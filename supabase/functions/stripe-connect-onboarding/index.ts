// Supabase Edge Function — stripe-connect-onboarding
// Se invoca desde el frontend (botón "Conectar con Stripe" en Mi Empresa).
// Crea (si hace falta) una cuenta Express de Stripe Connect para el
// suscriptor autenticado y devuelve una URL de onboarding alojada por
// Stripe para que verifique su identidad y su banco. El dinero de SUS
// facturas entrará directamente en esa cuenta, no en la de la plataforma.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    if (!STRIPE_SECRET_KEY) {
      return json({ error: 'Falta configurar STRIPE_SECRET_KEY en Supabase -> Edge Functions -> Secrets.' }, 400)
    }

    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !userData?.user) return json({ error: 'No autenticado' }, 401)
    const user = userData.user

    const { data: profile, error: perfErr } = await supabase
      .from('profiles')
      .select('id, stripe_account_id, nombre, apellidos')
      .eq('id', user.id)
      .single()
    if (perfErr) throw perfErr

    let accountId = profile?.stripe_account_id as string | null

    if (!accountId) {
      // Crear cuenta Express nueva para este suscriptor
      const body = new URLSearchParams()
      body.set('type', 'express')
      body.set('country', 'ES')
      if (user.email) body.set('email', user.email)
      body.set('capabilities[card_payments][requested]', 'true')
      body.set('capabilities[transfers][requested]', 'true')
      body.set('business_type', 'individual')

      const accRes = await fetch('https://api.stripe.com/v1/accounts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      })
      const account = await accRes.json()
      if (!accRes.ok) throw new Error(account?.error?.message || 'Error creando la cuenta de Stripe')

      accountId = account.id
      await supabase.from('profiles').update({ stripe_account_id: accountId }).eq('id', user.id)
    }

    // Generar enlace de onboarding (caduca en unos minutos, se puede regenerar)
    const linkBody = new URLSearchParams()
    linkBody.set('account', accountId!)
    linkBody.set('refresh_url', `${SITE_URL}/dashboard/mi-empresa?stripe=refresh`)
    linkBody.set('return_url', `${SITE_URL}/dashboard/mi-empresa?stripe=return`)
    linkBody.set('type', 'account_onboarding')

    const linkRes = await fetch('https://api.stripe.com/v1/account_links', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: linkBody,
    })
    const link = await linkRes.json()
    if (!linkRes.ok) throw new Error(link?.error?.message || 'Error generando el enlace de onboarding')

    return json({ url: link.url })
  } catch (err) {
    console.error(err)
    return json({ error: String(err instanceof Error ? err.message : err) }, 400)
  }
})
