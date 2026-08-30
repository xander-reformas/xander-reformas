// Supabase Edge Function — facturas-enviar-email
// Se invoca desde el frontend (botón "Enviar por email" en Facturas).
// Envía la factura al cliente por correo (vía Resend) con los datos de
// la empresa, las líneas, los totales y el QR Verifactu si ya existe.
// Si la factura estaba en borrador, la pasa a "enviada".

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

type Item = { titulo?: string; detalle?: string; cantidad?: string | number; unidad?: string; precio_unitario?: string | number; importe?: string | number }

function calculos(items: Item[], iva: number, descuento: number, retencion: number) {
  const base = (items || []).reduce((s, i) => s + (parseFloat(String(i.importe)) || 0), 0)
  const dto = base * (descuento || 0) / 100
  const baseConDto = base - dto
  const ivaImporte = baseConDto * (iva || 0) / 100
  const retImporte = baseConDto * (retencion || 0) / 100
  const total = baseConDto + ivaImporte - retImporte
  return { base, dto, ivaImporte, retImporte, total }
}

function fmt(v: number) {
  return (v || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
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

    const { factura_id, to, mensaje } = await req.json()
    if (!factura_id) return json({ error: 'Falta factura_id' }, 400)

    const { data: factura, error: errF } = await supabase
      .from('facturas')
      .select('*, clientes(nombre, email), obras(nombre)')
      .eq('id', factura_id)
      .single()
    if (errF) throw errF
    if (!factura) return json({ error: 'Factura no encontrada' }, 404)
    if (factura.user_id !== user.id) return json({ error: 'No autorizado' }, 403)

    const destino = (to || factura.clientes?.email || '').trim()
    if (!destino) {
      return json({ error: 'Este cliente no tiene email guardado. Añádelo en Clientes o escribe uno al enviar.' }, 400)
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('empresa_nombre, empresa_nif, empresa_direccion, empresa_cp, empresa_ciudad, empresa_telefono, empresa_email')
      .eq('id', user.id)
      .single()

    const { data: registro } = await supabase
      .from('registro_facturacion')
      .select('verifacti_qr, verifacti_estado')
      .eq('factura_id', factura.id).eq('tipo_registro', 'alta')
      .maybeSingle()

    const { base, dto, ivaImporte, retImporte, total } = calculos(factura.items || [], factura.iva, factura.descuento, factura.retencion)

    const empresaNombre = profile?.empresa_nombre || 'XANDER Gestión'
    const remitenteReply = profile?.empresa_email || user.email || undefined

    const filasHtml = (factura.items || []).map((it: Item) => `
      <tr style="border-bottom:1px solid #e5e0d8">
        <td style="padding:8px 6px;text-align:left">
          <div style="font-weight:600">${it.titulo || ''}</div>
          ${it.detalle ? `<div style="font-size:11px;color:#7a7a7a">${it.detalle}</div>` : ''}
        </td>
        <td style="padding:8px 6px;text-align:right;color:#7a7a7a;white-space:nowrap">${it.cantidad || ''} ${it.unidad || ''}</td>
        <td style="padding:8px 6px;text-align:right;font-weight:600">${fmt(parseFloat(String(it.importe)) || 0)}</td>
      </tr>
    `).join('')

    const qrHtml = registro?.verifacti_qr
      ? `<div style="margin-top:20px;display:flex;align-items:center;gap:14px">
           <img src="data:image/png;base64,${registro.verifacti_qr}" alt="QR Verifactu" width="70" height="70" style="display:block" />
           <div style="font-size:10px;color:#7a7a7a;line-height:1.4">Factura verificable ante la AEAT (Verifactu / RD 1007/2023).</div>
         </div>`
      : ''

    const html = `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1A1A2E">
        <div style="background:#1A1A2E;padding:20px 28px;border-radius:12px 12px 0 0">
          <span style="font-size:22px;font-weight:900;color:#C9A84C">X</span>
          <span style="font-size:22px;font-weight:900;color:#fff">ANDER</span>
          <span style="font-size:11px;color:rgba(255,255,255,0.4);margin-left:8px;letter-spacing:2px">GESTIÓN</span>
        </div>
        <div style="background:#fff;border:1px solid #e5e0d8;border-top:none;padding:28px;border-radius:0 0 12px 12px">
          <p style="margin:0 0 4px;font-size:14px;color:#7a7a7a">Hola${factura.clientes?.nombre ? `, ${factura.clientes.nombre}` : ''}</p>
          <h2 style="margin:0 0 4px;font-size:18px">Factura ${factura.numero}</h2>
          <div style="font-size:12px;color:#7a7a7a;margin-bottom:16px">
            ${empresaNombre}${factura.fecha ? ` · ${new Date(factura.fecha).toLocaleDateString('es-ES')}` : ''}${factura.obras?.nombre ? ` · ${factura.obras.nombre}` : ''}
          </div>

          ${mensaje ? `<div style="background:#f8f5f0;border-left:4px solid #C9A84C;padding:12px 16px;border-radius:4px;margin-bottom:20px;font-size:13px;white-space:pre-line">${mensaje}</div>` : ''}

          <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:12px">
            <thead>
              <tr style="border-bottom:2px solid rgba(26,26,46,0.15);font-size:11px;text-transform:uppercase;color:#7a7a7a">
                <th style="padding:6px;text-align:left">Concepto</th>
                <th style="padding:6px;text-align:right">Cantidad</th>
                <th style="padding:6px;text-align:right">Importe</th>
              </tr>
            </thead>
            <tbody>${filasHtml}</tbody>
          </table>

          <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
            <div style="width:220px;font-size:13px">
              <div style="display:flex;justify-content:space-between;color:#7a7a7a"><span>Base imponible</span><span>${fmt(base)}</span></div>
              ${dto > 0 ? `<div style="display:flex;justify-content:space-between;color:#7a7a7a"><span>Descuento</span><span>−${fmt(dto)}</span></div>` : ''}
              <div style="display:flex;justify-content:space-between;color:#7a7a7a"><span>IVA (${factura.iva}%)</span><span>+${fmt(ivaImporte)}</span></div>
              ${retImporte > 0 ? `<div style="display:flex;justify-content:space-between;color:#7a7a7a"><span>Retención (${factura.retencion}%)</span><span>−${fmt(retImporte)}</span></div>` : ''}
              <div style="display:flex;justify-content:space-between;font-weight:900;font-size:15px;border-top:2px solid rgba(26,26,46,0.15);padding-top:6px;margin-top:6px">
                <span>Total</span><span>${fmt(total)}</span>
              </div>
            </div>
          </div>

          ${qrHtml}

          <p style="font-size:11px;color:#aaa;margin:20px 0 0;border-top:1px solid #e5e0d8;padding-top:12px">
            Este email fue enviado desde XANDER Gestión en nombre de ${empresaNombre}.
            ${remitenteReply ? `Puedes responder directamente a este correo (${remitenteReply}) si tienes alguna duda.` : ''}
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
        // Remitente en el dominio propio verificado en Resend (xandergestion.com).
        from: `${empresaNombre} <avisos@xandergestion.com>`,
        to: destino,
        reply_to: remitenteReply,
        subject: `Factura ${factura.numero} — ${empresaNombre}`,
        html,
      }),
    })

    const body = await resp.text()
    if (!resp.ok) {
      console.error('Resend error', resp.status, body)
      let detalle = ''
      try { detalle = JSON.parse(body)?.message || '' } catch { /* no era JSON */ }
      const esRestriccionSandbox = /own email|verify a domain|testing emails/i.test(detalle)
      const error = esRestriccionSandbox
        ? 'Tu cuenta de Resend está en modo de pruebas: solo puede enviar al email con el que creaste la cuenta. Verifica un dominio propio en Resend (resend.com/domains) para poder enviar a tus clientes.'
        : (detalle || 'No se pudo enviar el email. Inténtalo de nuevo en unos minutos.')
      return json({ error }, 502)
    }

    // Si estaba en borrador, al enviarla pasa a "enviada" (igual que el cambio manual de estado en la lista)
    if (factura.estado === 'borrador') {
      await supabase.from('facturas').update({ estado: 'enviada' }).eq('id', factura.id)
    }

    return json({ ok: true, to: destino })
  } catch (err) {
    console.error(err)
    return json({ error: errMsg(err) }, 400)
  }
})
