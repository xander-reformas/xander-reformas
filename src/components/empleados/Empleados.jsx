import { useState, useEffect } from 'react'
import { supabase, getUID } from '../../lib/supabase'

// ── Catálogos ────────────────────────────────────────────────────────────────
const PUESTOS = [
  { value: 'encargado',     label: 'Encargado de obra' },
  { value: 'oficial_1',     label: 'Oficial 1ª' },
  { value: 'oficial_2',     label: 'Oficial 2ª' },
  { value: 'ayudante',      label: 'Ayudante' },
  { value: 'peon',          label: 'Peón' },
  { value: 'fontanero',     label: 'Fontanero/a' },
  { value: 'electricista',  label: 'Electricista' },
  { value: 'pintor',        label: 'Pintor/a' },
  { value: 'yesero',        label: 'Yesero / Escayolista' },
  { value: 'carpintero',    label: 'Carpintero/a' },
  { value: 'alicatador',    label: 'Alicatador/a Solador/a' },
  { value: 'impermeabilizador', label: 'Impermeabilizador/a' },
  { value: 'administrativo', label: 'Administrativo/a' },
  { value: 'otro',          label: 'Otro' },
]

const PUESTO_ICON = {
  encargado: '👷', oficial_1: '🔧', oficial_2: '🔧', ayudante: '🔨',
  peon: '⛏️', fontanero: '🚿', electricista: '⚡', pintor: '🖌️',
  yesero: '🏠', carpintero: '🪚', alicatador: '🧱', impermeabilizador: '💧',
  administrativo: '💼', otro: '👤',
}

const TIPOS_CONTRATO = [
  { value: 'indefinido',         label: 'Indefinido',               color: 'bg-green-100 text-green-700' },
  { value: 'fijo_discontinuo',   label: 'Fijo discontinuo',         color: 'bg-teal-100 text-teal-700' },
  { value: 'temporal_obra',      label: 'Temporal por obra',        color: 'bg-blue-100 text-blue-700' },
  { value: 'temporal_6m',        label: 'Temporal (≤6 meses)',      color: 'bg-yellow-100 text-yellow-700' },
  { value: 'formacion',          label: 'Formación y aprendizaje',  color: 'bg-orange-100 text-orange-700' },
  { value: 'autonomo',           label: 'Autónomo colaborador',     color: 'bg-purple-100 text-purple-700' },
]

const GRUPOS_CONVENIO = [
  { value: 'I',   label: 'Grupo I — Titulados superiores / medios' },
  { value: 'II',  label: 'Grupo II — Jefes de obra / administrativos titulados' },
  { value: 'III', label: 'Grupo III — Encargados / Capataces' },
  { value: 'IV',  label: 'Grupo IV — Oficiales 1ª y 2ª' },
  { value: 'V',   label: 'Grupo V — Ayudantes' },
  { value: 'VI',  label: 'Grupo VI — Peones' },
]

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

// ── Referencia Convenio Colectivo ────────────────────────────────────────────
const CONVENIO_SECCIONES = [
  {
    titulo: 'Convenio Colectivo General del Sector de la Construcción (CGSC)',
    icon: '🏗️',
    desc: 'El VI CGSC (2022-2026) regula las condiciones laborales de todos los trabajadores del sector en España. Aplica a empresas de reformas, acabados y mantenimiento de edificios (CNAE 41, 42, 43).',
    items: [
      { label: 'Jornada máxima anual', valor: '1.736 horas (2025)' },
      { label: 'Jornada semanal', valor: '40 horas ordinarias' },
      { label: 'Vacaciones', valor: '30 días naturales / año' },
      { label: 'Pagas extraordinarias', valor: '2 (junio y diciembre) — 30 días cada una' },
      { label: 'Horas extraordinarias', valor: 'Máx. 80/año — recargo mín. 75% o descanso compensatorio' },
    ],
  },
  {
    titulo: 'Grupos profesionales y salarios orientativos (2025)',
    icon: '💰',
    desc: 'Salarios mínimos según el Convenio. Las tablas salariales definitivas se actualizan anualmente. Comprueba la tabla vigente en tu provincia (algunos convenios provinciales mejoran el estatal).',
    items: [
      { label: 'Grupo III — Encargado / Capataz',  valor: 'Desde ~1.700 € / mes bruto' },
      { label: 'Grupo IV — Oficial 1ª',             valor: 'Desde ~1.550 € / mes bruto' },
      { label: 'Grupo IV — Oficial 2ª',             valor: 'Desde ~1.450 € / mes bruto' },
      { label: 'Grupo V — Ayudante',                valor: 'Desde ~1.350 € / mes bruto' },
      { label: 'Grupo VI — Peón especializado',     valor: 'Desde ~1.280 € / mes bruto' },
      { label: 'Grupo VI — Peón ordinario',         valor: 'Desde ~1.220 € / mes bruto' },
    ],
  },
  {
    titulo: 'Plus convenio y complementos salariales',
    icon: '➕',
    desc: 'Además del salario base, el convenio establece pluses obligatorios que deben sumarse al coste total del trabajador.',
    items: [
      { label: 'Plus de Convenio',   valor: 'Fijado por tabla salarial del convenio (varía por grupo)' },
      { label: 'Plus de Distancia',  valor: 'Por desplazamiento al centro de trabajo (km > 2 desde municipio de contratación)' },
      { label: 'Dietas',             valor: 'Media dieta: ~13 €/día | Dieta completa: ~30 €/día (pernocta fuera)' },
      { label: 'Plus de locomoción', valor: 'Cuando el trabajador usa vehículo propio: €/km según convenio provincial' },
      { label: 'IT / Incapacidad',   valor: 'Complemento empresa hasta el 100% desde el 1er día (accidente laboral)' },
    ],
  },
  {
    titulo: 'Cotizaciones SS — Cuotas empresa (construcción)',
    icon: '🏛️',
    desc: 'El empresario asume la mayor parte de las cotizaciones. Estos porcentajes aplican sobre la base de cotización (que puede diferir del salario bruto).',
    items: [
      { label: 'Contingencias comunes',              valor: `${SS.contingencias.toFixed(2)}%` },
      { label: 'AT y EP (construcción, CNAE 43)',    valor: `~${SS.at_ep.toFixed(2)}% (varía por CNAE y siniestralidad)` },
      { label: 'Desempleo (CG)',                     valor: `${SS.desempleo.toFixed(2)}%` },
      { label: 'FOGASA',                             valor: `${SS.fogasa.toFixed(2)}%` },
      { label: 'Formación profesional',              valor: `${SS.fp.toFixed(2)}%` },
      { label: 'MEI (2024-2025)',                    valor: `${SS.mei.toFixed(2)}%` },
      { label: '▶ Total aproximado empresa',         valor: `~${SS_TOTAL.toFixed(2)}% sobre base cotización`, bold: true },
    ],
  },
  {
    titulo: 'Obligaciones formales al contratar',
    icon: '📋',
    desc: 'Al contratar tu primer empleado deberás cumplir una serie de trámites previos y periódicos.',
    items: [
      { label: 'Alta como empleador en SS', valor: 'Código de Cuenta de Cotización (CCC) — antes del 1er contrato' },
      { label: 'Alta del trabajador en SS', valor: 'Sistema RED / SILTRA — antes del inicio de la actividad' },
      { label: 'Comunicación contrato',     valor: 'SEPE — 10 días hábiles desde la firma' },
      { label: 'TC1 / TC2 mensual',         valor: 'Cotización mensual SS — domiciliación o ingreso directo' },
      { label: 'Nómina',                    valor: 'Mensual, firmada por el trabajador (o acuse electrónico)' },
      { label: 'Retención IRPF',            valor: 'Mod. 111 trimestral + Mod. 190 anual (resumen retenciones)' },
      { label: 'Calendio laboral',          valor: 'Publicar en el centro de trabajo antes del 1 de enero' },
      { label: 'PRL (Prevención de Riesgos)', valor: 'Plan de prevención + evaluación de riesgos obligatoria' },
    ],
  },
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
    if (!confirm(`¿Eliminar a ${emp.nombre} ${emp.apellidos}?`)) return
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

  const tipoContrato = (v) => TIPOS_CONTRATO.find(t => t.value === v)
  const puestoLabel  = (v) => PUESTOS.find(p => p.value === v)?.label || v

  return (
    <div className="p-6 max-w-5xl">
      {/* Cabecera */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Empleados y equipo</h1>
          <p className="text-sm text-ink-soft mt-0.5">Gestión del equipo de trabajo, costes laborales y convenio colectivo</p>
        </div>
        {tab === 'equipo' && !setupNeeded && (
          <button onClick={openNew} className="btn-primary">+ Nuevo empleado</button>
        )}
      </div>

      {/* KPIs rápidos */}
      {!setupNeeded && !loading && activos.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="card text-center py-3">
            <div className="text-2xl font-black text-ink">{activos.length}</div>
            <div className="text-xs text-ink-soft mt-0.5">Empleados activos</div>
          </div>
          <div className="card text-center py-3">
            <div className="text-lg font-black text-ink">{fmt(costeTotalMensual)}</div>
            <div className="text-xs text-ink-soft mt-0.5">Salario bruto mensual</div>
          </div>
          <div className="card bg-navy text-center py-3">
            <div className="text-lg font-black text-gold">{fmt(totalEmpresa)}</div>
            <div className="text-xs text-white/70 mt-0.5">Coste empresa / mes</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-edge rounded-xl p-1 w-fit mb-6">
        {[
          { id: 'equipo',   label: '👥 Equipo' },
          { id: 'costes',   label: '💰 Costes' },
          { id: 'convenio', label: '📋 Convenio' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${tab === t.id ? 'bg-surface text-ink shadow-sm' : 'text-ink-soft hover:text-ink'}`}>
            {t.label}
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
                <div className="font-bold text-ink mb-2">Crear tabla en Supabase</div>
                <p className="text-sm text-ink-soft mb-3">Ejecuta el archivo <code className="bg-page px-1.5 py-0.5 rounded font-mono text-xs">supabase/empleados.sql</code> en el SQL Editor de Supabase.</p>
                <button onClick={() => { setSetup(false); load() }} className="btn-primary text-sm">Ya ejecutado — recargar</button>
              </div>
            </div>
          </div>
        ) : loading ? (
          <div className="text-ink-soft text-sm py-10 text-center">Cargando equipo…</div>
        ) : (
          <div>
            {/* Filtros */}
            <div className="flex flex-wrap gap-3 mb-5">
              <input className="input max-w-xs" placeholder="🔍  Buscar…" value={search} onChange={e => setSearch(e.target.value)} />
              <div className="flex gap-1 bg-edge rounded-xl p-1">
                {[
                  { v: 'activo', l: 'Activos' },
                  { v: 'baja_temporal', l: 'Baja temporal' },
                  { v: 'baja_definitiva', l: 'Baja definitiva' },
                  { v: 'todos', l: 'Todos' },
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
                <div className="font-bold text-ink mb-1">{search ? 'Sin resultados' : 'Sin empleados registrados'}</div>
                <div className="text-sm text-ink-soft mb-5">Añade tu primer empleado o colaborador</div>
                {!search && <button onClick={openNew} className="btn-primary">+ Nuevo empleado</button>}
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
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tc.color}`}>{tc.label}</span>
                            )}
                            {emp.estado === 'baja_temporal' && (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Baja temporal</span>
                            )}
                            {emp.estado === 'baja_definitiva' && (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Baja definitiva</span>
                            )}
                          </div>
                          <div className="text-sm text-ink-soft mt-0.5">
                            {puestoLabel(emp.puesto)}{emp.especialidad ? ` · ${emp.especialidad}` : ''}
                            {emp.grupo_convenio ? ` · Grupo ${emp.grupo_convenio} CC` : ''}
                          </div>
                          <div className="flex flex-wrap gap-4 mt-2 text-xs text-ink-soft">
                            {emp.telefono && <span>📞 {emp.telefono}</span>}
                            {emp.fecha_alta && <span>📅 Alta: {new Date(emp.fecha_alta + 'T12:00:00').toLocaleDateString('es-ES')}</span>}
                            {emp.jornada_pct < 100 && <span>⏱️ {emp.jornada_pct}% jornada</span>}
                          </div>
                        </div>

                        {/* Costes */}
                        <div className="text-right flex-shrink-0">
                          {bruto > 0 && (
                            <>
                              <div className="text-sm text-ink-soft">{fmt(bruto)} bruto</div>
                              <div className="text-xs text-ink-soft/60">+ {fmt(ss)} SS</div>
                              <div className="font-bold text-ink text-base">{fmt(total)} / mes</div>
                            </>
                          )}
                        </div>

                        {/* Acciones */}
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <button onClick={() => openEdit(emp)} className="text-gold hover:text-gold-dark text-xs font-semibold">Editar</button>
                          {emp.estado === 'activo' && (
                            <button onClick={() => cambiarEstado(emp, 'baja_temporal')} className="text-xs text-ink-soft hover:text-orange-600" title="Dar de baja temporal">↓ Baja</button>
                          )}
                          {emp.estado === 'baja_temporal' && (
                            <button onClick={() => cambiarEstado(emp, 'activo')} className="text-xs text-ink-soft hover:text-green-600" title="Reincorporar">↑ Alta</button>
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
            <div className="text-xs font-bold uppercase tracking-widest text-gold mb-4">Calculadora de coste empresa</div>
            <CostCalculator />
          </div>

          {/* Resumen del equipo */}
          {activos.length > 0 && (
            <div>
              <h2 className="text-base font-bold text-ink mb-4">Resumen del equipo activo</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-edge">
                      <th className="text-left py-2 px-3 text-xs font-bold text-ink-soft uppercase tracking-wide">Empleado</th>
                      <th className="text-left py-2 px-3 text-xs font-bold text-ink-soft uppercase tracking-wide">Puesto</th>
                      <th className="text-right py-2 px-3 text-xs font-bold text-ink-soft uppercase tracking-wide">Bruto / mes</th>
                      <th className="text-right py-2 px-3 text-xs font-bold text-ink-soft uppercase tracking-wide">SS empresa</th>
                      <th className="text-right py-2 px-3 text-xs font-bold text-ink-soft uppercase tracking-wide">Coste total / mes</th>
                      <th className="text-right py-2 px-3 text-xs font-bold text-ink-soft uppercase tracking-wide">Anual estimado</th>
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
                      <td colSpan={2} className="py-3 px-3 font-bold text-white">TOTAL EQUIPO</td>
                      <td className="py-3 px-3 text-right text-white">{fmt(costeTotalMensual)}</td>
                      <td className="py-3 px-3 text-right text-white/70">{fmt(ssTotalMensual)}</td>
                      <td className="py-3 px-3 text-right font-black text-gold text-base">{fmt(totalEmpresa)}</td>
                      <td className="py-3 px-3 text-right text-gold">{fmt(totalEmpresa * 12)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="text-xs text-ink-soft mt-3">
                * La SS empresa se calcula al {SS_TOTAL.toFixed(2)}% sobre el salario bruto (contingencias + AT/EP construcción + desempleo + FOGASA + FP + MEI). El coste real puede variar según la base de cotización y convenio provincial.
              </p>
            </div>
          )}

          {activos.length === 0 && (
            <div className="card text-center py-10 text-ink-soft text-sm">
              Añade empleados en la pestaña Equipo para ver el resumen de costes.
            </div>
          )}
        </div>
      )}

      {/* ── CONVENIO ──────────────────────────────────────────────────────── */}
      {tab === 'convenio' && (
        <div>
          <div className="bg-gold/10 border border-gold/30 rounded-xl px-4 py-3 mb-6 text-sm text-ink-soft">
            ℹ️ <strong>Guía orientativa.</strong> Basada en el VI Convenio Colectivo General del Sector de la Construcción (2022-2026). Verifica siempre los importes actualizados con tu asesoría laboral o en el BOE / convenio provincial.
          </div>
          <div className="space-y-6">
            {CONVENIO_SECCIONES.map(sec => (
              <div key={sec.titulo} className="card">
                <div className="flex items-start gap-3 mb-4">
                  <span className="text-2xl flex-shrink-0">{sec.icon}</span>
                  <div>
                    <h2 className="font-bold text-ink">{sec.titulo}</h2>
                    <p className="text-sm text-ink-soft mt-1 leading-relaxed">{sec.desc}</p>
                  </div>
                </div>
                <div className="bg-page rounded-xl overflow-hidden">
                  {sec.items.map((item, i) => (
                    <div key={i} className={`flex items-baseline justify-between gap-4 px-4 py-2.5 ${i < sec.items.length - 1 ? 'border-b border-white/60' : ''}`}>
                      <span className={`text-sm ${item.bold ? 'font-bold text-ink' : 'text-ink-soft'}`}>{item.label}</span>
                      <span className={`text-sm text-right flex-shrink-0 ${item.bold ? 'font-bold text-ink' : 'text-ink'}`}>{item.valor}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Recursos */}
          <div className="mt-8 card bg-navy">
            <div className="text-xs font-bold uppercase tracking-widest text-gold mb-4">Recursos y links útiles</div>
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
              <h2 className="text-lg font-bold text-ink">{editId ? 'Editar empleado' : 'Nuevo empleado'}</h2>
              <button onClick={() => setShowForm(false)} className="text-ink-soft hover:text-ink text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
            </div>
            <form onSubmit={save} className="p-6 space-y-4 overflow-y-auto">
              {/* Nombre */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Nombre *</label>
                  <input className="input" value={form.nombre} onChange={e => setF('nombre', e.target.value)} required placeholder="Nombre" />
                </div>
                <div>
                  <label className="label">Apellidos *</label>
                  <input className="input" value={form.apellidos} onChange={e => setF('apellidos', e.target.value)} required placeholder="Apellidos" />
                </div>
              </div>

              {/* Puesto y tipo contrato */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Puesto *</label>
                  <select className="input" value={form.puesto} onChange={e => setF('puesto', e.target.value)}>
                    {PUESTOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Tipo de contrato *</label>
                  <select className="input" value={form.tipo_contrato} onChange={e => setF('tipo_contrato', e.target.value)}>
                    {TIPOS_CONTRATO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Especialidad y grupo convenio */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Especialidad / detalle</label>
                  <input className="input" value={form.especialidad} onChange={e => setF('especialidad', e.target.value)} placeholder="Ej: Fontanería y gas, pladur…" />
                </div>
                <div>
                  <label className="label">Grupo profesional (Convenio)</label>
                  <select className="input" value={form.grupo_convenio} onChange={e => setF('grupo_convenio', e.target.value)}>
                    {GRUPOS_CONVENIO.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Salario y jornada */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Salario bruto mensual (€) *</label>
                  <input className="input" type="number" min="0" step="0.01" value={form.salario_bruto}
                    onChange={e => setF('salario_bruto', e.target.value)} required placeholder="1.500,00" />
                  {form.salario_bruto > 0 && (
                    <div className="text-xs text-ink-soft mt-1">
                      Coste empresa: <strong>{fmt(costeEmpresa(parseFloat(form.salario_bruto) || 0).total)}</strong> / mes
                    </div>
                  )}
                </div>
                <div>
                  <label className="label">% de jornada</label>
                  <input className="input" type="number" min="1" max="100" value={form.jornada_pct}
                    onChange={e => setF('jornada_pct', e.target.value)} />
                  <div className="text-xs text-ink-soft mt-1">100% = jornada completa</div>
                </div>
              </div>

              {/* Fechas y estado */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Fecha de alta *</label>
                  <input className="input" type="date" value={form.fecha_alta} onChange={e => setF('fecha_alta', e.target.value)} required />
                </div>
                <div>
                  <label className="label">Fecha de baja</label>
                  <input className="input" type="date" value={form.fecha_baja} onChange={e => setF('fecha_baja', e.target.value)} />
                </div>
                <div>
                  <label className="label">Estado</label>
                  <select className="input" value={form.estado} onChange={e => setF('estado', e.target.value)}>
                    <option value="activo">Activo</option>
                    <option value="baja_temporal">Baja temporal</option>
                    <option value="baja_definitiva">Baja definitiva</option>
                  </select>
                </div>
              </div>

              {/* Contacto y SS */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Teléfono</label>
                  <input className="input" type="tel" value={form.telefono} onChange={e => setF('telefono', e.target.value)} placeholder="6XX XXX XXX" />
                </div>
                <div>
                  <label className="label">Nº afiliación SS</label>
                  <input className="input" value={form.num_ss} onChange={e => setF('num_ss', e.target.value)} placeholder="28/XXXXXXXXXXX/XX" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">DNI / NIE</label>
                  <input className="input" value={form.dni} onChange={e => setF('dni', e.target.value)} placeholder="12345678A" />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input className="input" type="email" value={form.email} onChange={e => setF('email', e.target.value)} placeholder="empleado@email.com" />
                </div>
              </div>

              <div>
                <label className="label">Notas</label>
                <textarea className="input h-20 resize-none" value={form.notas} onChange={e => setF('notas', e.target.value)} placeholder="Observaciones, acuerdos especiales…" />
              </div>

              {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Guardando…' : 'Guardar'}</button>
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
  const [bruto, setBruto] = useState('')
  const b = parseFloat(bruto) || 0
  const { ss, total } = costeEmpresa(b)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <div>
          <label className="label">Salario bruto mensual (€)</label>
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
              <span>Total SS empresa ({SS_TOTAL.toFixed(2)}%)</span>
              <span>{fmt(ss)}</span>
            </div>
          </div>
        )}
      </div>
      <div className="space-y-3">
        {b > 0 && (
          <>
            <div className="bg-navy rounded-xl p-4 text-center">
              <div className="text-xs font-bold uppercase tracking-widest text-gold mb-1">Coste empresa / mes</div>
              <div className="text-3xl font-black text-white">{fmt(total)}</div>
              <div className="text-xs text-white/60 mt-1">{fmt(b)} bruto + {fmt(ss)} SS</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="card text-center py-3">
                <div className="text-sm font-bold text-ink">{fmt(total * 12)}</div>
                <div className="text-xs text-ink-soft">Coste anual (×12)</div>
              </div>
              <div className="card text-center py-3">
                <div className="text-sm font-bold text-ink">{fmt(total * 14)}</div>
                <div className="text-xs text-ink-soft">Con 2 pagas extra</div>
              </div>
            </div>
          </>
        )}
        {!b && (
          <div className="flex items-center justify-center h-full text-ink-soft text-sm text-center py-10">
            Introduce el salario bruto para calcular el coste real
          </div>
        )}
      </div>
    </div>
  )
}
