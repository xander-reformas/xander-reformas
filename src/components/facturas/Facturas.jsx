import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase, getUID } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

const ESTADOS_META = [
  { value: 'borrador',  color: 'bg-stone/20 text-ink-soft' },
  { value: 'enviada',   color: 'bg-blue-100 text-blue-700' },
  { value: 'vista',     color: 'bg-purple-100 text-purple-700' },
  { value: 'pagada',    color: 'bg-green-100 text-green-700' },
  { value: 'vencida',   color: 'bg-red-100 text-red-600' },
  { value: 'anulada',   color: 'bg-stone/30 text-ink-soft line-through' },
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

function FormFactura({ editData, locked, clientes, obras, presupuestos, onSave, onCancel, initialFromPres }) {
  const { t } = useTranslation()
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
    if (!form.numero.trim()) { setError(t('facturas.form.numeroRequerido')); return }
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
    const wasBorrador = !editData || editData.estado === 'borrador'
    const seEmite = wasBorrador && form.estado !== 'borrador'

    const { data: saved, error: err } = editData
      ? await supabase.from('facturas').update(payload).eq('id', editData.id).select('id').single()
      : await supabase.from('facturas').insert(payload).select('id').single()
    setSaving(false)
    if (err) {
      // El trigger de Verifactu ya devuelve mensajes en español listos para mostrar
      setError(err.message)
      return
    }

    // La factura ya quedó registrada localmente (hash Verifactu) gracias al trigger.
    // Ahora la enviamos a la AEAT vía Verifacti. Es un paso adicional: si falla,
    // la factura sigue siendo válida y se puede reintentar el envío más tarde.
    if (seEmite && saved?.id) {
      supabase.functions.invoke('verifactu-enviar', { body: { factura_id: saved.id } })
        .catch(e => console.error('Error enviando a Verifacti:', e))
    }

    onSave()
  }

  return (
    <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-4xl my-4">
        <div className="px-6 py-4 border-b border-edge flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink flex items-center gap-2">
              {editData ? t('facturas.form.editTitle') : t('facturas.form.newTitle')}
              {locked && <span className="text-xs font-semibold bg-navy text-gold px-2 py-0.5 rounded-full">{t('facturas.form.verifactuBadge')}</span>}
            </h2>
            {initialFromPres && !editData && (
              <p className="text-xs text-green-700 mt-0.5">{t('facturas.form.fromPresupuesto', { numero: initialFromPres.numero })}</p>
            )}
          </div>
          <button onClick={onCancel} className="text-ink-soft hover:text-ink text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
        </div>

        <form onSubmit={save} className="p-6 space-y-6">
          {locked && (
            <div className="bg-navy/5 border border-navy/20 rounded-xl p-4 text-sm text-ink">
              {t('facturas.form.lockedNotice')}
            </div>
          )}

          {/* Importar desde presupuesto (solo si no viene de navigate) */}
          {!editData && !initialFromPres && presFiltrados.length > 0 && (
            <div className="bg-gold/10 border border-gold/30 rounded-xl p-4">
              <label className="label text-gold-dark">{t('facturas.form.importarPresupuestoLabel')}</label>
              <select className="input mt-1" value={form.presupuesto_id} onChange={e => importarDesdePresupuesto(e.target.value)}>
                <option value="">{t('facturas.form.crearDesdeCero')}</option>
                {presFiltrados.map(p => (
                  <option key={p.id} value={p.id}>{p.numero} — {p.clientes?.nombre || t('facturas.form.sinCliente')}</option>
                ))}
              </select>
            </div>
          )}

          {/* Datos básicos */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="label">{t('facturas.form.numeroLabel')}</label>
              <input className="input" value={form.numero} onChange={e => setF('numero', e.target.value)} placeholder="FAC-2026-001" required disabled={locked} />
            </div>
            <div>
              <label className="label">{t('facturas.form.estadoLabel')}</label>
              <select className="input" value={form.estado} onChange={e => setF('estado', e.target.value)}>
                {ESTADOS_META.map(s => <option key={s.value} value={s.value}>{t(`facturas.estado.${s.value}`)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t('facturas.form.fechaEmisionLabel')}</label>
              <input className="input" type="date" value={form.fecha} onChange={e => setF('fecha', e.target.value)} disabled={locked} />
            </div>
            <div>
              <label className="label">{t('facturas.form.vencimientoLabel')}</label>
              <input className="input" type="date" value={form.vencimiento} onChange={e => setF('vencimiento', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">{t('facturas.form.clienteLabel')}</label>
              <select className="input" value={form.cliente_id} onChange={e => { setF('cliente_id', e.target.value); setF('obra_id', '') }} disabled={locked}>
                <option value="">{t('facturas.form.sinCliente')}</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t('facturas.form.obraLabel')}</label>
              <select className="input" value={form.obra_id} onChange={e => setF('obra_id', e.target.value)}>
                <option value="">{t('facturas.form.sinObra')}</option>
                {obrasFiltradas.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
              </select>
            </div>
          </div>

          {/* Líneas */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-soft">{t('facturas.form.lineasLabel')}</label>
              {!locked && <button type="button" onClick={addItem} className="text-gold text-sm font-semibold hover:text-gold-dark">{t('facturas.form.addLinea')}</button>}
            </div>
            <div className="space-y-3">
              {items.map((item, i) => (
                <div key={i} className="bg-page rounded-xl p-4 relative">
                  {!locked && (
                    <button type="button" onClick={() => removeItem(i)} className="absolute top-3 right-3 text-ink-soft/40 hover:text-red-500 text-lg leading-none">×</button>
                  )}
                  <div className="pr-6 space-y-3">
                    <div>
                      <label className="label">{t('facturas.form.descripcionLabel')}</label>
                      <input className="input bg-surface" value={item.titulo} onChange={e => setItem(i, 'titulo', e.target.value)} placeholder={t('facturas.form.descripcionPlaceholder')} disabled={locked} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="label">{t('facturas.form.unidadLabel')}</label>
                        <select className="input bg-surface" value={item.unidad || 'ud'} onChange={e => setItem(i, 'unidad', e.target.value)} disabled={locked}>
                          {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="label">{t('facturas.form.cantidadLabel')}</label>
                        <input className="input bg-surface" type="number" min="0" step="0.01" value={item.cantidad || ''} onChange={e => setItem(i, 'cantidad', e.target.value)} placeholder="1" disabled={locked} />
                      </div>
                      <div>
                        <label className="label">{t('facturas.form.precioUdLabel')}</label>
                        <input className="input bg-surface" type="number" min="0" step="0.01" value={item.precio_unitario || ''} onChange={e => setItem(i, 'precio_unitario', e.target.value)} placeholder="0.00" disabled={locked} />
                      </div>
                      <div>
                        <label className="label">{t('facturas.form.importeLabel')}</label>
                        <input className="input bg-surface font-semibold text-ink" type="number" min="0" step="0.01" value={item.importe || ''} onChange={e => setItem(i, 'importe', e.target.value)} placeholder="0.00" disabled={locked} />
                      </div>
                    </div>
                    <div>
                      <label className="label">{t('facturas.form.detalleLabel')}</label>
                      <textarea className="input bg-surface resize-none h-12 text-sm" value={item.detalle} onChange={e => setItem(i, 'detalle', e.target.value)} disabled={locked} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div>
              <label className="label">{t('facturas.form.notasLabel')}</label>
              <textarea className="input resize-none h-24 text-sm" value={form.notas} onChange={e => setF('notas', e.target.value)} placeholder={t('facturas.form.notasPlaceholder')} />
            </div>

            <div className="bg-navy rounded-xl p-5 text-white space-y-3">
              <div className="grid grid-cols-3 gap-2 mb-2">
                <div>
                  <label className="text-xs text-white/60 block mb-1.5 font-semibold">{t('facturas.form.ivaLabel')}</label>
                  <select
                    className="w-full rounded-lg px-2 py-2 text-sm font-semibold bg-white text-navy border border-white/20 focus:outline-none disabled:opacity-60"
                    value={form.iva}
                    onChange={e => setF('iva', e.target.value)}
                    disabled={locked}
                  >
                    <option value="0">{t('facturas.form.ivaOptions.sinIva')}</option>
                    <option value="10">{t('facturas.form.ivaOptions.residencial')}</option>
                    <option value="21">{t('facturas.form.ivaOptions.general')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1.5 font-semibold">{t('facturas.form.dtoLabel')}</label>
                  <input
                    className="w-full rounded-lg px-2 py-2 text-sm font-semibold bg-white text-navy border border-white/20 focus:outline-none disabled:opacity-60"
                    type="number" min="0" max="100" step="0.5"
                    value={form.descuento}
                    onChange={e => setF('descuento', e.target.value)}
                    disabled={locked}
                  />
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1.5 font-semibold">{t('facturas.form.retLabel')}</label>
                  <input
                    className="w-full rounded-lg px-2 py-2 text-sm font-semibold bg-white text-navy border border-white/20 focus:outline-none disabled:opacity-60"
                    type="number" min="0" max="25" step="0.5"
                    value={form.retencion}
                    onChange={e => setF('retencion', e.target.value)}
                    placeholder="0"
                    disabled={locked}
                  />
                </div>
              </div>

              <div className="border-t border-white/10 pt-3 space-y-2">
                <div className="flex justify-between text-sm text-white/70">
                  <span>{t('facturas.form.baseImponible')}</span>
                  <span>{base.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                </div>
                {dto > 0 && (
                  <div className="flex justify-between text-sm text-white/70">
                    <span>{t('facturas.form.descuentoLine', { pct: form.descuento })}</span>
                    <span>−{dto.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-white/70">
                  <span>{t('facturas.form.ivaLine', { pct: form.iva })}</span>
                  <span>+{ivaImporte.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                </div>
                {retImporte > 0 && (
                  <div className="flex justify-between text-sm text-white/70">
                    <span>{t('facturas.form.retLine', { pct: form.retencion })}</span>
                    <span className="text-red-300">−{retImporte.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                  </div>
                )}
                <div className="border-t border-white/20 pt-2 flex justify-between font-bold text-lg">
                  <span className="text-gold">{t('facturas.form.total')}</span>
                  <span className="text-gold">{total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                </div>
              </div>
            </div>
          </div>

          {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel} className="btn-secondary flex-1">{t('facturas.form.cancel')}</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? t('facturas.form.saving') : t('facturas.form.save')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function FacturaVista({ factura, obra, onClose }) {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [cliente, setCliente] = useState(null)
  const [registro, setRegistro] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function cargar() {
      setLoading(true)
      const [{ data: cli }, { data: reg }] = await Promise.all([
        factura.cliente_id
          ? supabase.from('clientes').select('*').eq('id', factura.cliente_id).single()
          : Promise.resolve({ data: null }),
        supabase.from('registro_facturacion')
          .select('hash, verifacti_estado, verifacti_uuid, verifacti_qr, verifacti_error')
          .eq('factura_id', factura.id).eq('tipo_registro', 'alta')
          .maybeSingle(),
      ])
      if (cancelled) return
      setCliente(cli || null)
      setRegistro(reg || null)
      setLoading(false)
    }
    cargar()
    return () => { cancelled = true }
  }, [factura.id])

  const { base, dto, ivaImporte, retImporte, total } = calculos(factura.items || [], factura.iva, factura.descuento, factura.retencion)
  const fmt = v => (v || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
  const registrada = !!registro
  const enviada = registro?.verifacti_estado && registro.verifacti_estado !== 'no_enviado'
  const verificable = !!registro?.verifacti_qr && ['pendiente', 'aceptado', 'aceptado_con_errores'].includes(registro?.verifacti_estado)

  return (
    <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-2xl my-4">
        <div className="px-6 py-4 border-b border-edge flex items-center justify-between no-print">
          <h2 className="text-lg font-bold text-ink">{t('facturas.vista.title', { numero: factura.numero })}</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
        </div>

        {loading ? (
          <div className="p-10 text-center text-ink-soft text-sm">{t('facturas.vista.loading')}</div>
        ) : (
          <div className="print-area p-8 text-sm text-ink">
            {/* Cabecera: empresa vs cliente */}
            <div className="flex justify-between items-start gap-6 mb-8">
              <div>
                <div className="text-lg font-black text-ink">{profile?.empresa_nombre || t('facturas.vista.empresaDefault')}</div>
                {profile?.empresa_nif && <div className="text-ink-soft">{t('facturas.vista.nif', { nif: profile.empresa_nif })}</div>}
                {profile?.empresa_direccion && <div className="text-ink-soft">{profile.empresa_direccion}</div>}
                {(profile?.empresa_cp || profile?.empresa_ciudad) && (
                  <div className="text-ink-soft">{[profile?.empresa_cp, profile?.empresa_ciudad].filter(Boolean).join(' ')}</div>
                )}
                {profile?.empresa_telefono && <div className="text-ink-soft">{t('facturas.vista.tel', { tel: profile.empresa_telefono })}</div>}
                {profile?.empresa_email && <div className="text-ink-soft">{profile.empresa_email}</div>}
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-navy">{t('facturas.vista.title', { numero: '' }).split(' ')[0]}</div>
                <div className="font-bold text-ink">{factura.numero}</div>
                <div className="text-ink-soft mt-1">{t('facturas.vista.fecha', { fecha: factura.fecha ? new Date(factura.fecha).toLocaleDateString('es-ES') : '—' })}</div>
                {factura.vencimiento && <div className="text-ink-soft">{t('facturas.vista.vencimiento', { fecha: new Date(factura.vencimiento).toLocaleDateString('es-ES') })}</div>}
              </div>
            </div>

            {/* Cliente */}
            <div className="bg-page rounded-xl p-4 mb-6">
              <div className="text-xs font-bold uppercase tracking-widest text-ink-soft mb-1.5">{t('facturas.vista.facturarA')}</div>
              <div className="font-bold text-ink">{cliente?.nombre || factura.clientes?.nombre || t('facturas.vista.sinCliente')}</div>
              {cliente?.nif && <div className="text-ink-soft">{t('facturas.vista.nif', { nif: cliente.nif })}</div>}
              {cliente?.direccion && <div className="text-ink-soft">{cliente.direccion}</div>}
              {(cliente?.cp || cliente?.ciudad) && <div className="text-ink-soft">{[cliente?.cp, cliente?.ciudad].filter(Boolean).join(' ')}</div>}
              {obra?.nombre && <div className="text-ink-soft mt-1">{t('facturas.vista.obra', { nombre: obra.nombre })}</div>}
            </div>

            {/* Líneas */}
            <table className="w-full mb-6">
              <thead>
                <tr className="border-b-2 border-ink/20 text-xs uppercase tracking-wide text-ink-soft">
                  <th className="text-left py-2">{t('facturas.vista.descripcionCol')}</th>
                  <th className="text-right py-2">{t('facturas.vista.cantidadCol')}</th>
                  <th className="text-right py-2">{t('facturas.vista.precioUdCol')}</th>
                  <th className="text-right py-2">{t('facturas.vista.importeCol')}</th>
                </tr>
              </thead>
              <tbody>
                {(factura.items || []).map((item, i) => (
                  <tr key={i} className="border-b border-edge">
                    <td className="py-2 pr-2">
                      <div className="font-medium text-ink">{item.titulo}</div>
                      {item.detalle && <div className="text-xs text-ink-soft">{item.detalle}</div>}
                    </td>
                    <td className="text-right py-2 text-ink-soft">{item.cantidad} {item.unidad}</td>
                    <td className="text-right py-2 text-ink-soft">{item.precio_unitario ? fmt(item.precio_unitario) : '—'}</td>
                    <td className="text-right py-2 font-semibold">{fmt(item.importe)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totales */}
            <div className="flex justify-end mb-6">
              <div className="w-64 space-y-1.5">
                <div className="flex justify-between text-ink-soft">
                  <span>{t('facturas.vista.baseImponible')}</span><span>{fmt(base)}</span>
                </div>
                {dto > 0 && (
                  <div className="flex justify-between text-ink-soft">
                    <span>{t('facturas.vista.descuentoLine', { pct: factura.descuento })}</span><span>−{fmt(dto)}</span>
                  </div>
                )}
                <div className="flex justify-between text-ink-soft">
                  <span>{t('facturas.vista.ivaLine', { pct: factura.iva })}</span><span>+{fmt(ivaImporte)}</span>
                </div>
                {retImporte > 0 && (
                  <div className="flex justify-between text-ink-soft">
                    <span>{t('facturas.vista.retLine', { pct: factura.retencion })}</span><span>−{fmt(retImporte)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-base border-t-2 border-ink/20 pt-1.5 mt-1.5">
                  <span>{t('facturas.vista.total')}</span><span>{fmt(total)}</span>
                </div>
              </div>
            </div>

            {factura.notas && (
              <div className="text-xs text-ink-soft border-t border-edge pt-3 mb-6 whitespace-pre-line">{factura.notas}</div>
            )}

            {/* Pie Verifactu: QR + leyenda normativa (RD 1007/2023) */}
            {registrada && (
              <div className="border-t border-edge pt-4 flex items-center gap-4">
                {verificable ? (
                  <>
                    <img
                      src={`data:image/png;base64,${registro.verifacti_qr}`}
                      alt="Código QR Verifactu"
                      className="w-20 h-20 shrink-0"
                    />
                    <div className="text-[10px] leading-tight text-ink-soft">
                      <div className="font-bold text-ink">{t('facturas.vista.veriTitle')}</div>
                      <div>{t('facturas.vista.veriDesc')}</div>
                      {registro.verifacti_uuid && <div className="mt-0.5">{t('facturas.vista.veriRef', { uuid: registro.verifacti_uuid })}</div>}
                    </div>
                  </>
                ) : (
                  <div className="text-[10px] leading-tight text-ink-soft">
                    <div className="font-bold text-ink">{t('facturas.vista.registradaTitle')}</div>
                    <div>{t('facturas.vista.hashLabel', { hash: registro.hash?.slice(0, 24) })}</div>
                    {!enviada && <div className="no-print mt-1 text-gold-dark">{t('facturas.vista.noEnviada')}</div>}
                    {registro.verifacti_error && <div className="no-print mt-1 text-red-600">{t('facturas.vista.aeatError', { error: registro.verifacti_error })}</div>}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="px-6 pb-6 pt-2 flex gap-3 no-print">
          <button onClick={onClose} className="btn-secondary flex-1">{t('facturas.vista.cerrar')}</button>
          <button onClick={() => window.print()} className="btn-primary flex-1">{t('facturas.vista.imprimir')}</button>
        </div>
      </div>
    </div>
  )
}

function CobroModal({ factura, url, onClose }) {
  const { t } = useTranslation()
  const [copiado, setCopiado] = useState(false)
  function copiar() {
    navigator.clipboard?.writeText(url)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }
  return (
    <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-edge flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">{t('facturas.cobro.title', { numero: factura.numero })}</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-ink-soft">{t('facturas.cobro.desc')}</p>
          <div className="bg-page rounded-xl p-3 text-xs break-all text-ink-soft border border-edge">{url}</div>
          <div className="flex gap-3">
            <button onClick={copiar} className="btn-secondary flex-1">{copiado ? t('facturas.cobro.copiado') : t('facturas.cobro.copiar')}</button>
            <a href={url} target="_blank" rel="noreferrer" className="btn-primary flex-1 text-center">{t('facturas.cobro.abrirEnlace')}</a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Facturas() {
  const { t } = useTranslation()
  const location = useLocation()
  const [facturas, setFacturas] = useState([])
  const [clientes, setClientes] = useState([])
  const [obras, setObras] = useState([])
  const [presupuestos, setPresupuestos] = useState([])
  const [lockedIds, setLockedIds] = useState(new Set())
  const [verifactiEstados, setVerifactiEstados] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editData, setEditData] = useState(null)
  const [fromPresupuesto, setFromPresupuesto] = useState(null)
  const [verData, setVerData] = useState(null)
  const [cobrando, setCobrando] = useState(null)
  const [cobroLink, setCobroLink] = useState(null)

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
    const [{ data: facs }, { data: clis }, { data: obs }, { data: pres }, { data: reg }] = await Promise.all([
      supabase.from('facturas').select('*, clientes(nombre), obras(nombre)').order('fecha', { ascending: false }),
      supabase.from('clientes').select('id, nombre').order('nombre'),
      supabase.from('obras').select('id, nombre, cliente_id').order('nombre'),
      supabase.from('presupuestos').select('id, numero, cliente_id, obra_id, items, iva, descuento, estado, clientes(nombre)').eq('estado', 'aceptado').order('created_at', { ascending: false }),
      supabase.from('registro_facturacion').select('factura_id, verifacti_estado').eq('tipo_registro', 'alta'),
    ])
    setFacturas(facs || [])
    setClientes(clis || [])
    setObras(obs || [])
    setPresupuestos(pres || [])
    setLockedIds(new Set((reg || []).map(r => r.factura_id)))
    setVerifactiEstados(Object.fromEntries((reg || []).map(r => [r.factura_id, r.verifacti_estado])))
    setLoading(false)
  }

  function openNew() { setEditData(null); setFromPresupuesto(null); setShowForm(true) }
  function openEdit(f) { setEditData(f); setFromPresupuesto(null); setShowForm(true) }

  async function cambiarEstado(id, estado) {
    const { error: err } = await supabase.from('facturas').update({ estado }).eq('id', id)
    if (err) { alert(err.message); return }
    load()
  }

  async function cobrarConTarjeta(f) {
    setCobrando(f.id)
    const { data, error: err } = await supabase.functions.invoke('stripe-crear-cobro', { body: { factura_id: f.id } })
    setCobrando(null)
    if (err || data?.error) {
      alert(data?.error || err.message || t('facturas.list.noEnlacePago'))
      return
    }
    setCobroLink({ factura: f, url: data.url })
  }

  async function remove(id, numero) {
    if (lockedIds.has(id)) {
      alert(t('facturas.list.cannotDeleteLocked'))
      return
    }
    if (!confirm(t('facturas.list.confirmDelete', { numero }))) return
    const { error: err } = await supabase.from('facturas').delete().eq('id', id)
    if (err) { alert(err.message); return }
    load()
  }

  async function anular(id, numero) {
    const motivo = prompt(t('facturas.list.anularPrompt', { numero }))
    if (motivo === null) return // cancelado
    const { error: err } = await supabase.rpc('verifactu_anular_factura', { p_factura_id: id, p_motivo: motivo || null })
    if (err) { alert(err.message); return }
    load()
  }

  const filtered = facturas
    .filter(f => !filtroEstado || f.estado === filtroEstado)
    .filter(f => [f.numero, f.clientes?.nombre, f.obras?.nombre].some(v => v?.toLowerCase().includes(search.toLowerCase())))

  const fmt = v => v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
  const facturasValidas = facturas.filter(f => f.estado !== 'anulada')
  const totalFacturado = facturasValidas.reduce((s, f) => s + calculos(f.items || [], f.iva, f.descuento, f.retencion).total, 0)
  const totalCobrado = facturasValidas.filter(f => f.estado === 'pagada').reduce((s, f) => s + calculos(f.items || [], f.iva, f.descuento, f.retencion).total, 0)
  const pendienteCobro = facturasValidas.filter(f => ['enviada', 'vista'].includes(f.estado)).reduce((s, f) => s + calculos(f.items || [], f.iva, f.descuento, f.retencion).total, 0)
  const pagadasCount = facturas.filter(f => f.estado === 'pagada').length
  const circulacionCount = facturas.filter(f => ['enviada', 'vista'].includes(f.estado)).length

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t('facturas.list.title')}</h1>
          <p className="text-sm text-ink-soft mt-0.5">
            {t(facturas.length === 1 ? 'facturas.list.countOne' : 'facturas.list.countOther', { count: facturas.length })}
          </p>
        </div>
        <button onClick={openNew} className="btn-primary">{t('facturas.list.newFactura')}</button>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card border-l-4 border-l-navy">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft mb-1">{t('facturas.list.facturadoLabel')}</div>
          <div className="text-2xl font-bold text-ink">{fmt(totalFacturado)}</div>
          <div className="text-xs text-ink-soft mt-1">{t(facturas.length === 1 ? 'facturas.list.facturasCountOne' : 'facturas.list.facturasCountOther', { count: facturas.length })}</div>
        </div>
        <div className="card border-l-4 border-l-green-500">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft mb-1">{t('facturas.list.cobradoLabel')}</div>
          <div className="text-2xl font-bold text-green-700">{fmt(totalCobrado)}</div>
          <div className="text-xs text-ink-soft mt-1">{t(pagadasCount === 1 ? 'facturas.list.pagadasCountOne' : 'facturas.list.pagadasCountOther', { count: pagadasCount })}</div>
        </div>
        <div className="card border-l-4 border-l-gold">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft mb-1">{t('facturas.list.pendienteLabel')}</div>
          <div className="text-2xl font-bold text-gold-dark">{fmt(pendienteCobro)}</div>
          <div className="text-xs text-ink-soft mt-1">{t(circulacionCount === 1 ? 'facturas.list.circulacionCountOne' : 'facturas.list.circulacionCountOther', { count: circulacionCount })}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button onClick={() => setFiltroEstado('')} className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${!filtroEstado ? 'bg-navy text-white border-navy' : 'border-edge text-ink-soft hover:border-navy hover:text-ink'}`}>
          {t('facturas.list.todas', { count: facturas.length })}
        </button>
        {ESTADOS_META.map(s => {
          const count = facturas.filter(f => f.estado === s.value).length
          return (
            <button key={s.value} onClick={() => setFiltroEstado(filtroEstado === s.value ? '' : s.value)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${filtroEstado === s.value ? 'bg-navy text-white border-navy' : 'border-edge text-ink-soft hover:border-navy hover:text-ink'}`}>
              {t(`facturas.estado.${s.value}`)} ({count})
            </button>
          )
        })}
      </div>

      <div className="mb-5">
        <input className="input max-w-xs" placeholder={t('facturas.list.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="text-ink-soft text-sm py-10 text-center">{t('facturas.list.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-3">📄</div>
          <div className="font-bold text-ink mb-1">{search || filtroEstado ? t('facturas.list.noResultsTitle') : t('facturas.list.noFacturasTitle')}</div>
          {!search && !filtroEstado && <button onClick={openNew} className="btn-primary mt-4">{t('facturas.list.newFactura')}</button>}
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-edge text-ink-soft text-xs uppercase tracking-wide">
                <th className="text-left px-5 py-3">{t('facturas.list.table.numero')}</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">{t('facturas.list.table.cliente')}</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">{t('facturas.list.table.fecha')}</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">{t('facturas.list.table.vencimiento')}</th>
                <th className="text-left px-4 py-3">{t('facturas.list.table.estado')}</th>
                <th className="text-right px-5 py-3">{t('facturas.list.table.total')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {filtered.map(f => {
                const { total } = calculos(f.items || [], f.iva, f.descuento, f.retencion)
                const vencida = f.vencimiento && f.estado !== 'pagada' && new Date(f.vencimiento) < new Date()
                return (
                  <tr key={f.id} className={`hover:bg-page/50 transition-colors ${vencida ? 'bg-red-50/50' : ''}`}>
                    <td className="px-5 py-3.5">
                      <div className={`font-bold text-ink flex items-center gap-1.5 ${f.estado === 'anulada' ? 'line-through opacity-50' : ''}`}>
                        {f.numero}
                        {f.estado === 'anulada' && (
                          <span title={t('facturas.list.anuladaTitle')} className="text-[10px] font-semibold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{t('facturas.list.anuladaBadge')}</span>
                        )}
                        {lockedIds.has(f.id) && (
                          <span title={t('facturas.list.lockedTitle')} className="text-[10px] font-semibold bg-navy text-gold px-1.5 py-0.5 rounded-full">🔒</span>
                        )}
                        {verifactiEstados[f.id] === 'pendiente' && (
                          <span title={t('facturas.list.pendienteAeatTitle')} className="text-[10px]">🕓</span>
                        )}
                        {verifactiEstados[f.id] === 'aceptado' && (
                          <span title={t('facturas.list.aceptadaAeatTitle')} className="text-[10px]">✅</span>
                        )}
                        {(verifactiEstados[f.id] === 'rechazado' || verifactiEstados[f.id] === 'error' || verifactiEstados[f.id] === 'aceptado_con_errores') && (
                          <span title={t('facturas.list.aeatEstadoTitle', { estado: verifactiEstados[f.id] })} className="text-[10px]">⚠️</span>
                        )}
                      </div>
                      {f.obras?.nombre && <div className="text-xs text-ink-soft mt-0.5">{f.obras.nombre}</div>}
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell text-ink">{f.clientes?.nombre || '—'}</td>
                    <td className="px-4 py-3.5 hidden lg:table-cell text-ink-soft">
                      {f.fecha ? new Date(f.fecha).toLocaleDateString('es-ES') : '—'}
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      {f.vencimiento ? (
                        <span className={vencida && f.estado !== 'pagada' ? 'text-red-600 font-semibold' : 'text-ink-soft'}>
                          {new Date(f.vencimiento).toLocaleDateString('es-ES')}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <select value={f.estado} onChange={e => cambiarEstado(f.id, e.target.value)}
                        disabled={f.estado === 'anulada'}
                        className="text-xs font-semibold bg-transparent border-none focus:outline-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
                        onClick={e => e.stopPropagation()}>
                        {ESTADOS_META.filter(s => s.value !== 'anulada' || f.estado === 'anulada').map(s => <option key={s.value} value={s.value}>{t(`facturas.estado.${s.value}`)}</option>)}
                      </select>
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-ink">{fmt(total)}</td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <button onClick={() => setVerData(f)} className="text-navy hover:text-gold-dark text-xs font-semibold mr-4">
                        {t('facturas.list.verFactura')}
                      </button>
                      {f.estado !== 'pagada' && f.estado !== 'anulada' && (
                        <button
                          onClick={() => cobrarConTarjeta(f)}
                          disabled={cobrando === f.id}
                          className="text-green-700 hover:text-green-800 text-xs font-semibold mr-4 disabled:opacity-50"
                        >
                          {cobrando === f.id ? t('facturas.list.cobrando') : t('facturas.list.cobrar')}
                        </button>
                      )}
                      <button onClick={() => openEdit(f)} className="text-gold hover:text-gold-dark text-xs font-semibold mr-4">
                        {lockedIds.has(f.id) ? t('facturas.list.ver') : t('facturas.list.editar')}
                      </button>
                      {lockedIds.has(f.id) ? (
                        f.estado === 'anulada' ? (
                          <span className="text-ink-soft/40 text-xs">{t('facturas.list.anuladaLabel')}</span>
                        ) : (
                          <button
                            onClick={() => anular(f.id, f.numero)}
                            title={t('facturas.list.anularTitle')}
                            className="text-ink-soft/60 hover:text-red-500 text-xs font-semibold"
                          >
                            {t('facturas.list.anularBtn')}
                          </button>
                        )
                      ) : (
                        <button onClick={() => remove(f.id, f.numero)} className="text-ink-soft/40 hover:text-red-500 text-xs">{t('facturas.list.eliminar')}</button>
                      )}
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
          locked={editData ? lockedIds.has(editData.id) : false}
          clientes={clientes}
          obras={obras}
          presupuestos={presupuestos}
          onSave={() => { setShowForm(false); setFromPresupuesto(null); load() }}
          onCancel={() => { setShowForm(false); setFromPresupuesto(null) }}
          initialFromPres={fromPresupuesto}
        />
      )}

      {verData && (
        <FacturaVista
          factura={verData}
          obra={obras.find(o => o.id === verData.obra_id)}
          onClose={() => setVerData(null)}
        />
      )}

      {cobroLink && (
        <CobroModal
          factura={cobroLink.factura}
          url={cobroLink.url}
          onClose={() => setCobroLink(null)}
        />
      )}
    </div>
  )
}
