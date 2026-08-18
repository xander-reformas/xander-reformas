import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

function totalFactura(f) {
  const base = (f.items || []).reduce((s, i) => s + (parseFloat(i.importe) || 0), 0)
  const dto = base * (f.descuento || 0) / 100
  const baseDto = base - dto
  const iva = baseDto * (f.iva || 0) / 100
  const ret = baseDto * (f.retencion || 0) / 100
  return baseDto + iva - ret
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export default function Resultados() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [anio, setAnio] = useState(new Date().getFullYear())

  useEffect(() => { load() }, [anio])

  async function load() {
    setLoading(true)
    const desde = `${anio}-01-01`
    const hasta = `${anio}-12-31`

    const [{ data: facs }, { data: gts, error: gErr }] = await Promise.all([
      supabase.from('facturas').select('fecha, estado, items, iva, descuento, retencion').gte('fecha', desde).lte('fecha', hasta),
      supabase.from('gastos').select('fecha, importe, categoria').gte('fecha', desde).lte('fecha', hasta),
    ])

    const facturas = facs || []
    const gastos = gErr ? [] : (gts || [])
    const sinGastos = !!gErr

    // Por mes
    const mesesData = Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, '0')
      const facsMes = facturas.filter(f => f.fecha?.startsWith(`${anio}-${m}`))
      const gtosMes = gastos.filter(g => g.fecha?.startsWith(`${anio}-${m}`))
      const ingresos = facsMes.filter(f => f.estado === 'pagada').reduce((s, f) => s + totalFactura(f), 0)
      const facturado = facsMes.reduce((s, f) => s + totalFactura(f), 0)
      const gastosMes = gtosMes.reduce((s, g) => s + parseFloat(g.importe || 0), 0)
      return { mes: MESES[i], ingresos, facturado, gastos: gastosMes, resultado: ingresos - gastosMes }
    })

    // Totales año
    const totalFacturado = facturas.reduce((s, f) => s + totalFactura(f), 0)
    const totalCobrado = facturas.filter(f => f.estado === 'pagada').reduce((s, f) => s + totalFactura(f), 0)
    const totalGastos = gastos.reduce((s, g) => s + parseFloat(g.importe || 0), 0)
    const resultado = totalCobrado - totalGastos

    // Por categoría de gasto
    const gastosPorCat = gastos.reduce((acc, g) => {
      acc[g.categoria] = (acc[g.categoria] || 0) + parseFloat(g.importe || 0)
      return acc
    }, {})

    setData({ mesesData, totalFacturado, totalCobrado, totalGastos, resultado, gastosPorCat, sinGastos })
    setLoading(false)
  }

  const fmt = v => v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
  const anios = [new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2]

  if (loading) return <div className="p-6 text-stone text-sm py-10 text-center">Calculando resultados…</div>

  const maxBar = Math.max(...data.mesesData.map(m => Math.max(m.facturado, m.gastos)), 1)

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy">Resultados</h1>
          <p className="text-sm text-stone mt-0.5">Cuenta de resultados del negocio</p>
        </div>
        <div className="flex gap-1 bg-arena-dark rounded-xl p-1">
          {anios.map(a => (
            <button key={a} onClick={() => setAnio(a)}
              className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors ${anio === a ? 'bg-white text-navy shadow-sm' : 'text-stone hover:text-navy'}`}>
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total facturado', value: fmt(data.totalFacturado), sub: 'todas las facturas', color: 'text-navy', border: 'border-l-navy' },
          { label: 'Ingresos reales', value: fmt(data.totalCobrado), sub: 'facturas cobradas', color: 'text-green-700', border: 'border-l-green-500' },
          { label: 'Gastos totales', value: fmt(data.totalGastos), sub: data.sinGastos ? 'tabla no configurada' : 'gastos registrados', color: 'text-red-600', border: 'border-l-red-400' },
          {
            label: 'Resultado neto',
            value: fmt(data.resultado),
            sub: data.resultado >= 0 ? 'beneficio' : 'pérdida',
            color: data.resultado >= 0 ? 'text-green-700' : 'text-red-600',
            border: data.resultado >= 0 ? 'border-l-green-500' : 'border-l-red-500',
            highlight: true,
          },
        ].map(k => (
          <div key={k.label} className={`card border-l-4 ${k.border} ${k.highlight ? 'bg-navy' : ''}`}>
            <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${k.highlight ? 'text-white/50' : 'text-stone'}`}>{k.label}</div>
            <div className={`text-xl font-bold ${k.highlight ? (data.resultado >= 0 ? 'text-green-400' : 'text-red-400') : k.color}`}>{k.value}</div>
            <div className={`text-xs mt-1 ${k.highlight ? 'text-white/40' : 'text-stone'}`}>{k.sub}</div>
          </div>
        ))}
      </div>

      {data.sinGastos && (
        <div className="bg-gold/10 border border-gold/30 rounded-xl px-4 py-3 mb-6 text-sm text-stone">
          ⚠️ La tabla de gastos no está configurada. Ve a <strong>Gastos</strong> y sigue las instrucciones para activarla.
        </div>
      )}

      {/* Gráfico de barras mensual */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="text-xs font-bold uppercase tracking-widest text-stone">Evolución mensual {anio}</div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-navy inline-block" />Facturado</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block" />Gastos</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" />Cobrado</span>
          </div>
        </div>
        <div className="flex items-end gap-1 h-40">
          {data.mesesData.map(m => {
            const hFac = Math.round((m.facturado / maxBar) * 100)
            const hGto = Math.round((m.gastos / maxBar) * 100)
            const hCob = Math.round((m.ingresos / maxBar) * 100)
            const tieneData = m.facturado > 0 || m.gastos > 0
            return (
              <div key={m.mes} className="flex-1 flex flex-col items-center gap-0.5" title={`${m.mes}: Facturado ${fmt(m.facturado)}, Gastos ${fmt(m.gastos)}`}>
                <div className="w-full flex items-end justify-center gap-0.5 flex-1">
                  <div className="flex-1 bg-navy rounded-t-sm transition-all" style={{ height: `${Math.max(hFac, tieneData ? 2 : 0)}%`, minHeight: tieneData ? '2px' : '0' }} />
                  <div className="flex-1 bg-red-400 rounded-t-sm transition-all" style={{ height: `${Math.max(hGto, tieneData ? 2 : 0)}%`, minHeight: tieneData ? '2px' : '0' }} />
                  <div className="flex-1 bg-green-500 rounded-t-sm transition-all" style={{ height: `${Math.max(hCob, tieneData ? 2 : 0)}%`, minHeight: tieneData ? '2px' : '0' }} />
                </div>
                <div className="text-[10px] text-stone mt-1">{m.mes}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tabla mensual */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 bg-arena-dark text-xs font-bold uppercase tracking-widest text-stone">Detalle por mes</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-arena-dark text-xs text-stone">
                <th className="text-left px-4 py-2">Mes</th>
                <th className="text-right px-3 py-2">Facturado</th>
                <th className="text-right px-3 py-2">Gastos</th>
                <th className="text-right px-4 py-2">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-arena-dark">
              {data.mesesData.map((m, i) => {
                const tieneData = m.facturado > 0 || m.ingresos > 0 || m.gastos > 0
                if (!tieneData && i > new Date().getMonth()) return null
                return (
                  <tr key={m.mes} className={`${!tieneData ? 'opacity-40' : ''}`}>
                    <td className="px-4 py-2.5 font-medium text-navy">{m.mes}</td>
                    <td className="px-3 py-2.5 text-right text-stone text-xs">{m.facturado > 0 ? fmt(m.facturado) : '—'}</td>
                    <td className="px-3 py-2.5 text-right text-stone text-xs">{m.gastos > 0 ? fmt(m.gastos) : '—'}</td>
                    <td className={`px-4 py-2.5 text-right font-bold text-xs ${m.resultado > 0 ? 'text-green-700' : m.resultado < 0 ? 'text-red-600' : 'text-stone'}`}>
                      {m.ingresos > 0 || m.gastos > 0 ? fmt(m.resultado) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-arena-dark border-t-2 border-arena font-bold">
                <td className="px-4 py-2.5 text-xs uppercase text-stone">Total {anio}</td>
                <td className="px-3 py-2.5 text-right text-xs text-navy">{fmt(data.totalFacturado)}</td>
                <td className="px-3 py-2.5 text-right text-xs text-red-600">{fmt(data.totalGastos)}</td>
                <td className={`px-4 py-2.5 text-right text-xs ${data.resultado >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(data.resultado)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Gastos por categoría */}
        <div className="card">
          <div className="text-xs font-bold uppercase tracking-widest text-stone mb-4">Gastos por categoría</div>
          {data.sinGastos || Object.keys(data.gastosPorCat).length === 0 ? (
            <div className="text-sm text-stone text-center py-8">
              {data.sinGastos ? 'Tabla de gastos no configurada' : 'Sin gastos registrados en ' + anio}
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(data.gastosPorCat).sort(([, a], [, b]) => b - a).map(([cat, val]) => {
                const pct = data.totalGastos > 0 ? (val / data.totalGastos) * 100 : 0
                return (
                  <div key={cat}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-stone truncate max-w-[65%]">{cat}</span>
                      <span className="font-semibold text-navy">{fmt(val)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-arena-dark rounded-full">
                        <div className="h-2 bg-red-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-stone w-8 text-right">{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
