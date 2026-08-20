// Supabase Edge Function — stripe-portal-suscripcion
// Se invoca desde "Gestionar suscripción" en Mi Empresa. Genera un enlace
// al Portal de Cliente de Stripe (alojado por Stripe) donde el suscriptor
// puede ver sus facturas, cambiar la tarjeta o cancelar su plan Pro por
// su cuenta, sin que XANDER tenga que gestionarlo manualmente.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Los errores de Postgrest/Supabase no son instancias de Error, así que
// String(err) los convierte en el inútil "[object Object]". Ver el mismo
// helper en stripe-crear-checkout-suscripcion/index.ts.
function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    return String(e.message || e.details || e.hint || JSON.stringify(err))
  }
  return String(err)
}

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
const SITE_URL          = Deno.env.get('SITE_URL') || 'https://xander-reformas.vercel.app'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (!STRIPE_SECRET_KEY) return json({ error: 'Falta configurar STRIPE_SECRET_KEY.' }, 400)

    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !userData?.user) return json({ error: 'No autenticado' }, 401)

    const { data: profile, error: perfErr } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userData.user.id)
      .single()
    if (perfErr) return json({ error: 'DB profiles: ' + errMsg(perfErr) }, 400)
    if (!profile?.stripe_customer_id) {
      return json({ error: 'Todavía no tienes una suscripción de pago activa.' }, 400)
    }

    const body = new URLSearchParams()
    body.set('customer', profile.stripe_customer_id)
    body.set('return_url', `${SITE_URL}/dashboard/mi-empresa`)

    const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    })
    const session = await res.json()
    if (!res.ok) throw new Error(session?.error?.message || 'Error abriendo el portal de facturación')

    return json({ url: session.url })
  } catch (err) {
    console.error(err)
    return json({ error: 'Unhandled: ' + errMsg(err) }, 400)
  }
})
