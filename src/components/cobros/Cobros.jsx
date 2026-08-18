import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const METODOS = ['Transferencia', 'Efectivo', 'Bizum', 'Cheque', 'Tarjeta']

function totalFactura(f) {
  const base = (f.items || []).reduce((s, i) => s + (parseFloat(i.importe) || 0), 0)
  const dto = base * (f.descuento || 0) / 100
  const baseDto = base - dto
  const iva = baseDto * (f.iva || 0) / 100
  const ret = baseDto * (f.retencion || 0) / 100
  return baseDto + iva - ret
}

function vencimientoFactura(f) {
  return f.fecha_vencimiento || f.vencimiento || null
}

function diasRestantes(vencimiento) {
  if (!vencimiento) return null
  const diff = Math.ceil((new Date(vencimiento) - new Date()) / 86400000)
  return diff
}

// Semáforo: 'verde' >30d, 'amarillo' 8-30d, 'naranja' 1-7d, 'rojo' vencida
function nivelAlerta(f) {
  const venc = vencimientoFactura(f)
  if (!venc || f.estado === 'pagada') return null
  const dias = diasRestantes(venc)
  if (dias < 0)  return 'rojo'
  if (dias <= 7) return 'naranja'
  if (dias <= 30) return 'amarillo'
  return 'verde'
}

const SEMAFORO_CONFIG = {
  rojo:     { color: 'bg-red-500',    text: 'text-red-600',    bg: 'bg-red-50 border-red-200',    label: 'Vencida' },
  naranja:  { color: 'bg-orange-400', text: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', label: 'Urgente (≤7 días)' },
  amarillo: { color: 'bg-yellow-400', text: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', label: 'Próxima (8-30 días)' },
  verde:    { color: 'bg-green-400',  text: 'text-green-700',  bg: 'bg-green-50 border-green-200', label: 'Al día (>30 días)' },
}

export default function Cobros() {
  const [facturas, setFacturas] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('pendientes') // pendientes | cobrados
  const [showModal, setShowModal] = useState(false)
  const [facturaActiva, setFacturaActiva] = useState(null)
  const [formCobro, setFormCobro] = useState({ fecha_cobro: '', metodo: 'Transferencia', notas: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('facturas')
      .select('*, clientes(nombre), obras(nombre)')
      .in('estado', ['enviada', 'vista', 'pagada', 'vencida'])
      .order('fecha', { ascending: false })
    setFacturas(data || [])
    setLoading(false)
  }

  function abrirCobro(f) {
    setFacturaActiva(f)
    setFormCobro({ fecha_cobro: new Date().toISOString().split('T')[0], metodo: 'Transferencia', notas: '' })
    setShowModal(true)
  }

  async function confirmarCobro(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('facturas').update({
      estado: 'pagada',
      notas: facturaActiva.notas
        ? `${facturaActiva.notas}\n✓ Cobrado el ${formCobro.fecha_cobro} via ${formCobro.metodo}`
        : `✓ Cobrado el ${formCobro.fecha_cobro} via ${formCobro.metodo}`,
    }).eq('id', facturaActiva.id)
    setSaving(false)
    setShowModal(false)
    load()
  }

  async function desmarcarPagada(id) {
    if (!confirm('¿Marcar esta factura como enviada (pendiente de cobro)?')) return
    await supabase.from('facturas').update({ estado: 'enviada' }).eq('id', id)
    load()
  }

  const pendientes = facturas.filter(f => f.estado !== 'pagada')
  const cobradas = facturas.filter(f => f.estado === 'pagada')
  const lista = tab === 'pendientes' ? pendientes : cobradas

  // Resumen financiero
  const totalPendiente = pendientes.reduce((s, f) => s + totalFactura(f), 0)
  const totalCobrado = cobradas.reduce((s, f) => s + totalFactura(f), 0)
  const vencidasSinCobrar = pendientes.filter(f => {
    const v = vencimientoFactura(f)
    return v && new Date(v) < new Date()
  })

  // Semáforo agrupado
  const porNivel = { rojo: [], naranja: [], amarillo: [], verde: [] }
  pendientes.forEach(f => {
    const nivel = nivelAlerta(f)
    if (nivel) porNivel[nivel].push(f)
  })
  const hayAlertas = porNivel.rojo.length + porNivel.naranja.length + porNivel.amarillo.length > 0

  // Cobros por mes (últimos 6 meses)
  const cobrosPorMes = cobradas.reduce((acc, f) => {
    const mes = f.fecha ? f.fecha.slice(0, 7) : 'Sin fecha'
    acc[mes] = (acc[mes] || 0) + totalFactura(f)
    return acc
  }, {})
  const meses = Object.entries(cobrosPorMes).sort(([a], [b]) => b.localeCompare(a)).slice(0, 6)
  const maxMes = Math.max(...meses.map(([, v]) => v), 1)

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Cobros</h1>
        <p className="text-sm text-ink-soft mt-0.5">Control de facturas pendientes y pagadas</p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card border-l-4 border-l-gold">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft mb-1">Pendiente cobro</div>
          <div className="text-2xl font-bold text-gold-dark">
            {totalPendiente.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
          </div>
          <div className="text-xs text-ink-soft mt-1">{pendientes.length} factura{pendientes.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="card border-l-4 border-l-green-500">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft mb-1">Total cobrado</div>
          <div className="text-2xl font-bold text-green-700">
            {totalCobrado.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
          </div>
          <div className="text-xs text-ink-soft mt-1">{cobradas.length} factura{cobradas.length !== 1 ? 's' : ''} pagada{cobradas.length !== 1 ? 's' : ''}</div>
        </div>
        <div className={`card border-l-4 ${vencidasSinCobrar.length > 0 ? 'border-l-red-500' : 'border-l-stone/30'}`}>
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft mb-1">Vencidas sin cobrar</div>
          <div className={`text-2xl font-bold ${vencidasSinCobrar.length > 0 ? 'text-red-600' : 'text-ink-soft'}`}>
            {vencidasSinCobrar.length}
          </div>
          <div className="text-xs text-ink-soft mt-1">
            {vencidasSinCobrar.length > 0
              ? vencidasSinCobrar.reduce((s, f) => s + totalFactura(f), 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
              : 'Todo al día ✓'}
          </div>
        </div>
      </div>

      {/* ── Semáforo de alertas ── */}
      {hayAlertas && (
        <div className="card mb-6 border border-red-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center text-lg">🚦</div>
            <div>
              <div className="font-bold text-ink text-sm">Alertas de cobro</div>
              <div className="text-xs text-ink-soft">{porNivel.rojo.length + porNivel.naranja.length} factura{porNivel.rojo.length+porNivel.naranja.length!==1?'s':''} urgente{porNivel.rojo.length+porNivel.naranja.length!==1?'s':''}</div>
            </div>
          </div>

          {/* Mini semáforo visual */}
          <div className="flex gap-2 mb-4">
            {['rojo','naranja','amarillo','verde'].map(nivel => {
              const cfg = SEMAFORO_CONFIG[nivel]
              const count = porNivel[nivel]?.length || 0
              return (
                <div key={nivel} className={`flex-1 rounded-xl border px-3 py-2 text-center ${count>0?cfg.bg:'bg-page/30 border-edge'}`}>
                  <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${count>0?cfg.color:'bg-stone/20'}`} />
                  <div className={`text-lg font-black ${count>0?cfg.text:'text-ink-soft/40'}`}>{count}</div>
                  <div className="text-[10px] text-ink-soft leading-tight">{cfg.label}</div>
                </div>
              )
            })}
          </div>

          {/* Facturas críticas (rojo + naranja) listadas */}
          {[...porNivel.rojo, ...porNivel.naranja].map(f => {
            const dias = diasRestantes(vencimientoFactura(f))
            const nivel = nivelAlerta(f)
            const cfg = SEMAFORO_CONFIG[nivel]
            return (
              <div key={f.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2 mb-2 ${cfg.bg}`}>
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.color}`} />
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-ink text-sm">{f.numero}</span>
                  {f.clientes?.nombre && <span className="text-xs text-ink-soft ml-2">{f.clientes.nombre}</span>}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-ink text-sm">{totalFactura(f).toLocaleString('es-ES',{style:'currency',currency:'EUR'})}</div>
                  <div className={`text-xs font-semibold ${cfg.text}`}>
                    {dias < 0 ? `Vencida hace ${Math.abs(dias)}d` : dias === 0 ? 'Vence hoy' : `Vence en ${dias}d`}
                  </div>
                </div>
                <button onClick={() => abrirCobro(f)} className="flex-shrink-0 text-xs font-semibold bg-green-600 text-white px-2.5 py-1 rounded-lg hover:bg-green-700 transition-colors">
                  Cobrar
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Gráfico de cobros por mes */}
      {meses.length > 0 && (
        <div className="card mb-6">
          <div className="text-xs font-bold uppercase tracking-widest text-ink-soft mb-4">Cobros por mes</div>
          <div className="flex items-end gap-3 h-28">
            {meses.reverse().map(([mes, valor]) => {
              const altura = Math.round((valor / maxMes) * 100)
              const [año, m] = mes.split('-')
              const label = new Date(año, m - 1).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })
              return (
                <div key={mes} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-xs font-semibold text-ink">
                    {valor >= 1000 ? `${(valor / 1000).toFixed(1)}k` : valor.toFixed(0)}€
                  </div>
                  <div className="w-full bg-edge rounded-t-md transition-all" style={{ height: `${Math.max(altura, 4)}%`, minHeight: '4px', background: '#C9A84C' }} />
                  <div className="text-xs text-ink-soft">{label}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-edge rounded-xl p-1 w-fit mb-5">
        <button onClick={() => setTab('pendientes')}
          className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${tab === 'pendientes' ? 'bg-surface text-ink shadow-sm' : 'text-ink-soft hover:text-ink'}`}>
          Pendientes ({pendientes.length})
        </button>
        <button onClick={() => setTab('cobrados')}
          className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${tab === 'cobrados' ? 'bg-surface text-ink shadow-sm' : 'text-ink-soft hover:text-ink'}`}>
          Cobradas ({cobradas.length})
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-ink-soft text-sm py-10 text-center">Cargando…</div>
      ) : lista.length === 0 ? (
        <div className="card text-center py-14">
          <div className="text-5xl mb-3">{tab === 'pendientes' ? '✅' : '💳'}</div>
          <div className="font-bold text-ink mb-1">
            {tab === 'pendientes' ? '¡Todo cobrado! Sin facturas pendientes' : 'Aún no hay cobros registrados'}
          </div>
          <div className="text-sm text-ink-soft">
            {tab === 'pendientes' ? 'Buen trabajo 💪' : 'Las facturas marcadas como pagadas aparecerán aquí'}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {lista.map(f => {
            const total = totalFactura(f)
            const venc = vencimientoFactura(f)
            const dias = diasRestantes(venc)
            const nivel = nivelAlerta(f)
            const cfg = nivel ? SEMAFORO_CONFIG[nivel] : null
            const vencida = nivel === 'rojo'
            const urgente = nivel === 'naranja'
            return (
              <div key={f.id} className={`card flex items-center gap-4 ${vencida ? 'border-red-200 bg-red-50/30' : urgente ? 'border-orange-200 bg-orange-50/30' : ''}`}>
                {/* Semáforo visual */}
                <div className={`w-2 h-12 rounded-full flex-shrink-0 ${f.estado === 'pagada' ? 'bg-green-400' : cfg ? cfg.color : 'bg-gold'}`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-bold text-ink">{f.numero}</span>
                    {f.clientes?.nombre && <span className="text-sm text-ink-soft">{f.clientes.nombre}</span>}
                    {f.obras?.nombre && <span className="text-xs text-ink-soft/60 hidden md:inline">· {f.obras.nombre}</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-ink-soft">
                    {f.fecha && <span>Emitida: {new Date(f.fecha).toLocaleDateString('es-ES')}</span>}
                    {venc && (
                      <span className={cfg ? cfg.text + ' font-semibold' : ''}>
                        Vence: {new Date(venc).toLocaleDateString('es-ES')}
                        {dias !== null && f.estado !== 'pagada' && (
                          dias < 0 ? ` (vencida hace ${Math.abs(dias)} días)` :
                          dias === 0 ? ' (vence hoy)' :
                          ` (en ${dias} días)`
                        )}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-ink text-lg">
                    {total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </div>
                  {tab === 'pendientes' ? (
                    <button onClick={() => abrirCobro(f)}
                      className="mt-1 text-xs font-semibold bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 transition-colors">
                      ✓ Marcar cobrada
                    </button>
                  ) : (
                    <button onClick={() => desmarcarPagada(f.id)}
                      className="mt-1 text-xs text-ink-soft/50 hover:text-ink-soft transition-colors">
                      Desmarcar
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal confirmar cobro */}
      {showModal && facturaActiva && (
        <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-edge flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink">Confirmar cobro</h2>
              <button onClick={() => setShowModal(false)} className="text-ink-soft hover:text-ink text-2xl leading-none">×</button>
            </div>
            <form onSubmit={confirmarCobro} className="p-6 space-y-4">
              <div className="bg-page rounded-xl p-4 text-center">
                <div className="text-sm text-ink-soft">{facturaActiva.numero} · {facturaActiva.clientes?.nombre}</div>
                <div className="text-2xl font-bold text-ink mt-1">
                  {totalFactura(facturaActiva).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                </div>
              </div>
              <div>
                <label className="label">Fecha de cobro</label>
                <input className="input" type="date" value={formCobro.fecha_cobro}
                  onChange={e => setFormCobro(p => ({ ...p, fecha_cobro: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Método de pago</label>
                <select className="input" value={formCobro.metodo}
                  onChange={e => setFormCobro(p => ({ ...p, metodo: e.target.value }))}>
                  {METODOS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-green-600 text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50">
                  {saving ? 'Guardando…' : '✓ Confirmar cobro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
