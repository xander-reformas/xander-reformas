import { useState, useEffect } from 'react'
import { supabase, getUID } from '../../lib/supabase'

const FORM_EMPTY = { nombre: '', nif: '', telefono: '', email: '', direccion: '', cp: '', ciudad: '', notas: '' }

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(FORM_EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('clientes').select('*').order('nombre')
    setClientes(data || [])
    setLoading(false)
  }

  function openNew() {
    setEditId(null)
    setForm(FORM_EMPTY)
    setError('')
    setShowForm(true)
  }

  function openEdit(c) {
    setEditId(c.id)
    setForm({ nombre: c.nombre || '', nif: c.nif || '', telefono: c.telefono || '', email: c.email || '', direccion: c.direccion || '', cp: c.cp || '', ciudad: c.ciudad || '', notas: c.notas || '' })
    setError('')
    setShowForm(true)
  }

  function set(field, val) { setForm(p => ({ ...p, [field]: val })) }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const user_id = await getUID()
    const payload = { ...form, user_id }
    const { error: err } = editId
      ? await supabase.from('clientes').update(payload).eq('id', editId)
      : await supabase.from('clientes').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    setShowForm(false)
    load()
  }

  async function remove(id, nombre) {
    if (!confirm(`¿Eliminar a "${nombre}"? Esta acción no se puede deshacer.`)) return
    await supabase.from('clientes').delete().eq('id', id)
    load()
  }

  const filtered = clientes.filter(c =>
    [c.nombre, c.email, c.ciudad, c.telefono].some(v => v?.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="p-6 max-w-5xl">
      {/* Cabecera */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy">Clientes</h1>
          <p className="text-sm text-stone mt-0.5">{clientes.length} cliente{clientes.length !== 1 ? 's' : ''} en total</p>
        </div>
        <button onClick={openNew} className="btn-primary">+ Nuevo cliente</button>
      </div>

      {/* Buscador */}
      <div className="mb-5">
        <input className="input max-w-sm" placeholder="🔍  Buscar por nombre, email, ciudad…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="text-stone text-sm py-10 text-center">Cargando clientes…</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-3">👤</div>
          <div className="font-bold text-navy mb-1">{search ? 'Sin resultados' : 'Aún no tienes clientes'}</div>
          <div className="text-sm text-stone mb-5">{search ? 'Prueba otra búsqueda' : 'Añade tu primer cliente para empezar a gestionar obras y presupuestos'}</div>
          {!search && <button onClick={openNew} className="btn-primary">+ Añadir cliente</button>}
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-arena-dark text-stone text-xs uppercase tracking-wide">
                <th className="text-left px-5 py-3">Nombre / NIF</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Teléfono</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Email</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Ciudad</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-arena-dark">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-arena/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-navy">{c.nombre}</div>
                    {c.nif && <div className="text-xs text-stone mt-0.5">{c.nif}</div>}
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell text-stone">{c.telefono || '—'}</td>
                  <td className="px-4 py-3.5 hidden lg:table-cell text-stone">{c.email || '—'}</td>
                  <td className="px-4 py-3.5 hidden lg:table-cell text-stone">{c.ciudad || '—'}</td>
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    <button onClick={() => openEdit(c)} className="text-gold hover:text-gold-dark text-xs font-semibold mr-4">Editar</button>
                    <button onClick={() => remove(c.id, c.nombre)} className="text-stone/50 hover:text-red-500 text-xs transition-colors">Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-arena-dark flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-bold text-navy">{editId ? 'Editar cliente' : 'Nuevo cliente'}</h2>
              <button onClick={() => setShowForm(false)} className="text-stone hover:text-navy text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
            </div>
            <form onSubmit={save} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="label">Nombre *</label>
                <input className="input" value={form.nombre} onChange={e => set('nombre', e.target.value)} required autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">NIF / CIF</label>
                  <input className="input" value={form.nif} onChange={e => set('nif', e.target.value)} />
                </div>
                <div>
                  <label className="label">Teléfono</label>
                  <input className="input" type="tel" value={form.telefono} onChange={e => set('telefono', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
              <div>
                <label className="label">Dirección</label>
                <input className="input" value={form.direccion} onChange={e => set('direccion', e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">CP</label>
                  <input className="input" value={form.cp} onChange={e => set('cp', e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="label">Ciudad</label>
                  <input className="input" value={form.ciudad} onChange={e => set('ciudad', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Notas internas</label>
                <textarea className="input resize-none h-20" value={form.notas} onChange={e => set('notas', e.target.value)} />
              </div>
              {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Guardando…' : 'Guardar cliente'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
