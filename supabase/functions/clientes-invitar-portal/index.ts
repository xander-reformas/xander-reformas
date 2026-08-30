// Supabase Edge Function — clientes-invitar-portal
// Se invoca desde el frontend (botón "Invitar al portal" en Clientes).
// Crea (o reutiliza) una cuenta de acceso al Portal del Cliente para el
// email del cliente, vincula clientes.portal_user_id y le envía por email
// (vía Resend) un enlace para que cree su contraseña y entre a ver el
// estado de sus obras.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SITE_URL        = Deno.env.get('SITE_URL') || 'https://xander-reformas.vercel.app'

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

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message
  try { return JSON.stringify(err) } catch { return String(err) }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (!RESEND_API_KEY) {
      return json({ error: 'Falta configurar RESEND_API_KEY en Supabase → Edge Functions → Secrets.' }, 400)
    }

    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !userData?.user) return json({ error: 'No autenticado' }, 401)
    const user = userData.user

    const { cliente_id } = await req.json()
    if (!cliente_id) return json({ error: 'Falta cliente_id' }, 400)

    const { data: cliente, error: errC } = await supabase
      .from('clientes')
      .select('id, nombre, email, user_id, portal_user_id')
      .eq('id', cliente_id)
      .single()
    if (errC) throw errC
    if (!cliente) return json({ error: 'Cliente no encontrado' }, 404)
    if (cliente.user_id !== user.id) return json({ error: 'No autorizado' }, 403)

    const email = (cliente.email || '').trim()
    if (!email) {
      return json({ error: 'Este cliente no tiene email guardado. Añádelo en Clientes antes de invitarlo al portal.' }, 400)
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('empresa_nombre')
      .eq('id', user.id)
      .single()
    const empresaNombre = profile?.empresa_nombre || 'XANDER Gestión'

    const redirectTo = `${SITE_URL}/portal/set-password`

    // Primero probamos "invite" (crea la cuenta si no existe). Si el email ya
    // tiene una cuenta de Supabase Auth, caemos a "magiclink" para el mismo
    // usuario, así siempre conseguimos un enlace de acceso válido.
    let linkData
    let linkErr
    {
      const r = await supabase.auth.admin.generateLink({
        type: 'invite',
        email,
        options: { redirectTo },
      })
      linkData = r.data
      linkErr = r.error
    }
    if (linkErr) {
      const yaRegistrado = /already.*registered|already.*exists/i.test(linkErr.message || '')
      if (!yaRegistrado) {
        return json({ error: `No se pudo generar el enlace de invitación: ${linkErr.message}` }, 502)
      }
      const r = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo },
      })
      linkData = r.data
      linkErr = r.error
      if (linkErr) {
        return json({ error: `No se pudo generar el enlace de acceso: ${linkErr.message}` }, 502)
      }
    }

    const actionLink = linkData?.properties?.action_link || (linkData as unknown as { action_link?: string })?.action_link
    const portalUserId = linkData?.user?.id
    if (!actionLink || !portalUserId) {
      return json({ error: 'Supabase no devolvió un enlace de invitación válido.' }, 502)
    }

    const { error: errUpd } = await supabase
      .from('clientes')
      .update({ portal_user_id: portalUserId })
      .eq('id', cliente.id)
    if (errUpd) throw errUpd

    const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1A1A2E">
        <div style="background:#1A1A2E;padding:20px 28px;border-radius:12px 12px 0 0">
          <span style="font-size:22px;font-weight:900;color:#C9A84C">X</span>
          <span style="font-size:22px;font-weight:900;color:#fff">ANDER</span>
          <span style="font-size:11px;color:rgba(255,255,255,0.4);margin-left:8px;letter-spacing:2px">GESTIÓN</span>
        </div>
        <div style="background:#fff;border:1px solid #e5e0d8;border-top:none;padding:28px;border-radius:0 0 12px 12px">
          <p style="margin:0 0 4px;font-size:14px;color:#7a7a7a">Hola${cliente.nombre ? `, ${cliente.nombre}` : ''}</p>
          <h2 style="margin:0 0 16px;font-size:18px">Ya puedes seguir el estado de tu obra online</h2>
          <p style="font-size:14px;line-height:1.6;margin:0 0 20px">
            ${empresaNombre} te ha dado acceso a tu portal personal, donde podrás ver en cualquier momento
            en qué fase está tu obra, las fotos del progreso y las novedades que te vayamos compartiendo.
          </p>
          <div style="text-align:center;margin:28px 0">
            <a href="${actionLink}" style="background:#C9A84C;color:#1A1A2E;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:8px;display:inline-block;font-size:14px">
              Crear mi contraseña y entrar
            </a>
          </div>
          <p style="font-size:12px;color:#aaa;margin:20px 0 0;border-top:1px solid #e5e0d8;padding-top:12px">
            Este enlace es personal e intransferible. Si no esperabas este email, puedes ignorarlo.
          </p>
        </div>
      </div>
    `

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${empresaNombre} <avisos@xandergestion.com>`,
        to: email,
        subject: `Accede al estado de tu obra — ${empresaNombre}`,
        html,
      }),
    })

    const body = await resp.text()
    if (!resp.ok) {
      console.error('Resend error', resp.status, body)
      return json({ error: 'La cuenta del portal se creó, pero no se pudo enviar el email de invitación. Vuelve a intentarlo en unos minutos.' }, 502)
    }

    return json({ ok: true, email })
  } catch (err) {
    console.error(err)
    return json({ error: errMsg(err) }, 400)
  }
})
