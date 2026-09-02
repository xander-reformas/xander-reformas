// Supabase Edge Function — gestoria-enviar-mes
// Se invoca desde el frontend (botón "Enviar pendientes a gestoría" en la
// sección Gestoría). Recoge las facturas emitidas y los gastos de un mes que
// todavía no se han enviado (enviado_gestoria = false), arma un email con
// dos tablas resumen y adjunta los comprobantes de gastos disponibles, lo
// envía a la gestoría (con copia a la propia empresa) y marca como enviado
// todo lo que se ha incluido — así nunca se pierde de vista qué falta.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const COMPROBANTES_BUCKET = 'gastos-comprobantes'
// Límite prudente para no pasarnos del tamaño máximo de email de Resend.
const LIMITE_ADJUNTOS_BYTES = 15 * 1024 * 1024

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

function fmt(v: number) {
  return (v || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
}

function pad(n: number) { return String(n).padStart(2, '0') }

type Item = { importe?: string | number; iva?: number; descuento?: number; retencion?: number }
function calculoFactura(items: Item[], iva: number, descuento: number, retencion: number) {
  const base = (items || []).reduce((s, i) => s + (parseFloat(String(i.importe)) || 0), 0)
  const dto = base * (descuento || 0) / 100
  const baseConDto = base - dto
  const ivaImporte = baseConDto * (iva || 0) / 100
  const retImporte = baseConDto * (retencion || 0) / 100
  const total = baseConDto + ivaImporte - retImporte
  return { base: baseConDto, total }
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

    const { anio, mes } = await req.json()
    if (!anio || !mes || mes < 1 || mes > 12) return json({ error: 'Falta anio/mes válidos' }, 400)

    const { data: profile } = await supabase
      .from('profiles')
      .select('empresa_nombre, empresa_email, gestoria_email, gestoria_nombre')
      .eq('id', user.id)
      .single()

    const empresaNombre = profile?.empresa_nombre || 'XANDER Gestión'
    const gestoriaEmail = profile?.gestoria_email
    if (!gestoriaEmail) {
      return json({ error: 'No has configurado el email de tu gestoría. Ve a Mi Empresa → Gestoría / Asesoría y guárdalo.' }, 400)
    }

    const inicio = `${anio}-${pad(mes)}-01`
    const finExclusivo = mes === 12 ? `${anio + 1}-01-01` : `${anio}-${pad(mes + 1)}-01`

    const [{ data: facturas, error: errF }, { data: gastos, error: errG }] = await Promise.all([
      supabase.from('facturas')
        .select('*, clientes(nombre)')
        .eq('user_id', user.id)
        .eq('enviado_gestoria', false)
        .gte('fecha', inicio).lt('fecha', finExclusivo)
        .order('fecha'),
      supabase.from('gastos')
        .select('*')
        .eq('user_id', user.id)
        .eq('enviado_gestoria', false)
        .gte('fecha', inicio).lt('fecha', finExclusivo)
        .order('fecha'),
    ])
    if (errF) throw errF
    if (errG) throw errG

    const nFacturas = facturas?.length || 0
    const nGastos = gastos?.length || 0

    if (nFacturas === 0 && nGastos === 0) {
      return json({ ok: true, skipped: true, motivo: 'No hay nada pendiente de enviar en ese periodo.' })
    }

    // ── Adjuntos: comprobantes de gastos (hasta el límite de tamaño) ──
    const attachments: { filename: string; content: string }[] = []
    let bytesAdjuntos = 0
    let comprobantesOmitidos = 0

    for (const g of gastos || []) {
      if (!g.comprobante_path) continue
      try {
        const { data: blob, error: dlErr } = await supabase.storage.from(COMPROBANTES_BUCKET).download(g.comprobante_path)
        if (dlErr || !blob) { comprobantesOmitidos++; continue }
        const buf = new Uint8Array(await blob.arrayBuffer())
        if (bytesAdjuntos + buf.length > LIMITE_ADJUNTOS_BYTES) { comprobantesOmitidos++; continue }
        bytesAdjuntos += buf.length
        let binary = ''
        for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i])
        const base64 = btoa(binary)
        const ext = g.comprobante_path.split('.').pop()
        const nombreArchivo = `${g.fecha}_${(g.descripcion || 'gasto').replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 40)}.${ext}`
        attachments.push({ filename: nombreArchivo, content: base64 })
      } catch {
        comprobantesOmitidos++
      }
    }

    // ── Tabla de facturas ──
    let totalFacturado = 0
    const filasFacturas = (facturas || []).map(f => {
      const { base, total } = calculoFactura(f.items || [], f.iva, f.descuento, f.retencion)
      totalFacturado += total
      const anulada = f.estado === 'anulada'
      return `
        <tr style="border-bottom:1px solid #e5e0d8;${anulada ? 'opacity:0.6' : ''}">
          <td style="padding:6px">${f.numero}${anulada ? ' <span style="color:#c0392b;font-size:11px">(ANULADA)</span>' : ''}</td>
          <td style="padding:6px">${new Date(f.fecha).toLocaleDateString('es-ES')}</td>
          <td style="padding:6px">${f.clientes?.nombre || '—'}</td>
          <td style="padding:6px;text-align:right">${fmt(base)}</td>
          <td style="padding:6px;text-align:center">${f.iva}%</td>
          <td style="padding:6px;text-align:right;font-weight:600">${fmt(total)}</td>
        </tr>`
    }).join('')

    // ── Tabla de gastos ──
    let totalGastado = 0
    const filasGastos = (gastos || []).map(g => {
      totalGastado += parseFloat(g.importe) || 0
      return `
        <tr style="border-bottom:1px solid #e5e0d8">
          <td style="padding:6px">${new Date(g.fecha).toLocaleDateString('es-ES')}</td>
          <td style="padding:6px">${g.descripcion}${g.proveedor ? ` <span style="color:#7a7a7a">· ${g.proveedor}</span>` : ''}</td>
          <td style="padding:6px">${g.categoria}</td>
          <td style="padding:6px;text-align:right">${fmt(g.importe_base)}</td>
          <td style="padding:6px;text-align:center">${g.iva_pct}%</td>
          <td style="padding:6px;text-align:right;font-weight:600">${fmt(g.importe)}</td>
          <td style="padding:6px;text-align:center">${g.comprobante_path ? '📎' : '—'}</td>
        </tr>`
    }).join('')

    const nombreMes = new Date(anio, mes - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

    const html = `
      <div style="font-family:sans-serif;max-width:720px;margin:0 auto;color:#1A1A2E">
        <div style="background:#1A1A2E;padding:20px 28px;border-radius:12px 12px 0 0">
          <span style="font-size:22px;font-weight:900;color:#C9A84C">X</span>
          <span style="font-size:22px;font-weight:900;color:#fff">ANDER</span>
          <span style="font-size:11px;color:rgba(255,255,255,0.4);margin-left:8px;letter-spacing:2px">GESTIÓN</span>
        </div>
        <div style="background:#fff;border:1px solid #e5e0d8;border-top:none;padding:28px;border-radius:0 0 12px 12px">
          <p style="margin:0 0 4px;font-size:14px;color:#7a7a7a">${profile?.gestoria_nombre ? `Hola, ${profile.gestoria_nombre}` : 'Hola'}</p>
          <h2 style="margin:0 0 16px;font-size:18px">Facturas y gastos de ${nombreMes} — ${empresaNombre}</h2>

          ${nFacturas > 0 ? `
            <h3 style="font-size:14px;margin:20px 0 8px">Facturas emitidas (${nFacturas})</h3>
            <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px">
              <thead>
                <tr style="border-bottom:2px solid rgba(26,26,46,0.15);font-size:10px;text-transform:uppercase;color:#7a7a7a">
                  <th style="padding:6px;text-align:left">Nº</th>
                  <th style="padding:6px;text-align:left">Fecha</th>
                  <th style="padding:6px;text-align:left">Cliente</th>
                  <th style="padding:6px;text-align:right">Base</th>
                  <th style="padding:6px;text-align:center">IVA</th>
                  <th style="padding:6px;text-align:right">Total</th>
                </tr>
              </thead>
              <tbody>${filasFacturas}</tbody>
            </table>
            <div style="text-align:right;font-weight:900;font-size:13px;margin-bottom:20px">Total facturado: ${fmt(totalFacturado)}</div>
          ` : ''}

          ${nGastos > 0 ? `
            <h3 style="font-size:14px;margin:20px 0 8px">Gastos (${nGastos})</h3>
            <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px">
              <thead>
                <tr style="border-bottom:2px solid rgba(26,26,46,0.15);font-size:10px;text-transform:uppercase;color:#7a7a7a">
                  <th style="padding:6px;text-align:left">Fecha</th>
                  <th style="padding:6px;text-align:left">Descripción</th>
                  <th style="padding:6px;text-align:left">Categoría</th>
                  <th style="padding:6px;text-align:right">Base</th>
                  <th style="padding:6px;text-align:center">IVA</th>
                  <th style="padding:6px;text-align:right">Total</th>
                  <th style="padding:6px;text-align:center">Adj.</th>
                </tr>
              </thead>
              <tbody>${filasGastos}</tbody>
            </table>
            <div style="text-align:right;font-weight:900;font-size:13px;margin-bottom:20px">Total gastos: ${fmt(totalGastado)}</div>
          ` : ''}

          ${comprobantesOmitidos > 0 ? `
            <p style="font-size:12px;color:#c0392b;background:#fdf0ef;border-radius:6px;padding:10px 14px;margin-bottom:16px">
              ⚠️ ${comprobantesOmitidos} comprobante(s) no se han podido adjuntar (tamaño del correo). Están disponibles en la app, en Gastos.
            </p>
          ` : ''}

          <p style="font-size:11px;color:#aaa;margin:20px 0 0;border-top:1px solid #e5e0d8;padding-top:12px">
            Email generado automáticamente desde XANDER Gestión. Se envía copia a ${profile?.empresa_email || 'la empresa'}.
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
        to: gestoriaEmail,
        cc: profile?.empresa_email || undefined,
        reply_to: profile?.empresa_email || undefined,
        subject: `Facturas y gastos de ${nombreMes} — ${empresaNombre}`,
        html,
        attachments: attachments.length ? attachments : undefined,
      }),
    })

    const body = await resp.text()
    if (!resp.ok) {
      console.error('Resend error', resp.status, body)
      let detalle = ''
      try { detalle = JSON.parse(body)?.message || '' } catch { /* no era JSON */ }
      return json({ error: detalle || 'No se pudo enviar el email a la gestoría.' }, 502)
    }

    const ahora = new Date().toISOString()
    if (nFacturas > 0) {
      await supabase.from('facturas')
        .update({ enviado_gestoria: true, enviado_gestoria_fecha: ahora })
        .in('id', (facturas || []).map(f => f.id))
    }
    if (nGastos > 0) {
      await supabase.from('gastos')
        .update({ enviado_gestoria: true, enviado_gestoria_fecha: ahora })
        .in('id', (gastos || []).map(g => g.id))
    }

    return json({ ok: true, facturas: nFacturas, gastos: nGastos, to: gestoriaEmail, comprobantesOmitidos })
  } catch (err) {
    console.error(err)
    return json({ error: errMsg(err) }, 400)
  }
})
