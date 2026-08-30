import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase, getUID } from '../../lib/supabase'

const FORM_EMPTY = { nombre: '', nif: '', telefono: '', email: '', direccion: '', cp: '', ciudad: '', notas: '' }

export default function Clientes() {
  const { t } = useTranslation()
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(FORM_EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [invitando, setInvitando] = useState({})
  const [inviteMsg, setInviteMsg] = useState({})

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
    if (!confirm(t('clientes.confirmDelete', { nombre }))) return
    await supabase.from('clientes').delete().eq('id', id)
    load()
  }

  // Invita (o reenvía el acceso a) el Portal del Cliente para que pueda ver
  // el estado de su(s) obra(s) online.
  async function invitarPortal(c) {
    if (!c.email) {
      setInviteMsg(p => ({ ...p, [c.id]: { ok: false, text: 'Añade un email a este cliente antes de invitarlo.' } }))
      return
    }
    setInvitando(p => ({ ...p, [c.id]: true }))
    setInviteMsg(p => ({ ...p, [c.id]: null }))
    const { data, error: err } = await supabase.functions.invoke('clientes-invitar-portal', { body: { cliente_id: c.id } })
    setInvitando(p => ({ ...p, [c.id]: false }))
    if (err || data?.error) {
      setInviteMsg(p => ({ ...p, [c.id]: { ok: false, text: data?.error || err.message } }))
      return
    }
    setInviteMsg(p => ({ ...p, [c.id]: { ok: true, text: `Invitación enviada a ${data.email}` } }))
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
          <h1 className="text-2xl font-bold text-ink">{t('clientes.title')}</h1>
          <p className="text-sm text-ink-soft mt-0.5">
            {t(clientes.length === 1 ? 'clientes.countOne' : 'clientes.countOther', { count: clientes.length })}
          </p>
        </div>
        <button onClick={openNew} className="btn-primary">{t('clientes.newCliente')}</button>
      </div>

      {/* Buscador */}
      <div className="mb-5">
        <input className="input max-w-sm" placeholder={t('clientes.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="text-ink-soft text-sm py-10 text-center">{t('clientes.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-3">👤</div>
          <div className="font-bold text-ink mb-1">{search ? t('clientes.noResultsTitle') : t('clientes.noClientesTitle')}</div>
          <div className="text-sm text-ink-soft mb-5">{search ? t('clientes.noResultsHint') : t('clientes.noClientesHint')}</div>
          {!search && <button onClick={openNew} className="btn-primary">{t('clientes.addFirst')}</button>}
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-edge text-ink-soft text-xs uppercase tracking-wide">
                <th className="text-left px-5 py-3">{t('clientes.table.nombreNif')}</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">{t('clientes.table.telefono')}</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">{t('clientes.table.email')}</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">{t('clientes.table.ciudad')}</th>
                <th className="text-left px-4 py-3">Portal</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-page/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-ink">{c.nombre}</div>
                    {c.nif && <div className="text-xs text-ink-soft mt-0.5">{c.nif}</div>}
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell text-ink-soft">{c.telefono || '—'}</td>
                  <td className="px-4 py-3.5 hidden lg:table-cell text-ink-soft">{c.email || '—'}</td>
                  <td className="px-4 py-3.5 hidden lg:table-cell text-ink-soft">{c.ciudad || '—'}</td>
                  <td className="px-4 py-3.5">
                    {c.portal_user_id ? (
                      <div>
                        <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded-full">✓ Portal activo</span>
                        <button onClick={() => invitarPortal(c)} disabled={invitando[c.id]}
                          className="block mt-1 text-xs text-ink-soft hover:text-gold underline">
                          {invitando[c.id] ? 'Enviando…' : 'Reenviar acceso'}
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => invitarPortal(c)} disabled={invitando[c.id]}
                        className="text-xs font-semibold text-gold hover:text-gold-dark px-2 py-1 rounded-lg border border-gold/30 hover:bg-gold/10 transition-colors whitespace-nowrap">
                        {invitando[c.id] ? 'Enviando…' : 'Invitar al portal'}
                      </button>
                    )}
                    {inviteMsg[c.id] && (
                      <div className={`text-[11px] mt-1 max-w-[160px] ${inviteMsg[c.id].ok ? 'text-green-700' : 'text-red-600'}`}>
                        {inviteMsg[c.id].text}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    <button onClick={() => openEdit(c)} className="text-gold hover:text-gold-dark text-xs font-semibold mr-4">{t('clientes.editar')}</button>
                    <button onClick={() => remove(c.id, c.nombre)} className="text-ink-soft/50 hover:text-red-500 text-xs transition-colors">{t('clientes.eliminar')}</button>
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
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-edge flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-bold text-ink">{editId ? t('clientes.form.editTitle') : t('clientes.form.newTitle')}</h2>
              <button onClick={() => setShowForm(false)} className="text-ink-soft hover:text-ink text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
            </div>
            <form onSubmit={save} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="label">{t('clientes.form.nombreLabel')}</label>
                <input className="input" value={form.nombre} onChange={e => set('nombre', e.target.value)} required autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('clientes.form.nifLabel')}</label>
                  <input className="input" value={form.nif} onChange={e => set('nif', e.target.value)} />
                </div>
                <div>
                  <label className="label">{t('clientes.form.telefonoLabel')}</label>
                  <input className="input" type="tel" value={form.telefono} onChange={e => set('telefono', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">{t('clientes.form.emailLabel')}</label>
                <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
              <div>
                <label className="label">{t('clientes.form.direccionLabel')}</label>
                <input className="input" value={form.direccion} onChange={e => set('direccion', e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">{t('clientes.form.cpLabel')}</label>
                  <input className="input" value={form.cp} onChange={e => set('cp', e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="label">{t('clientes.form.ciudadLabel')}</label>
                  <input className="input" value={form.ciudad} onChange={e => set('ciudad', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">{t('clientes.form.notasLabel')}</label>
                <textarea className="input resize-none h-20" value={form.notas} onChange={e => set('notas', e.target.value)} />
              </div>
              {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">{t('clientes.form.cancel')}</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? t('clientes.form.saving') : t('clientes.form.save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
