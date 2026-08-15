-- ============================================================
-- XANDER Gestión SaaS — Esquema Supabase / PostgreSQL
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- Habilitar extensión UUID
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLA: profiles
-- Datos de empresa y configuración por usuario
-- ============================================================
create table public.profiles (
  id                    uuid references auth.users(id) on delete cascade primary key,
  -- Datos personales
  nombre                text,
  apellidos             text,
  dni_nie               text,
  telefono_personal     text,
  -- Datos empresa
  empresa_nombre        text,
  empresa_nif           text,
  empresa_direccion     text,
  empresa_cp            text,
  empresa_ciudad        text,
  empresa_email         text,
  empresa_telefono      text,
  empresa_web           text,
  -- Actividad
  fecha_inicio_actividad date,
  tarifa_reducida       boolean default false,
  especialidades        text[] default '{}',
  -- Branding
  logo_url              text,
  color_primario        text default '#1A1A2E',
  color_secundario      text default '#C9A84C',
  -- Estado
  onboarding_completado boolean default false,
  plan                  text default 'free', -- free | pro | estudio
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- RLS: solo el propio usuario puede ver/editar su perfil
alter table public.profiles enable row level security;

create policy "profiles: ver propio" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles: editar propio" on public.profiles
  for update using (auth.uid() = id);

create policy "profiles: insertar propio" on public.profiles
  for insert with check (auth.uid() = id);

-- Trigger: crear perfil vacío al registrarse
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Trigger: actualizar updated_at automáticamente
create or replace function public.update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute procedure public.update_updated_at();


-- ============================================================
-- TABLA: clientes
-- ============================================================
create table public.clientes (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  nombre      text not null,
  nif         text,
  direccion   text,
  cp          text,
  ciudad      text,
  email       text,
  telefono    text,
  notas       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.clientes enable row level security;

create policy "clientes: solo propios" on public.clientes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_clientes_user_id on public.clientes(user_id);

create trigger clientes_updated_at before update on public.clientes
  for each row execute procedure public.update_updated_at();


-- ============================================================
-- TABLA: obras
-- ============================================================
create table public.obras (
  id                  uuid default uuid_generate_v4() primary key,
  user_id             uuid references auth.users(id) on delete cascade not null,
  cliente_id          uuid references public.clientes(id) on delete set null,
  nombre              text not null,
  descripcion         text,
  estado              text default 'pendiente', -- pendiente|en_curso|pausada|completada|cancelada
  fecha_inicio        date,
  fecha_fin_prevista  date,
  fecha_fin_real      date,
  direccion_obra      text,
  presupuesto_total   numeric(10,2) default 0,
  coste_real          numeric(10,2) default 0,
  notas               text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

alter table public.obras enable row level security;

create policy "obras: solo propias" on public.obras
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_obras_user_id on public.obras(user_id);
create index idx_obras_cliente_id on public.obras(cliente_id);

create trigger obras_updated_at before update on public.obras
  for each row execute procedure public.update_updated_at();


-- ============================================================
-- TABLA: presupuestos
-- ============================================================
create table public.presupuestos (
  id            uuid default uuid_generate_v4() primary key,
  user_id       uuid references auth.users(id) on delete cascade not null,
  obra_id       uuid references public.obras(id) on delete set null,
  cliente_id    uuid references public.clientes(id) on delete set null,
  numero        text not null,
  referencia    text,
  fecha         date default current_date,
  validez_dias  integer default 30,
  estado        text default 'borrador', -- borrador|enviado|aceptado|rechazado|expirado
  items         jsonb default '[]',      -- [{titulo, detalle, importe}]
  iva           numeric(5,2) default 10,
  descuento     numeric(5,2) default 0,
  notas         text,
  no_incluido   jsonb default '[]',
  condiciones   jsonb default '[]',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table public.presupuestos enable row level security;

create policy "presupuestos: solo propios" on public.presupuestos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_presupuestos_user_id on public.presupuestos(user_id);
create index idx_presupuestos_obra_id on public.presupuestos(obra_id);
create index idx_presupuestos_cliente_id on public.presupuestos(cliente_id);

create trigger presupuestos_updated_at before update on public.presupuestos
  for each row execute procedure public.update_updated_at();


-- ============================================================
-- TABLA: facturas
-- ============================================================
create table public.facturas (
  id                uuid default uuid_generate_v4() primary key,
  user_id           uuid references auth.users(id) on delete cascade not null,
  obra_id           uuid references public.obras(id) on delete set null,
  cliente_id        uuid references public.clientes(id) on delete set null,
  presupuesto_id    uuid references public.presupuestos(id) on delete set null,
  numero            text not null,
  fecha             date default current_date,
  vencimiento       date,
  estado            text default 'borrador', -- borrador|enviada|vista|pagada|vencida
  items             jsonb default '[]',
  iva               numeric(5,2) default 10,
  descuento         numeric(5,2) default 0,
  retencion         numeric(5,2) default 0,
  notas             text,
  -- Tracking email
  email_enviado_at  timestamptz,
  email_visto_at    timestamptz,
  resend_message_id text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

alter table public.facturas enable row level security;

create policy "facturas: solo propias" on public.facturas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_facturas_user_id on public.facturas(user_id);
create index idx_facturas_obra_id on public.facturas(obra_id);
create index idx_facturas_cliente_id on public.facturas(cliente_id);
create index idx_facturas_estado on public.facturas(estado);

create trigger facturas_updated_at before update on public.facturas
  for each row execute procedure public.update_updated_at();


-- ============================================================
-- TABLA: tarifas
-- ============================================================
create table public.tarifas (
  id              uuid default uuid_generate_v4() primary key,
  user_id         uuid references auth.users(id) on delete cascade not null,
  categoria       text not null,
  descripcion     text not null,
  unidad          text default 'm²',
  coste_material  numeric(10,2) default 0,
  coste_mo        numeric(10,2) default 0,
  margen          numeric(5,2) default 38,
  precio_cliente  numeric(10,2) generated always as (
    round((coste_material + coste_mo) * (1 + margen/100), 2)
  ) stored,
  notas           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table public.tarifas enable row level security;

create policy "tarifas: solo propias" on public.tarifas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_tarifas_user_id on public.tarifas(user_id);
create index idx_tarifas_categoria on public.tarifas(categoria);

create trigger tarifas_updated_at before update on public.tarifas
  for each row execute procedure public.update_updated_at();


-- ============================================================
-- TABLA: calendario_notas
-- ============================================================
create table public.calendario_notas (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  fecha       date not null,
  titulo      text not null,
  descripcion text,
  tipo        text default 'trabajo', -- trabajo|reunion|cobro|recordatorio
  color       text default '#C9A84C',
  obra_id     uuid references public.obras(id) on delete set null,
  created_at  timestamptz default now()
);

alter table public.calendario_notas enable row level security;

create policy "calendario: solo propias" on public.calendario_notas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_calendario_user_id on public.calendario_notas(user_id);
create index idx_calendario_fecha on public.calendario_notas(fecha);


-- ============================================================
-- TARIFAS BASE (se copian al primer usuario en onboarding)
-- Tabla temporal de referencia, no por usuario
-- ============================================================
create table public.tarifas_base (
  id              uuid default uuid_generate_v4() primary key,
  categoria       text not null,
  descripcion     text not null,
  unidad          text default 'm²',
  coste_material  numeric(10,2) default 0,
  coste_mo        numeric(10,2) default 0,
  margen          numeric(5,2) default 38
);

-- Insertar tarifas base del sector reformas
insert into public.tarifas_base (categoria, descripcion, unidad, coste_material, coste_mo, margen) values
  -- DEMOLICIÓN
  ('Demolición', 'Levantado de alicatado', 'm²', 0, 13, 38),
  ('Demolición', 'Levantado de solado / pavimento', 'm²', 0, 10, 38),
  ('Demolición', 'Picado de enfoscado', 'm²', 0, 10, 38),
  ('Demolición', 'Demolición de tabiquería de ladrillo', 'm²', 0, 18, 38),
  ('Demolición', 'Retirada y gestión de escombros (contenedor)', 'ud', 180, 0, 38),
  -- ALBAÑILERÍA
  ('Albañilería', 'Enfoscado de paredes (mortero cementoso)', 'm²', 4, 10, 38),
  ('Albañilería', 'Tabiquería de ladrillo hueco', 'm²', 12, 22, 38),
  ('Albañilería', 'Tabiquería de Pladur estándar', 'm²', 14, 18, 38),
  ('Albañilería', 'Tabiquería de Pladur hidrófugo', 'm²', 18, 20, 38),
  ('Albañilería', 'Ornacina / nicho de Pladur hidrófugo (120 cm)', 'ud', 80, 270, 38),
  -- IMPERMEABILIZACIÓN
  ('Impermeabilización', 'Membrana Sika / impermeabilizante flexible (2 manos)', 'm²', 12, 10, 40),
  -- ALICATADOS Y SOLADOS
  ('Alicatados y Solados', 'Colocación de azulejo (material no incluido)', 'm²', 10, 24, 38),
  ('Alicatados y Solados', 'Colocación de gres / porcelánico (material no incluido)', 'm²', 10, 22, 38),
  ('Alicatados y Solados', 'Sistema autonivelante de suelo', 'm²', 5, 8, 38),
  -- FONTANERÍA
  ('Fontanería', 'Nuevo punto de suministro de agua', 'ud', 25, 70, 38),
  ('Fontanería', 'Modificación / desplazamiento de toma de agua', 'ud', 20, 60, 38),
  ('Fontanería', 'Instalación de plato de ducha (sin suministro)', 'ud', 0, 110, 38),
  ('Fontanería', 'Retirada de bañera / bidé', 'ud', 0, 80, 38),
  ('Fontanería', 'Desplazamiento de radiador / toallero', 'ud', 40, 180, 38),
  ('Fontanería', 'Instalación de inodoro (sin suministro)', 'ud', 0, 90, 38),
  -- ELECTRICIDAD
  ('Electricidad', 'Nuevo punto de luz', 'ud', 15, 45, 38),
  ('Electricidad', 'Nuevo enchufes / toma de corriente', 'ud', 12, 35, 38),
  ('Electricidad', 'Cuadro eléctrico (pequeña actualización)', 'ud', 80, 120, 38),
  -- PINTURA
  ('Pintura', 'Pintura plástica en paredes (2 manos)', 'm²', 3, 6, 38),
  ('Pintura', 'Pintura esmalte en carpintería', 'm²', 8, 12, 38),
  -- CARPINTERÍA Y REMATES
  ('Carpintería y Remates', 'Instalación de mampara de ducha (sin suministro)', 'ud', 0, 90, 38),
  ('Carpintería y Remates', 'Sellado técnico y remates generales', 'ud', 20, 60, 38),
  -- GESTIÓN Y LOGÍSTICA
  ('Gestión y Logística', 'Gestión de compra, acarreo y transporte de materiales', '%', 0, 0, 10),
  ('Gestión y Logística', 'Trabajos previos y protección de obra', 'ud', 30, 80, 38),
  -- REFORMAS INTEGRALES (precio global orientativo)
  ('Reforma Integral', 'Reforma integral baño pequeño hasta 5 m²', 'm²', 250, 450, 40),
  ('Reforma Integral', 'Reforma integral baño mediano 5-8 m²', 'm²', 220, 400, 40),
  ('Reforma Integral', 'Reforma integral cocina hasta 10 m²', 'm²', 300, 500, 42);
