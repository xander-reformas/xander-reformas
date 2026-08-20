// Supabase Edge Function — stripe-crear-cobro
// Se invoca desde el frontend (botón "💳 Cobrar con tarjeta" en Facturas).
// Crea una Stripe Checkout Session EN LA CUENTA STRIPE CONNECT del
// suscriptor dueño de la factura (Direct charge vía header Stripe-Account),
// para que el dinero del cliente entre directo en SU banco, no en el de
// la plataforma. Requiere que el suscriptor haya conectado su cuenta
// (profiles.stripe_account_id + stripe_charges_enabled = true).
//
// Requiere el secreto STRIPE_SECRET_KEY (clave de la PLATAFORMA, la misma
// que gestiona las conexiones) configurado en Supabase → Edge Functions →
// Secrets. Si no está configurado, la función devuelve un error explicativo.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY       = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const STRIPE_SECRET_KEY  = Deno.env.get('STRIPE_SECRET_KEY')
const SITE_URL           = Deno.env.get('SITE_URL') || 'https://xander-reformas.vercel.app'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function calcularTotal(items: Array<Record<string, unknown>>, iva: number, descuento: number, retencion: number) {
  const base = (items || []).reduce((s, i) => s + (parseFloat(String(i.importe)) || 0), 0)
  const dto = base * (descuento || 0) / 100
  const baseConDto = base - dto
  const ivaImporte = baseConDto * (iva || 0) / 100
  const retImporte = baseConDto * (retencion || 0) / 100
  return baseConDto + ivaImporte - retImporte
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (!STRIPE_SECRET_KEY) {
      return new Response(
        JSON.stringify({ error: 'Falta configurar STRIPE_SECRET_KEY en Supabase → Edge Functions → Secrets.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { factura_id } = await req.json()
    if (!factura_id) throw new Error('Falta factura_id')

    const { data: factura, error: errF } = await supabase
      .from('facturas')
      .select('id, numero, items, iva, descuento, retencion, estado, cliente_id, user_id, clientes(nombre, email)')
      .eq('id', factura_id)
      .single()
    if (errF) throw errF
    if (!factura) throw new Error('Factura no encontrada')
    if (factura.estado === 'pagada') {
      return new Response(JSON.stringify({ error: 'Esta factura ya está marcada como pagada.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: propietario, error: errP } = await supabase
      .from('profiles')
      .select('stripe_account_id, stripe_charges_enabled')
      .eq('id', factura.user_id)
      .single()
    if (errP) throw errP
    if (!propietario?.stripe_account_id || !propietario.stripe_charges_enabled) {
      return new Response(JSON.stringify({
        error: 'Todavía no has conectado tu cuenta de Stripe. Ve a Mi Empresa → Cobros online para conectarla (tarda 5 minutos) antes de poder cobrar con tarjeta.',
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const stripeAccountId = propietario.stripe_account_id as string

    const total = calcularTotal(factura.items || [], factura.iva, factura.descuento, factura.retencion)
    if (total <= 0) throw new Error('El importe de la factura debe ser mayor que 0')

    const clienteEmail = (factura as unknown as { clientes?: { email?: string } }).clientes?.email

    const body = new URLSearchParams()
    body.set('mode', 'payment')
    body.set('line_items[0][quantity]', '1')
    body.set('line_items[0][price_data][currency]', 'eur')
    body.set('line_items[0][price_data][unit_amount]', String(Math.round(total * 100)))
    body.set('line_items[0][price_data][product_data][name]', `Factura ${factura.numero}`)
    body.set('success_url', `${SITE_URL}/dashboard/facturas?pago=ok`)
    body.set('cancel_url', `${SITE_URL}/dashboard/facturas?pago=cancelado`)
    body.set('metadata[factura_id]', factura.id)
    if (clienteEmail) body.set('customer_email', clienteEmail)

    // Direct charge: la sesión se crea EN la cuenta conectada del suscriptor
    // (cabecera Stripe-Account) para que el dinero del cliente vaya a su banco.
    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Account': stripeAccountId,
      },
      body,
    })
    const session = await stripeRes.json()
    if (!stripeRes.ok) throw new Error(session?.error?.message || 'Error creando la sesión de pago en Stripe')

    await supabase.from('facturas').update({
      stripe_checkout_id: session.id,
      stripe_payment_url: session.url,
    }).eq('id', factura.id)

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: String(err instanceof Error ? err.message : err) }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
