import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase, getUID } from '../../lib/supabase'

const CATEGORIAS_ORDER = [
  'Demolición', 'Albañilería', 'Impermeabilización', 'Alicatados y Solados',
  'Fontanería', 'Electricidad', 'Pintura', 'Carpintería y Remates',
  'Gestión y Logística', 'Reforma Integral',
]

function precio(t) {
  // precio_cliente es columna generada en supabase, pero por si acaso calculamos también aquí
  if (t.precio_cliente != null) return parseFloat(t.precio_cliente)
  return Math.round((t.coste_material + t.coste_mo) * (1 + t.margen / 100) * 100) / 100
}

export default function Tarifas() {
  const { t } = useTranslation()
  const [tarifasBase, setTarifasBase] = useState([])
  const [tarifasUser, setTarifasUser] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('base')  // 'base' | 'mis'
  const [search, setSearch] = useState('')
  const [catFiltro, setCatFiltro] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ categoria: '', descripcion: '', unidad: 'm²', coste_material: '', coste_mo: '', margen: '38', notas: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: base }, { data: user }] = await Promise.all([
      supabase.from('tarifas_base').select('*').order('categoria').order('descripcion'),
      supabase.from('tarifas').select('*').order('categoria').order('descripcion'),
    ])
    setTarifasBase(base || [])
    setTarifasUser(user || [])
    setLoading(false)
  }

  const datos = tab === 'base' ? tarifasBase : tarifasUser

  const categorias = [...new Set(datos.map(t => t.categoria))].sort((a, b) => {
    const ia = CATEGORIAS_ORDER.indexOf(a)
    const ib = CATEGORIAS_ORDER.indexOf(b)
    if (ia === -1 && ib === -1) return a.localeCompare(b)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })

  const filtradas = datos.filter(t =>
    (!catFiltro || t.categoria === catFiltro) &&
    [t.descripcion, t.categoria, t.unidad].some(v => v?.toLowerCase().includes(search.toLowerCase()))
  )

  const porCategoria = categorias.reduce((acc, cat) => {
    acc[cat] = filtradas.filter(t => t.categoria === cat)
    return acc
  }, {})

  function openNew() {
    setEditId(null)
    setForm({ categoria: '', descripcion: '', unidad: 'm²', coste_material: '', coste_mo: '', margen: '38', notas: '' })
    setError('')
    setShowForm(true)
  }

  function openEdit(t) {
    setEditId(t.id)
    setForm({
      categoria: t.categoria || '', descripcion: t.descripcion || '',
      unidad: t.unidad || 'm²', coste_material: t.coste_material?.toString() || '',
      coste_mo: t.coste_mo?.toString() || '', margen: t.margen?.toString() || '38',
      notas: t.notas || ''
    })
    setError('')
    setShowForm(true)
  }

  function setF(f, v) { setForm(p => ({ ...p, [f]: v })) }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const user_id = await getUID()
    const payload = {
      user_id,
      categoria: form.categoria.trim(),
      descripcion: form.descripcion.trim(),
      unidad: form.unidad,
      coste_material: parseFloat(form.coste_material) || 0,
      coste_mo: parseFloat(form.coste_mo) || 0,
      margen: parseFloat(form.margen) || 38,
      notas: form.notas || null,
    }
    const { error: err } = editId
      ? await supabase.from('tarifas').update(payload).eq('id', editId)
      : await supabase.from('tarifas').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    setShowForm(false)
    load()
    setTab('mis')
  }

  async function remove(id, desc) {
    if (!confirm(t('tarifas.confirmDelete', { desc }))) return
    await supabase.from('tarifas').delete().eq('id', id)
    load()
  }

  const precioPreview = Math.round(
    ((parseFloat(form.coste_material) || 0) + (parseFloat(form.coste_mo) || 0)) *
    (1 + (parseFloat(form.margen) || 38) / 100) * 100
  ) / 100

  return (
    <div className="p-6 max-w-5xl">
      {/* Cabecera */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t('tarifas.title')}</h1>
          <p className="text-sm text-ink-soft mt-0.5">{t('tarifas.subtitle')}</p>
        </div>
        <button onClick={openNew} className="btn-primary">{t('tarifas.nuevaTarifa')}</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-edge rounded-xl p-1 w-fit mb-5">
        <button onClick={() => setTab('base')} className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${tab === 'base' ? 'bg-surface text-ink shadow-sm' : 'text-ink-soft hover:text-ink'}`}>
          {t('tarifas.tabs.catalogoBase', { count: tarifasBase.length })}
        </button>
        <button onClick={() => setTab('mis')} className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${tab === 'mis' ? 'bg-surface text-ink shadow-sm' : 'text-ink-soft hover:text-ink'}`}>
          {t('tarifas.tabs.misTarifas', { count: tarifasUser.length })}
        </button>
      </div>

      {tab === 'base' && (
        <div className="bg-gold/10 border border-gold/30 rounded-xl px-4 py-3 mb-5 text-sm text-ink-soft">
          {t('tarifas.disclaimer')}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input className="input max-w-xs" placeholder={t('tarifas.buscarPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input w-auto" value={catFiltro} onChange={e => setCatFiltro(e.target.value)}>
          <option value="">{t('tarifas.todasCategorias')}</option>
          {categorias.map(c => <option key={c} value={c}>{t(`tarifas.categoria.${c}`, c)}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-ink-soft text-sm py-10 text-center">{t('tarifas.cargando')}</div>
      ) : filtradas.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-3">{tab === 'mis' ? '💰' : '📊'}</div>
          <div className="font-bold text-ink mb-1">{search || catFiltro ? t('tarifas.sinResultados') : tab === 'mis' ? t('tarifas.sinTarifasPropias') : t('tarifas.sinTarifas')}</div>
          {tab === 'mis' && !search && !catFiltro && (
            <div className="text-sm text-ink-soft mb-5">{t('tarifas.personalizaPrecios')}</div>
          )}
          {tab === 'mis' && !search && !catFiltro && <button onClick={openNew} className="btn-primary">{t('tarifas.nuevaTarifa')}</button>}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(porCategoria).filter(([, items]) => items.length > 0).map(([cat, items]) => (
            <div key={cat}>
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-xs font-bold uppercase tracking-widest text-ink-soft">{t(`tarifas.categoria.${cat}`, cat)}</h3>
                <div className="flex-1 h-px bg-edge" />
                <span className="text-xs text-ink-soft/50">{t('tarifas.partidas', { count: items.length })}</span>
              </div>
              <div className="card p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-edge/60 text-ink-soft text-xs">
                      <th className="text-left px-4 py-2.5">{t('tarifas.tabla.descripcion')}</th>
                      <th className="text-center px-3 py-2.5 hidden sm:table-cell">{t('tarifas.tabla.ud')}</th>
                      <th className="text-right px-3 py-2.5 hidden md:table-cell">{t('tarifas.tabla.mat')}</th>
                      <th className="text-right px-3 py-2.5 hidden md:table-cell">{t('tarifas.tabla.mo')}</th>
                      <th className="text-right px-3 py-2.5 hidden md:table-cell">{t('tarifas.tabla.margen')}</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-ink">{t('tarifas.tabla.precioCliente')}</th>
                      {tab === 'mis' && <th className="px-3 py-2.5" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-edge/60">
                    {items.map(t2 => (
                      <tr key={t2.id} className="hover:bg-page/40 transition-colors">
                        <td className="px-4 py-3 text-ink">{tab === 'base' ? t(`tarifas.descripcionBase.${t2.descripcion}`, t2.descripcion) : t2.descripcion}</td>
                        <td className="px-3 py-3 text-center text-ink-soft hidden sm:table-cell">{t2.unidad}</td>
                        <td className="px-3 py-3 text-right text-ink-soft hidden md:table-cell">{parseFloat(t2.coste_material).toFixed(2)}</td>
                        <td className="px-3 py-3 text-right text-ink-soft hidden md:table-cell">{parseFloat(t2.coste_mo).toFixed(2)}</td>
                        <td className="px-3 py-3 text-right text-ink-soft hidden md:table-cell">{t2.margen}%</td>
                        <td className="px-4 py-3 text-right font-bold text-ink">
                          {precio(t2).toFixed(2)} €<span className="text-xs font-normal text-ink-soft">/{t2.unidad}</span>
                        </td>
                        {tab === 'mis' && (
                          <td className="px-3 py-3 text-right whitespace-nowrap">
                            <button onClick={() => openEdit(t2)} className="text-gold hover:text-gold-dark text-xs font-semibold mr-3">{t('tarifas.editar')}</button>
                            <button onClick={() => remove(t2.id, t2.descripcion)} className="text-ink-soft/40 hover:text-red-500 text-xs">×</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-edge flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-bold text-ink">{editId ? t('tarifas.modal.editarTarifa') : t('tarifas.modal.nuevaTarifa')}</h2>
              <button onClick={() => setShowForm(false)} className="text-ink-soft hover:text-ink text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
            </div>
            <form onSubmit={save} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('tarifas.modal.categoria')}</label>
                  <input className="input" list="cats" value={form.categoria} onChange={e => setF('categoria', e.target.value)} required />
                  <datalist id="cats">{CATEGORIAS_ORDER.map(c => <option key={c} value={c} />)}</datalist>
                </div>
                <div>
                  <label className="label">{t('tarifas.modal.unidad')}</label>
                  <input className="input" list="uds" value={form.unidad} onChange={e => setF('unidad', e.target.value)} />
                  <datalist id="uds">
                    {['m²', 'ml', 'ud', 'h', 'kg', '%'].map(u => <option key={u} value={u} />)}
                  </datalist>
                </div>
              </div>
              <div>
                <label className="label">{t('tarifas.modal.descripcion')}</label>
                <input className="input" value={form.descripcion} onChange={e => setF('descripcion', e.target.value)} required autoFocus />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">{t('tarifas.modal.costeMaterial')}</label>
                  <input className="input" type="number" min="0" step="0.01" value={form.coste_material} onChange={e => setF('coste_material', e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label className="label">{t('tarifas.modal.manoDeObra')}</label>
                  <input className="input" type="number" min="0" step="0.01" value={form.coste_mo} onChange={e => setF('coste_mo', e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label className="label">{t('tarifas.modal.margen')}</label>
                  <input className="input" type="number" min="0" max="200" step="0.5" value={form.margen} onChange={e => setF('margen', e.target.value)} />
                </div>
              </div>
              {/* Preview precio */}
              <div className="bg-navy rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-white/60 text-sm">{t('tarifas.modal.precioAlCliente')}</span>
                <span className="text-gold font-bold text-xl">{precioPreview.toFixed(2)} € / {form.unidad || 'ud'}</span>
              </div>
              <div>
                <label className="label">{t('tarifas.modal.notas')}</label>
                <textarea className="input resize-none h-16 text-sm" value={form.notas} onChange={e => setF('notas', e.target.value)} />
              </div>
              {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">{t('tarifas.modal.cancelar')}</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? t('tarifas.modal.guardando') : t('tarifas.modal.guardarTarifa')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
