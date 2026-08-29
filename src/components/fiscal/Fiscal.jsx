import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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

  const etiquetaPeriodo = tipo === 'trimestral' ? `${trimestre}T ${anio}` : t('fiscal.modal.anio', { anio })

  return (
    <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-3xl my-4">
        <div className="px-6 py-4 border-b border-edge flex items-center justify-between no-print">
          <h2 className="text-lg font-bold text-ink">{t('fiscal.modal.title', { periodo: etiquetaPeriodo })}</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
        </div>

        {loading ? (
          <div className="p-10 text-center text-ink-soft text-sm">{t('fiscal.modal.loading')}</div>
        ) : (
          <div className="print-area p-8 text-sm text-ink">
            {/* Cabecera */}
            <div className="flex justify-between items-start gap-6 mb-6">
              <div>
                <div className="text-lg font-black text-ink">{profile?.empresa_nombre || t('fiscal.modal.empresaDefault')}</div>
                {profile?.empresa_nif && <div className="text-ink-soft">{t('fiscal.modal.nif', { v: profile.empresa_nif })}</div>}
                {profile?.empresa_direccion && <div className="text-ink-soft">{profile.empresa_direccion}</div>}
              </div>
              <div className="text-right">
                <div className="text-xl font-black text-navy">{t('fiscal.modal.tituloDoc')}</div>
                <div className="font-bold text-ink">{etiquetaPeriodo}</div>
                <div className="text-ink-soft mt-1">{t('fiscal.modal.delAl', { desde: new Date(desde).toLocaleDateString('es-ES'), hasta: new Date(hasta).toLocaleDateString('es-ES') })}</div>
                <div className="text-ink-soft text-xs mt-0.5">{t('fiscal.modal.generado', { fecha: new Date().toLocaleDateString('es-ES') })}</div>
              </div>
            </div>

            <div className="bg-gold/10 border border-gold/30 rounded-xl px-4 py-2.5 mb-6 text-xs text-ink-soft">
              {t('fiscal.modal.disclaimerModal')}
            </div>

            {/* Facturas emitidas */}
            <div className="mb-6">
              <div className="text-xs font-bold uppercase tracking-widest text-ink-soft mb-2">{t('fiscal.modal.facturasEmitidas', { count: facturasCalc.length })}</div>
              {facturasCalc.length === 0 ? (
                <div className="text-ink-soft text-xs">{t('fiscal.modal.sinFacturas')}</div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b-2 border-ink/20 text-ink-soft uppercase tracking-wide">
                      <th className="text-left py-1.5">{t('fiscal.modal.tabla.fecha')}</th>
                      <th className="text-left py-1.5">{t('fiscal.modal.tabla.numero')}</th>
                      <th className="text-left py-1.5">{t('fiscal.modal.tabla.cliente')}</th>
                      <th className="text-left py-1.5">{t('fiscal.modal.tabla.estado')}</th>
                      <th className="text-right py-1.5">{t('fiscal.modal.tabla.base')}</th>
                      <th className="text-right py-1.5">{t('fiscal.modal.tabla.iva')}</th>
                      <th className="text-right py-1.5">{t('fiscal.modal.tabla.ret')}</th>
                      <th className="text-right py-1.5">{t('fiscal.modal.tabla.total')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-edge">
                    {facturasCalc.map((f, i) => (
                      <tr key={i}>
                        <td className="py-1.5">{new Date(f.fecha).toLocaleDateString('es-ES')}</td>
                        <td className="py-1.5">{f.numero}</td>
                        <td className="py-1.5">{f.clientes?.nombre || t('fiscal.modal.sinCliente')}</td>
                        <td className="py-1.5 capitalize">{t(`facturas.estado.${f.estado}`, f.estado)}</td>
                        <td className="text-right py-1.5">{fmtEUR(f.baseConDto)}</td>
                        <td className="text-right py-1.5">{fmtEUR(f.ivaImporte)}</td>
                        <td className="text-right py-1.5">{f.retImporte > 0 ? `−${fmtEUR(f.retImporte)}` : '—'}</td>
                        <td className="text-right py-1.5 font-semibold">{fmtEUR(f.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-ink/20 font-bold">
                      <td className="py-1.5" colSpan={4}>{t('fiscal.modal.totalRow')}</td>
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
              <div className="text-xs font-bold uppercase tracking-widest text-ink-soft mb-2">{t('fiscal.modal.gastosRegistrados', { count: gastosCalc.length })}</div>
              {errorGastos ? (
                <div className="text-ink-soft text-xs">{t('fiscal.modal.moduloNoConfigurado')}</div>
              ) : gastosCalc.length === 0 ? (
                <div className="text-ink-soft text-xs">{t('fiscal.modal.sinGastos')}</div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b-2 border-ink/20 text-ink-soft uppercase tracking-wide">
                      <th className="text-left py-1.5">{t('fiscal.modal.tabla.fecha')}</th>
                      <th className="text-left py-1.5">{t('fiscal.modal.tabla.proveedor')}</th>
                      <th className="text-left py-1.5">{t('fiscal.modal.tabla.categoria')}</th>
                      <th className="text-right py-1.5">{t('fiscal.modal.tabla.base')}</th>
                      <th className="text-right py-1.5">{t('fiscal.modal.tabla.ivaSoport')}</th>
                      <th className="text-right py-1.5">{t('fiscal.modal.tabla.total')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-edge">
                    {gastosCalc.map((g, i) => (
                      <tr key={i}>
                        <td className="py-1.5">{new Date(g.fecha).toLocaleDateString('es-ES')}</td>
                        <td className="py-1.5">{g.proveedor || g.descripcion || '—'}</td>
                        <td className="py-1.5">{g.categoria ? t(`gastos.categoria.${g.categoria}`, g.categoria) : ''}</td>
                        <td className="text-right py-1.5">{fmtEUR(g.base)}</td>
                        <td className="text-right py-1.5">{fmtEUR(g.ivaSoportado)}</td>
                        <td className="text-right py-1.5 font-semibold">{fmtEUR(g.importe)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-ink/20 font-bold">
                      <td className="py-1.5" colSpan={3}>{t('fiscal.modal.totalRow')}</td>
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
              <div className="text-xs font-bold uppercase tracking-widest text-ink-soft mb-3">{t('fiscal.modal.resumenTitle', { extra: tipo === 'anual' ? ' / 390' : '' })}</div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
                <div className="flex justify-between"><span className="text-ink-soft">{t('fiscal.modal.ivaRepercutido')}</span><span className="font-semibold">{fmtEUR(ivaRepercutido)}</span></div>
                <div className="flex justify-between"><span className="text-ink-soft">{t('fiscal.modal.ivaSoportadoLabel')}</span><span className="font-semibold">−{fmtEUR(ivaSoportado)}</span></div>
                <div className="flex justify-between col-span-2 border-t border-edge pt-1.5 mt-0.5">
                  <span className="font-bold text-ink">{t('fiscal.modal.resultadoIva')}</span>
                  <span className="font-black">{resultadoIVA >= 0 ? t('fiscal.modal.aIngresar', { v: fmtEUR(resultadoIVA) }) : t('fiscal.modal.aCompensar', { v: fmtEUR(Math.abs(resultadoIVA)) })}</span>
                </div>
                <div className="flex justify-between mt-2"><span className="text-ink-soft">{t('fiscal.modal.ingresosBase')}</span><span className="font-semibold">{fmtEUR(baseFacturado)}</span></div>
                <div className="flex justify-between mt-2"><span className="text-ink-soft">{t('fiscal.modal.gastosBase')}</span><span className="font-semibold">−{fmtEUR(baseGastos)}</span></div>
                <div className="flex justify-between col-span-2 border-t border-edge pt-1.5 mt-0.5">
                  <span className="font-bold text-ink">{t('fiscal.modal.rendimientoNeto')}</span><span className="font-black">{fmtEUR(rendimientoNeto)}</span>
                </div>
                <div className="flex justify-between"><span className="text-ink-soft">{t('fiscal.modal.retencionesPracticadas')}</span><span className="font-semibold">−{fmtEUR(retencionesPracticadas)}</span></div>
                <div className="flex justify-between"><span className="text-ink-soft">{t('fiscal.modal.pago130')}</span><span className="font-semibold">{fmtEUR(pago130Estimado)}</span></div>
              </div>
            </div>
          </div>
        )}

        <div className="px-6 pb-6 pt-4 flex gap-3 no-print">
          <button onClick={onClose} className="btn-secondary flex-1">{t('fiscal.modal.cerrar')}</button>
          <button onClick={() => window.print()} className="btn-primary flex-1">{t('fiscal.modal.imprimir')}</button>
        </div>
      </div>
    </div>
  )
}

function SelectorConciliacion({ onClose }) {
  const { t } = useTranslation()
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
          <h2 className="text-lg font-bold text-ink">{t('fiscal.selector.title')}</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
        </div>
        <p className="text-sm text-ink-soft mb-5">{t('fiscal.selector.desc')}</p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-ink-soft mb-1.5 block">{t('fiscal.selector.tipoDocumento')}</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setTipo('trimestral')} className={`px-3 py-2 rounded-lg text-sm font-semibold border ${tipo === 'trimestral' ? 'bg-gold text-navy border-gold' : 'border-edge text-ink-soft'}`}>
                {t('fiscal.selector.trimestral')}
              </button>
              <button onClick={() => setTipo('anual')} className={`px-3 py-2 rounded-lg text-sm font-semibold border ${tipo === 'anual' ? 'bg-gold text-navy border-gold' : 'border-edge text-ink-soft'}`}>
                {t('fiscal.selector.anual')}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-ink-soft mb-1.5 block">{t('fiscal.selector.anioLabel')}</label>
              <select value={anio} onChange={e => setAnio(parseInt(e.target.value))} className="input w-full">
                {anios.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            {tipo === 'trimestral' && (
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-ink-soft mb-1.5 block">{t('fiscal.selector.trimestreLabel')}</label>
                <select value={trimestre} onChange={e => setTrimestre(parseInt(e.target.value))} className="input w-full">
                  {[1, 2, 3, 4].map(tr => <option key={tr} value={tr}>{tr}T</option>)}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">{t('fiscal.selector.cancelar')}</button>
          <button onClick={() => setGenerando(true)} className="btn-primary flex-1">{t('fiscal.selector.generarDocumento')}</button>
        </div>
      </div>
    </div>
  )
}

export default function Fiscal() {
  const { t } = useTranslation()
  const [showConciliacion, setShowConciliacion] = useState(false)

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">{t('fiscal.title')}</h1>
        <p className="text-sm text-ink-soft mt-0.5">{t('fiscal.subtitle')}</p>
      </div>

      <div className="bg-gold/10 border border-gold/30 rounded-xl px-4 py-3 mb-6 text-sm text-ink-soft">
        {t('fiscal.disclaimer')}
      </div>

      <div className="card flex items-center justify-between gap-4 mb-8 bg-navy/5 border-navy/20">
        <div>
          <div className="font-bold text-ink">{t('fiscal.conciliacion.cardTitle')}</div>
          <p className="text-sm text-ink-soft mt-0.5">{t('fiscal.conciliacion.cardDesc')}</p>
        </div>
        <button onClick={() => setShowConciliacion(true)} className="btn-primary whitespace-nowrap flex-shrink-0">{t('fiscal.conciliacion.generarDocumento')}</button>
      </div>

      {showConciliacion && <SelectorConciliacion onClose={() => setShowConciliacion(false)} />}

      {/* Calendario trimestral — contenido normativo, se mantiene en español */}
      <div className="mb-8">
        <h2 className="text-sm font-bold uppercase tracking-widest text-ink-soft mb-4">{t('fiscal.calendarioTitle')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {TRIMESTRES.map(tr => {
            const ahora = new Date()
            const mesActual = ahora.getMonth() + 1
            const esActual = (tr.t === '1T' && mesActual <= 4) || (tr.t === '2T' && mesActual <= 7 && mesActual >= 4) || (tr.t === '3T' && mesActual <= 10 && mesActual >= 7) || (tr.t === '4T' && mesActual >= 10)
            return (
              <div key={tr.t} className={`card text-center ${esActual ? 'border-gold border-2 bg-gold/5' : ''}`}>
                <div className={`text-2xl font-black mb-1 ${esActual ? 'text-gold' : 'text-ink'}`}>{tr.t}</div>
                <div className="text-xs text-ink-soft mb-2">{tr.meses}</div>
                <div className={`text-xs font-semibold ${esActual ? 'text-gold-dark' : 'text-ink-soft'}`}>{tr.presentacion}</div>
                {esActual && <div className="mt-2 text-xs bg-gold text-navy font-bold px-2 py-0.5 rounded-full">{t('fiscal.proximoBadge')}</div>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Modelos — contenido normativo español, se mantiene en español */}
      <div className="mb-8">
        <h2 className="text-sm font-bold uppercase tracking-widest text-ink-soft mb-4">{t('fiscal.modelosTitle')}</h2>
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

      {/* Tips deducibles — contenido normativo fiscal español, se mantiene en español */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest text-ink-soft mb-4">{t('fiscal.tipsTitle')}</h2>
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
