import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

const TRIMESTRES = [
  { t: '1T', meses: 'Enero – Marzo', presentacion: 'Hasta el 20 de abril' },
  { t: '2T', meses: 'Abril – Junio', presentacion: 'Hasta el 20 de julio' },
  { t: '3T', meses: 'Julio – Septiembre', presentacion: 'Hasta el 20 de octubre' },
  { t: '4T', meses: 'Octubre – Diciembre', presentacion: 'Hasta el 30 de enero (año siguiente)' },
]

const MODELOS = [
  {
    num: '130', nombre: 'IRPF fraccionado', periodo: 'Trimestral',
    desc: 'Pago a cuenta del IRPF. Si facturas con retención del 15% a empresas, es posible que no tengas que presentarlo. Calcula el 20% sobre el rendimiento neto (ingresos menos gastos).',
    color: 'bg-blue-100 text-blue-700',
  },
  {
    num: '303', nombre: 'IVA', periodo: 'Trimestral',
    desc: 'IVA repercutido (el que cobras en facturas) menos IVA soportado (el que pagas en compras y gastos). El resultado positivo se ingresa; el negativo se compensa.',
    color: 'bg-gold/20 text-gold-dark',
  },
  {
    num: '111', nombre: 'Retenciones IRPF', periodo: 'Trimestral',
    desc: 'Si tienes trabajadores o pagas a profesionales con retención, debes liquidar las retenciones practicadas.',
    color: 'bg-purple-100 text-purple-700',
  },
  {
    num: '100', nombre: 'Declaración de la Renta', periodo: 'Anual',
    desc: 'Presentación entre abril y junio del año siguiente. Incluye todos los rendimientos de actividad económica del año.',
    color: 'bg-green-100 text-green-700',
  },
  {
    num: '390', nombre: 'Resumen anual IVA', periodo: 'Anual',
    desc: 'Resumen de todos los trimestres del Modelo 303. Se presenta en enero del año siguiente.',
    color: 'bg-orange-100 text-orange-700',
  },
]

const TIPS = [
  { icon: '🧾', titulo: 'Guarda TODOS los tickets', desc: 'Materiales, gasolina, herramientas, ropa de trabajo, móvil (50%), dietas en obra. Si no tienes el justificante, no es deducible.' },
  { icon: '🏠', titulo: 'Despacho en casa', desc: 'Si usas parte de tu vivienda para trabajo, puedes deducir un % proporcional de suministros (luz, internet). Consulta con tu gestor el porcentaje.' },
  { icon: '🚗', titulo: 'Vehículo profesional', desc: 'Si tienes vehículo exclusivamente profesional (furgoneta de trabajo) deduces el 100%. Turismo personal: solo si es de uso exclusivo profesional.' },
  { icon: '📱', titulo: 'Teléfono y tecnología', desc: 'Móvil, ordenador, software: deducible al 100% si es uso exclusivamente profesional, al 50% si es mixto.' },
  { icon: '📅', titulo: 'Tarifa plana de autónomo', desc: 'Primeros 12 meses: cuota fija reducida. Prorrogable 12 meses más si los ingresos no superan el SMI. Gestiona bien el momento del alta.' },
  { icon: '💡', titulo: 'IVA en reformas', desc: 'Tipo reducido 10% para obras de rehabilitación de viviendas particulares con más de 2 años de antigüedad. Tipo general 21% para locales y obras nuevas.' },
]

// --- Documento de conciliación fiscal (para cruzar con la gestoría) ---

function calculosFactura(items, iva, descuento, retencion) {
  const base = (items || []).reduce((s, i) => s + (parseFloat(i.importe) || 0), 0)
  const dto = base * (parseFloat(descuento) || 0) / 100
  const baseConDto = base - dto
  const ivaImporte = baseConDto * (parseFloat(iva) || 0) / 100
  const retImporte = baseConDto * (parseFloat(retencion) || 0) / 100
  const total = baseConDto + ivaImporte - retImporte
  return { base, dto, baseConDto, ivaImporte, retImporte, total }
}

function rangoTrimestre(anio, t) {
  const inicios = { 1: '01-01', 2: '04-01', 3: '07-01', 4: '10-01' }
  const fines = { 1: '03-31', 2: '06-30', 3: '09-30', 4: '12-31' }
  return { desde: `${anio}-${inicios[t]}`, hasta: `${anio}-${fines[t]}` }
}

function rangoAnio(anio) {
  return { desde: `${anio}-01-01`, hasta: `${anio}-12-31` }
}

const fmtEUR = v => (v || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })

function ConciliacionModal({ tipo, anio, trimestre, onClose }) {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [facturas, setFacturas] = useState([])
  const [gastos, setGastos] = useState([])
  const [errorGastos, setErrorGastos] = useState(false)

  const { desde, hasta } = tipo === 'trimestral' ? rangoTrimestre(anio, trimestre) : rangoAnio(anio)

  useEffect(() => {
    let cancelled = false
    async function cargar() {
      setLoading(true)
      const [{ data: facs }, { data: gts, error: gErr }] = await Promise.all([
        supabase.from('facturas')
          .select('numero, fecha, estado, items, iva, descuento, retencion, clientes(nombre)')
          .gte('fecha', desde).lte('fecha', hasta).neq('estado', 'borrador').order('fecha'),
        supabase.from('gastos')
          .select('fecha, categoria, descripcion, proveedor, importe_base, iva_pct, importe')
          .gte('fecha', desde).lte('fecha', hasta).order('fecha'),
      ])
      if (cancelled) return
      setFacturas(facs || [])
      setGastos(gErr ? [] : (gts || []))
      setErrorGastos(!!gErr)
      setLoading(false)
    }
    cargar()
    return () => { cancelled = true }
  }, [desde, hasta])

  const facturasCalc = facturas.map(f => ({ ...f, ...calculosFactura(f.items || [], f.iva, f.descuento, f.retencion) }))
  const baseFacturado = facturasCalc.reduce((s, f) => s + f.baseConDto, 0)
  const ivaRepercutido = facturasCalc.reduce((s, f) => s + f.ivaImporte, 0)
  const retencionesPracticadas = facturasCalc.reduce((s, f) => s + f.retImporte, 0)
  const totalFacturado = facturasCalc.reduce((s, f) => s + f.total, 0)

  const gastosCalc = gastos.map(g => {
    const base = parseFloat(g.importe_base) || 0
    const ivaSoportado = base * (parseFloat(g.iva_pct) || 0) / 100
    return { ...g, base, ivaSoportado }
  })
  const baseGastos = gastosCalc.reduce((s, g) => s + g.base, 0)
  const ivaSoportado = gastosCalc.reduce((s, g) => s + g.ivaSoportado, 0)
  const totalGastos = gastosCalc.reduce((s, g) => s + (parseFloat(g.importe) || 0), 0)

  const resultadoIVA = ivaRepercutido - ivaSoportado
  const rendimientoNeto = baseFacturado - baseGastos
  const pago130Estimado = Math.max(0, rendimientoNeto * 0.20 - retencionesPracticadas)

  const etiquetaPeriodo = tipo === 'trimestral' ? `${trimestre}T ${anio}` : `Año ${anio}`

  return (
    <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-3xl my-4">
        <div className="px-6 py-4 border-b border-edge flex items-center justify-between no-print">
          <h2 className="text-lg font-bold text-ink">Conciliación fiscal — {etiquetaPeriodo}</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
        </div>

        {loading ? (
          <div className="p-10 text-center text-ink-soft text-sm">Cargando datos del periodo…</div>
        ) : (
          <div className="print-area p-8 text-sm text-ink">
            {/* Cabecera */}
            <div className="flex justify-between items-start gap-6 mb-6">
              <div>
                <div className="text-lg font-black text-ink">{profile?.empresa_nombre || 'Mi empresa'}</div>
                {profile?.empresa_nif && <div className="text-ink-soft">NIF: {profile.empresa_nif}</div>}
                {profile?.empresa_direccion && <div className="text-ink-soft">{profile.empresa_direccion}</div>}
              </div>
              <div className="text-right">
                <div className="text-xl font-black text-navy">CONCILIACIÓN FISCAL</div>
                <div className="font-bold text-ink">{etiquetaPeriodo}</div>
                <div className="text-ink-soft mt-1">Del {new Date(desde).toLocaleDateString('es-ES')} al {new Date(hasta).toLocaleDateString('es-ES')}</div>
                <div className="text-ink-soft text-xs mt-0.5">Generado: {new Date().toLocaleDateString('es-ES')}</div>
              </div>
            </div>

            <div className="bg-gold/10 border border-gold/30 rounded-xl px-4 py-2.5 mb-6 text-xs text-ink-soft">
              ⚠️ Documento orientativo generado automáticamente a partir de tus facturas y gastos registrados. Compártelo con tu gestoría para cruzar cifras antes de presentar los modelos — no sustituye su cálculo ni asesoramiento profesional.
            </div>

            {/* Facturas emitidas */}
            <div className="mb-6">
              <div className="text-xs font-bold uppercase tracking-widest text-ink-soft mb-2">Facturas emitidas ({facturasCalc.length})</div>
              {facturasCalc.length === 0 ? (
                <div className="text-ink-soft text-xs">Sin facturas emitidas en este periodo.</div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b-2 border-ink/20 text-ink-soft uppercase tracking-wide">
                      <th className="text-left py-1.5">Fecha</th>
                      <th className="text-left py-1.5">Nº</th>
                      <th className="text-left py-1.5">Cliente</th>
                      <th className="text-left py-1.5">Estado</th>
                      <th className="text-right py-1.5">Base</th>
                      <th className="text-right py-1.5">IVA</th>
                      <th className="text-right py-1.5">Ret.</th>
                      <th className="text-right py-1.5">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-edge">
                    {facturasCalc.map((f, i) => (
                      <tr key={i}>
                        <td className="py-1.5">{new Date(f.fecha).toLocaleDateString('es-ES')}</td>
                        <td className="py-1.5">{f.numero}</td>
                        <td className="py-1.5">{f.clientes?.nombre || '—'}</td>
                        <td className="py-1.5 capitalize">{f.estado}</td>
                        <td className="text-right py-1.5">{fmtEUR(f.baseConDto)}</td>
                        <td className="text-right py-1.5">{fmtEUR(f.ivaImporte)}</td>
                        <td className="text-right py-1.5">{f.retImporte > 0 ? `−${fmtEUR(f.retImporte)}` : '—'}</td>
                        <td className="text-right py-1.5 font-semibold">{fmtEUR(f.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-ink/20 font-bold">
                      <td className="py-1.5" colSpan={4}>Total</td>
                      <td className="text-right py-1.5">{fmtEUR(baseFacturado)}</td>
                      <td className="text-right py-1.5">{fmtEUR(ivaRepercutido)}</td>
                      <td className="text-right py-1.5">{retencionesPracticadas > 0 ? `−${fmtEUR(retencionesPracticadas)}` : '—'}</td>
                      <td className="text-right py-1.5">{fmtEUR(totalFacturado)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            {/* Gastos */}
            <div className="mb-6">
              <div className="text-xs font-bold uppercase tracking-widest text-ink-soft mb-2">Gastos registrados ({gastosCalc.length})</div>
              {errorGastos ? (
                <div className="text-ink-soft text-xs">El módulo de Gastos no está configurado todavía.</div>
              ) : gastosCalc.length === 0 ? (
                <div className="text-ink-soft text-xs">Sin gastos registrados en este periodo.</div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b-2 border-ink/20 text-ink-soft uppercase tracking-wide">
                      <th className="text-left py-1.5">Fecha</th>
                      <th className="text-left py-1.5">Proveedor</th>
                      <th className="text-left py-1.5">Categoría</th>
                      <th className="text-right py-1.5">Base</th>
                      <th className="text-right py-1.5">IVA soport.</th>
                      <th className="text-right py-1.5">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-edge">
                    {gastosCalc.map((g, i) => (
                      <tr key={i}>
                        <td className="py-1.5">{new Date(g.fecha).toLocaleDateString('es-ES')}</td>
                        <td className="py-1.5">{g.proveedor || g.descripcion || '—'}</td>
                        <td className="py-1.5">{g.categoria}</td>
                        <td className="text-right py-1.5">{fmtEUR(g.base)}</td>
                        <td className="text-right py-1.5">{fmtEUR(g.ivaSoportado)}</td>
                        <td className="text-right py-1.5 font-semibold">{fmtEUR(g.importe)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-ink/20 font-bold">
                      <td className="py-1.5" colSpan={3}>Total</td>
                      <td className="text-right py-1.5">{fmtEUR(baseGastos)}</td>
                      <td className="text-right py-1.5">{fmtEUR(ivaSoportado)}</td>
                      <td className="text-right py-1.5">{fmtEUR(totalGastos)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            {/* Resumen fiscal */}
            <div className="bg-page rounded-xl p-4">
              <div className="text-xs font-bold uppercase tracking-widest text-ink-soft mb-3">Resumen para modelos 303 / 130{tipo === 'anual' ? ' / 390' : ''}</div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
                <div className="flex justify-between"><span className="text-ink-soft">IVA repercutido (ventas)</span><span className="font-semibold">{fmtEUR(ivaRepercutido)}</span></div>
                <div className="flex justify-between"><span className="text-ink-soft">IVA soportado (gastos)</span><span className="font-semibold">−{fmtEUR(ivaSoportado)}</span></div>
                <div className="flex justify-between col-span-2 border-t border-edge pt-1.5 mt-0.5">
                  <span className="font-bold text-ink">Resultado IVA (Modelo 303)</span>
                  <span className="font-black">{resultadoIVA >= 0 ? `A ingresar: ${fmtEUR(resultadoIVA)}` : `A compensar: ${fmtEUR(Math.abs(resultadoIVA))}`}</span>
                </div>
                <div className="flex justify-between mt-2"><span className="text-ink-soft">Ingresos (base)</span><span className="font-semibold">{fmtEUR(baseFacturado)}</span></div>
                <div className="flex justify-between mt-2"><span className="text-ink-soft">Gastos (base)</span><span className="font-semibold">−{fmtEUR(baseGastos)}</span></div>
                <div className="flex justify-between col-span-2 border-t border-edge pt-1.5 mt-0.5">
                  <span className="font-bold text-ink">Rendimiento neto estimado</span><span className="font-black">{fmtEUR(rendimientoNeto)}</span>
                </div>
                <div className="flex justify-between"><span className="text-ink-soft">Retenciones IRPF ya practicadas</span><span className="font-semibold">−{fmtEUR(retencionesPracticadas)}</span></div>
                <div className="flex justify-between"><span className="text-ink-soft">Pago fraccionado 20% (Modelo 130, orientativo)</span><span className="font-semibold">{fmtEUR(pago130Estimado)}</span></div>
              </div>
            </div>
          </div>
        )}

        <div className="px-6 pb-6 pt-4 flex gap-3 no-print">
          <button onClick={onClose} className="btn-secondary flex-1">Cerrar</button>
          <button onClick={() => window.print()} className="btn-primary flex-1">🖨️ Imprimir / PDF</button>
        </div>
      </div>
    </div>
  )
}

function SelectorConciliacion({ onClose }) {
  const hoy = new Date()
  const [tipo, setTipo] = useState('trimestral')
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [trimestre, setTrimestre] = useState(Math.ceil((hoy.getMonth() + 1) / 3))
  const [generando, setGenerando] = useState(false)

  if (generando) {
    return <ConciliacionModal tipo={tipo} anio={anio} trimestre={trimestre} onClose={onClose} />
  }

  const anios = Array.from({ length: 5 }, (_, i) => hoy.getFullYear() - i)

  return (
    <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-ink">Documento de conciliación</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
        </div>
        <p className="text-sm text-ink-soft mb-5">Elige el periodo y genera un documento con el detalle de facturas, gastos y el resumen de IVA/IRPF para cruzar con tu gestoría.</p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-ink-soft mb-1.5 block">Tipo de documento</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setTipo('trimestral')} className={`px-3 py-2 rounded-lg text-sm font-semibold border ${tipo === 'trimestral' ? 'bg-gold text-navy border-gold' : 'border-edge text-ink-soft'}`}>
                Trimestral (130/303)
              </button>
              <button onClick={() => setTipo('anual')} className={`px-3 py-2 rounded-lg text-sm font-semibold border ${tipo === 'anual' ? 'bg-gold text-navy border-gold' : 'border-edge text-ink-soft'}`}>
                Anual (390/100)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-ink-soft mb-1.5 block">Año</label>
              <select value={anio} onChange={e => setAnio(parseInt(e.target.value))} className="input w-full">
                {anios.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            {tipo === 'trimestral' && (
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-ink-soft mb-1.5 block">Trimestre</label>
                <select value={trimestre} onChange={e => setTrimestre(parseInt(e.target.value))} className="input w-full">
                  {[1, 2, 3, 4].map(t => <option key={t} value={t}>{t}T</option>)}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={() => setGenerando(true)} className="btn-primary flex-1">Generar documento</button>
        </div>
      </div>
    </div>
  )
}

export default function Fiscal() {
  const [showConciliacion, setShowConciliacion] = useState(false)

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Fiscal</h1>
        <p className="text-sm text-ink-soft mt-0.5">Guía fiscal para autónomos del sector reformas en España</p>
      </div>

      <div className="bg-gold/10 border border-gold/30 rounded-xl px-4 py-3 mb-6 text-sm text-ink-soft">
        ⚠️ Esta guía es orientativa. Consulta siempre con tu gestor o asesor fiscal para decisiones concretas.
      </div>

      <div className="card flex items-center justify-between gap-4 mb-8 bg-navy/5 border-navy/20">
        <div>
          <div className="font-bold text-ink">📄 Conciliación con tu gestoría</div>
          <p className="text-sm text-ink-soft mt-0.5">Genera un documento con tus facturas, gastos y el resumen de IVA/IRPF del periodo, listo para cruzar antes de presentar el modelo correspondiente.</p>
        </div>
        <button onClick={() => setShowConciliacion(true)} className="btn-primary whitespace-nowrap flex-shrink-0">Generar documento</button>
      </div>

      {showConciliacion && <SelectorConciliacion onClose={() => setShowConciliacion(false)} />}

      {/* Calendario trimestral */}
      <div className="mb-8">
        <h2 className="text-sm font-bold uppercase tracking-widest text-ink-soft mb-4">📅 Calendario de declaraciones</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {TRIMESTRES.map(t => {
            const ahora = new Date()
            const mesActual = ahora.getMonth() + 1
            const esActual = (t.t === '1T' && mesActual <= 4) || (t.t === '2T' && mesActual <= 7 && mesActual >= 4) || (t.t === '3T' && mesActual <= 10 && mesActual >= 7) || (t.t === '4T' && mesActual >= 10)
            return (
              <div key={t.t} className={`card text-center ${esActual ? 'border-gold border-2 bg-gold/5' : ''}`}>
                <div className={`text-2xl font-black mb-1 ${esActual ? 'text-gold' : 'text-ink'}`}>{t.t}</div>
                <div className="text-xs text-ink-soft mb-2">{t.meses}</div>
                <div className={`text-xs font-semibold ${esActual ? 'text-gold-dark' : 'text-ink-soft'}`}>{t.presentacion}</div>
                {esActual && <div className="mt-2 text-xs bg-gold text-navy font-bold px-2 py-0.5 rounded-full">Próximo</div>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Modelos */}
      <div className="mb-8">
        <h2 className="text-sm font-bold uppercase tracking-widest text-ink-soft mb-4">📋 Modelos a presentar</h2>
        <div className="space-y-3">
          {MODELOS.map(m => (
            <div key={m.num} className="card flex items-start gap-4">
              <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center font-black text-lg ${m.color}`}>
                {m.num}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <span className="font-bold text-ink">{m.nombre}</span>
                  <span className="text-xs bg-edge text-ink-soft px-2 py-0.5 rounded-full">{m.periodo}</span>
                </div>
                <p className="text-sm text-ink-soft">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tips deducibles */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest text-ink-soft mb-4">💡 Gastos deducibles clave</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TIPS.map(tip => (
            <div key={tip.titulo} className="card">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{tip.icon}</span>
                <div>
                  <div className="font-bold text-ink text-sm mb-1">{tip.titulo}</div>
                  <p className="text-xs text-ink-soft leading-relaxed">{tip.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
