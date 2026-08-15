# XANDER Gestión — SaaS para Autónomos de Reformas

## Visión del producto

Herramienta de gestión integral para autónomos del sector de reformas de interior. Sustituto/complemento de la gestoría tradicional, diseñado específicamente para el flujo de trabajo real de un reformista: presupuestos por partidas, seguimiento de obras, facturación con IVA reducido, tarifas orientativas y análisis de rentabilidad.

**Modelo de negocio:** Freemium. Beta gratuita para validar → plan de pago por suscripción mensual/anual.

---

## Stack Técnico

| Capa | Tecnología | Motivo |
|------|-----------|--------|
| Frontend | React 18 + Vite | Rápido, moderno, reutilizable |
| Estilos | Tailwind CSS | Utility-first, consistente |
| Backend / DB | Supabase (PostgreSQL) | Auth + DB + Storage + RLS out-of-the-box |
| Email | Resend API | GDPR compliant, fiable, gratuito hasta 3.000 emails/mes |
| PDF | react-pdf | Generación de PDFs branded en cliente |
| Hosting | Vercel (frontend) + Supabase Cloud (backend) | Free tier generoso para beta |
| Pagos (fase 3) | Stripe | Estándar europeo |

---

## Colores de marca (heredados de XANDER)

```
Navy:  #1A1A2E   (primario)
Gold:  #C9A84C   (acento)
Arena: #F0EBE0   (fondo claro)
Stone: #5C5248   (texto secundario)
```

---

## Base de datos — Tablas principales

### `profiles` (datos de empresa por usuario)
- id → FK auth.users
- empresa_nombre, empresa_nif, empresa_direccion, empresa_cp, empresa_ciudad
- empresa_email, empresa_telefono, empresa_web
- logo_url, color_primario, color_secundario
- fecha_inicio_actividad → para calcular tarifa plana autónomo
- tarifa_reducida (boolean calculado)
- especialidades (array: reformas_integrales, banos, cocinas, pintura, etc.)
- onboarding_completado (boolean)
- created_at

### `clientes`
- id, user_id, nombre, nif, direccion, cp, ciudad, email, telefono, notas
- created_at, updated_at

### `obras`
- id, user_id, cliente_id, nombre, descripcion, estado
- fecha_inicio, fecha_fin_prevista, fecha_fin_real
- direccion_obra, presupuesto_total, coste_real
- notas, created_at

### `presupuestos`
- id, user_id, obra_id, cliente_id, numero, referencia
- fecha, validez_dias, estado (borrador/enviado/aceptado/rechazado)
- items (JSONB: [{titulo, detalle, importe}])
- iva, descuento, notas
- created_at

### `facturas`
- id, user_id, obra_id, cliente_id, presupuesto_id
- numero, fecha, vencimiento, estado (borrador/enviada/vista/pagada/vencida)
- items (JSONB), iva, descuento, retencion, notas
- email_enviado_at, email_visto_at
- created_at

### `tarifas`
- id, user_id, categoria, descripcion, unidad
- coste_material, coste_mo, margen, precio_cliente
- created_at

### `calendario_notas`
- id, user_id, fecha, titulo, descripcion
- tipo (trabajo/reunion/cobro/recordatorio), color
- created_at

---

## Fases de desarrollo

### FASE 1 — Fundación (actual)
- [ ] Scaffolding React + Vite + Tailwind
- [ ] Esquema SQL Supabase + RLS
- [ ] Páginas auth: Login, Registro, Recuperar contraseña
- [ ] Wizard onboarding (5 pasos)
- [ ] Dashboard shell con sidebar y navegación
- [ ] Calendario colapsable con notas

### FASE 2 — Funcionalidades core
- [ ] Migración de toda la lógica de XANDER_Gestion.html
- [ ] Módulo Clientes (CRUD completo)
- [ ] Módulo Obras (CRUD + estados)
- [ ] Módulo Presupuestos (generación PDF branded)
- [ ] Módulo Facturas (generación PDF + envío email)
- [ ] Módulo Tarifas (tabla de precios editable)
- [ ] Herramienta de importación (JSON backup app actual → Supabase)

### FASE 3 — Monetización y extras
- [ ] Modelo de pago Stripe (plan Free / Pro / Estudio)
- [ ] Política de privacidad + Términos de uso (RGPD/LOPDGDD)
- [ ] Panel de administración
- [ ] Notificaciones: facturas vencidas, presupuestos por vencer
- [ ] Envío email facturas con tracking de apertura (Resend)
- [ ] Dashboard de rentabilidad por obra y global

---

## Onboarding — 5 pasos

1. **Datos personales** — Nombre, apellidos, DNI/NIE, teléfono
2. **Empresa** — Nombre comercial, NIF/CIF, dirección fiscal, email, teléfono
3. **Actividad** — Fecha de inicio → detecta tarifa plana reducida autónomo:
   - Año 1: tarifa plana (actualmente ~80 €/mes)
   - Año 2: tarifa reducida progresiva
   - Año 3+: tarifa general por tramos de ingresos
4. **Branding** — Subida de logo, colores corporativos (con preview)
5. **Especialidades** — Multi-select: reformas integrales, baños, cocinas, pintura, pladur, electricidad, fontanería, etc.

---

## Envío de facturas por email

Flujo:
1. Usuario pulsa "Enviar factura" en la fila o en el detalle
2. Modal: email pre-cargado del cliente, asunto automático, cuerpo editable
3. Sistema genera PDF de la factura al momento
4. Resend API envía el email con PDF adjunto
5. Estado factura → "Enviada" + timestamp
6. Webhook Resend notifica apertura → estado → "Vista"

---

## Seguridad y RGPD

- Supabase Row Level Security (RLS): cada usuario solo accede a sus datos
- SSL/TLS en todas las comunicaciones (Supabase + Vercel)
- Contraseñas gestionadas por Supabase Auth (bcrypt)
- Datos en servidores UE (Supabase Frankfurt)
- Política de privacidad + cookies obligatoria en fase 3
- Derecho al olvido: botón "Eliminar cuenta y todos mis datos"

---

## Migración desde app actual

Script de importación que lee el JSON de backup de XANDER_Gestion.html y crea:
- Todos los clientes → tabla `clientes`
- Todas las obras → tabla `obras`
- Todos los presupuestos → tabla `presupuestos`
- Todas las facturas → tabla `facturas`
- Todas las tarifas → tabla `tarifas`

El primer usuario (Alexander) tendrá todos sus datos el día 1.
