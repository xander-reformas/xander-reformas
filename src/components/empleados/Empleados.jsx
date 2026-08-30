import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase, getUID } from '../../lib/supabase'

// ── Catálogos ────────────────────────────────────────────────────────────────
const PUESTOS = [
  { value: 'encargado' }, { value: 'oficial_1' }, { value: 'oficial_2' },
  { value: 'ayudante' }, { value: 'peon' }, { value: 'fontanero' },
  { value: 'electricista' }, { value: 'pintor' }, { value: 'yesero' },
  { value: 'carpintero' }, { value: 'alicatador' }, { value: 'impermeabilizador' },
  { value: 'administrativo' }, { value: 'otro' },
]

const PUESTO_ICON = {
  encargado: '👷', oficial_1: '🔧', oficial_2: '🔧', ayudante: '🔨',
  peon: '⛏️', fontanero: '🚿', electricista: '⚡', pintor: '🖌️',
  yesero: '🏠', carpintero: '🪚', alicatador: '🧱', impermeabilizador: '💧',
  administrativo: '💼', otro: '👤',
}

const TIPOS_CONTRATO = [
  { value: 'indefinido',         color: 'bg-green-100 text-green-700' },
  { value: 'fijo_discontinuo',   color: 'bg-teal-100 text-teal-700' },
  { value: 'temporal_obra',      color: 'bg-blue-100 text-blue-700' },
  { value: 'temporal_6m',        color: 'bg-yellow-100 text-yellow-700' },
  { value: 'formacion',          color: 'bg-orange-100 text-orange-700' },
  { value: 'autonomo',           color: 'bg-purple-100 text-purple-700' },
]

const GRUPOS_CONVENIO = ['I', 'II', 'III', 'IV', 'V', 'VI']

// ── Coste empresa (construcción CNAE 43xx, 2024-2025) ────────────────────────
const SS = {
  contingencias: 23.60,
  at_ep:         3.70,   // promedio actividades de reforma/acabados
  desempleo:     5.50,
  fogasa:        0.20,
  fp:            0.60,
  mei:           0.58,   // Mecanismo Equidad Intergeneracional
}
const SS_TOTAL = Object.values(SS).reduce((a, b) => a + b, 0) // ≈ 34.18%

function costeEmpresa(bruto) {
  const ss = bruto * (SS_TOTAL / 100)
  return { ss: Math.round(ss * 100) / 100, total: Math.round((bruto + ss) * 100) / 100 }
}

function fmt(n) {
  return Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

// ── Referencia Convenio Colectivo — traducido vía i18n (ver empleados.convenio.*) ──
const CONVENIO_SECCIONES_KEYS = [
  { key: 'convenioGeneral', icon: '🏗️', items: ['jornadaMaxAnual', 'jornadaSemanal', 'vacaciones', 'pagasExtra', 'horasExtra'] },
  { key: 'gruposSalarios', icon: '💰', items: ['grupoIIIEncargado', 'grupoIVOficial1', 'grupoIVOficial2', 'grupoVAyudante', 'grupoVIPeonEsp', 'grupoVIPeonOrd'] },
  { key: 'plusesComplementos', icon: '➕', items: ['plusConvenio', 'plusDistancia', 'dietas', 'plusLocomocion', 'itIncapacidad'] },
  { key: 'cotizacionesSS', icon: '🏛️', items: ['contingenciasComunes', 'atEp', 'desempleoCG', 'fogasa', 'formacionProfesional', 'mei', 'totalAproxEmpresa'] },
  { key: 'obligacionesFormales', icon: '📋', items: ['altaEmpleadorSS', 'altaTrabajadorSS', 'comunicacionContrato', 'tc1tc2', 'nomina', 'retencionIrpfEmp', 'calendarioLaboral', 'prl'] },
]

// ── Estado inicial del formulario ────────────────────────────────────────────
const FORM_EMPTY = {
  nombre: '', apellidos: '', dni: '', telefono: '', email: '',
  puesto: 'oficial_2', especialidad: '', tipo_contrato: 'indefinido',
  fecha_alta: new Date().toISOString().split('T')[0], fecha_baja: '',
  salario_bruto: '', jornada_pct: 100,
  num_ss: '', grupo_convenio: 'IV', estado: 'activo', notas: '',
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function Empleados() {
  const { t } = useTranslation()
  const [tab, setTab]               = useState('equipo')
  const [empleados, setEmpleados]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [setupNeeded, setSetup]     = useState(false)
  const [showForm, setShowForm]     = useState(false)
  const [editId, setEditId]         = useState(null)
  const [form, setForm]             = useState(FORM_EMPTY)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [search, setSearch]         = useState('')
  const [filtroEstado, setFiltro]   = useState('activo')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('empleados')
      .select('*')
      .order('apellidos')
    if (err?.code === '42P01') { setSetup(true); setLoading(false); return }
    setEmpleados(data || [])
    setLoading(false)
  }

  function setF(field, value) { setForm(p => ({ ...p, [field]: value })) }

  function openNew() {
    setEditId(null); setForm(FORM_EMPTY); setError(''); setShowForm(true)
  }
  function openEdit(e) {
    setEditId(e.id)
    setForm({
      nombre: e.nombre || '', apellidos: e.apellidos || '', dni: e.dni || '',
      telefono: e.telefono || '', email: e.email || '', puesto: e.puesto || 'oficial_2',
      especialidad: e.especialidad || '', tipo_contrato: e.tipo_contrato || 'indefinido',
      fecha_alta: e.fecha_alta || '', fecha_baja: e.fecha_baja || '',
      salario_bruto: e.salario_bruto || '', jornada_pct: e.jornada_pct || 100,
      num_ss: e.num_ss || '', grupo_convenio: e.grupo_convenio || 'IV',
      estado: e.estado || 'activo', notas: e.notas || '',
    })
    setError(''); setShowForm(true)
  }

  async function save(e) {
    e.preventDefault(); setSaving(true); setError('')
    const uid = await getUID()
    const payload = {
      ...form,
      user_id: uid,
      salario_bruto: parseFloat(form.salario_bruto) || 0,
      jornada_pct: parseInt(form.jornada_pct) || 100,
      fecha_baja: form.fecha_baja || null,
      dni: form.dni || null, email: form.email || null, telefono: form.telefono || null,
      num_ss: form.num_ss || null, especialidad: form.especialidad || null, notas: form.notas || null,
    }
    const { error: err } = editId
      ? await supabase.from('empleados').update(payload).eq('id', editId)
      : await supabase.from('empleados').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    setShowForm(false); load()
  }

  async function remove(emp) {
    if (!confirm(t('empleados.confirmDelete', { nombre: `${emp.nombre} ${emp.apellidos}` }))) return
    await supabase.from('empleados').delete().eq('id', emp.id)
    load()
  }

  async function cambiarEstado(emp, nuevoEstado) {
    await supabase.from('empleados').update({ estado: nuevoEstado }).eq('id', emp.id)
    load()
  }

  const lista = empleados
    .filter(e => filtroEstado === 'todos' || e.estado === filtroEstado)
    .filter(e => {
      const q = search.toLowerCase()
      return !q || [e.nombre, e.apellidos, e.puesto, e.especialidad].some(v => v?.toLowerCase().includes(q))
    })

  const activos   = empleados.filter(e => e.estado === 'activo')
  const costeTotalMensual = activos.reduce((sum, e) => sum + (parseFloat(e.salario_bruto) || 0), 0)
  const { ss: ssTotalMensual, total: totalEmpresa } = costeEmpresa(costeTotalMensual)

  const tipoContrato = (v) => TIPOS_CONTRATO.find(tc => tc.value === v)
  const puestoLabel  = (v) => t(`empleados.puesto.${v}`, v)

  return (
    <div className="p-6 max-w-5xl">
      {/* Cabecera */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t('empleados.title')}</h1>
          <p className="text-sm text-ink-soft mt-0.5">{t('empleados.subtitle')}</p>
        </div>
        {tab === 'equipo' && !setupNeeded && (
          <button onClick={openNew} className="btn-primary">{t('empleados.newEmpleado')}</button>
        )}
      </div>

      {/* KPIs rápidos */}
      {!setupNeeded && !loading && activos.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="card text-center py-3">
            <div className="text-2xl font-black text-ink">{activos.length}</div>
            <div className="text-xs text-ink-soft mt-0.5">{t('empleados.kpi.activos')}</div>
          </div>
          <div className="card text-center py-3">
            <div className="text-lg font-black text-ink">{fmt(costeTotalMensual)}</div>
            <div className="text-xs text-ink-soft mt-0.5">{t('empleados.kpi.salarioBruto')}</div>
          </div>
          <div className="card bg-navy text-center py-3">
            <div className="text-lg font-black text-gold">{fmt(totalEmpresa)}</div>
            <div className="text-xs text-white/70 mt-0.5">{t('empleados.kpi.costeEmpresa')}</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-edge rounded-xl p-1 w-fit mb-6">
        {[
          { id: 'equipo',   label: t('empleados.tabs.equipo') },
          { id: 'costes',   label: t('empleados.tabs.costes') },
          { id: 'convenio', label: t('empleados.tabs.convenio') },
        ].map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${tab === tb.id ? 'bg-surface text-ink shadow-sm' : 'text-ink-soft hover:text-ink'}`}>
            {tb.label}
          </button>
        ))}
      </div>

      {/* ── EQUIPO ────────────────────────────────────────────────────────── */}
      {tab === 'equipo' && (
        setupNeeded ? (
          <div className="card border-2 border-gold/40">
            <div className="flex items-start gap-4">
              <div className="text-3xl">⚙️</div>
              <div>
                <div className="font-bold text-ink mb-2">{t('empleados.setup.title')}</div>
                <p className="text-sm text-ink-soft mb-3">{t('empleados.setup.descPre')} <code className="bg-page px-1.5 py-0.5 rounded font-mono text-xs">supabase/empleados.sql</code> {t('empleados.setup.descPost')}</p>
                <button onClick={() => { setSetup(false); load() }} className="btn-primary text-sm">{t('empleados.setup.reload')}</button>
              </div>
            </div>
          </div>
        ) : loading ? (
          <div className="text-ink-soft text-sm py-10 text-center">{t('empleados.loading')}</div>
        ) : (
          <div>
            {/* Filtros */}
            <div className="flex flex-wrap gap-3 mb-5">
              <input className="input max-w-xs" placeholder={t('empleados.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} />
              <div className="flex gap-1 bg-edge rounded-xl p-1">
                {[
                  { v: 'activo', l: t('empleados.filtros.activos') },
                  { v: 'baja_temporal', l: t('empleados.filtros.bajaTemporal') },
                  { v: 'baja_definitiva', l: t('empleados.filtros.bajaDefinitiva') },
                  { v: 'todos', l: t('empleados.filtros.todos') },
                ].map(o => (
                  <button key={o.v} onClick={() => setFiltro(o.v)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${filtroEstado === o.v ? 'bg-surface text-ink shadow-sm' : 'text-ink-soft hover:text-ink'}`}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>

            {lista.length === 0 ? (
              <div className="card text-center py-14">
                <div className="text-5xl mb-3">👷</div>
                <div className="font-bold text-ink mb-1">{search ? t('empleados.noResultsTitle') : t('empleados.noEmpleadosTitle')}</div>
                <div className="text-sm text-ink-soft mb-5">{t('empleados.noEmpleadosHint')}</div>
                {!search && <button onClick={openNew} className="btn-primary">{t('empleados.newEmpleado')}</button>}
              </div>
            ) : (
              <div className="space-y-3">
                {lista.map(emp => {
                  const bruto = parseFloat(emp.salario_bruto) || 0
                  const { ss, total } = costeEmpresa(bruto)
                  const tc = tipoContrato(emp.tipo_contrato)
                  return (
                    <div key={emp.id} className={`card ${emp.estado !== 'activo' ? 'opacity-60' : ''}`}>
                      <div className="flex items-start gap-4">
                        {/* Avatar */}
                        <div className="w-11 h-11 rounded-full bg-navy/10 flex items-center justify-center text-xl flex-shrink-0">
                          {PUESTO_ICON[emp.puesto] || '👤'}
                        </div>

                        {/* Info principal */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="font-bold text-ink">{emp.nombre} {emp.apellidos}</span>
                            {tc && (
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tc.color}`}>{t(`empleados.tipoContrato.${tc.value}`)}</span>
                            )}
                            {emp.estado === 'baja_temporal' && (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">{t('empleados.filtros.bajaTemporal')}</span>
                            )}
                            {emp.estado === 'baja_definitiva' && (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">{t('empleados.filtros.bajaDefinitiva')}</span>
                            )}
                          </div>
                          <div className="text-sm text-ink-soft mt-0.5">
                            {puestoLabel(emp.puesto)}{emp.especialidad ? ` · ${emp.especialidad}` : ''}
                            {emp.grupo_convenio ? ` · ${t('empleados.grupoCC', { grupo: emp.grupo_convenio })}` : ''}
                          </div>
                          <div className="flex flex-wrap gap-4 mt-2 text-xs text-ink-soft">
                            {emp.telefono && <span>📞 {emp.telefono}</span>}
                            {emp.fecha_alta && <span>📅 {t('empleados.alta', { fecha: new Date(emp.fecha_alta + 'T12:00:00').toLocaleDateString('es-ES') })}</span>}
                            {emp.jornada_pct < 100 && <span>⏱️ {t('empleados.jornadaPct', { pct: emp.jornada_pct })}</span>}
                          </div>
                        </div>

                        {/* Costes */}
                        <div className="text-right flex-shrink-0">
                          {bruto > 0 && (
                            <>
                              <div className="text-sm text-ink-soft">{t('empleados.bruto', { monto: fmt(bruto) })}</div>
                              <div className="text-xs text-ink-soft/60">{t('empleados.masSS', { monto: fmt(ss) })}</div>
                              <div className="font-bold text-ink text-base">{t('empleados.porMes', { monto: fmt(total) })}</div>
                            </>
                          )}
                        </div>

                        {/* Acciones */}
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <button onClick={() => openEdit(emp)} className="text-gold hover:text-gold-dark text-xs font-semibold">{t('empleados.editar')}</button>
                          {emp.estado === 'activo' && (
                            <button onClick={() => cambiarEstado(emp, 'baja_temporal')} className="text-xs text-ink-soft hover:text-orange-600" title={t('empleados.bajaTemporalTitle')}>{t('empleados.bajaTemporalBtn')}</button>
                          )}
                          {emp.estado === 'baja_temporal' && (
                            <button onClick={() => cambiarEstado(emp, 'activo')} className="text-xs text-ink-soft hover:text-green-600" title={t('empleados.altaTitle')}>{t('empleados.altaBtn')}</button>
                          )}
                          <button onClick={() => remove(emp)} className="text-ink-soft/30 hover:text-red-500 text-lg leading-none">×</button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      )}

      {/* ── COSTES ────────────────────────────────────────────────────────── */}
      {tab === 'costes' && (
        <div className="space-y-6">
          {/* Calculadora individual */}
          <div className="card border-2 border-gold/30">
            <div className="text-xs font-bold uppercase tracking-widest text-gold mb-4">{t('empleados.costes.calculadoraTitle')}</div>
            <CostCalculator />
          </div>

          {/* Resumen del equipo */}
          {activos.length > 0 && (
            <div>
              <h2 className="text-base font-bold text-ink mb-4">{t('empleados.costes.resumenTitle')}</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-edge">
                      <th className="text-left py-2 px-3 text-xs font-bold text-ink-soft uppercase tracking-wide">{t('empleados.costes.table.empleado')}</th>
                      <th className="text-left py-2 px-3 text-xs font-bold text-ink-soft uppercase tracking-wide">{t('empleados.costes.table.puesto')}</th>
                      <th className="text-right py-2 px-3 text-xs font-bold text-ink-soft uppercase tracking-wide">{t('empleados.costes.table.brutoMes')}</th>
                      <th className="text-right py-2 px-3 text-xs font-bold text-ink-soft uppercase tracking-wide">{t('empleados.costes.table.ssEmpresa')}</th>
                      <th className="text-right py-2 px-3 text-xs font-bold text-ink-soft uppercase tracking-wide">{t('empleados.costes.table.costeTotalMes')}</th>
                      <th className="text-right py-2 px-3 text-xs font-bold text-ink-soft uppercase tracking-wide">{t('empleados.costes.table.anualEstimado')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activos.map(emp => {
                      const bruto = parseFloat(emp.salario_bruto) || 0
                      const { ss, total } = costeEmpresa(bruto)
                      return (
                        <tr key={emp.id} className="border-b border-edge/50 hover:bg-page/30 transition-colors">
                          <td className="py-2.5 px-3 font-semibold text-ink">{emp.nombre} {emp.apellidos}</td>
                          <td className="py-2.5 px-3 text-ink-soft">{puestoLabel(emp.puesto)}</td>
                          <td className="py-2.5 px-3 text-right">{fmt(bruto)}</td>
                          <td className="py-2.5 px-3 text-right text-ink-soft">{fmt(ss)}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-ink">{fmt(total)}</td>
                          <td className="py-2.5 px-3 text-right text-ink-soft">{fmt(total * 12)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-navy">
                    <tr className="bg-navy">
                      <td colSpan={2} className="py-3 px-3 font-bold text-white">{t('empleados.costes.totalEquipo')}</td>
                      <td className="py-3 px-3 text-right text-white">{fmt(costeTotalMensual)}</td>
                      <td className="py-3 px-3 text-right text-white/70">{fmt(ssTotalMensual)}</td>
                      <td className="py-3 px-3 text-right font-black text-gold text-base">{fmt(totalEmpresa)}</td>
                      <td className="py-3 px-3 text-right text-gold">{fmt(totalEmpresa * 12)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="text-xs text-ink-soft mt-3">
                {t('empleados.costes.nota', { pct: SS_TOTAL.toFixed(2) })}
              </p>
            </div>
          )}

          {activos.length === 0 && (
            <div className="card text-center py-10 text-ink-soft text-sm">
              {t('empleados.costes.emptyHint')}
            </div>
          )}
        </div>
      )}

      {/* ── CONVENIO ──────────────────────────────────────────────────────── */}
      {tab === 'convenio' && (
        <div>
          <div className="bg-gold/10 border border-gold/30 rounded-xl px-4 py-3 mb-4 text-sm text-ink-soft">
            <strong>{t('empleados.convenio.disclaimerPre')}</strong> {t('empleados.convenio.disclaimerPost')}
          </div>
          <div className="mb-6 bg-navy/5 border border-navy/15 rounded-xl px-4 py-3 flex items-start gap-3 text-xs text-ink-soft">
            <span className="text-base flex-shrink-0">ℹ️</span>
            <div>
              <div className="font-semibold text-ink">{t('legalAviso.titulo')}</div>
              <div className="mt-0.5">{t('legalAviso.texto')}</div>
            </div>
          </div>
          <div className="space-y-6">
            {CONVENIO_SECCIONES_KEYS.map(sec => (
              <div key={sec.key} className="card">
                <div className="flex items-start gap-3 mb-4">
                  <span className="text-2xl flex-shrink-0">{sec.icon}</span>
                  <div>
                    <h2 className="font-bold text-ink">{t(`empleados.convenio.secciones.${sec.key}.titulo`)}</h2>
                    <p className="text-sm text-ink-soft mt-1 leading-relaxed">{t(`empleados.convenio.secciones.${sec.key}.desc`)}</p>
                  </div>
                </div>
                <div className="bg-page rounded-xl overflow-hidden">
                  {sec.items.map((itemKey, i) => {
                    const bold = itemKey === 'totalAproxEmpresa'
                    let valor
                    if (sec.key === 'cotizacionesSS') {
                      if (itemKey === 'contingenciasComunes') valor = `${SS.contingencias.toFixed(2)}%`
                      else if (itemKey === 'atEp') valor = `~${SS.at_ep.toFixed(2)}% ${t('empleados.convenio.atEpSufijo')}`
                      else if (itemKey === 'desempleoCG') valor = `${SS.desempleo.toFixed(2)}%`
                      else if (itemKey === 'fogasa') valor = `${SS.fogasa.toFixed(2)}%`
                      else if (itemKey === 'formacionProfesional') valor = `${SS.fp.toFixed(2)}%`
                      else if (itemKey === 'mei') valor = `${SS.mei.toFixed(2)}%`
                      else if (itemKey === 'totalAproxEmpresa') valor = `~${SS_TOTAL.toFixed(2)}% ${t('empleados.convenio.items.totalAproxEmpresa.sufijo')}`
                    } else {
                      valor = t(`empleados.convenio.items.${itemKey}.valor`)
                    }
                    return (
                      <div key={itemKey} className={`flex items-baseline justify-between gap-4 px-4 py-2.5 ${i < sec.items.length - 1 ? 'border-b border-white/60' : ''}`}>
                        <span className={`text-sm ${bold ? 'font-bold text-ink' : 'text-ink-soft'}`}>{t(`empleados.convenio.items.${itemKey}.label`)}</span>
                        <span className={`text-sm text-right flex-shrink-0 ${bold ? 'font-bold text-ink' : 'text-ink'}`}>{valor}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Recursos */}
          <div className="mt-8 card bg-navy">
            <div className="text-xs font-bold uppercase tracking-widest text-gold mb-4">{t('empleados.convenio.recursosTitle')}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                { label: 'VI CGSC — BOE', url: 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2022-13559' },
                { label: 'Sistema RED / Sede SS', url: 'https://sede.seg-social.gob.es' },
                { label: 'Modelos cotización TC1 / TC2', url: 'https://www.seg-social.es/wps/portal/wss/internet/Trabajadores' },
                { label: 'SEPE — Contratos', url: 'https://www.sepe.es/HomeSepe/empresas/contratos-y-subvenciones.html' },
                { label: 'Tablas salariales construcción', url: 'https://www.cnconstuccion.es' },
                { label: 'INSST — PRL construcción', url: 'https://www.insst.es/materias/sectores-de-actividad/construccion' },
              ].map(r => (
                <a key={r.label} href={r.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-white/80 hover:text-gold text-xs transition-colors py-1">
                  <span className="text-gold/60">↗</span> {r.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal formulario ──────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-edge flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-bold text-ink">{editId ? t('empleados.form.editTitle') : t('empleados.form.newTitle')}</h2>
              <button onClick={() => setShowForm(false)} className="text-ink-soft hover:text-ink text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
            </div>
            <form onSubmit={save} className="p-6 space-y-4 overflow-y-auto">
              {/* Nombre */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('empleados.form.nombreLabel')}</label>
                  <input className="input" value={form.nombre} onChange={e => setF('nombre', e.target.value)} required placeholder={t('empleados.form.nombreLabel')} />
                </div>
                <div>
                  <label className="label">{t('empleados.form.apellidosLabel')}</label>
                  <input className="input" value={form.apellidos} onChange={e => setF('apellidos', e.target.value)} required placeholder={t('empleados.form.apellidosLabel')} />
                </div>
              </div>

              {/* Puesto y tipo contrato */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('empleados.form.puestoLabel')}</label>
                  <select className="input" value={form.puesto} onChange={e => setF('puesto', e.target.value)}>
                    {PUESTOS.map(p => <option key={p.value} value={p.value}>{t(`empleados.puesto.${p.value}`)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{t('empleados.form.tipoContratoLabel')}</label>
                  <select className="input" value={form.tipo_contrato} onChange={e => setF('tipo_contrato', e.target.value)}>
                    {TIPOS_CONTRATO.map(tcOpt => <option key={tcOpt.value} value={tcOpt.value}>{t(`empleados.tipoContrato.${tcOpt.value}`)}</option>)}
                  </select>
                </div>
              </div>

              {/* Especialidad y grupo convenio */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('empleados.form.especialidadLabel')}</label>
                  <input className="input" value={form.especialidad} onChange={e => setF('especialidad', e.target.value)} placeholder={t('empleados.form.especialidadPlaceholder')} />
                </div>
                <div>
                  <label className="label">{t('empleados.form.grupoLabel')}</label>
                  <select className="input" value={form.grupo_convenio} onChange={e => setF('grupo_convenio', e.target.value)}>
                    {GRUPOS_CONVENIO.map(g => <option key={g} value={g}>{t(`empleados.grupoConvenio.${g}`)}</option>)}
                  </select>
                </div>
              </div>

              {/* Salario y jornada */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('empleados.form.salarioLabel')}</label>
                  <input className="input" type="number" min="0" step="0.01" value={form.salario_bruto}
                    onChange={e => setF('salario_bruto', e.target.value)} required placeholder="1.500,00" />
                  {form.salario_bruto > 0 && (
                    <div className="text-xs text-ink-soft mt-1">
                      {t('empleados.form.costeEmpresaPreview', { monto: `${fmt(costeEmpresa(parseFloat(form.salario_bruto) || 0).total)}` })}
                    </div>
                  )}
                </div>
                <div>
                  <label className="label">{t('empleados.form.jornadaLabel')}</label>
                  <input className="input" type="number" min="1" max="100" value={form.jornada_pct}
                    onChange={e => setF('jornada_pct', e.target.value)} />
                  <div className="text-xs text-ink-soft mt-1">{t('empleados.form.jornadaHint')}</div>
                </div>
              </div>

              {/* Fechas y estado */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">{t('empleados.form.fechaAltaLabel')}</label>
                  <input className="input" type="date" value={form.fecha_alta} onChange={e => setF('fecha_alta', e.target.value)} required />
                </div>
                <div>
                  <label className="label">{t('empleados.form.fechaBajaLabel')}</label>
                  <input className="input" type="date" value={form.fecha_baja} onChange={e => setF('fecha_baja', e.target.value)} />
                </div>
                <div>
                  <label className="label">{t('empleados.form.estadoLabel')}</label>
                  <select className="input" value={form.estado} onChange={e => setF('estado', e.target.value)}>
                    <option value="activo">{t('empleados.form.estadoOpts.activo')}</option>
                    <option value="baja_temporal">{t('empleados.form.estadoOpts.baja_temporal')}</option>
                    <option value="baja_definitiva">{t('empleados.form.estadoOpts.baja_definitiva')}</option>
                  </select>
                </div>
              </div>

              {/* Contacto y SS */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('empleados.form.telefonoLabel')}</label>
                  <input className="input" type="tel" value={form.telefono} onChange={e => setF('telefono', e.target.value)} placeholder="6XX XXX XXX" />
                </div>
                <div>
                  <label className="label">{t('empleados.form.numSsLabel')}</label>
                  <input className="input" value={form.num_ss} onChange={e => setF('num_ss', e.target.value)} placeholder="28/XXXXXXXXXXX/XX" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('empleados.form.dniLabel')}</label>
                  <input className="input" value={form.dni} onChange={e => setF('dni', e.target.value)} placeholder="12345678A" />
                </div>
                <div>
                  <label className="label">{t('empleados.form.emailLabel')}</label>
                  <input className="input" type="email" value={form.email} onChange={e => setF('email', e.target.value)} placeholder="empleado@email.com" />
                </div>
              </div>

              <div>
                <label className="label">{t('empleados.form.notasLabel')}</label>
                <textarea className="input h-20 resize-none" value={form.notas} onChange={e => setF('notas', e.target.value)} placeholder={t('empleados.form.notasPlaceholder')} />
              </div>

              {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">{t('empleados.form.cancel')}</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? t('empleados.form.saving') : t('empleados.form.save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Calculadora independiente ────────────────────────────────────────────────
function CostCalculator() {
  const { t } = useTranslation()
  const [bruto, setBruto] = useState('')
  const b = parseFloat(bruto) || 0
  const { ss, total } = costeEmpresa(b)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <div>
          <label className="label">{t('empleados.costes.calc.salarioLabel')}</label>
          <input className="input" type="number" min="0" step="10" value={bruto}
            onChange={e => setBruto(e.target.value)} placeholder="1.500" />
        </div>
        {b > 0 && (
          <div className="bg-page rounded-xl p-4 space-y-2 text-sm">
            {Object.entries(SS).map(([k, v]) => (
              <div key={k} className="flex justify-between text-ink-soft">
                <span className="capitalize">{k.replace('_', ' + ')} ({v.toFixed(2)}%)</span>
                <span>{fmt(b * v / 100)}</span>
              </div>
            ))}
            <div className="border-t border-stone/20 pt-2 flex justify-between font-bold text-ink">
              <span>{t('empleados.costes.calc.totalSS', { pct: SS_TOTAL.toFixed(2) })}</span>
              <span>{fmt(ss)}</span>
            </div>
          </div>
        )}
      </div>
      <div className="space-y-3">
        {b > 0 && (
          <>
            <div className="bg-navy rounded-xl p-4 text-center">
              <div className="text-xs font-bold uppercase tracking-widest text-gold mb-1">{t('empleados.costes.calc.costeEmpresaMes')}</div>
              <div className="text-3xl font-black text-white">{fmt(total)}</div>
              <div className="text-xs text-white/60 mt-1">{t('empleados.costes.calc.brutoMasSS', { bruto: fmt(b), ss: fmt(ss) })}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="card text-center py-3">
                <div className="text-sm font-bold text-ink">{fmt(total * 12)}</div>
                <div className="text-xs text-ink-soft">{t('empleados.costes.calc.costeAnual')}</div>
              </div>
              <div className="card text-center py-3">
                <div className="text-sm font-bold text-ink">{fmt(total * 14)}</div>
                <div className="text-xs text-ink-soft">{t('empleados.costes.calc.con2Pagas')}</div>
              </div>
            </div>
          </>
        )}
        {!b && (
          <div className="flex items-center justify-center h-full text-ink-soft text-sm text-center py-10">
            {t('empleados.costes.calc.introduceSalario')}
          </div>
        )}
      </div>
    </div>
  )
}
