// Supabase Edge Function — obras-notificar-actualizacion
// Se invoca desde el frontend (Obras.jsx) justo después de cambiar la etapa
// de una obra o de añadir una nota de seguimiento marcada como visible para
// el cliente. Si el cliente tiene email guardado, le avisa por correo con
// la novedad y un enlace a su Portal del Cliente.
// Si el cliente no tiene email, o no hay nada que enviar, no es un error:
// simplemente no se envía nada (se devuelve ok:true, skipped:true).

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
      // No es crítico para el flujo del profesional: no rompemos su guardado.
      return json({ ok: true, skipped: true, motivo: 'RESEND_API_KEY no configurada' })
    }

    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !userData?.user) return json({ error: 'No autenticado' }, 401)
    const user = userData.user

    const { obra_id, tipo, mensaje } = await req.json()
    if (!obra_id || !mensaje) return json({ error: 'Falta obra_id o mensaje' }, 400)

    const { data: obra, error: errO } = await supabase
      .from('obras')
      .select('id, nombre, etapa, user_id, clientes(nombre, email)')
      .eq('id', obra_id)
      .single()
    if (errO) throw errO
    if (!obra) return json({ error: 'Obra no encontrada' }, 404)
    if (obra.user_id !== user.id) return json({ error: 'No autorizado' }, 403)

    const email = (obra as unknown as { clientes?: { email?: string } }).clientes?.email
    if (!email) {
      return json({ ok: true, skipped: true, motivo: 'El cliente de esta obra no tiene email guardado' })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('empresa_nombre')
      .eq('id', user.id)
      .single()
    const empresaNombre = profile?.empresa_nombre || 'XANDER Gestión'
    const nombreCliente = (obra as unknown as { clientes?: { nombre?: string } }).clientes?.nombre

    const esEtapa = tipo === 'etapa'
    const titulo = esEtapa ? 'Nueva etapa en tu obra' : 'Nueva novedad en tu obra'

    const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1A1A2E">
        <div style="background:#1A1A2E;padding:20px 28px;border-radius:12px 12px 0 0">
          <span style="font-size:22px;font-weight:900;color:#C9A84C">X</span>
          <span style="font-size:22px;font-weight:900;color:#fff">ANDER</span>
          <span style="font-size:11px;color:rgba(255,255,255,0.4);margin-left:8px;letter-spacing:2px">GESTIÓN</span>
        </div>
        <div style="background:#fff;border:1px solid #e5e0d8;border-top:none;padding:28px;border-radius:0 0 12px 12px">
          <p style="margin:0 0 4px;font-size:14px;color:#7a7a7a">Hola${nombreCliente ? `, ${nombreCliente}` : ''}</p>
          <h2 style="margin:0 0 4px;font-size:18px">${titulo}</h2>
          <div style="font-size:12px;color:#7a7a7a;margin-bottom:16px">${obra.nombre}${obra.etapa ? ` · Etapa actual: ${obra.etapa}` : ''}</div>
          <div style="background:#f8f5f0;border-left:4px solid #C9A84C;padding:16px 20px;border-radius:4px;margin-bottom:24px;font-size:14px;white-space:pre-line">
            ${mensaje}
          </div>
          <div style="text-align:center;margin:24px 0 8px">
            <a href="${SITE_URL}/portal" style="background:#C9A84C;color:#1A1A2E;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:8px;display:inline-block;font-size:13px">
              Ver el estado completo de mi obra
            </a>
          </div>
          <p style="font-size:11px;color:#aaa;margin:20px 0 0;border-top:1px solid #e5e0d8;padding-top:12px">
            Este aviso fue generado automáticamente por ${empresaNombre} desde XANDER Gestión.
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
        subject: `${titulo}: ${obra.nombre}`,
        html,
      }),
    })

    const body = await resp.text()
    if (!resp.ok) {
      console.error('Resend error', resp.status, body)
      return json({ ok: false, error: 'No se pudo enviar el aviso al cliente.' }, 502)
    }

    return json({ ok: true, to: email })
  } catch (err) {
    console.error(err)
    return json({ error: errMsg(err) }, 400)
  }
})
