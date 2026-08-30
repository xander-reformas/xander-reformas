import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase, getUID } from '../../lib/supabase'
import FirmaModal from '../shared/FirmaModal'

const ESTADOS_META = [
  { value: 'borrador',   color: 'bg-stone/20 text-ink-soft' },
  { value: 'enviado',    color: 'bg-blue-100 text-blue-700' },
  { value: 'aceptado',   color: 'bg-green-100 text-green-700' },
  { value: 'rechazado',  color: 'bg-red-100 text-red-600' },
  { value: 'expirado',   color: 'bg-orange-100 text-orange-700' },
]

const UNIDADES = ['ud', 'm²', 'm³', 'ml', 'm', 'h', 'kg', 'l', 'pa', 'gl']

function EstadoBadge({ estado, t }) {
  const e = ESTADOS_META.find(s => s.value === estado) || ESTADOS_META[0]
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${e.color}`}>{t(`presupuestos.estado.${e.value}`)}</span>
}

function calculos(items, iva, descuento) {
  const base = items.reduce((s, i) => s + (parseFloat(i.importe) || 0), 0)
  const dto = base * (parseFloat(descuento) || 0) / 100
  const baseConDto = base - dto
  const ivaImporte = baseConDto * (parseFloat(iva) || 0) / 100
  const total = baseConDto + ivaImporte
  return { base, dto, baseConDto, ivaImporte, total }
}

const ITEM_EMPTY = { titulo: '', detalle: '', cantidad: '1', unidad: 'ud', precio_unitario: '', importe: '' }

function FormPresupuesto({ editData, clientes, obras, onSave, onCancel }) {
  const { t } = useTranslation()
  const hoy = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    numero: '', referencia: '', cliente_id: '', obra_id: '',
    fecha: hoy, validez_dias: '30', estado: 'borrador',
    iva: '10', descuento: '0', notas: '',
    no_incluido: '', condiciones: ''
  })
  const [items, setItems] = useState([{ ...ITEM_EMPTY }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (editData) {
      setForm({
        numero: editData.numero || '', referencia: editData.referencia || '',
        cliente_id: editData.cliente_id || '', obra_id: editData.obra_id || '',
        fecha: editData.fecha || hoy, validez_dias: editData.validez_dias?.toString() || '30',
        estado: editData.estado || 'borrador', iva: editData.iva?.toString() || '10',
        descuento: editData.descuento?.toString() || '0', notas: editData.notas || '',
        no_incluido: Array.isArray(editData.no_incluido) ? editData.no_incluido.join('\n') : '',
        condiciones: Array.isArray(editData.condiciones) ? editData.condiciones.join('\n') : '',
      })
      setItems(editData.items?.length ? editData.items : [{ ...ITEM_EMPTY }])
    }
  }, [editData])

  function setF(f, v) { setForm(p => ({ ...p, [f]: v })) }

  function addItem() { setItems(p => [...p, { ...ITEM_EMPTY }]) }
  function removeItem(i) { setItems(p => p.filter((_, idx) => idx !== i)) }
  function setItem(i, f, v) {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item
      const updated = { ...item, [f]: v }
      // Auto-calcular importe al cambiar cantidad o precio_unitario
      if (f === 'cantidad' || f === 'precio_unitario') {
        const cant = parseFloat(f === 'cantidad' ? v : item.cantidad) || 0
        const precio = parseFloat(f === 'precio_unitario' ? v : item.precio_unitario) || 0
        if (cant > 0 && precio > 0) updated.importe = (cant * precio).toFixed(2)
      }
      return updated
    }))
  }

  const { base, dto, baseConDto, ivaImporte, total } = calculos(items, form.iva, form.descuento)
  const obrasFiltradas = obras.filter(o => !form.cliente_id || o.cliente_id === form.cliente_id)

  async function save(e) {
    e.preventDefault()
    if (!form.numero.trim()) { setError(t('presupuestos.form.numeroRequerido')); return }
    setSaving(true); setError('')
    const user_id = await getUID()
    const payload = {
      user_id,
      numero: form.numero.trim(),
      referencia: form.referencia || null,
      cliente_id: form.cliente_id || null,
      obra_id: form.obra_id || null,
      fecha: form.fecha,
      validez_dias: parseInt(form.validez_dias) || 30,
      estado: form.estado,
      items: items.filter(i => i.titulo || i.importe),
      iva: parseFloat(form.iva) || 10,
      descuento: parseFloat(form.descuento) || 0,
      notas: form.notas || null,
      no_incluido: form.no_incluido ? form.no_incluido.split('\n').filter(Boolean) : [],
      condiciones: form.condiciones ? form.condiciones.split('\n').filter(Boolean) : [],
    }
    const { error: err } = editData
      ? await supabase.from('presupuestos').update(payload).eq('id', editData.id)
      : await supabase.from('presupuestos').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    onSave()
  }

  return (
    <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-4xl my-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-edge flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">{editData ? t('presupuestos.form.editTitle') : t('presupuestos.form.newTitle')}</h2>
          <button onClick={onCancel} className="text-ink-soft hover:text-ink text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
        </div>

        <form onSubmit={save} className="p-6 space-y-6">
          {/* Datos básicos */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="label">{t('presupuestos.form.numeroLabel')}</label>
              <input className="input" value={form.numero} onChange={e => setF('numero', e.target.value)} placeholder="PRE-2026-001" required />
            </div>
            <div>
              <label className="label">{t('presupuestos.form.referenciaLabel')}</label>
              <input className="input" value={form.referencia} onChange={e => setF('referencia', e.target.value)} />
            </div>
            <div>
              <label className="label">{t('presupuestos.form.fechaLabel')}</label>
              <input className="input" type="date" value={form.fecha} onChange={e => setF('fecha', e.target.value)} />
            </div>
            <div>
              <label className="label">{t('presupuestos.form.validezLabel')}</label>
              <input className="input" type="number" min="1" value={form.validez_dias} onChange={e => setF('validez_dias', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="label">{t('presupuestos.form.clienteLabel')}</label>
              <select className="input" value={form.cliente_id} onChange={e => { setF('cliente_id', e.target.value); setF('obra_id', '') }}>
                <option value="">{t('presupuestos.form.sinCliente')}</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t('presupuestos.form.obraLabel')}</label>
              <select className="input" value={form.obra_id} onChange={e => setF('obra_id', e.target.value)}>
                <option value="">{t('presupuestos.form.sinObra')}</option>
                {obrasFiltradas.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t('presupuestos.form.estadoLabel')}</label>
              <select className="input" value={form.estado} onChange={e => setF('estado', e.target.value)}>
                {ESTADOS_META.map(s => <option key={s.value} value={s.value}>{t(`presupuestos.estado.${s.value}`)}</option>)}
              </select>
            </div>
          </div>

          {/* Partidas */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-soft">{t('presupuestos.form.partidasLabel')}</label>
              <button type="button" onClick={addItem} className="text-gold text-sm font-semibold hover:text-gold-dark">{t('presupuestos.form.addPartida')}</button>
            </div>
            <div className="space-y-3">
              {items.map((item, i) => (
                <div key={i} className="bg-page rounded-xl p-4 relative">
                  <button type="button" onClick={() => removeItem(i)} className="absolute top-3 right-3 text-ink-soft/40 hover:text-red-500 text-lg leading-none">×</button>
                  <div className="pr-6 space-y-3">
                    {/* Fila 1: Descripción */}
                    <div>
                      <label className="label">{t('presupuestos.form.tituloLabel')}</label>
                      <input className="input bg-surface" value={item.titulo} onChange={e => setItem(i, 'titulo', e.target.value)} placeholder={t('presupuestos.form.tituloPlaceholder')} />
                    </div>
                    {/* Fila 2: Ud · Cantidad · Precio/ud · Importe */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="label">{t('presupuestos.form.unidadLabel')}</label>
                        <select className="input bg-surface" value={item.unidad || 'ud'} onChange={e => setItem(i, 'unidad', e.target.value)}>
                          {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="label">{t('presupuestos.form.cantidadLabel')}</label>
                        <input className="input bg-surface" type="number" min="0" step="0.01" value={item.cantidad || ''} onChange={e => setItem(i, 'cantidad', e.target.value)} placeholder="1" />
                      </div>
                      <div>
                        <label className="label">{t('presupuestos.form.precioUdLabel')}</label>
                        <input className="input bg-surface" type="number" min="0" step="0.01" value={item.precio_unitario || ''} onChange={e => setItem(i, 'precio_unitario', e.target.value)} placeholder="0.00" />
                      </div>
                      <div>
                        <label className="label">{t('presupuestos.form.importeLabel')}</label>
                        <input className="input bg-surface font-semibold text-ink" type="number" min="0" step="0.01" value={item.importe || ''} onChange={e => setItem(i, 'importe', e.target.value)} placeholder="0.00" />
                      </div>
                    </div>
                    {/* Fila 3: Detalle */}
                    <div>
                      <label className="label">{t('presupuestos.form.detalleLabel')}</label>
                      <textarea className="input bg-surface resize-none h-14 text-sm" value={item.detalle} onChange={e => setItem(i, 'detalle', e.target.value)} placeholder={t('presupuestos.form.detallePlaceholder')} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totales + condiciones */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Izq: no incluido + condiciones */}
            <div className="space-y-3">
              <div>
                <label className="label">{t('presupuestos.form.noIncluidoLabel')}</label>
                <textarea className="input resize-none h-20 text-sm" value={form.no_incluido} onChange={e => setF('no_incluido', e.target.value)} placeholder={t('presupuestos.noIncluidoPlaceholder')} />
              </div>
              <div>
                <label className="label">{t('presupuestos.form.condicionesLabel')}</label>
                <textarea className="input resize-none h-20 text-sm" value={form.condiciones} onChange={e => setF('condiciones', e.target.value)} placeholder={t('presupuestos.condicionesPlaceholder')} />
              </div>
              <div>
                <label className="label">{t('presupuestos.form.notasLabel')}</label>
                <textarea className="input resize-none h-16 text-sm" value={form.notas} onChange={e => setF('notas', e.target.value)} />
              </div>
            </div>

            {/* Der: cálculo */}
            <div>
              <div className="bg-navy rounded-xl p-5 text-white space-y-3">
                {/* IVA y descuento — fondo sólido en selects para visibilidad */}
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div>
                    <label className="text-xs text-white/60 block mb-1.5 font-semibold">{t('presupuestos.form.ivaLabel')}</label>
                    <select
                      className="w-full rounded-lg px-3 py-2 text-sm font-semibold bg-white text-navy border border-white/20 focus:outline-none focus:ring-2 focus:ring-gold"
                      value={form.iva}
                      onChange={e => setF('iva', e.target.value)}
                    >
                      <option value="0">{t('presupuestos.form.ivaOptions.sinIva')}</option>
                      <option value="10">{t('presupuestos.form.ivaOptions.residencial')}</option>
                      <option value="21">{t('presupuestos.form.ivaOptions.general')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-white/60 block mb-1.5 font-semibold">{t('presupuestos.form.descuentoLabel')}</label>
                    <input
                      className="w-full rounded-lg px-3 py-2 text-sm font-semibold bg-white text-navy border border-white/20 focus:outline-none focus:ring-2 focus:ring-gold"
                      type="number" min="0" max="100" step="0.5"
                      value={form.descuento}
                      onChange={e => setF('descuento', e.target.value)}
                    />
                  </div>
                </div>

                <div className="border-t border-white/10 pt-3 space-y-2">
                  <div className="flex justify-between text-sm text-white/70">
                    <span>{t('presupuestos.form.baseImponible')}</span>
                    <span>{base.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                  </div>
                  {dto > 0 && (
                    <div className="flex justify-between text-sm text-white/70">
                      <span>{t('presupuestos.form.descuentoLine', { pct: form.descuento })}</span>
                      <span>−{dto.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm text-white/70">
                    <span>{t('presupuestos.form.ivaLine', { pct: form.iva })}</span>
                    <span>{ivaImporte.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                  </div>
                  <div className="border-t border-white/20 pt-2 flex justify-between font-bold text-lg">
                    <span className="text-gold">{t('presupuestos.form.total')}</span>
                    <span className="text-gold">{total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel} className="btn-secondary flex-1">{t('presupuestos.form.cancel')}</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? t('presupuestos.form.saving') : t('presupuestos.form.save')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Presupuestos() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [presupuestos, setPresupuestos] = useState([])
  const [clientes, setClientes] = useState([])
  const [obras, setObras] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editData, setEditData] = useState(null)
  const [firmando, setFirmando] = useState(null)

  useEffect(() => { load() }, [])

  async function guardarFirma(datos) {
    if (!firmando) return
    const { error: err } = await supabase.from('presupuestos')
      .update({ ...datos, estado: 'aceptado' })
      .eq('id', firmando.id)
    if (err) { alert(err.message); return }
    setFirmando(null)
    load()
  }

  async function expirarVencidos(lista) {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    const vencidos = lista.filter(p => {
      if (!['borrador', 'enviado'].includes(p.estado)) return false
      if (!p.fecha || !p.validez_dias) return false
      const expira = new Date(p.fecha)
      expira.setDate(expira.getDate() + p.validez_dias)
      return expira < hoy
    })
    if (!vencidos.length) return lista
    const ids = vencidos.map(p => p.id)
    await supabase.from('presupuestos').update({ estado: 'expirado' }).in('id', ids)
    return lista.map(p => ids.includes(p.id) ? { ...p, estado: 'expirado' } : p)
  }

  async function load() {
    setLoading(true)
    const [{ data: pres }, { data: clis }, { data: obs }] = await Promise.all([
      supabase.from('presupuestos').select('*, clientes(nombre), obras(nombre)').order('created_at', { ascending: false }),
      supabase.from('clientes').select('id, nombre').order('nombre'),
      supabase.from('obras').select('id, nombre, cliente_id').order('nombre'),
    ])
    const actualizados = await expirarVencidos(pres || [])
    setPresupuestos(actualizados)
    setClientes(clis || [])
    setObras(obs || [])
    setLoading(false)
  }

  function openNew() { setEditData(null); setShowForm(true) }
  function openEdit(p) { setEditData(p); setShowForm(true) }

  function infoVencimiento(p) {
    if (!p.fecha || !p.validez_dias) return null
    if (['aceptado', 'rechazado', 'expirado'].includes(p.estado)) return null
    const expira = new Date(p.fecha)
    expira.setDate(expira.getDate() + p.validez_dias)
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    const dias = Math.round((expira - hoy) / 86400000)
    if (dias < 0) return { label: t('presupuestos.list.vencido'), cls: 'text-red-600 font-semibold' }
    if (dias === 0) return { label: t('presupuestos.list.venceHoy'), cls: 'text-orange-600 font-semibold' }
    if (dias <= 3) return { label: t('presupuestos.list.diasRestanteOther', { count: dias }), cls: 'text-orange-500 font-semibold' }
    return { label: t('presupuestos.list.diasRestanteOther', { count: dias }), cls: 'text-ink-soft' }
  }

  async function remove(id, numero) {
    if (!confirm(t('presupuestos.list.confirmDelete', { numero }))) return
    await supabase.from('presupuestos').delete().eq('id', id)
    load()
  }

  function crearFactura(p) {
    navigate('/dashboard/facturas', { state: { fromPresupuesto: p } })
  }

  const filtered = presupuestos
    .filter(p => !filtroEstado || p.estado === filtroEstado)
    .filter(p => [p.numero, p.referencia, p.clientes?.nombre, p.obras?.nombre].some(v => v?.toLowerCase().includes(search.toLowerCase())))

  const totalAceptado = presupuestos.filter(p => p.estado === 'aceptado')
    .reduce((s, p) => s + calculos(p.items || [], p.iva, p.descuento).total, 0)

  const fmt = v => v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t('presupuestos.list.title')}</h1>
          <p className="text-sm text-ink-soft mt-0.5">
            {t(presupuestos.length === 1 ? 'presupuestos.list.countOne' : 'presupuestos.list.countOther', { count: presupuestos.length })}
          </p>
        </div>
        <button onClick={openNew} className="btn-primary">{t('presupuestos.list.newPresupuesto')}</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {ESTADOS_META.map(s => {
          const count = presupuestos.filter(p => p.estado === s.value).length
          return (
            <div key={s.value} className="card text-center py-3 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFiltroEstado(filtroEstado === s.value ? '' : s.value)}>
              <div className="text-xl font-bold text-ink">{count}</div>
              <div className="mt-1"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.color}`}>{t(`presupuestos.estado.${s.value}`)}</span></div>
            </div>
          )
        })}
      </div>

      {totalAceptado > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-3 mb-5 flex items-center gap-3">
          <span className="text-green-700 font-semibold text-sm">{t('presupuestos.list.aceptados')}</span>
          <span className="text-green-800 font-bold">{fmt(totalAceptado)}</span>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input className="input max-w-xs" placeholder={t('presupuestos.list.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input w-auto" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">{t('presupuestos.list.allStates')}</option>
          {ESTADOS_META.map(s => <option key={s.value} value={s.value}>{t(`presupuestos.estado.${s.value}`)}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-ink-soft text-sm py-10 text-center">{t('presupuestos.list.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-3">📋</div>
          <div className="font-bold text-ink mb-1">{search || filtroEstado ? t('presupuestos.list.noResultsTitle') : t('presupuestos.list.noPresupuestosTitle')}</div>
          {!search && !filtroEstado && (
            <><div className="text-sm text-ink-soft mb-5">{t('presupuestos.list.noPresupuestosHint')}</div>
            <button onClick={openNew} className="btn-primary">{t('presupuestos.list.newPresupuesto')}</button></>
          )}
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-edge text-ink-soft text-xs uppercase tracking-wide">
                <th className="text-left px-5 py-3">{t('presupuestos.list.table.numero')}</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">{t('presupuestos.list.table.clienteObra')}</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">{t('presupuestos.list.table.fecha')}</th>
                <th className="text-left px-4 py-3 hidden xl:table-cell">{t('presupuestos.list.table.vence')}</th>
                <th className="text-left px-4 py-3">{t('presupuestos.list.table.estado')}</th>
                <th className="text-right px-5 py-3">{t('presupuestos.list.table.total')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {filtered.map(p => {
                const { total } = calculos(p.items || [], p.iva, p.descuento)
                const vence = infoVencimiento(p)
                return (
                  <tr key={p.id} className="hover:bg-page/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-ink flex items-center gap-1.5">
                        {p.numero}
                        {p.firma_png && (
                          <span title={t('presupuestos.list.firmadoTitle', { nombre: p.firma_nombre || '', fecha: p.firma_fecha ? new Date(p.firma_fecha).toLocaleDateString('es-ES') : '' })} className="text-[10px]">✍️</span>
                        )}
                      </div>
                      {p.referencia && <div className="text-xs text-ink-soft mt-0.5">{p.referencia}</div>}
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <div className="text-ink">{p.clientes?.nombre || '—'}</div>
                      {p.obras?.nombre && <div className="text-xs text-ink-soft mt-0.5">{p.obras.nombre}</div>}
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell text-ink-soft">
                      {p.fecha ? new Date(p.fecha).toLocaleDateString('es-ES') : '—'}
                    </td>
                    <td className="px-4 py-3.5 hidden xl:table-cell text-xs">
                      {vence ? <span className={vence.cls}>{vence.label}</span> : <span className="text-ink-soft/40">—</span>}
                    </td>
                    <td className="px-4 py-3.5"><EstadoBadge estado={p.estado} t={t} /></td>
                    <td className="px-5 py-3.5 text-right font-bold text-ink">{fmt(total)}</td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      {p.estado === 'aceptado' && (
                        <button
                          onClick={() => crearFactura(p)}
                          className="text-xs font-bold px-3 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors mr-3"
                          title={t('presupuestos.list.crearFacturaTitle')}
                        >
                          {t('presupuestos.list.crearFactura')}
                        </button>
                      )}
                      {!['aceptado', 'rechazado'].includes(p.estado) && (
                        <button
                          onClick={() => setFirmando(p)}
                          className="text-xs font-bold px-3 py-1 rounded-lg bg-gold/20 text-gold-dark hover:bg-gold/30 transition-colors mr-3"
                          title={t('presupuestos.list.firmarTitle')}
                        >
                          {t('presupuestos.list.firmar')}
                        </button>
                      )}
                      <button onClick={() => openEdit(p)} className="text-gold hover:text-gold-dark text-xs font-semibold mr-3">{t('presupuestos.list.editar')}</button>
                      <button onClick={() => remove(p.id, p.numero)} className="text-ink-soft/40 hover:text-red-500 text-xs">{t('presupuestos.list.eliminar')}</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <FormPresupuesto
          editData={editData}
          clientes={clientes}
          obras={obras}
          onSave={() => { setShowForm(false); load() }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {firmando && (
        <FirmaModal
          titulo={t('presupuestos.firmarModalTitle', { numero: firmando.numero })}
          nombreDefault={firmando.clientes?.nombre}
          onGuardar={guardarFirma}
          onCancel={() => setFirmando(null)}
        />
      )}
    </div>
  )
}
