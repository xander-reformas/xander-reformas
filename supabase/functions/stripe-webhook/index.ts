// Supabase Edge Function — stripe-webhook
// Endpoint público que Stripe llama cuando cambia el estado de un pago.
// Al recibir "checkout.session.completed" marca la factura correspondiente
// como pagada. Recibe eventos de DOS destinos distintos configurados en
// Stripe, cada uno con su propia firma:
//   - "Tu cuenta" (los cobros de la propia plataforma)
//   - "Cuentas conectadas" (los cobros de cada suscriptor vía Connect)
//
// Configurar en Stripe → Developers → Webhooks, dos destinos apuntando
// a la misma URL:
//   https://ligpevuofniwzuujjgor.supabase.co/functions/v1/stripe-webhook
//   Evento en ambos: checkout.session.completed
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
      const facturaId = session.metadata?.factura_id
      if (facturaId) {
        await supabase.from('facturas').update({
          estado: 'pagada',
          stripe_pagado_at: new Date().toISOString(),
        }).eq('id', facturaId)
      }
    }
    return new Response(JSON.stringify({ received: true }), { status: 200 })
  } catch (err) {
    console.error(err)
    return new Response(String(err), { status: 500 })
  }
})
