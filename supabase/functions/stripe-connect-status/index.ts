// Supabase Edge Function — stripe-connect-status
// Se invoca desde el frontend al volver del onboarding de Stripe (o al
// abrir "Mi Empresa"). Consulta el estado real de la cuenta conectada
// del suscriptor contra la API de Stripe y actualiza profiles.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')

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
    if (!STRIPE_SECRET_KEY) {
      return json({ error: 'Falta configurar STRIPE_SECRET_KEY en Supabase -> Edge Functions -> Secrets.' }, 400)
    }

    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !userData?.user) return json({ error: 'No autenticado' }, 401)

    const { data: profile, error: perfErr } = await supabase
      .from('profiles')
      .select('stripe_account_id, stripe_charges_enabled')
      .eq('id', userData.user.id)
      .single()
    if (perfErr) throw perfErr

    if (!profile?.stripe_account_id) {
      return json({ connected: false, charges_enabled: false })
    }

    const accRes = await fetch(`https://api.stripe.com/v1/accounts/${profile.stripe_account_id}`, {
      headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` },
    })
    const account = await accRes.json()
    if (!accRes.ok) throw new Error(account?.error?.message || 'Error consultando la cuenta de Stripe')

    const chargesEnabled = !!account.charges_enabled

    await supabase.from('profiles').update({
      stripe_charges_enabled: chargesEnabled,
      stripe_connected_at: chargesEnabled ? new Date().toISOString() : null,
    }).eq('id', userData.user.id)

    return json({
      connected: true,
      charges_enabled: chargesEnabled,
      details_submitted: !!account.details_submitted,
    })
  } catch (err) {
    console.error(err)
    return json({ error: String(err instanceof Error ? err.message : err) }, 400)
  }
})
