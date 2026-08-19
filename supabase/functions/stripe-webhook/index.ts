// Supabase Edge Function — stripe-webhook
// Endpoint público que Stripe llama cuando cambia el estado de un pago.
// Al recibir "checkout.session.completed" marca la factura correspondiente
// como pagada.
//
// Configurar en Stripe → Developers → Webhooks:
//   URL:    https://ligpevuofniwzuujjgor.supabase.co/functions/v1/stripe-webhook
//   Evento: checkout.session.completed
//
// Requiere los secretos STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET
// (este último lo genera Stripe al crear el webhook) en Supabase →
// Edge Functions → Secrets.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@17?target=deno'

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY          = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const STRIPE_SECRET_KEY     = Deno.env.get('STRIPE_SECRET_KEY')!
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const body = await req.text()

  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    console.error('Faltan STRIPE_SECRET_KEY o STRIPE_WEBHOOK_SECRET en los secretos de la función')
    return new Response('Webhook no configurado', { status: 500 })
  }

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Firma de webhook inválida:', err)
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
