// Supabase Edge Function — stripe-webhook
// Endpoint público que Stripe llama cuando cambia el estado de un pago.
// Recibe eventos de DOS destinos distintos configurados en Stripe, cada
// uno con su propia firma:
//   - "Tu cuenta" (cobros de la propia plataforma: facturas con Stripe
//     Connect Direct charge NO llegan aquí — ver más abajo — y la cuota
//     de suscripción Pro de los suscriptores, que sí es de "Tu cuenta")
//   - "Cuentas conectadas" (los cobros de cada suscriptor a SUS clientes,
//     vía Connect)
//
// Dos flujos distintos según el evento:
//   1. checkout.session.completed con metadata.factura_id → marca esa
//      factura como pagada (cobro de un suscriptor a su cliente).
//   2. checkout.session.completed con mode="subscription" y
//      metadata.tipo="suscripcion_pro" → activa el plan Pro del
//      suscriptor que acaba de pagar la cuota de XANDER Gestión.
//   3. customer.subscription.deleted → cuando esa suscripción termina
//      (impago definitivo o cancelación), el suscriptor vuelve a "free".
//
// Configurar en Stripe → Developers → Webhooks, dos destinos apuntando
// a la misma URL:
//   https://ligpevuofniwzuujjgor.supabase.co/functions/v1/stripe-webhook
//   Eventos en "Tu cuenta": checkout.session.completed,
//     customer.subscription.deleted
//   Eventos en "Cuentas conectadas": checkout.session.completed
//
// Requiere los secretos STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (firma
// del destino "Tu cuenta") y STRIPE_CONNECT_WEBHOOK_SECRET (firma del
// destino "Cuentas conectadas") en Supabase → Edge Functions → Secrets.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@17?target=deno'

const SUPABASE_URL                  = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY                  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const STRIPE_SECRET_KEY             = Deno.env.get('STRIPE_SECRET_KEY')!
const STRIPE_WEBHOOK_SECRET         = Deno.env.get('STRIPE_WEBHOOK_SECRET')!
const STRIPE_CONNECT_WEBHOOK_SECRET = Deno.env.get('STRIPE_CONNECT_WEBHOOK_SECRET') || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })

// Programa de referidos: si el usuario que acaba de hacerse Pro (referidoId)
// fue invitado por otro suscriptor, se marca el referido como "convertido" y
// se intenta dar un mes gratis (crédito de 19€) a quien le invitó. Si el
// referidor todavía no tiene cuenta de facturación en Stripe (nunca ha
// pagado), el crédito queda pendiente y se puede aplicar manualmente más
// adelante.
async function recompensarReferido(referidoId: string) {
  const { data: refRow } = await supabase
    .from('referidos')
    .select('id, referrer_id, recompensa_aplicada')
    .eq('referido_id', referidoId)
    .maybeSingle()

  if (!refRow || refRow.recompensa_aplicada) return

  const { data: referrer } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', refRow.referrer_id)
    .single()

  let aplicada = false
  let detalle = 'Pendiente: el referidor todavía no tiene cuenta de facturación en Stripe.'

  if (referrer?.stripe_customer_id) {
    const balBody = new URLSearchParams()
    balBody.set('amount', '-1900')
    balBody.set('currency', 'eur')
    balBody.set('description', 'Recompensa por referido — 1 mes gratis de XANDER Pro')
    const balRes = await fetch(
      `https://api.stripe.com/v1/customers/${referrer.stripe_customer_id}/balance_transactions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: balBody,
      }
    )
    aplicada = balRes.ok
    detalle = aplicada
      ? 'Crédito de 19€ aplicado al saldo de Stripe del referidor.'
      : 'Error aplicando el crédito en Stripe — revisar manualmente.'
    if (!aplicada) console.error('Error crédito referido:', await balRes.text())
  }

  await supabase.from('referidos').update({
    estado: 'convertido',
    convertido_at: new Date().toISOString(),
    recompensa_aplicada: aplicada,
    recompensa_detalle: detalle,
  }).eq('id', refRow.id)
}

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const body = await req.text()

  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    console.error('Faltan STRIPE_SECRET_KEY o STRIPE_WEBHOOK_SECRET en los secretos de la función')
    return new Response('Webhook no configurado', { status: 500 })
  }

  // El evento puede venir firmado con el secreto de "Tu cuenta" o con el
  // de "Cuentas conectadas" — probamos los dos.
  let event: Stripe.Event | null = null
  for (const secret of [STRIPE_WEBHOOK_SECRET, STRIPE_CONNECT_WEBHOOK_SECRET]) {
    if (!secret) continue
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature!, secret)
      break
    } catch (_err) {
      // probar el siguiente secreto
    }
  }
  if (!event) {
    console.error('Firma de webhook inválida (no coincide con ningún secreto configurado)')
    return new Response('Firma inválida', { status: 400 })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session

      if (session.mode === 'subscription' && session.metadata?.tipo === 'suscripcion_pro') {
        // Cuota Pro de un suscriptor de XANDER Gestión
        const userId = session.metadata?.user_id
        if (userId) {
          await supabase.from('profiles').update({
            plan: session.metadata?.ciclo === 'anual' ? 'pro_annual' : 'pro',
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
            plan_expires_at: null,
          }).eq('id', userId)

          // Programa de referidos: si quien se acaba de hacer Pro fue
          // invitado por alguien, se le da un mes gratis (crédito de 19€
          // en el saldo de Stripe) a quien le invitó.
          await recompensarReferido(userId)
        }
      } else {
        // Cobro de un suscriptor a uno de sus clientes (factura)
        const facturaId = session.metadata?.factura_id
        if (facturaId) {
          await supabase.from('facturas').update({
            estado: 'pagada',
            stripe_pagado_at: new Date().toISOString(),
          }).eq('id', facturaId)
        }
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string
      await supabase.from('profiles').update({
        plan: 'free',
        plan_expires_at: null,
        stripe_subscription_id: null,
      }).eq('stripe_customer_id', customerId)
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 })
  } catch (err) {
    console.error(err)
    return new Response(String(err), { status: 500 })
  }
})
