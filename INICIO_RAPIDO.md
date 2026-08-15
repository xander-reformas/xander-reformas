# XANDER Gestión SaaS — Guía de inicio rápido

## Requisitos previos
- Node.js 18+ instalado (https://nodejs.org)
- Cuenta en Supabase (https://supabase.com) — gratuita

---

## Paso 1 — Crear proyecto en Supabase

1. Entra en https://supabase.com y crea una cuenta
2. Clic en "New project"
3. Nombre: `xander-gestion`
4. Elige región: `Frankfurt (EU Central)` → cumple RGPD
5. Guarda la contraseña de BD en algún lugar seguro
6. Espera 1-2 minutos a que se cree el proyecto

---

## Paso 2 — Ejecutar el esquema de base de datos

1. En tu proyecto Supabase → menú izquierdo → "SQL Editor"
2. Clic en "New query"
3. Abre el archivo `supabase/schema.sql` de esta carpeta
4. Copia todo el contenido y pégalo en el editor
5. Clic en "Run" (▶)
6. Debería decir "Success" al final

---

## Paso 3 — Configurar credenciales

1. En Supabase → Settings → API
2. Copia "Project URL" y "anon public" key
3. En esta carpeta, copia `.env.example` como `.env`
4. Pega las credenciales:
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJxxx...
   ```

---

## Paso 4 — Instalar y arrancar

Abre una terminal en esta carpeta y ejecuta:

```bash
npm install
npm run dev
```

La app se abrirá en http://localhost:3000

---

## Paso 5 — Primer usuario (Alexander)

1. Ve a http://localhost:3000/registro
2. Crea tu cuenta con tu email
3. Confirma el email (revisa la bandeja)
4. Completa el wizard de onboarding con los datos de tu empresa
5. ¡Listo! Ya estás en el dashboard

---

## Importar datos de la app actual

*(Disponible en Fase 2)*

Exporta un backup desde XANDER_Gestion.html → Importar en la nueva app → Todos tus clientes, obras, presupuestos y facturas estarán listos.

---

## Estructura del proyecto

```
XANDER-SaaS/
├── src/
│   ├── components/
│   │   ├── auth/          → Login, Registro
│   │   ├── onboarding/    → Wizard 5 pasos
│   │   ├── dashboard/     → Dashboard + Calendario
│   │   ├── clientes/      → (Fase 2)
│   │   ├── obras/         → (Fase 2)
│   │   ├── presupuestos/  → (Fase 2)
│   │   ├── facturas/      → (Fase 2)
│   │   └── tarifas/       → (Fase 2)
│   ├── hooks/useAuth.js   → Autenticación
│   └── lib/supabase.js    → Cliente BD
├── supabase/schema.sql    → Esquema de BD
├── PROYECTO.md            → Especificaciones completas
└── INICIO_RAPIDO.md       → Esta guía
```
