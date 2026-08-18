import { useState, useEffect, useRef } from 'react'
import { supabase, getUID } from '../../lib/supabase'

const ESTADOS = [
  { value: 'pendiente',   label: 'Pendiente',   color: 'bg-stone/20 text-ink-soft' },
  { value: 'en_curso',    label: 'En curso',    color: 'bg-gold/20 text-gold-dark' },
  { value: 'pausada',     label: 'Pausada',     color: 'bg-orange-100 text-orange-700' },
  { value: 'completada',  label: 'Completada',  color: 'bg-green-100 text-green-700' },
  { value: 'cancelada',   label: 'Cancelada',   color: 'bg-red-100 text-red-600' },
]

const ETAPAS = [
  'Planificación', 'Inicio de obra', 'Demolición', 'Albañilería',
  'Instalaciones', 'Revestimientos', 'Carpintería', 'Pintura', 'Acabados', 'Entrega'
]

const BUCKET = 'obras-fotos'

function EstadoBadge({ estado }) {
  const e = ESTADOS.find(s => s.value === estado) || ESTADOS[0]
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${e.color}`}>{e.label}</span>
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
  const [obra, setObra] = useState(obraInicial)
  const [tab, setTab] = useState('seguimiento')
  const [saving, setSaving] = useState(false)
  const [cacheError, setCacheError] = useState(false)

  // Seguimiento
  const [nota, setNota] = useState('')
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
    if (!confirm(`¿Eliminar "${plano.nombre}"?`)) return
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
    if (!confirm('¿Quitar este empleado de la obra?')) return
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

  async function cambiarEtapa(val) {
    const entrada = { id: crypto.randomUUID(), fecha: new Date().toISOString().split('T')[0], nota: `Etapa avanzada a: ${val}`, tipo: 'etapa' }
    const nuevoSeguimiento = [...(obra.seguimiento || []), entrada]
    await patchRpc({ nueva_etapa: val, nuevo_seguimiento: nuevoSeguimiento })
  }

  async function agregarNota(e) {
    e.preventDefault()
    if (!nota.trim()) return
    setAddingNota(true)
    const entrada = { id: crypto.randomUUID(), fecha: new Date().toISOString().split('T')[0], nota: nota.trim(), tipo: 'nota' }
    const nuevoSeguimiento = [...(obra.seguimiento || []), entrada]
    await patchRpc({ nuevo_seguimiento: nuevoSeguimiento })
    setNota('')
    setAddingNota(false)
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
    if (!confirm('¿Eliminar esta foto?')) return
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
              {ESTADOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            {obra.presupuesto_total > 0 && (
              <span className="text-xs text-white/60">
                💰 {obra.presupuesto_total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
              </span>
            )}
            {margen !== null && (
              <span className={`text-xs font-bold ${parseFloat(margen) >= 30 ? 'text-green-300' : 'text-orange-300'}`}>
                Margen {margen}%
              </span>
            )}
            {obra.fecha_inicio && <span className="text-xs text-white/50">📅 {new Date(obra.fecha_inicio).toLocaleDateString('es-ES')}</span>}
            {obra.fecha_fin_prevista && <span className="text-xs text-white/50">🏁 {new Date(obra.fecha_fin_prevista).toLocaleDateString('es-ES')}</span>}
          </div>

          {/* Barra de etapa */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-white/50 font-semibold uppercase tracking-wide">Etapa actual</span>
              <span className="text-xs font-bold text-gold">{obra.etapa || 'Planificación'}</span>
            </div>
            <div className="flex gap-1">
              {ETAPAS.map((e, i) => {
                const actual = ETAPAS.indexOf(obra.etapa || 'Planificación')
                const done = i <= actual
                return (
                  <button key={e} onClick={() => cambiarEtapa(e)} title={e}
                    className={`h-1.5 flex-1 rounded-full transition-all hover:opacity-80 cursor-pointer ${done ? 'bg-gold' : 'bg-white/20'}`}
                  />
                )
              })}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-white/30">{ETAPAS[0]}</span>
              <span className="text-[9px] text-white/30">{ETAPAS[ETAPAS.length - 1]}</span>
            </div>
          </div>
        </div>

        {/* Banner error caché */}
        {cacheError && (
          <div className="bg-amber-50 border-b border-amber-200 px-5 py-3 flex items-start gap-3 flex-shrink-0">
            <span className="text-lg">⚠️</span>
            <div className="flex-1 text-xs text-amber-800">
              <strong>Acción necesaria en Supabase:</strong> El cambio de etapa/seguimiento requiere refrescar la caché. Ve a{' '}
              <strong>Supabase → SQL Editor</strong> y ejecuta:<br />
              <code className="font-mono bg-amber-100 px-1 rounded">NOTIFY pgrst, &apos;reload schema&apos;;</code>
              <button onClick={() => setCacheError(false)} className="ml-3 text-amber-600 underline">Cerrar</button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-0 border-b border-edge flex-shrink-0 bg-surface px-4">
          {[
            { id: 'seguimiento', label: '📋 Seguimiento', count: obra.seguimiento?.length },
            { id: 'fotos',       label: '📷 Fotos',       count: fotos.length },
            { id: 'planos',      label: '📐 Planos',      count: planos.length },
            { id: 'equipo',      label: '👷 Equipo',      count: equipoObra.length },
            { id: 'datos',       label: '✏️ Datos' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                tab === t.id ? 'border-gold text-ink' : 'border-transparent text-ink-soft hover:text-ink'
              }`}>
              {t.label}
              {t.count > 0 && <span className="text-xs bg-edge text-ink-soft px-1.5 py-0.5 rounded-full">{t.count}</span>}
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
              {saving && <div className="mb-3 text-xs text-ink-soft animate-pulse">Guardando…</div>}
              {/* Cambio de etapa rápido */}
              <div className="mb-5">
                <label className="label mb-2">Avanzar etapa</label>
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
                        {i < actual ? '✓ ' : ''}{e}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Añadir nota */}
              <form onSubmit={agregarNota} className="mb-6">
                <label className="label mb-2">Añadir actualización</label>
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    placeholder="Ej: Se terminó el solado del salón…"
                    value={nota}
                    onChange={e => setNota(e.target.value)}
                  />
                  <button type="submit" disabled={addingNota || !nota.trim()} className="btn-primary px-4">
                    {addingNota ? '…' : 'Añadir'}
                  </button>
                </div>
              </form>

              {/* Timeline */}
              {seguimientoOrdenado.length === 0 ? (
                <div className="text-center py-10 text-ink-soft text-sm">
                  <div className="text-3xl mb-2">📋</div>
                  Aún no hay actualizaciones. Añade la primera nota.
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
                        <span className="text-xs text-ink-soft/50 mt-1 block">
                          {new Date(entry.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
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
                <div className="font-semibold text-ink mb-1">{subiendo ? 'Subiendo fotos…' : 'Toca para añadir fotos'}</div>
                <div className="text-xs text-ink-soft">JPG, PNG, WEBP · Máx 10 MB por foto</div>
                <input ref={fileRef} type="file" multiple accept="image/*" className="hidden" onChange={subirFotos} disabled={subiendo} />
              </div>
              {errorFoto && (
                <div className="text-red-700 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
                  {errorFoto}
                  {errorFoto.includes('policy') || errorFoto.includes('Unauthorized') ? (
                    <div className="mt-2 font-semibold">
                      ⚙️ Falta política de Storage. Ejecuta en Supabase SQL Editor:<br />
                      <code className="font-mono text-ink">
                        CREATE POLICY &quot;up&quot; ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = &apos;obras-fotos&apos;);
                      </code>
                    </div>
                  ) : null}
                </div>
              )}

              {cargandoFotos ? (
                <div className="text-center py-8 text-ink-soft text-sm">Cargando fotos…</div>
              ) : fotos.length === 0 ? (
                <div className="text-center py-8 text-ink-soft text-sm">
                  <div className="text-3xl mb-2">🖼️</div>
                  Aún no hay fotos de esta obra
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
                  <strong className="text-ink">⚙️ Primera vez:</strong> Asegúrate de haber creado el bucket{' '}
                  <code className="bg-surface px-1 rounded">obras-fotos</code> en Supabase → Storage → New bucket (público).
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
                <div className="font-semibold text-ink mb-1">{subiendoPlano ? 'Subiendo planos…' : 'Añadir planos del proyecto'}</div>
                <div className="text-xs text-ink-soft">PDF, DWG, DXF, RVT, imágenes · Sin límite de archivos</div>
                <input
                  ref={planoRef}
                  type="file"
                  multiple
                  accept=".pdf,.dwg,.dxf,.rvt,.ifc,.png,.jpg,.jpeg,.tif,.tiff,.zip"
                  className="hidden"
                  onChange={subirPlanos}
                  disabled={subiendoPlano}
                />
              </div>

              {errorPlano && (
                <div className="text-red-700 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{errorPlano}</div>
              )}

              {/* Lista de planos */}
              {cargandoPlanos ? (
                <div className="text-center py-8 text-ink-soft text-sm">Cargando planos…</div>
              ) : planos.length === 0 ? (
                <div className="text-center py-10 text-ink-soft text-sm">
                  <div className="text-4xl mb-2">📂</div>
                  <div className="font-semibold text-ink mb-1">Sin planos</div>
                  <div className="text-xs">Sube el proyecto, memorias, mediciones o cualquier documento técnico</div>
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
                            ↓ Abrir
                          </a>
                        )}
                        <button
                          onClick={() => eliminarPlano(p)}
                          className="text-ink-soft/30 hover:text-red-500 text-sm opacity-0 group-hover:opacity-100 transition-opacity px-1"
                          title="Eliminar"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 bg-gold/10 border border-gold/30 rounded-xl px-4 py-3 text-xs text-ink-soft">
                <strong className="text-ink">💡 Consejo:</strong> Aquí van los documentos técnicos del proyecto — memoria, planos, mediciones, detalles constructivos. Las fotos de obra van en el tab <strong>Fotos</strong>.
              </div>
            </div>
          )}

          {/* ── EQUIPO ── */}
          {tab === 'equipo' && (
            <div className="p-5">
              {/* Asignar empleado */}
              {asignando ? (
                <form onSubmit={asignarEmpleado} className="card bg-page mb-5 space-y-3">
                  <div className="font-semibold text-ink">Asignar empleado a esta obra</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="label">Empleado *</label>
                      <select className="input" value={formEq.empleado_id} onChange={e=>setFormEq(p=>({...p,empleado_id:e.target.value}))} required>
                        <option value="">Seleccionar…</option>
                        {todosEmpleados
                          .filter(e => !equipoObra.some(eq => eq.empleado_id === e.id))
                          .map(e => (
                            <option key={e.id} value={e.id}>{e.apellidos}, {e.nombre} — {e.puesto}</option>
                          ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="label">Rol en obra</label>
                      <input className="input" placeholder="Ej: Jefe de equipo, Fontanero…" value={formEq.rol_en_obra} onChange={e=>setFormEq(p=>({...p,rol_en_obra:e.target.value}))} />
                    </div>
                    <div>
                      <label className="label">Fecha inicio</label>
                      <input className="input" type="date" value={formEq.fecha_inicio} onChange={e=>setFormEq(p=>({...p,fecha_inicio:e.target.value}))} />
                    </div>
                    <div>
                      <label className="label">Fecha fin prevista</label>
                      <input className="input" type="date" value={formEq.fecha_fin} onChange={e=>setFormEq(p=>({...p,fecha_fin:e.target.value}))} />
                    </div>
                  </div>
                  {errEq && <div className="text-red-600 text-xs">{errEq}</div>}
                  <div className="flex gap-2">
                    <button type="button" onClick={()=>setAsignando(false)} className="btn-secondary text-sm py-1.5">Cancelar</button>
                    <button type="submit" disabled={savingEq} className="btn-primary text-sm py-1.5">{savingEq?'Asignando…':'Asignar'}</button>
                  </div>
                </form>
              ) : (
                <button onClick={()=>setAsignando(true)} className="btn-gold w-full mb-5">
                  + Asignar empleado
                </button>
              )}

              {/* Lista equipo */}
              {equipoObra.length === 0 ? (
                <div className="text-center py-10 text-ink-soft text-sm">
                  <div className="text-4xl mb-2">👷</div>
                  Aún no hay empleados asignados a esta obra
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
                            {eq.fecha_inicio && <span>Desde {new Date(eq.fecha_inicio+'T12:00:00').toLocaleDateString('es-ES')}</span>}
                            {eq.fecha_fin && <span>Hasta {new Date(eq.fecha_fin+'T12:00:00').toLocaleDateString('es-ES')}</span>}
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
                  <strong>Acción necesaria:</strong> Ejecuta <code>supabase/equipo_v2.sql</code> en Supabase → SQL Editor para crear las tablas necesarias.
                </div>
              )}
            </div>
          )}

          {/* ── DATOS ── */}
          {tab === 'datos' && (
            <form onSubmit={saveForm} className="p-5 space-y-4">
              <div>
                <label className="label">Nombre de la obra *</label>
                <input className="input" value={form.nombre} onChange={e => setF('nombre', e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Cliente</label>
                  <select className="input" value={form.cliente_id} onChange={e => setF('cliente_id', e.target.value)}>
                    <option value="">Sin cliente</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Estado</label>
                  <select className="input" value={form.estado} onChange={e => setF('estado', e.target.value)}>
                    {ESTADOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Dirección</label>
                <input className="input" value={form.direccion_obra} onChange={e => setF('direccion_obra', e.target.value)} />
              </div>
              <div>
                <label className="label">Descripción</label>
                <textarea className="input resize-none h-16" value={form.descripcion} onChange={e => setF('descripcion', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Fecha inicio</label>
                  <input className="input" type="date" value={form.fecha_inicio} onChange={e => setF('fecha_inicio', e.target.value)} />
                </div>
                <div>
                  <label className="label">Fecha fin prevista</label>
                  <input className="input" type="date" value={form.fecha_fin_prevista} onChange={e => setF('fecha_fin_prevista', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Presupuesto (€)</label>
                  <input className="input" type="number" min="0" step="0.01" value={form.presupuesto_total} onChange={e => setF('presupuesto_total', e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <label className="label">Coste real (€)</label>
                  <input className="input" type="number" min="0" step="0.01" value={form.coste_real} onChange={e => setF('coste_real', e.target.value)} placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className="label">Notas internas</label>
                <textarea className="input resize-none h-16" value={form.notas} onChange={e => setF('notas', e.target.value)} />
              </div>
              {formError && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</div>}
              <button type="submit" disabled={savingForm} className="btn-primary w-full">
                {savingForm ? 'Guardando…' : 'Guardar cambios'}
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
    if (!confirm(`¿Eliminar la obra "${nombre}"?`)) return
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
          <h1 className="text-2xl font-bold text-ink">Obras</h1>
          <p className="text-sm text-ink-soft mt-0.5">{obras.length} obra{obras.length !== 1 ? 's' : ''} en total</p>
        </div>
        <button onClick={openNew} className="btn-primary">+ Nueva obra</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', value: resumen.total, color: 'text-ink' },
          { label: 'En curso', value: resumen.en_curso, color: 'text-gold-dark' },
          { label: 'Pendientes', value: resumen.pendiente, color: 'text-ink-soft' },
          { label: 'Completadas', value: resumen.completada, color: 'text-green-700' },
        ].map(s => (
          <div key={s.label} className="card text-center py-3 cursor-pointer hover:shadow-sm" onClick={() => setFiltroEstado(s.label === 'Total' ? '' : s.label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(' ', '_'))}>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-ink-soft mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input className="input max-w-xs" placeholder="🔍  Buscar obra o cliente…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input w-auto" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {ESTADOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {/* Listado */}
      {loading ? (
        <div className="text-ink-soft text-sm py-10 text-center">Cargando obras…</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-3">🔨</div>
          <div className="font-bold text-ink mb-1">{search || filtroEstado ? 'Sin resultados' : 'Aún no tienes obras'}</div>
          <div className="text-sm text-ink-soft mb-5">
            {search || filtroEstado ? 'Prueba otros filtros' : 'Crea tu primera obra para empezar a gestionar proyectos'}
          </div>
          {!search && !filtroEstado && <button onClick={openNew} className="btn-primary">+ Nueva obra</button>}
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
                      <span className="text-xs text-ink-soft flex-shrink-0">{o.etapa || 'Planificación'}</span>
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
                        Margen {margen}%
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-4 mt-3 pt-3 border-t border-edge" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setDetalleObra(o)} className="text-gold hover:text-gold-dark text-xs font-semibold">Ver detalle →</button>
                  <button onClick={e => remove(o.id, o.nombre, e)} className="text-ink-soft/40 hover:text-red-500 text-xs transition-colors">Eliminar</button>
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
              <h2 className="text-lg font-bold text-ink">Nueva obra</h2>
              <button onClick={() => setShowForm(false)} className="text-ink-soft hover:text-ink text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
            </div>
            <form onSubmit={save} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="label">Nombre de la obra *</label>
                <input className="input" value={form.nombre} onChange={e => setF('nombre', e.target.value)} required autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Cliente</label>
                  <select className="input" value={form.cliente_id} onChange={e => setF('cliente_id', e.target.value)}>
                    <option value="">Sin cliente</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Estado</label>
                  <select className="input" value={form.estado} onChange={e => setF('estado', e.target.value)}>
                    {ESTADOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Dirección de la obra</label>
                <input className="input" value={form.direccion_obra} onChange={e => setF('direccion_obra', e.target.value)} />
              </div>
              <div>
                <label className="label">Descripción</label>
                <textarea className="input resize-none h-16" value={form.descripcion} onChange={e => setF('descripcion', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Fecha inicio</label>
                  <input className="input" type="date" value={form.fecha_inicio} onChange={e => setF('fecha_inicio', e.target.value)} />
                </div>
                <div>
                  <label className="label">Fecha fin prevista</label>
                  <input className="input" type="date" value={form.fecha_fin_prevista} onChange={e => setF('fecha_fin_prevista', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Presupuesto (€)</label>
                  <input className="input" type="number" min="0" step="0.01" value={form.presupuesto_total} onChange={e => setF('presupuesto_total', e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <label className="label">Coste real (€)</label>
                  <input className="input" type="number" min="0" step="0.01" value={form.coste_real} onChange={e => setF('coste_real', e.target.value)} placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className="label">Notas internas</label>
                <textarea className="input resize-none h-16" value={form.notas} onChange={e => setF('notas', e.target.value)} />
              </div>
              {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Guardando…' : 'Crear obra'}</button>
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
