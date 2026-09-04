import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase, getUID } from '../../lib/supabase'

const ESTADOS = [
  { value: 'pendiente',   color: 'bg-stone/20 text-ink-soft' },
  { value: 'en_curso',    color: 'bg-gold/20 text-gold-dark' },
  { value: 'pausada',     color: 'bg-orange-100 text-orange-700' },
  { value: 'completada',  color: 'bg-green-100 text-green-700' },
  { value: 'cancelada',   color: 'bg-red-100 text-red-600' },
]

// Los valores de ETAPAS se guardan tal cual en la base de datos (en español),
// por eso no se traducen aquí — solo su etiqueta visible (ver ETAPA_KEYS).
const ETAPAS = [
  'Planificación', 'Inicio de obra', 'Demolición', 'Albañilería',
  'Instalaciones', 'Revestimientos', 'Carpintería', 'Pintura', 'Acabados', 'Entrega'
]

const ETAPA_KEYS = {
  'Planificación': 'planificacion',
  'Inicio de obra': 'inicio_obra',
  'Demolición': 'demolicion',
  'Albañilería': 'albanileria',
  'Instalaciones': 'instalaciones',
  'Revestimientos': 'revestimientos',
  'Carpintería': 'carpinteria',
  'Pintura': 'pintura',
  'Acabados': 'acabados',
  'Entrega': 'entrega',
}

function estadoLabel(t, value) { return t(`obras.estado.${value}`) }
function etapaLabel(t, etapa) { return t(`obras.etapa.${ETAPA_KEYS[etapa] || 'planificacion'}`) }

const BUCKET = 'obras-fotos'

function EstadoBadge({ estado }) {
  const { t } = useTranslation()
  const e = ESTADOS.find(s => s.value === estado) || ESTADOS[0]
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${e.color}`}>{estadoLabel(t, e.value)}</span>
}

function EtapaBar({ etapa, onChange }) {
  const idx = ETAPAS.indexOf(etapa)
  const pct = idx < 0 ? 0 : Math.round((idx / (ETAPAS.length - 1)) * 100)
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-semibold text-ink-soft uppercase tracking-wide">Etapa</span>
        <span className="text-xs font-bold text-ink">{pct}% completado</span>
      </div>
      <div className="relative">
        <div className="h-2 bg-edge rounded-full overflow-hidden">
          <div className="h-full bg-gold rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex justify-between mt-2 overflow-x-auto pb-1">
          {ETAPAS.map((e, i) => (
            <button key={e} onClick={() => onChange && onChange(e)}
              className={`text-[9px] font-semibold flex-shrink-0 px-1 text-center transition-colors ${
                i <= idx ? 'text-gold-dark' : 'text-ink-soft/40'
              } ${onChange ? 'hover:text-ink cursor-pointer' : 'cursor-default'}`}
              title={e}
            >
              {i <= idx ? '●' : '○'}
            </button>
          ))}
        </div>
        <div className="flex justify-between">
          {ETAPAS.map((e, i) => (
            <span key={e}
              className={`text-[8px] flex-shrink-0 text-center leading-tight max-w-[52px] ${
                e === etapa ? 'text-ink font-bold' : 'text-ink-soft/40'
              }`}
            >
              {i === 0 || i === ETAPAS.length - 1 || e === etapa ? e : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Panel de detalle de obra ───────────────────────────────
function ObraDetalle({ obra: obraInicial, clientes, onClose, onUpdate }) {
  const { t } = useTranslation()
  const [obra, setObra] = useState(obraInicial)
  const [tab, setTab] = useState('seguimiento')
  const [saving, setSaving] = useState(false)
  const [cacheError, setCacheError] = useState(false)

  // Seguimiento
  const [nota, setNota] = useState('')
  const [notaVisibleCliente, setNotaVisibleCliente] = useState(true)
  const [addingNota, setAddingNota] = useState(false)
  const [errorSeg, setErrorSeg] = useState('')

  // Fotos — cargadas directamente desde Storage (sin depender de DB)
  const [fotos, setFotos] = useState([])
  const [subiendo, setSubiendo] = useState(false)
  const [cargandoFotos, setCargandoFotos] = useState(false)
  const [errorFoto, setErrorFoto] = useState('')
  const fileRef = useRef(null)

  // Planos — subcarpeta planos/ dentro del mismo bucket obras-fotos
  const [planos, setPlanos] = useState([])
  const [subiendoPlano, setSubiendoPlano] = useState(false)
  const [cargandoPlanos, setCargandoPlanos] = useState(false)
  const [errorPlano, setErrorPlano] = useState('')
  const planoRef = useRef(null)

  // Equipo asignado
  const [equipoObra, setEquipoObra] = useState([])
  const [todosEmpleados, setTodosEmpleados] = useState([])
  const [asignando, setAsignando] = useState(false)
  const [formEq, setFormEq] = useState({ empleado_id: '', rol_en_obra: '', fecha_inicio: '', fecha_fin: '' })
  const [errEq, setErrEq] = useState('')
  const [savingEq, setSavingEq] = useState(false)

  // Editar datos básicos
  const [form, setForm] = useState({
    nombre: obra.nombre || '', cliente_id: obra.cliente_id || '',
    descripcion: obra.descripcion || '', estado: obra.estado || 'pendiente',
    etapa: obra.etapa || 'Planificación', fecha_inicio: obra.fecha_inicio || '',
    fecha_fin_prevista: obra.fecha_fin_prevista || '', direccion_obra: obra.direccion_obra || '',
    presupuesto_total: obra.presupuesto_total?.toString() || '',
    coste_real: obra.coste_real?.toString() || '', notas: obra.notas || ''
  })
  const [savingForm, setSavingForm] = useState(false)
  const [formError, setFormError] = useState('')

  // Cargar fotos + planos + equipo al abrir
  useEffect(() => { cargarFotos(); cargarPlanos(); cargarEquipo() }, [])

  async function cargarFotos() {
    setCargandoFotos(true)
    setErrorFoto('')
    const { data, error } = await supabase.storage.from(BUCKET).list(obra.id + '/', { sortBy: { column: 'created_at', order: 'asc' } })
    if (error) { setErrorFoto(`Error listando fotos: ${error.message}`); setCargandoFotos(false); return }
    const archivos = (data || []).filter(f => f.name && !f.name.startsWith('.') && f.id)
    if (!archivos.length) { setFotos([]); setCargandoFotos(false); return }

    const paths = archivos.map(f => `${obra.id}/${f.name}`)
    const { data: signed, error: signErr } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600)
    setCargandoFotos(false)
    if (signErr) { setErrorFoto(`Error generando URLs: ${signErr.message}`); return }

    setFotos(archivos.map((f, i) => ({
      url: signed[i]?.signedUrl || '',
      nombre: f.name,
      path: `${obra.id}/${f.name}`,
      fecha: f.created_at?.split('T')[0] || '',
    })))
  }

  function setF(f, v) { setForm(p => ({ ...p, [f]: v })) }

  // ── PLANOS ───────────────────────────────────────────────
  const PLANOS_PREFIX = `${obra.id}/planos/`

  function planoIcon(nombre) {
    const ext = nombre.split('.').pop().toLowerCase()
    if (ext === 'pdf') return '📄'
    if (['dwg','dxf','rvt','ifc'].includes(ext)) return '📐'
    if (['jpg','jpeg','png','webp','tif','tiff'].includes(ext)) return '🖼️'
    if (['zip','rar','7z'].includes(ext)) return '🗜️'
    return '📎'
  }

  function fmtBytes(b) {
    if (!b) return ''
    if (b < 1024) return `${b} B`
    if (b < 1024*1024) return `${(b/1024).toFixed(0)} KB`
    return `${(b/(1024*1024)).toFixed(1)} MB`
  }

  async function cargarPlanos() {
    setCargandoPlanos(true); setErrorPlano('')
    const { data, error } = await supabase.storage.from(BUCKET).list(PLANOS_PREFIX, { sortBy: { column: 'created_at', order: 'desc' } })
    setCargandoPlanos(false)
    if (error) { setErrorPlano(`Error: ${error.message}`); return }
    const archivos = (data || []).filter(f => f.name && !f.name.startsWith('.') && f.id)
    if (!archivos.length) { setPlanos([]); return }
    const paths = archivos.map(f => `${PLANOS_PREFIX}${f.name}`)
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 7200)
    setPlanos(archivos.map((f, i) => ({
      url: signed?.[i]?.signedUrl || '',
      nombre: f.name,
      path: `${PLANOS_PREFIX}${f.name}`,
      fecha: f.created_at?.split('T')[0] || '',
      size: f.metadata?.size || 0,
    })))
  }

  async function subirPlanos(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setSubiendoPlano(true); setErrorPlano('')
    for (const file of files) {
      const ext = file.name.split('.').pop().toLowerCase()
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${PLANOS_PREFIX}${Date.now()}_${safeName}`
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
      if (error) { setErrorPlano(`Error subiendo "${file.name}": ${error.message}`); break }
    }
    await cargarPlanos()
    setSubiendoPlano(false)
    if (planoRef.current) planoRef.current.value = ''
  }

  async function eliminarPlano(plano) {
    if (!confirm(t('obras.confirm.eliminarPlano', { nombre: plano.nombre }))) return
    await supabase.storage.from(BUCKET).remove([plano.path])
    await cargarPlanos()
  }

  // ── EQUIPO ───────────────────────────────────────────────
  async function cargarEquipo() {
    const [{ data: eq }, { data: emps }] = await Promise.all([
      supabase.from('obra_empleados')
        .select('*, empleados(nombre,apellidos,puesto,telefono)')
        .eq('obra_id', obra.id),
      supabase.from('empleados').select('id,nombre,apellidos,puesto').eq('estado','activo').order('apellidos'),
    ])
    setEquipoObra(eq || [])
    setTodosEmpleados(emps || [])
  }

  async function asignarEmpleado(e) {
    e.preventDefault(); setSavingEq(true); setErrEq('')
    const { error } = await supabase.from('obra_empleados').insert({
      obra_id: obra.id,
      empleado_id: formEq.empleado_id,
      rol_en_obra: formEq.rol_en_obra || null,
      fecha_inicio: formEq.fecha_inicio || null,
      fecha_fin: formEq.fecha_fin || null,
    })
    setSavingEq(false)
    if (error) { setErrEq(error.message); return }
    setFormEq({ empleado_id: '', rol_en_obra: '', fecha_inicio: '', fecha_fin: '' })
    setAsignando(false)
    cargarEquipo()
  }

  async function quitarEmpleado(id) {
    if (!confirm(t('obras.confirm.quitarEmpleado'))) return
    await supabase.from('obra_empleados').delete().eq('id', id)
    cargarEquipo()
  }

  // patch — solo campos que existen en el caché (estado, nombre, etc.)
  // para campos nuevos (etapa, seguimiento) captura el error de caché
  async function patch(campos) {
    setSaving(true); setCacheError(false)
    const { data, error } = await supabase.from('obras').update(campos).eq('id', obra.id).select('*, clientes(nombre)').single()
    setSaving(false)
    if (error) {
      if (error.message?.includes('schema cache') || error.message?.includes('column')) {
        setCacheError(true)
      } else {
        setErrorFoto(`Error: ${error.message}`)
      }
      return
    }
    if (data) { setObra(data); onUpdate(data) }
  }

  async function cambiarEstado(val) {
    await patch({ estado: val })
  }

  // Actualiza etapa y/o seguimiento via RPC (evita caché de PostgREST)
  async function patchRpc({ nueva_etapa, nuevo_seguimiento }) {
    setSaving(true); setErrorSeg('')
    const params = { obra_id: obra.id }
    if (nueva_etapa !== undefined) params.nueva_etapa = nueva_etapa
    if (nuevo_seguimiento !== undefined) params.nuevo_seguimiento = nuevo_seguimiento
    console.log('[patchRpc] llamando RPC con:', params)
    const { error } = await supabase.rpc('actualizar_obra_seguimiento', params)
    console.log('[patchRpc] resultado error:', error)
    if (error) {
      setErrorSeg(`Error RPC: ${error.message}`)
      setSaving(false)
      return
    }
    // Refresca la obra desde la DB
    const { data, error: fetchErr } = await supabase.from('obras').select('*, clientes(nombre)').eq('id', obra.id).single()
    console.log('[patchRpc] obra refrescada:', data, fetchErr)
    setSaving(false)
    if (data) { setObra(data); onUpdate(data) }
  }

  // Avisa al cliente por email (si tiene portal/email) de una novedad en su obra.
  // No crítico: si falla, no interrumpe el flujo del profesional.
  async function notificarCliente(tipo, mensaje) {
    try {
      await supabase.functions.invoke('obras-notificar-actualizacion', {
        body: { obra_id: obra.id, tipo, mensaje },
      })
    } catch { /* no bloquea el guardado si el aviso falla */ }
  }

  async function cambiarEtapa(val) {
    // El cambio de etapa siempre es visible para el cliente: es lo primero que
    // le interesa saber sobre el avance de su obra.
    const entrada = { id: crypto.randomUUID(), fecha: new Date().toISOString().split('T')[0], nota: `Etapa avanzada a: ${val}`, tipo: 'etapa', visible_cliente: true }
    const nuevoSeguimiento = [...(obra.seguimiento || []), entrada]
    await patchRpc({ nueva_etapa: val, nuevo_seguimiento: nuevoSeguimiento })
    notificarCliente('etapa', `La obra ha avanzado a la etapa "${val}".`)
  }

  async function agregarNota(e) {
    e.preventDefault()
    if (!nota.trim()) return
    setAddingNota(true)
    const textoNota = nota.trim()
    const visible = notaVisibleCliente
    const entrada = { id: crypto.randomUUID(), fecha: new Date().toISOString().split('T')[0], nota: textoNota, tipo: 'nota', visible_cliente: visible }
    const nuevoSeguimiento = [...(obra.seguimiento || []), entrada]
    await patchRpc({ nuevo_seguimiento: nuevoSeguimiento })
    setNota('')
    setAddingNota(false)
    if (visible) notificarCliente('nota', textoNota)
  }

  async function eliminarNota(id) {
    const nuevo = (obra.seguimiento || []).filter(e => e.id !== id)
    await patchRpc({ nuevo_seguimiento: nuevo })
  }

  // Fotos: upload directo a Storage, listar desde Storage (sin columna DB)
  async function subirFotos(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setSubiendo(true); setErrorFoto('')
    let hayError = false
    for (const file of files) {
      const ext = file.name.split('.').pop().toLowerCase()
      const path = `${obra.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
      if (upErr) {
        hayError = true
        setErrorFoto(`❌ Error subiendo "${file.name}": ${upErr.message}`)
      }
    }
    if (!hayError) setErrorFoto('')
    await cargarFotos()
    setSubiendo(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function eliminarFoto(foto) {
    if (!confirm(t('obras.confirm.eliminarFoto'))) return
    await supabase.storage.from(BUCKET).remove([foto.path])
    await cargarFotos()
  }

  async function saveForm(e) {
    e.preventDefault(); setSavingForm(true); setFormError('')
    const payload = {
      ...form,
      cliente_id: form.cliente_id || null,
      presupuesto_total: form.presupuesto_total ? parseFloat(form.presupuesto_total) : 0,
      coste_real: form.coste_real ? parseFloat(form.coste_real) : 0,
      fecha_inicio: form.fecha_inicio || null,
      fecha_fin_prevista: form.fecha_fin_prevista || null,
    }
    const { data, error } = await supabase.from('obras').update(payload).eq('id', obra.id).select('*, clientes(nombre)').single()
    setSavingForm(false)
    if (error) { setFormError(error.message); return }
    setObra(data); onUpdate(data)
  }

  const seguimientoOrdenado = [...(obra.seguimiento || [])].sort((a, b) => b.fecha.localeCompare(a.fecha))
  const margen = obra.presupuesto_total > 0
    ? ((obra.presupuesto_total - obra.coste_real) / obra.presupuesto_total * 100).toFixed(0)
    : null

  return (
    <div className="fixed inset-0 bg-navy/70 backdrop-blur-sm z-50 flex items-start justify-end">
      <div className="bg-surface h-full w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-navy px-6 py-4 flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-white font-bold text-lg leading-tight">{obra.nombre}</h2>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {obra.clientes?.nombre && <span className="text-white/60 text-xs">👤 {obra.clientes.nombre}</span>}
                {obra.direccion_obra && <span className="text-white/60 text-xs">📍 {obra.direccion_obra}</span>}
              </div>
            </div>
            <button onClick={onClose} className="text-white/50 hover:text-white text-2xl leading-none flex-shrink-0 mt-0.5">×</button>
          </div>

          {/* Estado + métricas */}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <select
              value={obra.estado}
              onChange={e => cambiarEstado(e.target.value)}
              className="text-xs font-semibold bg-white/10 text-white border border-white/20 rounded-lg px-3 py-1.5 focus:outline-none focus:border-gold cursor-pointer"
            >
              {/* El desplegable del navegador ignora el fondo translúcido del
                  <select> y lo pinta sólido; sin bg/color explícitos en cada
                  <option> el texto blanco queda invisible sobre ese fondo. */}
              {ESTADOS.map(s => <option key={s.value} value={s.value} className="bg-navy text-white">{estadoLabel(t, s.value)}</option>)}
            </select>
            {obra.presupuesto_total > 0 && (
              <span className="text-xs text-white/60">
                💰 {obra.presupuesto_total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
              </span>
            )}
            {margen !== null && (
              <span className={`text-xs font-bold ${parseFloat(margen) >= 30 ? 'text-green-300' : 'text-orange-300'}`}>
                {t('obras.list.margen', { pct: margen })}
              </span>
            )}
            {obra.fecha_inicio && <span className="text-xs text-white/50">📅 {new Date(obra.fecha_inicio).toLocaleDateString('es-ES')}</span>}
            {obra.fecha_fin_prevista && <span className="text-xs text-white/50">🏁 {new Date(obra.fecha_fin_prevista).toLocaleDateString('es-ES')}</span>}
          </div>

          {/* Barra de etapa */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-white/50 font-semibold uppercase tracking-wide">{t('obras.detalle.etapaActual')}</span>
              <span className="text-xs font-bold text-gold">{etapaLabel(t, obra.etapa || 'Planificación')}</span>
            </div>
            <div className="flex gap-1">
              {ETAPAS.map((e, i) => {
                const actual = ETAPAS.indexOf(obra.etapa || 'Planificación')
                const done = i <= actual
                return (
                  <button key={e} onClick={() => cambiarEtapa(e)} title={etapaLabel(t, e)}
                    className={`h-1.5 flex-1 rounded-full transition-all hover:opacity-80 cursor-pointer ${done ? 'bg-gold' : 'bg-white/20'}`}
                  />
                )
              })}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-white/30">{etapaLabel(t, ETAPAS[0])}</span>
              <span className="text-[9px] text-white/30">{etapaLabel(t, ETAPAS[ETAPAS.length - 1])}</span>
            </div>
          </div>
        </div>

        {/* Banner error caché */}
        {cacheError && (
          <div className="bg-amber-50 border-b border-amber-200 px-5 py-3 flex items-start gap-3 flex-shrink-0">
            <span className="text-lg">⚠️</span>
            <div className="flex-1 text-xs text-amber-800">
              <strong>{t('obras.setup.cacheAccionNecesaria')}</strong> {t('obras.setup.cacheBody')}{' '}
              <strong>Supabase → SQL Editor</strong> {t('obras.setup.cacheEjecuta')}<br />
              <code className="font-mono bg-amber-100 px-1 rounded">NOTIFY pgrst, &apos;reload schema&apos;;</code>
              <button onClick={() => setCacheError(false)} className="ml-3 text-amber-600 underline">{t('obras.setup.cerrar')}</button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-0 border-b border-edge flex-shrink-0 bg-surface px-4">
          {[
            { id: 'seguimiento', label: t('obras.detalle.tabs.seguimiento'), count: obra.seguimiento?.length },
            { id: 'fotos',       label: t('obras.detalle.tabs.fotos'),       count: fotos.length },
            { id: 'planos',      label: t('obras.detalle.tabs.planos'),      count: planos.length },
            { id: 'equipo',      label: t('obras.detalle.tabs.equipo'),      count: equipoObra.length },
            { id: 'datos',       label: t('obras.detalle.tabs.datos') },
          ].map(tb => (
            <button key={tb.id} onClick={() => setTab(tb.id)}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                tab === tb.id ? 'border-gold text-ink' : 'border-transparent text-ink-soft hover:text-ink'
              }`}>
              {tb.label}
              {tb.count > 0 && <span className="text-xs bg-edge text-ink-soft px-1.5 py-0.5 rounded-full">{tb.count}</span>}
            </button>
          ))}
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto">

          {/* ── SEGUIMIENTO ── */}
          {tab === 'seguimiento' && (
            <div className="p-5">
              {errorSeg && (
                <div className="mb-4 text-red-700 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  ❌ {errorSeg}
                </div>
              )}
              {saving && <div className="mb-3 text-xs text-ink-soft animate-pulse">{t('obras.detalle.seguimiento.saving')}</div>}
              {/* Cambio de etapa rápido */}
              <div className="mb-5">
                <label className="label mb-2">{t('obras.detalle.avanzarEtapa')}</label>
                <div className="flex flex-wrap gap-2">
                  {ETAPAS.map((e, i) => {
                    const actual = ETAPAS.indexOf(obra.etapa || 'Planificación')
                    return (
                      <button key={e} onClick={() => cambiarEtapa(e)}
                        className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors border ${
                          e === obra.etapa
                            ? 'bg-gold text-navy border-gold'
                            : i < actual
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-surface text-ink-soft border-edge hover:border-gold hover:text-ink'
                        }`}>
                        {i < actual ? '✓ ' : ''}{etapaLabel(t, e)}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Añadir nota */}
              <form onSubmit={agregarNota} className="mb-6">
                <label className="label mb-2">{t('obras.detalle.seguimiento.addUpdateLabel')}</label>
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    placeholder={t('obras.detalle.seguimiento.addUpdatePlaceholder')}
                    value={nota}
                    onChange={e => setNota(e.target.value)}
                  />
                  <button type="submit" disabled={addingNota || !nota.trim()} className="btn-primary px-4">
                    {addingNota ? '…' : t('obras.detalle.seguimiento.addBtn')}
                  </button>
                </div>
                <label className="flex items-center gap-2 mt-2 text-xs text-ink-soft cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={notaVisibleCliente}
                    onChange={e => setNotaVisibleCliente(e.target.checked)}
                    className="rounded border-edge"
                  />
                  Visible para el cliente en su Portal (le avisamos por email)
                </label>
              </form>

              {/* Timeline */}
              {seguimientoOrdenado.length === 0 ? (
                <div className="text-center py-10 text-ink-soft text-sm">
                  <div className="text-3xl mb-2">📋</div>
                  {t('obras.detalle.seguimiento.emptyText')}
                </div>
              ) : (
                <div className="space-y-3">
                  {seguimientoOrdenado.map(entry => (
                    <div key={entry.id} className={`flex gap-3 group ${entry.tipo === 'etapa' ? 'opacity-70' : ''}`}>
                      <div className="flex-shrink-0 flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                          entry.tipo === 'etapa' ? 'bg-gold/20 text-gold-dark' : 'bg-navy text-white'
                        }`}>
                          {entry.tipo === 'etapa' ? '→' : '✍'}
                        </div>
                        <div className="w-px flex-1 bg-edge mt-1" />
                      </div>
                      <div className="flex-1 pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm leading-relaxed ${entry.tipo === 'etapa' ? 'text-ink-soft italic' : 'text-ink'}`}>
                            {entry.nota}
                          </p>
                          {entry.tipo !== 'etapa' && (
                            <button onClick={() => eliminarNota(entry.id)}
                              className="text-ink-soft/30 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                              ×
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-ink-soft/50">
                            {new Date(entry.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </span>
                          {entry.tipo === 'etapa' || entry.visible_cliente ? (
                            <span className="text-[10px] font-semibold text-gold-dark bg-gold/10 px-1.5 py-0.5 rounded-full">👁 Visible cliente</span>
                          ) : (
                            <span className="text-[10px] font-semibold text-ink-soft/50 bg-edge px-1.5 py-0.5 rounded-full">🔒 Interno</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── FOTOS ── */}
          {tab === 'fotos' && (
            <div className="p-5">
              {/* Upload */}
              <div
                onClick={() => !subiendo && fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors mb-5 group ${subiendo ? 'border-gold bg-gold/5 cursor-wait' : 'border-edge hover:border-gold cursor-pointer'}`}
              >
                <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">{subiendo ? '⏳' : '📷'}</div>
                <div className="font-semibold text-ink mb-1">{subiendo ? t('obras.detalle.fotos.dropZoneUploading') : t('obras.detalle.fotos.dropZoneIdle')}</div>
                <div className="text-xs text-ink-soft">{t('obras.detalle.fotos.hint')}</div>
                <input ref={fileRef} type="file" multiple accept="image/*" className="sr-only" onChange={subirFotos} disabled={subiendo} />
              </div>
              {errorFoto && (
                <div className="text-red-700 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
                  {errorFoto}
                  {errorFoto.includes('policy') || errorFoto.includes('Unauthorized') ? (
                    <div className="mt-2 font-semibold">
                      ⚙️ {t('obras.setup.faltaPoliticaStorage')}<br />
                      <code className="font-mono text-ink">
                        CREATE POLICY &quot;up&quot; ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = &apos;obras-fotos&apos;);
                      </code>
                    </div>
                  ) : null}
                </div>
              )}

              {cargandoFotos ? (
                <div className="text-center py-8 text-ink-soft text-sm">{t('obras.detalle.fotos.loading')}</div>
              ) : fotos.length === 0 ? (
                <div className="text-center py-8 text-ink-soft text-sm">
                  <div className="text-3xl mb-2">🖼️</div>
                  {t('obras.detalle.fotos.empty')}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {fotos.map((foto, i) => (
                    <div key={i} className="relative group rounded-xl overflow-hidden bg-page aspect-square">
                      <img src={foto.url} alt={foto.nombre} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-navy/0 group-hover:bg-navy/40 transition-all flex items-end">
                        <div className="p-2 w-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between">
                          <span className="text-white text-xs truncate">{foto.fecha}</span>
                          <div className="flex gap-2">
                            <a href={foto.url} target="_blank" rel="noopener noreferrer"
                              className="w-7 h-7 bg-white/20 hover:bg-white/40 rounded-lg flex items-center justify-center text-white text-xs">
                              ↗
                            </a>
                            <button onClick={() => eliminarFoto(foto)}
                              className="w-7 h-7 bg-red-500/80 hover:bg-red-600 rounded-lg flex items-center justify-center text-white text-xs">
                              ×
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Info bucket */}
              {fotos.length === 0 && (
                <div className="mt-4 bg-gold/10 border border-gold/30 rounded-xl px-4 py-3 text-xs text-ink-soft">
                  <strong className="text-ink">⚙️ {t('obras.setup.primeraVez')}</strong> {t('obras.setup.primeraVezBody')}{' '}
                  <code className="bg-surface px-1 rounded">obras-fotos</code> {t('obras.setup.primeraVezFin')}
                </div>
              )}
            </div>
          )}

          {/* ── PLANOS ── */}
          {tab === 'planos' && (
            <div className="p-5">
              {/* Zona de subida */}
              <div
                onClick={() => !subiendoPlano && planoRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-7 text-center transition-colors mb-5 group cursor-pointer ${subiendoPlano ? 'border-gold bg-gold/5 cursor-wait' : 'border-edge hover:border-gold'}`}
              >
                <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">{subiendoPlano ? '⏳' : '📐'}</div>
                <div className="font-semibold text-ink mb-1">{subiendoPlano ? t('obras.detalle.planos.dropZoneUploading') : t('obras.detalle.planos.dropZoneIdle')}</div>
                <div className="text-xs text-ink-soft">{t('obras.detalle.planos.hint')}</div>
                <input
                  ref={planoRef}
                  type="file"
                  multiple
                  accept=".pdf,.dwg,.dxf,.rvt,.ifc,.png,.jpg,.jpeg,.tif,.tiff,.zip"
                  className="sr-only"
                  onChange={subirPlanos}
                  disabled={subiendoPlano}
                />
              </div>

              {errorPlano && (
                <div className="text-red-700 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{errorPlano}</div>
              )}

              {/* Lista de planos */}
              {cargandoPlanos ? (
                <div className="text-center py-8 text-ink-soft text-sm">{t('obras.detalle.planos.loading')}</div>
              ) : planos.length === 0 ? (
                <div className="text-center py-10 text-ink-soft text-sm">
                  <div className="text-4xl mb-2">📂</div>
                  <div className="font-semibold text-ink mb-1">{t('obras.detalle.planos.emptyTitle')}</div>
                  <div className="text-xs">{t('obras.detalle.planos.emptyHint')}</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {planos.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 py-3 px-4 bg-page rounded-xl group hover:bg-edge/50 transition-colors">
                      <span className="text-2xl flex-shrink-0">{planoIcon(p.nombre)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-ink text-sm truncate">{p.nombre}</div>
                        <div className="text-xs text-ink-soft flex gap-3 mt-0.5">
                          {p.fecha && <span>{new Date(p.fecha+'T12:00:00').toLocaleDateString('es-ES')}</span>}
                          {p.size > 0 && <span>{fmtBytes(p.size)}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {p.url && (
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-semibold text-gold hover:text-gold-dark px-2 py-1 rounded-lg border border-gold/30 hover:bg-gold/10 transition-colors"
                          >
                            {t('obras.detalle.planos.download')}
                          </a>
                        )}
                        <button
                          onClick={() => eliminarPlano(p)}
                          className="text-ink-soft/30 hover:text-red-500 text-sm opacity-0 group-hover:opacity-100 transition-opacity px-1"
                          title={t('obras.list.eliminar')}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 bg-gold/10 border border-gold/30 rounded-xl px-4 py-3 text-xs text-ink-soft">
                <strong className="text-ink">{t('obras.detalle.planos.tipTitle')}</strong> {t('obras.detalle.planos.tipBody')}
              </div>
            </div>
          )}

          {/* ── EQUIPO ── */}
          {tab === 'equipo' && (
            <div className="p-5">
              {/* Asignar empleado */}
              {asignando ? (
                <form onSubmit={asignarEmpleado} className="card bg-page mb-5 space-y-3">
                  <div className="font-semibold text-ink">{t('obras.detalle.equipo.assignTitle')}</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="label">{t('obras.detalle.equipo.employeeLabel')}</label>
                      <select className="input" value={formEq.empleado_id} onChange={e=>setFormEq(p=>({...p,empleado_id:e.target.value}))} required>
                        <option value="">{t('obras.detalle.equipo.selectPlaceholder')}</option>
                        {todosEmpleados
                          .filter(e => !equipoObra.some(eq => eq.empleado_id === e.id))
                          .map(e => (
                            <option key={e.id} value={e.id}>{e.apellidos}, {e.nombre} — {e.puesto}</option>
                          ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="label">{t('obras.detalle.equipo.roleLabel')}</label>
                      <input className="input" placeholder={t('obras.detalle.equipo.rolePlaceholder')} value={formEq.rol_en_obra} onChange={e=>setFormEq(p=>({...p,rol_en_obra:e.target.value}))} />
                    </div>
                    <div>
                      <label className="label">{t('obras.detalle.equipo.startDateLabel')}</label>
                      <input className="input" type="date" value={formEq.fecha_inicio} onChange={e=>setFormEq(p=>({...p,fecha_inicio:e.target.value}))} />
                    </div>
                    <div>
                      <label className="label">{t('obras.detalle.equipo.endDateLabel')}</label>
                      <input className="input" type="date" value={formEq.fecha_fin} onChange={e=>setFormEq(p=>({...p,fecha_fin:e.target.value}))} />
                    </div>
                  </div>
                  {errEq && <div className="text-red-600 text-xs">{errEq}</div>}
                  <div className="flex gap-2">
                    <button type="button" onClick={()=>setAsignando(false)} className="btn-secondary text-sm py-1.5">{t('obras.detalle.equipo.cancel')}</button>
                    <button type="submit" disabled={savingEq} className="btn-primary text-sm py-1.5">{savingEq?t('obras.detalle.equipo.assigning'):t('obras.detalle.equipo.assign')}</button>
                  </div>
                </form>
              ) : (
                <button onClick={()=>setAsignando(true)} className="btn-gold w-full mb-5">
                  {t('obras.detalle.equipo.assignBtn')}
                </button>
              )}

              {/* Lista equipo */}
              {equipoObra.length === 0 ? (
                <div className="text-center py-10 text-ink-soft text-sm">
                  <div className="text-4xl mb-2">👷</div>
                  {t('obras.detalle.equipo.emptyText')}
                </div>
              ) : (
                <div className="space-y-3">
                  {equipoObra.map(eq => {
                    const emp = eq.empleados
                    return (
                      <div key={eq.id} className="flex items-center gap-4 py-3 border-b border-edge last:border-0">
                        <div className="w-10 h-10 rounded-full bg-navy/10 flex items-center justify-center text-ink font-bold text-sm flex-shrink-0">
                          {emp?.nombre?.[0]}{emp?.apellidos?.[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-ink">{emp?.nombre} {emp?.apellidos}</div>
                          <div className="text-xs text-ink-soft flex flex-wrap gap-x-3 mt-0.5">
                            <span>{emp?.puesto}</span>
                            {eq.rol_en_obra && <span className="text-gold-dark font-semibold">{eq.rol_en_obra}</span>}
                            {eq.fecha_inicio && <span>{t('obras.detalle.equipo.since')} {new Date(eq.fecha_inicio+'T12:00:00').toLocaleDateString('es-ES')}</span>}
                            {eq.fecha_fin && <span>{t('obras.detalle.equipo.until')} {new Date(eq.fecha_fin+'T12:00:00').toLocaleDateString('es-ES')}</span>}
                          </div>
                        </div>
                        {emp?.telefono && (
                          <a href={`tel:${emp.telefono}`} className="text-ink-soft/50 hover:text-ink text-sm px-2">📞</a>
                        )}
                        <button onClick={()=>quitarEmpleado(eq.id)} className="text-ink-soft/30 hover:text-red-500 text-sm px-1 transition-colors flex-shrink-0">×</button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Aviso si faltan tablas en Supabase */}
              {errEq && errEq.includes('does not exist') && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
                  <strong>{t('obras.setup.equipoAccionNecesaria')}</strong> {t('obras.setup.equipoBody')} <code>supabase/equipo_v2.sql</code> {t('obras.setup.equipoFin')}
                </div>
              )}
            </div>
          )}

          {/* ── DATOS ── */}
          {tab === 'datos' && (
            <form onSubmit={saveForm} className="p-5 space-y-4">
              <div>
                <label className="label">{t('obras.form.nameLabel')}</label>
                <input className="input" value={form.nombre} onChange={e => setF('nombre', e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('obras.form.clientLabel')}</label>
                  <select className="input" value={form.cliente_id} onChange={e => setF('cliente_id', e.target.value)}>
                    <option value="">{t('obras.form.noClient')}</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{t('obras.form.stateLabel')}</label>
                  <select className="input" value={form.estado} onChange={e => setF('estado', e.target.value)}>
                    {ESTADOS.map(s => <option key={s.value} value={s.value}>{estadoLabel(t, s.value)}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">{t('obras.form.addressLabel')}</label>
                <input className="input" value={form.direccion_obra} onChange={e => setF('direccion_obra', e.target.value)} />
              </div>
              <div>
                <label className="label">{t('obras.form.descriptionLabel')}</label>
                <textarea className="input resize-none h-16" value={form.descripcion} onChange={e => setF('descripcion', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('obras.form.startDateLabel')}</label>
                  <input className="input" type="date" value={form.fecha_inicio} onChange={e => setF('fecha_inicio', e.target.value)} />
                </div>
                <div>
                  <label className="label">{t('obras.form.endDateLabel')}</label>
                  <input className="input" type="date" value={form.fecha_fin_prevista} onChange={e => setF('fecha_fin_prevista', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('obras.form.budgetLabel')}</label>
                  <input className="input" type="number" min="0" step="0.01" value={form.presupuesto_total} onChange={e => setF('presupuesto_total', e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <label className="label">{t('obras.form.actualCostLabel')}</label>
                  <input className="input" type="number" min="0" step="0.01" value={form.coste_real} onChange={e => setF('coste_real', e.target.value)} placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className="label">{t('obras.form.internalNotesLabel')}</label>
                <textarea className="input resize-none h-16" value={form.notas} onChange={e => setF('notas', e.target.value)} />
              </div>
              {formError && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</div>}
              <button type="submit" disabled={savingForm} className="btn-primary w-full">
                {savingForm ? t('obras.form.saving') : t('obras.form.saveChanges')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────
const FORM_EMPTY = {
  nombre: '', cliente_id: '', descripcion: '', estado: 'pendiente',
  fecha_inicio: '', fecha_fin_prevista: '', direccion_obra: '',
  presupuesto_total: '', coste_real: '', notas: ''
}

export default function Obras() {
  const { t } = useTranslation()
  const [obras, setObras] = useState([])
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(FORM_EMPTY)
  const [detalleObra, setDetalleObra] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: obs }, { data: clis }] = await Promise.all([
      supabase.from('obras').select('*, clientes(nombre)').order('created_at', { ascending: false }),
      supabase.from('clientes').select('id, nombre').order('nombre'),
    ])
    setObras(obs || [])
    setClientes(clis || [])
    setLoading(false)
  }

  function openNew() { setForm(FORM_EMPTY); setError(''); setShowForm(true) }
  function setF(f, v) { setForm(p => ({ ...p, [f]: v })) }

  async function save(e) {
    e.preventDefault(); setSaving(true); setError('')
    const user_id = await getUID()
    const payload = {
      ...form,
      user_id,
      cliente_id: form.cliente_id || null,
      presupuesto_total: form.presupuesto_total ? parseFloat(form.presupuesto_total) : 0,
      coste_real: form.coste_real ? parseFloat(form.coste_real) : 0,
      fecha_inicio: form.fecha_inicio || null,
      fecha_fin_prevista: form.fecha_fin_prevista || null,
    }
    const { error: err } = await supabase.from('obras').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    setShowForm(false); load()
  }

  async function remove(id, nombre, e) {
    e.stopPropagation()
    if (!confirm(t('obras.confirm.eliminarObra', { nombre }))) return
    await supabase.from('obras').delete().eq('id', id)
    load()
  }

  function handleUpdate(obraActualizada) {
    setObras(prev => prev.map(o => o.id === obraActualizada.id ? obraActualizada : o))
    setDetalleObra(obraActualizada)
  }

  const filtered = obras
    .filter(o => !filtroEstado || o.estado === filtroEstado)
    .filter(o => [o.nombre, o.clientes?.nombre, o.direccion_obra].some(v => v?.toLowerCase().includes(search.toLowerCase())))

  const resumen = {
    total: obras.length,
    en_curso: obras.filter(o => o.estado === 'en_curso').length,
    pendiente: obras.filter(o => o.estado === 'pendiente').length,
    completada: obras.filter(o => o.estado === 'completada').length,
  }

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t('obras.list.title')}</h1>
          <p className="text-sm text-ink-soft mt-0.5">
            {t(obras.length === 1 ? 'obras.list.countOne' : 'obras.list.countOther', { count: obras.length })}
          </p>
        </div>
        <button onClick={openNew} className="btn-primary">{t('obras.list.newObra')}</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { key: '', label: t('obras.list.statTotal'), value: resumen.total, color: 'text-ink' },
          { key: 'en_curso', label: t('obras.list.statEnCurso'), value: resumen.en_curso, color: 'text-gold-dark' },
          { key: 'pendiente', label: t('obras.list.statPendientes'), value: resumen.pendiente, color: 'text-ink-soft' },
          { key: 'completada', label: t('obras.list.statCompletadas'), value: resumen.completada, color: 'text-green-700' },
        ].map(s => (
          <div key={s.label} className="card text-center py-3 cursor-pointer hover:shadow-sm" onClick={() => setFiltroEstado(s.key)}>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-ink-soft mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input className="input max-w-xs" placeholder={t('obras.list.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input w-auto" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">{t('obras.list.allStates')}</option>
          {ESTADOS.map(s => <option key={s.value} value={s.value}>{estadoLabel(t, s.value)}</option>)}
        </select>
      </div>

      {/* Listado */}
      {loading ? (
        <div className="text-ink-soft text-sm py-10 text-center">{t('obras.list.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-3">🔨</div>
          <div className="font-bold text-ink mb-1">{search || filtroEstado ? t('obras.list.noResultsTitle') : t('obras.list.noObrasTitle')}</div>
          <div className="text-sm text-ink-soft mb-5">
            {search || filtroEstado ? t('obras.list.noResultsHint') : t('obras.list.noObrasHint')}
          </div>
          {!search && !filtroEstado && <button onClick={openNew} className="btn-primary">{t('obras.list.newObra')}</button>}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(o => {
            const margen = o.presupuesto_total > 0
              ? ((o.presupuesto_total - o.coste_real) / o.presupuesto_total * 100).toFixed(0)
              : null
            const etapaIdx = ETAPAS.indexOf(o.etapa || 'Planificación')
            const pct = etapaIdx < 0 ? 0 : Math.round((etapaIdx / (ETAPAS.length - 1)) * 100)
            const nFotos = (o.fotos || []).length
            const nNotas = (o.seguimiento || []).filter(s => s.tipo === 'nota').length

            return (
              <div key={o.id} onClick={() => setDetalleObra(o)}
                className="card hover:shadow-md transition-all cursor-pointer hover:border-gold/30 border border-transparent">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-bold text-ink text-base">{o.nombre}</span>
                      <EstadoBadge estado={o.estado} />
                      {nFotos > 0 && <span className="text-xs text-ink-soft/60">📷 {nFotos}</span>}
                      {nNotas > 0 && <span className="text-xs text-ink-soft/60">📋 {nNotas}</span>}
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-1 mt-1.5 text-sm text-ink-soft">
                      {o.clientes?.nombre && <span>👤 {o.clientes.nombre}</span>}
                      {o.direccion_obra && <span>📍 {o.direccion_obra}</span>}
                      {o.fecha_fin_prevista && <span>🏁 {new Date(o.fecha_fin_prevista).toLocaleDateString('es-ES')}</span>}
                    </div>
                    {/* Mini barra de progreso */}
                    <div className="mt-2.5 flex items-center gap-2">
                      <div className="flex-1 h-1 bg-edge rounded-full overflow-hidden">
                        <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-ink-soft flex-shrink-0">{etapaLabel(t, o.etapa || 'Planificación')}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {o.presupuesto_total > 0 && (
                      <div className="text-sm font-bold text-ink">
                        {o.presupuesto_total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                      </div>
                    )}
                    {margen !== null && (
                      <div className={`text-xs font-semibold ${parseFloat(margen) >= 30 ? 'text-green-600' : 'text-orange-600'}`}>
                        {t('obras.list.margen', { pct: margen })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-4 mt-3 pt-3 border-t border-edge" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setDetalleObra(o)} className="text-gold hover:text-gold-dark text-xs font-semibold">{t('obras.list.verDetalle')}</button>
                  <button onClick={e => remove(o.id, o.nombre, e)} className="text-ink-soft/40 hover:text-red-500 text-xs transition-colors">{t('obras.list.eliminar')}</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal nueva obra */}
      {showForm && (
        <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-edge flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-bold text-ink">{t('obras.form.newTitle')}</h2>
              <button onClick={() => setShowForm(false)} className="text-ink-soft hover:text-ink text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
            </div>
            <form onSubmit={save} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="label">{t('obras.form.nameLabel')}</label>
                <input className="input" value={form.nombre} onChange={e => setF('nombre', e.target.value)} required autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('obras.form.clientLabel')}</label>
                  <select className="input" value={form.cliente_id} onChange={e => setF('cliente_id', e.target.value)}>
                    <option value="">{t('obras.form.noClient')}</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{t('obras.form.stateLabel')}</label>
                  <select className="input" value={form.estado} onChange={e => setF('estado', e.target.value)}>
                    {ESTADOS.map(s => <option key={s.value} value={s.value}>{estadoLabel(t, s.value)}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">{t('obras.form.addressLabelObra')}</label>
                <input className="input" value={form.direccion_obra} onChange={e => setF('direccion_obra', e.target.value)} />
              </div>
              <div>
                <label className="label">{t('obras.form.descriptionLabel')}</label>
                <textarea className="input resize-none h-16" value={form.descripcion} onChange={e => setF('descripcion', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('obras.form.startDateLabel')}</label>
                  <input className="input" type="date" value={form.fecha_inicio} onChange={e => setF('fecha_inicio', e.target.value)} />
                </div>
                <div>
                  <label className="label">{t('obras.form.endDateLabel')}</label>
                  <input className="input" type="date" value={form.fecha_fin_prevista} onChange={e => setF('fecha_fin_prevista', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('obras.form.budgetLabel')}</label>
                  <input className="input" type="number" min="0" step="0.01" value={form.presupuesto_total} onChange={e => setF('presupuesto_total', e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <label className="label">{t('obras.form.actualCostLabel')}</label>
                  <input className="input" type="number" min="0" step="0.01" value={form.coste_real} onChange={e => setF('coste_real', e.target.value)} placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className="label">{t('obras.form.internalNotesLabel')}</label>
                <textarea className="input resize-none h-16" value={form.notas} onChange={e => setF('notas', e.target.value)} />
              </div>
              {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">{t('obras.form.cancel')}</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? t('obras.form.saving') : t('obras.form.create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Panel de detalle */}
      {detalleObra && (
        <ObraDetalle
          obra={detalleObra}
          clientes={clientes}
          onClose={() => setDetalleObra(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  )
}
