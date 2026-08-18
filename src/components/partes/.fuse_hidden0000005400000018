import { useState, useEffect } from 'react'
import { supabase, getUID } from '../../lib/supabase'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function fmt2(n) { return Number(n||0).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2}) }

const FORM_EMPTY = {
  empleado_id:'', obra_id:'', fecha: new Date().toISOString().split('T')[0],
  horas:'8', descripcion:''
}

export default function PartesTrabajo() {
  const hoy = new Date()
  const [partes,    setPartes]    = useState([])
  const [empleados, setEmpleados] = useState([])
  const [obras,     setObras]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [editId,    setEditId]    = useState(null)
  const [form,      setForm]      = useState(FORM_EMPTY)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [filtroEmp, setFiltroEmp] = useState('')
  const [filtroObra,setFiltroObra]= useState('')
  const [filtroMes, setFiltroMes] = useState(hoy.getMonth() + 1)
  const [filtroAño, setFiltroAño] = useState(hoy.getFullYear())
  const [vista,     setVista]     = useState('lista') // 'lista' | 'resumen'

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: pts }, { data: emps }, { data: obs }] = await Promise.all([
      supabase.from('partes_trabajo').select('*, empleados(nombre,apellidos), obras(nombre)').order('fecha', { ascending: false }),
      supabase.from('empleados').select('id,nombre,apellidos').eq('estado','activo').order('apellidos'),
      supabase.from('obras').select('id,nombre').order('nombre'),
    ])
    setPartes(pts || [])
    setEmpleados(emps || [])
    setObras(obs || [])
    setLoading(false)
  }

  function setF(k,v) { setForm(p=>({...p,[k]:v})) }

  function openNew() { setEditId(null); setForm(FORM_EMPTY); setError(''); setShowForm(true) }
  function openEdit(p) {
    setEditId(p.id)
    setForm({ empleado_id: p.empleado_id, obra_id: p.obra_id||'', fecha: p.fecha,
              horas: p.horas, descripcion: p.descripcion||'' })
    setError(''); setShowForm(true)
  }

  async function save(e) {
    e.preventDefault(); setSaving(true); setError('')
    const uid = await getUID()
    const payload = { ...form, user_id: uid, horas: parseFloat(form.horas)||0,
                      obra_id: form.obra_id || null, descripcion: form.descripcion || null }
    const { error: err } = editId
      ? await supabase.from('partes_trabajo').update(payload).eq('id', editId)
      : await supabase.from('partes_trabajo').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    setShowForm(false); load()
  }

  async function remove(id) {
    if (!confirm('¿Eliminar este parte?')) return
    await supabase.from('partes_trabajo').delete().eq('id', id); load()
  }

  // Filtrado
  const filtrados = partes.filter(p => {
    const d = new Date(p.fecha + 'T12:00:00')
    const mesOk = d.getMonth()+1 === filtroMes && d.getFullYear() === filtroAño
    const empOk = !filtroEmp || p.empleado_id === filtroEmp
    const obraOk = !filtroObra || p.obra_id === filtroObra
    return mesOk && empOk && obraOk
  })

  // Resumen por empleado del mes
  const resumenEmp = empleados.map(emp => {
    const ps = filtrados.filter(p => p.empleado_id === emp.id)
    const horas = ps.reduce((s,p) => s + parseFloat(p.horas||0), 0)
    return { ...emp, horas, dias: ps.length }
  }).filter(e => e.horas > 0)

  // Resumen por obra del mes
  const resumenObra = obras.map(o => {
    const ps = filtrados.filter(p => p.obra_id === o.id)
    const horas = ps.reduce((s,p) => s + parseFloat(p.horas||0), 0)
    return { ...o, horas, personas: new Set(ps.map(p=>p.empleado_id)).size }
  }).filter(o => o.horas > 0)

  const totalHoras = filtrados.reduce((s,p) => s + parseFloat(p.horas||0), 0)

  const empNombre = (id) => { const e = empleados.find(e=>e.id===id); return e ? `${e.nombre} ${e.apellidos}` : '—' }
  const obraNombre = (id) => obras.find(o=>o.id===id)?.nombre || '—'

  const años = Array.from({length:5},(_,i)=>hoy.getFullYear()-i)

  return (
    <div className="p-6 max-w-5xl">
      {/* Cabecera */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy">Partes de trabajo</h1>
          <p className="text-sm text-stone mt-0.5">Registro diario de horas por empleado y obra</p>
        </div>
        <button onClick={openNew} className="btn-primary">+ Nuevo parte</button>
      </div>

      {/* Filtros */}
      <div className="card mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="label">Mes</label>
            <select className="input w-36" value={filtroMes} onChange={e=>setFiltroMes(Number(e.target.value))}>
              {MESES.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Año</label>
            <select className="input w-24" value={filtroAño} onChange={e=>setFiltroAño(Number(e.target.value))}>
              {años.map(y=><option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Empleado</label>
            <select className="input w-48" value={filtroEmp} onChange={e=>setFiltroEmp(e.target.value)}>
              <option value="">Todos</option>
              {empleados.map(e=><option key={e.id} value={e.id}>{e.nombre} {e.apellidos}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Obra</label>
            <select className="input w-48" value={filtroObra} onChange={e=>setFiltroObra(e.target.value)}>
              <option value="">Todas</option>
              {obras.map(o=><option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>
          </div>
          <div className="ml-auto flex gap-1 bg-arena-dark rounded-xl p-1 self-end">
            <button onClick={()=>setVista('lista')} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${vista==='lista'?'bg-white text-navy shadow-sm':'text-stone hover:text-navy'}`}>Lista</button>
            <button onClick={()=>setVista('resumen')} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${vista==='resumen'?'bg-white text-navy shadow-sm':'text-stone hover:text-navy'}`}>Resumen</button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card text-center py-3">
          <div className="text-2xl font-black text-navy">{filtrados.length}</div>
          <div className="text-xs text-stone">Partes en {MESES[filtroMes-1]}</div>
        </div>
        <div className="card text-center py-3">
          <div className="text-2xl font-black text-navy">{fmt2(totalHoras)}</div>
          <div className="text-xs text-stone">Horas registradas</div>
        </div>
        <div className="card bg-navy text-center py-3">
          <div className="text-2xl font-black text-gold">{resumenEmp.length}</div>
          <div className="text-xs text-white/70">Empleados activos en el mes</div>
        </div>
      </div>

      {loading ? (
        <div className="text-stone text-sm py-10 text-center">Cargando partes…</div>
      ) : vista === 'lista' ? (
        /* ── Vista lista ── */
        filtrados.length === 0 ? (
          <div className="card text-center py-14">
            <div className="text-5xl mb-3">📋</div>
            <div className="font-bold text-navy mb-1">Sin partes en {MESES[filtroMes-1]} {filtroAño}</div>
            <div className="text-sm text-stone mb-5">Empieza a registrar las horas del equipo</div>
            <button onClick={openNew} className="btn-primary">+ Nuevo parte</button>
          </div>
        ) : (
          <div className="space-y-2">
            {filtrados.map(p => (
              <div key={p.id} className="card py-3 flex items-center gap-4">
                <div className="text-center flex-shrink-0 w-12">
                  <div className="text-sm font-black text-navy">{new Date(p.fecha+'T12:00:00').getDate()}</div>
                  <div className="text-xs text-stone">{MESES[new Date(p.fecha+'T12:00:00').getMonth()].slice(0,3)}</div>
                </div>
                <div className="w-px h-10 bg-arena-dark flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-navy">{p.empleados ? `${p.empleados.nombre} ${p.empleados.apellidos}` : empNombre(p.empleado_id)}</div>
                  <div className="text-xs text-stone flex gap-3 mt-0.5">
                    {p.obras && <span>🔨 {p.obras.nombre}</span>}
                    {p.descripcion && <span>· {p.descripcion}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xl font-black text-navy">{fmt2(p.horas)}<span className="text-xs font-normal text-stone ml-1">h</span></div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={()=>openEdit(p)} className="text-gold hover:text-gold-dark text-xs font-semibold">Editar</button>
                  <button onClick={()=>remove(p.id)} className="text-stone/30 hover:text-red-500 text-lg leading-none">×</button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* ── Vista resumen ── */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Por empleado */}
          <div>
            <h3 className="text-sm font-bold text-stone uppercase tracking-widest mb-3">Por empleado</h3>
            {resumenEmp.length === 0
              ? <div className="card text-center py-8 text-stone text-sm">Sin datos</div>
              : <div className="space-y-2">
                  {resumenEmp.sort((a,b)=>b.horas-a.horas).map(e=>(
                    <div key={e.id} className="card py-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-navy/10 flex items-center justify-center text-sm flex-shrink-0">👷</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-navy text-sm">{e.nombre} {e.apellidos}</div>
                        <div className="text-xs text-stone">{e.dias} día{e.dias!==1?'s':''}</div>
                      </div>
                      <div className="font-black text-navy">{fmt2(e.horas)}<span className="text-xs font-normal text-stone ml-1">h</span></div>
                    </div>
                  ))}
                  <div className="card bg-navy py-3 flex justify-between items-center">
                    <span className="text-white font-bold text-sm">TOTAL</span>
                    <span className="font-black text-gold">{fmt2(totalHoras)} h</span>
                  </div>
                </div>
            }
          </div>
          {/* Por obra */}
          <div>
            <h3 className="text-sm font-bold text-stone uppercase tracking-widest mb-3">Por obra</h3>
            {resumenObra.length === 0
              ? <div className="card text-center py-8 text-stone text-sm">Sin obras con partes</div>
              : <div className="space-y-2">
                  {resumenObra.sort((a,b)=>b.horas-a.horas).map(o=>(
                    <div key={o.id} className="card py-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-navy/10 flex items-center justify-center text-sm flex-shrink-0">🔨</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-navy text-sm truncate">{o.nombre}</div>
                        <div className="text-xs text-stone">{o.personas} persona{o.personas!==1?'s':''}</div>
                      </div>
                      <div className="font-black text-navy">{fmt2(o.horas)}<span className="text-xs font-normal text-stone ml-1">h</span></div>
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
            <div className="px-6 py-4 border-b border-arena-dark flex items-center justify-between">
              <h2 className="text-lg font-bold text-navy">{editId ? 'Editar parte' : 'Nuevo parte de trabajo'}</h2>
              <button onClick={()=>setShowForm(false)} className="text-stone hover:text-navy text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
            </div>
            <form onSubmit={save} className="p-6 space-y-4">
              <div>
                <label className="label">Empleado *</label>
                <select className="input" value={form.empleado_id} onChange={e=>setF('empleado_id',e.target.value)} required>
                  <option value="">Seleccionar empleado</option>
                  {empleados.map(e=><option key={e.id} value={e.id}>{e.nombre} {e.apellidos}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Fecha *</label>
                  <input className="input" type="date" value={form.fecha} onChange={e=>setF('fecha',e.target.value)} required />
                </div>
                <div>
                  <label className="label">Horas *</label>
                  <input className="input" type="number" min="0.5" max="24" step="0.5" value={form.horas} onChange={e=>setF('horas',e.target.value)} required />
                </div>
              </div>
              <div>
                <label className="label">Obra</label>
                <select className="input" value={form.obra_id} onChange={e=>setF('obra_id',e.target.value)}>
                  <option value="">Sin obra asignada</option>
                  {obras.map(o=><option key={o.id} value={o.id}>{o.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Descripción del trabajo</label>
                <input className="input" value={form.descripcion} onChange={e=>setF('descripcion',e.target.value)} placeholder="Alicatado baño, instalación eléctrica…" />
              </div>
              {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={()=>setShowForm(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving?'Guardando…':'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
