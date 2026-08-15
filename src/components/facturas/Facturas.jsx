import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase, getUID } from '../../lib/supabase'

const ESTADOS = [
  { value: 'borrador',  label: 'Borrador',  color: 'bg-stone/20 text-stone' },
  { value: 'enviada',   label: 'Enviada',   color: 'bg-blue-100 text-blue-700' },
  { value: 'vista',     label: 'Vista',     color: 'bg-purple-100 text-purple-700' },
  { value: 'pagada',    label: 'Pagada',    color: 'bg-green-100 text-green-700' },
  { value: 'vencida',   label: 'Vencida',   color: 'bg-red-100 text-red-600' },
]

const UNIDADES = ['ud', 'm²', 'm³', 'ml', 'm', 'h', 'kg', 'l', 'pa', 'gl']

function calculos(items, iva, descuento, retencion) {
  const base = items.reduce((s, i) => s + (parseFloat(i.importe) || 0), 0)
  const dto = base * (parseFloat(descuento) || 0) / 100
  const baseConDto = base - dto
  const ivaImporte = baseConDto * (parseFloat(iva) || 0) / 100
  const retImporte = baseConDto * (parseFloat(retencion) || 0) / 100
  const total = baseConDto + ivaImporte - retImporte
  return { base, dto, baseConDto, ivaImporte, retImporte, total }
}

const ITEM_EMPTY = { titulo: '', detalle: '', cantidad: '1', unidad: 'ud', precio_unitario: '', importe: '' }

function FormFactura({ editData, clientes, obras, presupuestos, onSave, onCancel, initialFromPres }) {
  const hoy = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    numero: '', cliente_id: '', obra_id: '', presupuesto_id: '',
    fecha: hoy, vencimiento: '', estado: 'borrador',
    iva: '10', descuento: '0', retencion: '0', notas: '',
  })
  const [items, setItems] = useState([{ ...ITEM_EMPTY }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Cargar editData
  useEffect(() => {
    if (editData) {
      setForm({
        numero: editData.numero || '',
        cliente_id: editData.cliente_id || '',
        obra_id: editData.obra_id || '',
        presupuesto_id: editData.presupuesto_id || '',
        fecha: editData.fecha || hoy,
        vencimiento: editData.vencimiento || '',
        estado: editData.estado || 'borrador',
        iva: editData.iva?.toString() || '10',
        descuento: editData.descuento?.toString() || '0',
        retencion: editData.retencion?.toString() || '0',
        notas: editData.notas || '',
      })
      setItems(editData.items?.length ? editData.items : [{ ...ITEM_EMPTY }])
    }
  }, [editData])

  // Pre-rellenar desde presupuesto (botón "→ Factura")
  useEffect(() => {
    if (initialFromPres && !editData) {
      const p = initialFromPres
      setForm(prev => ({
        ...prev,
        presupuesto_id: p.id,
        cliente_id: p.cliente_id || '',
        obra_id: p.obra_id || '',
        iva: p.iva?.toString() || '10',
        descuento: p.descuento?.toString() || '0',
      }))
      if (p.items?.length) setItems(p.items.map(i => ({ ...ITEM_EMPTY, ...i })))
    }
  }, [initialFromPres])

  function setF(f, v) { setForm(p => ({ ...p, [f]: v })) }
  function addItem() { setItems(p => [...p, { ...ITEM_EMPTY }]) }
  function removeItem(i) { setItems(p => p.filter((_, idx) => idx !== i)) }
  function setItem(i, f, v) {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item
      const updated = { ...item, [f]: v }
      if (f === 'cantidad' || f === 'precio_unitario') {
        const cant = parseFloat(f === 'cantidad' ? v : item.cantidad) || 0
        const precio = parseFloat(f === 'precio_unitario' ? v : item.precio_unitario) || 0
        if (cant > 0 && precio > 0) updated.importe = (cant * precio).toFixed(2)
      }
      return updated
    }))
  }

  // Importar desde presupuesto seleccionado en el dropdown
  function importarDesdePresupuesto(presId) {
    setF('presupuesto_id', presId)
    if (!presId) return
    const pres = presupuestos.find(p => p.id === presId)
    if (!pres) return
    if (pres.items?.length) setItems(pres.items.map(i => ({ ...ITEM_EMPTY, ...i })))
    if (pres.cliente_id) setF('cliente_id', pres.cliente_id)
    if (pres.obra_id) setF('obra_id', pres.obra_id)
    if (pres.iva != null) setF('iva', pres.iva.toString())
    if (pres.descuento != null) setF('descuento', pres.descuento.toString())
  }

  const { base, dto, baseConDto, ivaImporte, retImporte, total } = calculos(items, form.iva, form.descuento, form.retencion)
  const obrasFiltradas = obras.filter(o => !form.cliente_id || o.cliente_id === form.cliente_id)
  const presFiltrados = presupuestos.filter(p =>
    (!form.cliente_id || p.cliente_id === form.cliente_id) && p.estado === 'aceptado'
  )

  async function save(e) {
    e.preventDefault()
    if (!form.numero.trim()) { setError('El número de factura es obligatorio'); return }
    setSaving(true); setError('')
    const user_id = await getUID()
    const payload = {
      user_id,
      numero: form.numero.trim(),
      cliente_id: form.cliente_id || null,
      obra_id: form.obra_id || null,
      presupuesto_id: form.presupuesto_id || null,
      fecha: form.fecha,
      vencimiento: form.vencimiento || null,
      estado: form.estado,
      items: items.filter(i => i.titulo || i.importe),
      iva: parseFloat(form.iva) || 10,
      descuento: parseFloat(form.descuento) || 0,
      retencion: parseFloat(form.retencion) || 0,
      notas: form.notas || null,
    }
    const { error: err } = editData
      ? await supabase.from('facturas').update(payload).eq('id', editData.id)
      : await supabase.from('facturas').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    onSave()
  }

  return (
    <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-4">
        <div className="px-6 py-4 border-b border-arena-dark flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-navy">{editData ? 'Editar factura' : 'Nueva factura'}</h2>
            {initialFromPres && !editData && (
              <p className="text-xs text-green-700 mt-0.5">📋 Creada desde presupuesto {initialFromPres.numero}</p>
            )}
          </div>
          <button onClick={onCancel} className="text-stone hover:text-navy text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
        </div>

        <form onSubmit={save} className="p-6 space-y-6">
          {/* Importar desde presupuesto (solo si no viene de navigate) */}
          {!editData && !initialFromPres && presFiltrados.length > 0 && (
            <div className="bg-gold/10 border border-gold/30 rounded-xl p-4">
              <label className="label text-gold-dark">⚡ Importar desde presupuesto aceptado</label>
              <select className="input mt-1" value={form.presupuesto_id} onChange={e => importarDesdePresupuesto(e.target.value)}>
                <option value="">Crear factura desde cero</option>
                {presFiltrados.map(p => (
                  <option key={p.id} value={p.id}>{p.numero} — {p.clientes?.nombre || 'Sin cliente'}</option>
                ))}
              </select>
            </div>
          )}

          {/* Datos básicos */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="label">Número *</label>
              <input className="input" value={form.numero} onChange={e => setF('numero', e.target.value)} placeholder="FAC-2026-001" required />
            </div>
            <div>
              <label className="label">Estado</label>
              <select className="input" value={form.estado} onChange={e => setF('estado', e.target.value)}>
                {ESTADOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Fecha emisión</label>
              <input className="input" type="date" value={form.fecha} onChange={e => setF('fecha', e.target.value)} />
            </div>
            <div>
              <label className="label">Vencimiento</label>
              <input className="input" type="date" value={form.vencimiento} onChange={e => setF('vencimiento', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">Cliente</label>
              <select className="input" value={form.cliente_id} onChange={e => { setF('cliente_id', e.target.value); setF('obra_id', '') }}>
                <option value="">Sin cliente</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Obra</label>
              <select className="input" value={form.obra_id} onChange={e => setF('obra_id', e.target.value)}>
                <option value="">Sin obra</option>
                {obrasFiltradas.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
              </select>
            </div>
          </div>

          {/* Líneas */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-stone">Líneas de factura</label>
              <button type="button" onClick={addItem} className="text-gold text-sm font-semibold hover:text-gold-dark">+ Añadir línea</button>
            </div>
            <div className="space-y-3">
              {items.map((item, i) => (
                <div key={i} className="bg-arena rounded-xl p-4 relative">
                  <button type="button" onClick={() => removeItem(i)} className="absolute top-3 right-3 text-stone/40 hover:text-red-500 text-lg leading-none">×</button>
                  <div className="pr-6 space-y-3">
                    <div>
                      <label className="label">Descripción</label>
                      <input className="input bg-white" value={item.titulo} onChange={e => setItem(i, 'titulo', e.target.value)} placeholder="Trabajos ejecutados en reforma de baño" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="label">Unidad</label>
                        <select className="input bg-white" value={item.unidad || 'ud'} onChange={e => setItem(i, 'unidad', e.target.value)}>
                          {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="label">Cantidad</label>
                        <input className="input bg-white" type="number" min="0" step="0.01" value={item.cantidad || ''} onChange={e => setItem(i, 'cantidad', e.target.value)} placeholder="1" />
                      </div>
                      <div>
                        <label className="label">Precio / ud (€)</label>
                        <input className="input bg-white" type="number" min="0" step="0.01" value={item.precio_unitario || ''} onChange={e => setItem(i, 'precio_unitario', e.target.value)} placeholder="0.00" />
                      </div>
                      <div>
                        <label className="label">Importe (€)</label>
                        <input className="input bg-white font-semibold text-navy" type="number" min="0" step="0.01" value={item.importe || ''} onChange={e => setItem(i, 'importe', e.target.value)} placeholder="0.00" />
                      </div>
                    </div>
                    <div>
                      <label className="label">Detalle (opcional)</label>
                      <textarea className="input bg-white resize-none h-12 text-sm" value={item.detalle} onChange={e => setItem(i, 'detalle', e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div>
              <label className="label">Notas / observaciones</label>
              <textarea className="input resize-none h-24 text-sm" value={form.notas} onChange={e => setF('notas', e.target.value)} placeholder="Condiciones de pago, nº de cuenta, etc." />
            </div>

            <div className="bg-navy rounded-xl p-5 text-white space-y-3">
              <div className="grid grid-cols-3 gap-2 mb-2">
                <div>
                  <label className="text-xs text-white/60 block mb-1.5 font-semibold">IVA (%)</label>
                  <select
                    className="w-full rounded-lg px-2 py-2 text-sm font-semibold bg-white text-navy border border-white/20 focus:outline-none"
                    value={form.iva}
                    onChange={e => setF('iva', e.target.value)}
                  >
                    <option value="0">0% — Sin IVA</option>
                    <option value="10">10% — Residencial</option>
                    <option value="21">21% — Local / Obra nueva / Empresa / Inversor</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1.5 font-semibold">Dto. (%)</label>
                  <input
                    className="w-full rounded-lg px-2 py-2 text-sm font-semibold bg-white text-navy border border-white/20 focus:outline-none"
                    type="number" min="0" max="100" step="0.5"
                    value={form.descuento}
                    onChange={e => setF('descuento', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1.5 font-semibold">Ret. IRPF (%)</label>
                  <input
                    className="w-full rounded-lg px-2 py-2 text-sm font-semibold bg-white text-navy border border-white/20 focus:outline-none"
                    type="number" min="0" max="25" step="0.5"
                    value={form.retencion}
                    onChange={e => setF('retencion', e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="border-t border-white/10 pt-3 space-y-2">
                <div className="flex justify-between text-sm text-white/70">
                  <span>Base imponible</span>
                  <span>{base.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                </div>
                {dto > 0 && (
                  <div className="flex justify-between text-sm text-white/70">
                    <span>Descuento ({form.descuento}%)</span>
                    <span>−{dto.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-white/70">
                  <span>IVA ({form.iva}%)</span>
                  <span>+{ivaImporte.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                </div>
                {retImporte > 0 && (
                  <div className="flex justify-between text-sm text-white/70">
                    <span>Ret. IRPF ({form.retencion}%)</span>
                    <span className="text-red-300">−{retImporte.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                  </div>
                )}
                <div className="border-t border-white/20 pt-2 flex justify-between font-bold text-lg">
                  <span className="text-gold">TOTAL</span>
                  <span className="text-gold">{total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                </div>
              </div>
            </div>
          </div>

          {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Guardando…' : 'Guardar factura'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Facturas() {
  const location = useLocation()
  const [facturas, setFacturas] = useState([])
  const [clientes, setClientes] = useState([])
  const [obras, setObras] = useState([])
  const [presupuestos, setPresupuestos] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editData, setEditData] = useState(null)
  const [fromPresupuesto, setFromPresupuesto] = useState(null)

  useEffect(() => {
    load()
    // Si venimos de un presupuesto aceptado, abrir formulario pre-rellenado
    if (location.state?.fromPresupuesto) {
      setFromPresupuesto(location.state.fromPresupuesto)
      setEditData(null)
      setShowForm(true)
      // Limpiar el state de navegación para no re-disparar
      window.history.replaceState({}, document.title)
    }
  }, [])

  async function load() {
    setLoading(true)
    const [{ data: facs }, { data: clis }, { data: obs }, { data: pres }] = await Promise.all([
      supabase.from('facturas').select('*, clientes(nombre), obras(nombre)').order('fecha', { ascending: false }),
      supabase.from('clientes').select('id, nombre').order('nombre'),
      supabase.from('obras').select('id, nombre, cliente_id').order('nombre'),
      supabase.from('presupuestos').select('id, numero, cliente_id, obra_id, items, iva, descuento, estado, clientes(nombre)').eq('estado', 'aceptado').order('created_at', { ascending: false }),
    ])
    setFacturas(facs || [])
    setClientes(clis || [])
    setObras(obs || [])
    setPresupuestos(pres || [])
    setLoading(false)
  }

  function openNew() { setEditData(null); setFromPresupuesto(null); setShowForm(true) }
  function openEdit(f) { setEditData(f); setFromPresupuesto(null); setShowForm(true) }

  async function cambiarEstado(id, estado) {
    await supabase.from('facturas').update({ estado }).eq('id', id)
    load()
  }

  async function remove(id, numero) {
    if (!confirm(`¿Eliminar la factura ${numero}?`)) return
    await supabase.from('facturas').delete().eq('id', id)
    load()
  }

  const filtered = facturas
    .filter(f => !filtroEstado || f.estado === filtroEstado)
    .filter(f => [f.numero, f.clientes?.nombre, f.obras?.nombre].some(v => v?.toLowerCase().includes(search.toLowerCase())))

  const fmt = v => v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
  const totalFacturado = facturas.reduce((s, f) => s + calculos(f.items || [], f.iva, f.descuento, f.retencion).total, 0)
  const totalCobrado = facturas.filter(f => f.estado === 'pagada').reduce((s, f) => s + calculos(f.items || [], f.iva, f.descuento, f.retencion).total, 0)
  const pendienteCobro = facturas.filter(f => ['enviada', 'vista'].includes(f.estado)).reduce((s, f) => s + calculos(f.items || [], f.iva, f.descuento, f.retencion).total, 0)

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy">Facturas</h1>
          <p className="text-sm text-stone mt-0.5">{facturas.length} factura{facturas.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openNew} className="btn-primary">+ Nueva factura</button>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card border-l-4 border-l-navy">
          <div className="text-xs font-semibold uppercase tracking-wide text-stone mb-1">Facturado (total)</div>
          <div className="text-2xl font-bold text-navy">{fmt(totalFacturado)}</div>
          <div className="text-xs text-stone mt-1">{facturas.length} facturas</div>
        </div>
        <div className="card border-l-4 border-l-green-500">
          <div className="text-xs font-semibold uppercase tracking-wide text-stone mb-1">Cobrado</div>
          <div className="text-2xl font-bold text-green-700">{fmt(totalCobrado)}</div>
          <div className="text-xs text-stone mt-1">{facturas.filter(f => f.estado === 'pagada').length} pagadas</div>
        </div>
        <div className="card border-l-4 border-l-gold">
          <div className="text-xs font-semibold uppercase tracking-wide text-stone mb-1">Pendiente cobro</div>
          <div className="text-2xl font-bold text-gold-dark">{fmt(pendienteCobro)}</div>
          <div className="text-xs text-stone mt-1">{facturas.filter(f => ['enviada', 'vista'].includes(f.estado)).length} en circulación</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button onClick={() => setFiltroEstado('')} className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${!filtroEstado ? 'bg-navy text-white border-navy' : 'border-arena-dark text-stone hover:border-navy hover:text-navy'}`}>
          Todas ({facturas.length})
        </button>
        {ESTADOS.map(s => {
          const count = facturas.filter(f => f.estado === s.value).length
          return (
            <button key={s.value} onClick={() => setFiltroEstado(filtroEstado === s.value ? '' : s.value)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${filtroEstado === s.value ? 'bg-navy text-white border-navy' : 'border-arena-dark text-stone hover:border-navy hover:text-navy'}`}>
              {s.label} ({count})
            </button>
          )
        })}
      </div>

      <div className="mb-5">
        <input className="input max-w-xs" placeholder="🔍  Buscar nº, cliente…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="text-stone text-sm py-10 text-center">Cargando facturas…</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-3">📄</div>
          <div className="font-bold text-navy mb-1">{search || filtroEstado ? 'Sin resultados' : 'Aún no tienes facturas'}</div>
          {!search && !filtroEstado && <button onClick={openNew} className="btn-primary mt-4">+ Nueva factura</button>}
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-arena-dark text-stone text-xs uppercase tracking-wide">
                <th className="text-left px-5 py-3">Número</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Cliente</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Fecha</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Vencimiento</th>
                <th className="text-left px-4 py-3">Estado</th>
                <th className="text-right px-5 py-3">Total</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-arena-dark">
              {filtered.map(f => {
                const { total } = calculos(f.items || [], f.iva, f.descuento, f.retencion)
                const vencida = f.vencimiento && f.estado !== 'pagada' && new Date(f.vencimiento) < new Date()
                return (
                  <tr key={f.id} className={`hover:bg-arena/50 transition-colors ${vencida ? 'bg-red-50/50' : ''}`}>
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-navy">{f.numero}</div>
                      {f.obras?.nombre && <div className="text-xs text-stone mt-0.5">{f.obras.nombre}</div>}
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell text-navy">{f.clientes?.nombre || '—'}</td>
                    <td className="px-4 py-3.5 hidden lg:table-cell text-stone">
                      {f.fecha ? new Date(f.fecha).toLocaleDateString('es-ES') : '—'}
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      {f.vencimiento ? (
                        <span className={vencida && f.estado !== 'pagada' ? 'text-red-600 font-semibold' : 'text-stone'}>
                          {new Date(f.vencimiento).toLocaleDateString('es-ES')}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <select value={f.estado} onChange={e => cambiarEstado(f.id, e.target.value)}
                        className="text-xs font-semibold bg-transparent border-none focus:outline-none cursor-pointer"
                        onClick={e => e.stopPropagation()}>
                        {ESTADOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-navy">{fmt(total)}</td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <button onClick={() => openEdit(f)} className="text-gold hover:text-gold-dark text-xs font-semibold mr-4">Editar</button>
                      <button onClick={() => remove(f.id, f.numero)} className="text-stone/40 hover:text-red-500 text-xs">Eliminar</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <FormFactura
          editData={editData}
          clientes={clientes}
          obras={obras}
          presupuestos={presupuestos}
          onSave={() => { setShowForm(false); setFromPresupuesto(null); load() }}
          onCancel={() => { setShowForm(false); setFromPresupuesto(null) }}
          initialFromPres={fromPresupuesto}
        />
      )}
    </div>
  )
}
