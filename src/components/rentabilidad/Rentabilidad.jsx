import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const ESTADOS_COLOR = {
  pendiente:  'bg-stone/20 text-ink-soft',
  en_curso:   'bg-gold/20 text-gold-dark',
  pausada:    'bg-orange-100 text-orange-700',
  completada: 'bg-green-100 text-green-700',
  cancelada:  'bg-red-100 text-red-600',
}

function MargenBar({ margen }) {
  const clamped = Math.max(0, Math.min(margen, 100))
  const color = margen >= 35 ? 'bg-green-500' : margen >= 20 ? 'bg-gold' : margen >= 0 ? 'bg-orange-500' : 'bg-red-500'
  const textColor = margen >= 35 ? 'text-green-700' : margen >= 20 ? 'text-gold-dark' : margen >= 0 ? 'text-orange-600' : 'text-red-600'
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-edge rounded-full h-2">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className={`text-sm font-bold w-12 text-right ${textColor}`}>
        {margen > 0 ? `${margen.toFixed(1)}%` : margen === 0 ? '0%' : `${margen.toFixed(1)}%`}
      </span>
    </div>
  )
}

export default function Rentabilidad() {
  const [obras, setObras] = useState([])
  const [loading, setLoading] = useState(true)
  const [orden, setOrden] = useState('margen_desc')
  const [filtroEstado, setFiltroEstado] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: obs }, { data: facs }] = await Promise.all([
      supabase.from('obras').select('*, clientes(nombre)').order('created_at', { ascending: false }),
      supabase.from('facturas').select('obra_id, items, iva, descuento, retencion, estado'),
    ])

    // Para cada obra, calcular lo facturado real
    const facturadoPorObra = {}
    for (const f of facs || []) {
      if (!f.obra_id) continue
      const base = (f.items || []).reduce((s, i) => s + (parseFloat(i.importe) || 0), 0)
      const dto = base * (f.descuento || 0) / 100
      const baseDto = base - dto
      const iva = baseDto * (f.iva || 0) / 100
      const ret = baseDto * (f.retencion || 0) / 100
      facturadoPorObra[f.obra_id] = (facturadoPorObra[f.obra_id] || 0) + baseDto + iva - ret
    }

    const obrasConRent = (obs || []).map(o => {
      const presupuestado = parseFloat(o.presupuesto_total) || 0
      const coste = parseFloat(o.coste_real) || 0
      const facturado = facturadoPorObra[o.id] || 0
      const beneficio = presupuestado > 0 ? presupuestado - coste : facturado - coste
      const base = presupuestado > 0 ? presupuestado : facturado
      const margen = base > 0 ? (beneficio / base) * 100 : 0
      return { ...o, presupuestado, coste, facturado, beneficio, margen }
    })

    setObras(obrasConRent)
    setLoading(false)
  }

  const filtradas = obras
    .filter(o => !filtroEstado || o.estado === filtroEstado)

  const ordenadas = [...filtradas].sort((a, b) => {
    switch (orden) {
      case 'margen_desc': return b.margen - a.margen
      case 'margen_asc': return a.margen - b.margen
      case 'presupuesto_desc': return b.presupuestado - a.presupuestado
      case 'nombre': return a.nombre.localeCompare(b.nombre)
      default: return 0
    }
  })

  // Totales globales
  const totales = filtradas.reduce((acc, o) => ({
    presupuestado: acc.presupuestado + o.presupuestado,
    coste: acc.coste + o.coste,
    facturado: acc.facturado + o.facturado,
    beneficio: acc.beneficio + o.beneficio,
  }), { presupuestado: 0, coste: 0, facturado: 0, beneficio: 0 })

  const margenGlobal = totales.presupuestado > 0
    ? (totales.beneficio / totales.presupuestado) * 100
    : 0

  // Distribución por rentabilidad
  const dist = {
    buena:  filtradas.filter(o => o.margen >= 35).length,
    media:  filtradas.filter(o => o.margen >= 20 && o.margen < 35).length,
    baja:   filtradas.filter(o => o.margen >= 0 && o.margen < 20).length,
    negat:  filtradas.filter(o => o.margen < 0).length,
  }

  const fmt = v => v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Rentabilidad por obras</h1>
        <p className="text-sm text-ink-soft mt-0.5">Comparativa presupuesto vs coste real · margen de cada proyecto</p>
      </div>

      {/* Resumen global */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card text-center">
          <div className="text-xl font-bold text-ink">{fmt(totales.presupuestado)}</div>
          <div className="text-xs text-ink-soft mt-1">Total presupuestado</div>
        </div>
        <div className="card text-center">
          <div className="text-xl font-bold text-ink">{fmt(totales.coste)}</div>
          <div className="text-xs text-ink-soft mt-1">Coste real acumulado</div>
        </div>
        <div className={`card text-center ${totales.beneficio >= 0 ? '' : 'border-red-200'}`}>
          <div className={`text-xl font-bold ${totales.beneficio >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {fmt(totales.beneficio)}
          </div>
          <div className="text-xs text-ink-soft mt-1">Beneficio neto</div>
        </div>
        <div className="card text-center bg-navy">
          <div className={`text-xl font-bold ${margenGlobal >= 30 ? 'text-green-400' : margenGlobal >= 15 ? 'text-gold' : 'text-orange-400'}`}>
            {margenGlobal.toFixed(1)}%
          </div>
          <div className="text-xs text-white/50 mt-1">Margen global</div>
        </div>
      </div>

      {/* Semáforo de obras */}
      <div className="card mb-6">
        <div className="text-xs font-bold uppercase tracking-widest text-ink-soft mb-4">Distribución de rentabilidad</div>
        <div className="grid grid-cols-4 gap-3 text-center">
          {[
            { label: 'Excelente', sub: '≥ 35%', count: dist.buena, color: 'text-green-700', bg: 'bg-green-100' },
            { label: 'Buena', sub: '20–35%', count: dist.media, color: 'text-gold-dark', bg: 'bg-gold/20' },
            { label: 'Justa', sub: '0–20%', count: dist.baja, color: 'text-orange-600', bg: 'bg-orange-100' },
            { label: 'Negativa', sub: '< 0%', count: dist.negat, color: 'text-red-600', bg: 'bg-red-100' },
          ].map(d => (
            <div key={d.label} className={`rounded-xl p-3 ${d.bg}`}>
              <div className={`text-2xl font-bold ${d.color}`}>{d.count}</div>
              <div className={`text-xs font-semibold mt-0.5 ${d.color}`}>{d.label}</div>
              <div className="text-xs text-ink-soft">{d.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select className="input w-auto" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {['pendiente', 'en_curso', 'pausada', 'completada', 'cancelada'].map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}</option>
          ))}
        </select>
        <select className="input w-auto" value={orden} onChange={e => setOrden(e.target.value)}>
          <option value="margen_desc">Mayor margen primero</option>
          <option value="margen_asc">Menor margen primero</option>
          <option value="presupuesto_desc">Mayor presupuesto primero</option>
          <option value="nombre">Por nombre</option>
        </select>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="text-ink-soft text-sm py-10 text-center">Cargando obras…</div>
      ) : ordenadas.length === 0 ? (
        <div className="card text-center py-14">
          <div className="text-5xl mb-3">📈</div>
          <div className="font-bold text-ink mb-1">Sin obras que analizar</div>
          <div className="text-sm text-ink-soft">Crea obras y añade costes para ver la rentabilidad</div>
        </div>
      ) : (
        <div className="space-y-3">
          {ordenadas.map(o => (
            <div key={o.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-bold text-ink text-base">{o.nombre}</span>
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${ESTADOS_COLOR[o.estado] || ''}`}>
                      {o.estado?.replace('_', ' ')}
                    </span>
                  </div>
                  {o.clientes?.nombre && <div className="text-sm text-ink-soft mt-0.5">👤 {o.clientes.nombre}</div>}
                </div>
                <div className={`text-right flex-shrink-0 px-4 py-2 rounded-xl ${o.margen >= 35 ? 'bg-green-100' : o.margen >= 20 ? 'bg-gold/15' : o.margen >= 0 ? 'bg-orange-100' : 'bg-red-100'}`}>
                  <div className={`text-2xl font-black ${o.margen >= 35 ? 'text-green-700' : o.margen >= 20 ? 'text-gold-dark' : o.margen >= 0 ? 'text-orange-600' : 'text-red-600'}`}>
                    {o.margen.toFixed(1)}%
                  </div>
                  <div className="text-xs text-ink-soft">margen</div>
                </div>
              </div>

              {/* Barra de margen */}
              <MargenBar margen={o.margen} />

              {/* Desglose económico */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-edge">
                <div>
                  <div className="text-xs text-ink-soft uppercase tracking-wide">Presupuestado</div>
                  <div className="font-bold text-ink mt-0.5">
                    {o.presupuestado > 0 ? fmt(o.presupuestado) : <span className="text-ink-soft/40">Sin dato</span>}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-ink-soft uppercase tracking-wide">Coste real</div>
                  <div className="font-bold text-ink mt-0.5">
                    {o.coste > 0 ? fmt(o.coste) : <span className="text-ink-soft/40">Sin dato</span>}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-ink-soft uppercase tracking-wide">Facturado</div>
                  <div className="font-bold text-ink mt-0.5">
                    {o.facturado > 0 ? fmt(o.facturado) : <span className="text-ink-soft/40">Sin factura</span>}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-ink-soft uppercase tracking-wide">Beneficio</div>
                  <div className={`font-bold mt-0.5 ${o.beneficio >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {o.presupuestado > 0 || o.coste > 0 ? fmt(o.beneficio) : <span className="text-ink-soft/40">Sin dato</span>}
                  </div>
                </div>
              </div>

              {/* Alerta si falta info */}
              {o.presupuestado === 0 && o.coste === 0 && (
                <div className="mt-3 text-xs text-ink-soft/60 bg-page rounded-lg px-3 py-2">
                  💡 Añade presupuesto total y coste real en la obra para ver la rentabilidad
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
