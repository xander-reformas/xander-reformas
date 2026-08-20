// Supabase Edge Function — stripe-crear-checkout-suscripcion
// Se invoca desde el frontend (botón "Actualizar a Pro" en Mi Empresa).
// Crea una Stripe Checkout Session en modo SUSCRIPCIÓN, EN LA CUENTA DE
// LA PLATAFORMA (sin cabecera Stripe-Account, a diferencia de
// stripe-crear-cobro) para cobrar la cuota de XANDER Gestión al
// suscriptor autenticado. Crea el Customer de Stripe la primera vez y
// lo guarda en profiles.stripe_customer_id.
//
// Requiere el secreto STRIPE_SECRET_KEY (clave de la PLATAFORMA) en
// Supabase → Edge Functions → Secrets.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Los errores de Postgrest/Supabase no son instancias de Error (son objetos
// planos { message, details, hint, code }), así que String(err) los
// convierte en el inútil "[object Object]". Este helper extrae siempre un
// mensaje legible, venga de donde venga el error.
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

// Precio orientativo — mantener sincronizado con PRECIO_PRO en src/hooks/usePlan.js
const PRECIO_CENTIMOS: Record<string, number> = { mensual: 1900, anual: 19000 } // 19€/mes · 190€/año (2 meses gratis)
const INTERVALO: Record<string, string> = { mensual: 'month', anual: 'year' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (!STRIPE_SECRET_KEY) {
      return json({ error: 'Falta configurar STRIPE_SECRET_KEY en Supabase -> Edge Functions -> Secrets.' }, 400)
    }

    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userErr } = await supabase.auth.getUser(token)
    if (userErr) return json({ error: 'Auth error: ' + errMsg(userErr) }, 401)
    if (!userData?.user) return json({ error: 'No autenticado' }, 401)
    const user = userData.user

    const body_in = await req.json().catch(() => ({}))
    const clave = body_in?.ciclo === 'anual' ? 'anual' : 'mensual'

    const { data: profile, error: perfErr } = await supabase
      .from('profiles')
      .select('id, stripe_customer_id, empresa_nombre, nombre')
      .eq('id', user.id)
      .single()
    if (perfErr) return json({ error: 'DB profiles: ' + errMsg(perfErr) }, 400)

    let customerId = profile?.stripe_customer_id as string | null

    if (!customerId) {
      const custBody = new URLSearchParams()
      if (user.email) custBody.set('email', user.email)
      custBody.set('name', profile?.empresa_nombre || profile?.nombre || user.email || '')
      custBody.set('metadata[user_id]', user.id)

      const custRes = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: custBody,
      })
      const customer = await custRes.json()
      if (!custRes.ok) return json({ error: 'Stripe customer: ' + errMsg(customer?.error || customer) }, 400)
      customerId = customer.id
      const { error: updErr } = await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
      if (updErr) return json({ error: 'DB update: ' + errMsg(updErr) }, 400)
    }

    const body = new URLSearchParams()
    body.set('mode', 'subscription')
    body.set('customer', customerId!)
    body.set('line_items[0][quantity]', '1')
    body.set('line_items[0][price_data][currency]', 'eur')
    body.set('line_items[0][price_data][unit_amount]', String(PRECIO_CENTIMOS[clave]))
    body.set('line_items[0][price_data][recurring][interval]', INTERVALO[clave])
    body.set('line_items[0][price_data][product_data][name]', `XANDER Gestión Pro (${clave === 'anual' ? 'anual' : 'mensual'})`)
    body.set('success_url', `${SITE_URL}/dashboard/mi-empresa?suscripcion=ok`)
    body.set('cancel_url', `${SITE_URL}/dashboard/mi-empresa?suscripcion=cancelado`)
    body.set('metadata[user_id]', user.id)
    body.set('metadata[tipo]', 'suscripcion_pro')
    body.set('metadata[ciclo]', clave)
    body.set('subscription_data[metadata][user_id]', user.id)

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    })
    const session = await stripeRes.json()
    if (!stripeRes.ok) return json({ error: 'Stripe checkout: ' + errMsg(session?.error || session) }, 400)

    return json({ url: session.url })
  } catch (err) {
    console.error(err)
    return json({ error: 'Unhandled: ' + errMsg(err) }, 400)
  }
})
