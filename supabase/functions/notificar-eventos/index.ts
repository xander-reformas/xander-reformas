// Supabase Edge Function — notificar-eventos
// Se ejecuta cada 15 minutos via pg_cron
// Envía emails con Resend cuando un evento está a 24h o 1h

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY  = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

Deno.serve(async () => {
  try {
    const ahora = new Date()

    // Buscar eventos con alerta activa y fecha/hora en las próximas 25h (margen)
    const { data: eventos, error } = await supabase
      .from('calendario_eventos')
      .select('*, profiles:user_id(email, nombre)')
      .eq('notificar_email', true)
      .gte('fecha', ahora.toISOString().split('T')[0])

    if (error) throw error
    if (!eventos?.length) return new Response('Sin eventos', { status: 200 })

    let enviados = 0

    for (const ev of eventos) {
      if (!ev.hora) continue                          // sin hora = sin alerta
      const email = ev.profiles?.email
      const nombre = ev.profiles?.nombre || 'Profesional'
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
        await enviarEmail(email, nombre, ev, tipoLabel, '24 horas')
        await supabase.from('calendario_eventos').update({ notificado_24h: true }).eq('id', ev.id)
        enviados++
      }

      // Aviso 1h — entre 45min y 75min restantes, no enviado aún
      if (diffH >= 0.75 && diffH <= 1.25 && !ev.notificado_1h) {
        await enviarEmail(email, nombre, ev, tipoLabel, '1 hora')
        await supabase.from('calendario_eventos').update({ notificado_1h: true }).eq('id', ev.id)
        enviados++
      }
    }

    return new Response(`Emails enviados: ${enviados}`, { status: 200 })
  } catch (err) {
    console.error(err)
    return new Response(String(err), { status: 500 })
  }
})

async function enviarEmail(
  email: string,
  nombre: string,
  ev: Record<string, string>,
  tipoLabel: string,
  anticipacion: string
) {
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

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'XANDER Gestión <avisos@tudominio.com>',  // cambia por tu dominio verificado en Resend
      to: email,
      subject: `⏰ En ${anticipacion}: ${ev.titulo}`,
      html,
    }),
  })
}
