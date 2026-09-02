import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

const COMPROBANTES_BUCKET = 'gastos-comprobantes'

function fmt(v) { return (parseFloat(v) || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) }

function calcTotalFactura(f) {
  const base = (f.items || []).reduce((s, i) => s + (parseFloat(i.importe) || 0), 0)
  const dto = base * (f.descuento || 0) / 100
  const baseConDto = base - dto
  const iva = baseConDto * (f.iva || 0) / 100
  const ret = baseConDto * (f.retencion || 0) / 100
  return baseConDto + iva - ret
}

function EstadoBadge({ enviado, fecha }) {
  if (enviado) {
    return (
      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700" title={fecha ? new Date(fecha).toLocaleString('es-ES') : ''}>
        ✓ Enviado
      </span>
    )
  }
  return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">Pendiente</span>
}

export default function Gestoria() {
  const { profile } = useAuth()
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7)) // YYYY-MM
  const [facturas, setFacturas] = useState([])
  const [gastos, setGastos] = useState([])
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState(null) // { ok, text }

  useEffect(() => { cargar() }, [mes])

  function rangoMes() {
    const [anioStr, mesStr] = mes.split('-')
    const anio = parseInt(anioStr), mesNum = parseInt(mesStr)
    const inicio = `${anioStr}-${mesStr}-01`
    const finExclusivo = mesNum === 12 ? `${anio + 1}-01-01` : `${anio}-${String(mesNum + 1).padStart(2, '0')}-01`
    return { anio, mesNum, inicio, finExclusivo }
  }

  async function cargar() {
    setLoading(true)
    const { inicio, finExclusivo } = rangoMes()
    const [{ data: fs }, { data: gs }] = await Promise.all([
      supabase.from('facturas').select('*, clientes(nombre)').gte('fecha', inicio).lt('fecha', finExclusivo).order('fecha'),
      supabase.from('gastos').select('*').gte('fecha', inicio).lt('fecha', finExclusivo).order('fecha'),
    ])
    setFacturas(fs || [])
    setGastos(gs || [])
    setLoading(false)
  }

  async function toggleFactura(f) {
    const nuevo = !f.enviado_gestoria
    await supabase.from('facturas')
      .update({ enviado_gestoria: nuevo, enviado_gestoria_fecha: nuevo ? new Date().toISOString() : null })
      .eq('id', f.id)
    cargar()
  }

  async function toggleGasto(g) {
    const nuevo = !g.enviado_gestoria
    await supabase.from('gastos')
      .update({ enviado_gestoria: nuevo, enviado_gestoria_fecha: nuevo ? new Date().toISOString() : null })
      .eq('id', g.id)
    cargar()
  }

  async function verComprobante(path) {
    const { data } = await supabase.storage.from(COMPROBANTES_BUCKET).createSignedUrl(path, 300)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener')
  }

  async function enviarPendientes() {
    setEnviando(true); setMsg(null)
    const { anio, mesNum } = rangoMes()
    const { data, error: err } = await supabase.functions.invoke('gestoria-enviar-mes', { body: { anio, mes: mesNum } })
    setEnviando(false)
    if (err || data?.error) { setMsg({ ok: false, text: data?.error || err.message }); return }
    if (data?.skipped) { setMsg({ ok: true, text: data.motivo }); return }
    setMsg({ ok: true, text: `Enviado a ${data.to}: ${data.facturas} factura(s) y ${data.gastos} gasto(s).${data.comprobantesOmitidos ? ` (${data.comprobantesOmitidos} comprobante(s) no cupieron en el correo.)` : ''}` })
    cargar()
  }

  const facturasEnviadas = facturas.filter(f => f.enviado_gestoria).length
  const gastosEnviados = gastos.filter(g => g.enviado_gestoria).length
  const pendientes = (facturas.length - facturasEnviadas) + (gastos.length - gastosEnviados)
  const nombreMesLabel = new Date(mes + '-01T12:00:00').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Gestoría</h1>
          <p className="text-sm text-ink-soft mt-0.5">Envía a tu gestoría las facturas y gastos del mes, sin que se quede nada fuera.</p>
        </div>
        <input type="month" className="input w-auto" value={mes} onChange={e => setMes(e.target.value)} />
      </div>

      {!profile?.gestoria_email && (
        <div className="card border-gold border-2 mb-6">
          <div className="flex items-start gap-4">
            <div className="text-3xl">⚙️</div>
            <div>
              <div className="font-bold text-ink mb-1">Configura primero el email de tu gestoría</div>
              <p className="text-sm text-ink-soft mb-3">Para poder enviarles las facturas y gastos, necesitamos su email de contacto.</p>
              <Link to="/dashboard/mi-empresa" className="btn-primary inline-block">Ir a Mi Empresa</Link>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card text-center py-4">
          <div className="text-xl font-bold text-ink">{facturasEnviadas}/{facturas.length}</div>
          <div className="text-xs text-ink-soft mt-0.5">Facturas enviadas</div>
        </div>
        <div className="card text-center py-4">
          <div className="text-xl font-bold text-ink">{gastosEnviados}/{gastos.length}</div>
          <div className="text-xs text-ink-soft mt-0.5">Gastos enviados</div>
        </div>
        <div className="card text-center py-4 flex flex-col items-center justify-center">
          <button onClick={enviarPendientes} disabled={enviando || pendientes === 0 || !profile?.gestoria_email} className="btn-primary w-full">
            {enviando ? 'Enviando…' : pendientes === 0 ? 'Todo enviado' : `Enviar ${pendientes} pendiente(s)`}
          </button>
        </div>
      </div>

      {msg && (
        <div className={`text-sm rounded-xl px-4 py-3 mb-6 border ${msg.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-ink-soft text-sm">Cargando {nombreMesLabel}…</div>
      ) : (
        <>
          {/* Facturas */}
          <div className="mb-8">
            <h2 className="text-sm font-bold uppercase tracking-widest text-ink-soft mb-3">Facturas emitidas — {nombreMesLabel}</h2>
            {facturas.length === 0 ? (
              <div className="card text-center py-8 text-ink-soft text-sm">No hay facturas en este mes.</div>
            ) : (
              <div className="card p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-edge text-ink-soft text-xs uppercase tracking-wide">
                      <th className="text-left px-4 py-2.5">Nº</th>
                      <th className="text-left px-3 py-2.5 hidden md:table-cell">Fecha</th>
                      <th className="text-left px-3 py-2.5 hidden md:table-cell">Cliente</th>
                      <th className="text-right px-4 py-2.5">Total</th>
                      <th className="text-center px-3 py-2.5">Estado</th>
                      <th className="px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-edge">
                    {facturas.map(f => (
                      <tr key={f.id} className="hover:bg-page/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-ink">
                          {f.numero}{f.estado === 'anulada' && <span className="ml-2 text-xs text-red-500 font-semibold">ANULADA</span>}
                        </td>
                        <td className="px-3 py-3 hidden md:table-cell text-ink-soft text-xs">{new Date(f.fecha).toLocaleDateString('es-ES')}</td>
                        <td className="px-3 py-3 hidden md:table-cell text-ink-soft">{f.clientes?.nombre || '—'}</td>
                        <td className="px-4 py-3 text-right font-bold text-ink">{fmt(calcTotalFactura(f))}</td>
                        <td className="px-3 py-3 text-center"><EstadoBadge enviado={f.enviado_gestoria} fecha={f.enviado_gestoria_fecha} /></td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <button onClick={() => toggleFactura(f)} className="text-xs text-ink-soft hover:text-ink underline">
                            {f.enviado_gestoria ? 'Marcar pendiente' : 'Marcar enviada'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Gastos */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-ink-soft mb-3">Gastos — {nombreMesLabel}</h2>
            {gastos.length === 0 ? (
              <div className="card text-center py-8 text-ink-soft text-sm">No hay gastos en este mes.</div>
            ) : (
              <div className="card p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-edge text-ink-soft text-xs uppercase tracking-wide">
                      <th className="text-left px-4 py-2.5">Descripción</th>
                      <th className="text-left px-3 py-2.5 hidden md:table-cell">Fecha</th>
                      <th className="text-right px-4 py-2.5">Total</th>
                      <th className="text-center px-3 py-2.5">Adj.</th>
                      <th className="text-center px-3 py-2.5">Estado</th>
                      <th className="px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-edge">
                    {gastos.map(g => (
                      <tr key={g.id} className="hover:bg-page/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-ink">{g.descripcion}</div>
                          {g.proveedor && <div className="text-xs text-ink-soft mt-0.5">{g.proveedor}</div>}
                        </td>
                        <td className="px-3 py-3 hidden md:table-cell text-ink-soft text-xs">{new Date(g.fecha).toLocaleDateString('es-ES')}</td>
                        <td className="px-4 py-3 text-right font-bold text-ink">{fmt(g.importe)}</td>
                        <td className="px-3 py-3 text-center">
                          {g.comprobante_path ? (
                            <button onClick={() => verComprobante(g.comprobante_path)} title="Ver comprobante">📎</button>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-3 text-center"><EstadoBadge enviado={g.enviado_gestoria} fecha={g.enviado_gestoria_fecha} /></td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <button onClick={() => toggleGasto(g)} className="text-xs text-ink-soft hover:text-ink underline">
                            {g.enviado_gestoria ? 'Marcar pendiente' : 'Marcar enviado'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
