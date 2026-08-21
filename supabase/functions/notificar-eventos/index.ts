// Supabase Edge Function — notificar-eventos
// Se ejecuta cada 15 minutos via pg_cron
// Envía emails con Resend cuando un evento está a 24h o 1h

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY  = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Los errores de Postgrest/Supabase no son instancias de Error: String(err)
// devuelve "[object Object]" y oculta la causa real. Serializamos a mano.
function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message
  try { return JSON.stringify(err) } catch { return String(err) }
}

Deno.serve(async () => {
  try {
    const ahora = new Date()

    // Buscar eventos con alerta activa y fecha en las próximas ~25h (margen).
    // OJO: no se puede hacer un embed `profiles:user_id(email, nombre)` aquí —
    // calendario_eventos.user_id referencia auth.users(id), no public.profiles(id),
    // y profiles no tiene columna email. Cargamos nombre/email aparte más abajo.
    const { data: eventos, error } = await supabase
      .from('calendario_eventos')
      .select('*')
      .eq('notificar_email', true)
      .gte('fecha', ahora.toISOString().split('T')[0])

    if (error) return new Response('DB calendario_eventos: ' + errMsg(error), { status: 500 })
    if (!eventos?.length) return new Response('Sin eventos', { status: 200 })

    const userIds = [...new Set(eventos.map((e) => e.user_id))]

    // Nombre desde profiles
    const { data: perfiles, error: perfErr } = await supabase
      .from('profiles')
      .select('id, nombre')
      .in('id', userIds)
    if (perfErr) return new Response('DB profiles: ' + errMsg(perfErr), { status: 500 })
    const nombresPorId = new Map((perfiles || []).map((p) => [p.id, p.nombre]))

    // Email desde auth.users (no existe en profiles)
    const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    if (usersErr) return new Response('Auth listUsers: ' + errMsg(usersErr), { status: 500 })
    const emailsPorId = new Map(usersData.users.map((u) => [u.id, u.email]))

    let enviados = 0

    for (const ev of eventos) {
      if (!ev.hora) continue                          // sin hora = sin alerta
      const email = emailsPorId.get(ev.user_id)
      const nombre = nombresPorId.get(ev.user_id) || 'Profesional'
      if (!email) continue

      // Construir datetime del evento
      const fechaEvento = new Date(`${ev.fecha}T${ev.hora}`)
      const diffMs = fechaEvento.getTime() - ahora.getTime()
      const diffH  = diffMs / 3_600_000

      const tipoLabel = {
        trabajo: 'Trabajo', reunion: 'Reunión', cobro: 'Cobro',
        recordatorio: 'Recordatorio', visita: 'Visita obra'
      }[ev.tipo] || ev.tipo

      // Aviso 24h — entre 23h y 25h restantes, no enviado aún
      if (diffH >= 23 && diffH <= 25 && !ev.notificado_24h) {
        const r = await enviarEmail(email, nombre, ev, tipoLabel, '24 horas')
        if (r.ok) {
          await supabase.from('calendario_eventos').update({ notificado_24h: true }).eq('id', ev.id)
          enviados++
        } else {
          console.error('Resend 24h', ev.id, r.status, r.body)
        }
      }

      // Aviso 1h — entre 45min y 75min restantes, no enviado aún
      if (diffH >= 0.75 && diffH <= 1.25 && !ev.notificado_1h) {
        const r = await enviarEmail(email, nombre, ev, tipoLabel, '1 hora')
        if (r.ok) {
          await supabase.from('calendario_eventos').update({ notificado_1h: true }).eq('id', ev.id)
          enviados++
        } else {
          console.error('Resend 1h', ev.id, r.status, r.body)
        }
      }
    }

    return new Response(`Emails enviados: ${enviados}`, { status: 200 })
  } catch (err) {
    console.error(err)
    return new Response('Unhandled: ' + errMsg(err), { status: 500 })
  }
})

async function enviarEmail(
  email: string,
  nombre: string,
  ev: Record<string, string>,
  tipoLabel: string,
  anticipacion: string
): Promise<{ ok: boolean; status: number; body: string }> {
  const hora = ev.hora?.slice(0, 5) || ''
  const fecha = new Date(ev.fecha + 'T00:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long'
  })

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1A1A2E">
      <div style="background:#1A1A2E;padding:20px 28px;border-radius:12px 12px 0 0">
        <span style="font-size:22px;font-weight:900;color:#C9A84C">X</span>
        <span style="font-size:22px;font-weight:900;color:#fff">ANDER</span>
        <span style="font-size:11px;color:rgba(255,255,255,0.4);margin-left:8px;letter-spacing:2px">GESTIÓN</span>
      </div>
      <div style="background:#fff;border:1px solid #e5e0d8;border-top:none;padding:28px;border-radius:0 0 12px 12px">
        <p style="margin:0 0 4px;font-size:14px;color:#7a7a7a">Hola, ${nombre}</p>
        <h2 style="margin:0 0 20px;font-size:18px">⏰ Recordatorio — en ${anticipacion}</h2>
        <div style="background:#f8f5f0;border-left:4px solid #C9A84C;padding:16px 20px;border-radius:4px;margin-bottom:20px">
          <div style="font-size:16px;font-weight:700">${ev.titulo}</div>
          <div style="margin-top:6px;font-size:13px;color:#7a7a7a">${tipoLabel} · ${fecha} · ${hora}h</div>
          ${ev.descripcion ? `<div style="margin-top:8px;font-size:13px">${ev.descripcion}</div>` : ''}
        </div>
        <p style="font-size:12px;color:#aaa;margin:0">Este aviso fue generado automáticamente por XANDER Gestión.</p>
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
      // TODO: sustituir por un remitente de tu dominio verificado en Resend
      // (Ajustes → Domains) en cuanto lo verifiques. onboarding@resend.dev
      // funciona sin verificación mientras tanto, para que los avisos no se rompan.
      from: 'XANDER Gestión <onboarding@resend.dev>',
      to: email,
      subject: `⏰ En ${anticipacion}: ${ev.titulo}`,
      html,
    }),
  })

  const body = await resp.text()
  return { ok: resp.ok, status: resp.status, body }
}
