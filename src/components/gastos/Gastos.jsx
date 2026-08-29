import { useState, useEffect, useRef } from 'react'
import { supabase, getUID } from '../../lib/supabase'

const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY

const CATEGORIAS = [
  'Materiales', 'Mano de obra / Subcontratas', 'Herramientas y equipos',
  'Transporte y combustible', 'Publicidad y marketing', 'Seguros',
  'Gestoría / Asesoría', 'Alquiler', 'Formación', 'Comunicaciones', 'Otros',
]

const IVA_OPTS = [
  { label: '0% — Exento', value: '0' },
  { label: '4% — Superreducido', value: '4' },
  { label: '10% — Reducido (vivienda)', value: '10' },
  { label: '21% — General (local / empresa)', value: '21' },
]

const FORM_EMPTY = {
  fecha: new Date().toISOString().split('T')[0],
  categoria: 'Materiales', descripcion: '',
  importe_base: '', iva_pct: '21', importe: '',
  obra_id: '', proveedor: '', factura_num: '', notas: '',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcTotal(base, pct) {
  const b = parseFloat(base) || 0
  const p = parseFloat(pct) || 0
  return (b * (1 + p / 100))
}
function fmt(v) { return (parseFloat(v) || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) }

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ─── PDF → imagen (primera página) ───────────────────────────────────────────
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib)
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      resolve(window.pdfjsLib)
    }
    s.onerror = reject
    document.head.appendChild(s)
  })
}

async function pdfToCanvas(file) {
  const pdfjs  = await loadPdfJs()
  const buf    = await file.arrayBuffer()
  const pdf    = await pdfjs.getDocument({ data: buf }).promise
  const page   = await pdf.getPage(1)
  const vp     = page.getViewport({ scale: 2 })
  const canvas = document.createElement('canvas')
  canvas.width  = vp.width
  canvas.height = vp.height
  await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise
  const dataUrl = canvas.toDataURL('image/png')
  return { base64: dataUrl.split(',')[1], previewUrl: dataUrl }
}

// ─── Tesseract.js (OCR local en navegador) ────────────────────────────────────
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract)
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'
    s.onload = () => resolve(window.Tesseract)
    s.onerror = reject
    document.head.appendChild(s)
  })
}

async function ocrSource(source) {
  const T = await loadTesseract()
  const worker = await T.createWorker('spa+eng')
  const { data: { text } } = await worker.recognize(source)
  await worker.terminate()
  return text
}

// ─── Groq texto → JSON estructurado ──────────────────────────────────────────
async function textoADatos(textoOcr) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'Eres un asistente que extrae datos estructurados de textos OCR de facturas españolas. Respondes ÚNICAMENTE con JSON válido, sin texto adicional ni bloques de código markdown.',
        },
        {
          role: 'user',
          content: `Extrae los datos de esta factura o ticket. Texto OCR:\n\n${textoOcr}\n\nResponde con este JSON exacto:\n{"fecha":"YYYY-MM-DD o null","descripcion":"descripción breve max 80 chars","importe_base":número o null,"iva_pct":0 o 4 o 10 o 21 o null,"importe_total":número o null,"proveedor":"nombre o null","factura_num":"número o null","categoria":"Materiales o Mano de obra / Subcontratas o Herramientas y equipos o Transporte y combustible o Publicidad y marketing o Seguros o Gestoría / Asesoría o Alquiler o Formación o Comunicaciones o Otros"}`,
        },
      ],
      max_tokens: 400,
      temperature: 0.1,
    }),
  })
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const texto = data.choices?.[0]?.message?.content || ''
  const match = texto.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Sin JSON en respuesta')
  return JSON.parse(match[0])
}

// ─── Pipeline principal OCR ───────────────────────────────────────────────────
async function extraerDatosFactura(file) {
  let ocrSource_arg, previewUrl = null

  if (file.type === 'application/pdf') {
    const res = await pdfToCanvas(file)
    previewUrl = res.previewUrl
    ocrSource_arg = res.previewUrl   // dataURL PNG del canvas
  } else {
    previewUrl = URL.createObjectURL(file)
    ocrSource_arg = file             // Tesseract acepta File directamente
  }

  const textoOcr = await ocrSource(ocrSource_arg)
  if (!textoOcr.trim()) throw new Error('OCR no extrajo texto')
  const datos = await textoADatos(textoOcr)
  return { datos, previewUrl }
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Gastos() {
  const [gastos,      setGastos]      = useState([])
  const [obras,       setObras]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [setupNeeded, setSetupNeeded] = useState(false)
  const [search,      setSearch]      = useState('')
  const [filtroCat,   setFiltroCat]   = useState('')
  const [filtroObra,  setFiltroObra]  = useState('')
  const [mes,         setMes]         = useState('')
  const [showForm,    setShowForm]    = useState(false)
  const [editId,      setEditId]      = useState(null)
  const [form,        setForm]        = useState(FORM_EMPTY)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  // OCR
  const [imgPreview, setImgPreview] = useState(null)
  const [leyendo,    setLeyendo]    = useState(false)
  const [ocrMsg,     setOcrMsg]     = useState('')
  const [dragging,   setDragging]   = useState(false)
  const [lightbox,   setLightbox]   = useState(false)
  const fileRef = useRef()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: gts, error: gErr }, { data: obs }] = await Promise.all([
      supabase.from('gastos').select('*, obras(nombre)').order('fecha', { ascending: false }),
      supabase.from('obras').select('id, nombre').order('nombre'),
    ])
    if (gErr?.code === '42P01') { setSetupNeeded(true); setLoading(false); return }
    setGastos(gts || [])
    setObras(obs || [])
    setLoading(false)
  }

  function openNew()  { setEditId(null); setForm(FORM_EMPTY); setError(''); resetOcr(); setShowForm(true) }
  function openEdit(g) {
    setEditId(g.id)
    setForm({
      fecha: g.fecha || '', categoria: g.categoria || 'Materiales',
      descripcion: g.descripcion || '',
      importe_base: g.importe_base?.toString() || '',
      iva_pct: g.iva_pct?.toString() || '21',
      importe: g.importe?.toString() || '',
      obra_id: g.obra_id || '', proveedor: g.proveedor || '',
      factura_num: g.factura_num || '', notas: g.notas || '',
    })
    resetOcr(); setError(''); setShowForm(true)
  }
  function resetOcr() { setImgPreview(null); setOcrMsg('') }

  function setF(f, v) {
    setForm(prev => {
      const next = { ...prev, [f]: v }
      // Recalcular total cuando cambia base o IVA
      if (f === 'importe_base' || f === 'iva_pct') {
        const base = f === 'importe_base' ? v : prev.importe_base
        const pct  = f === 'iva_pct'      ? v : prev.iva_pct
        next.importe = calcTotal(base, pct).toFixed(2)
      }
      return next
    })
  }

  // ── OCR ──────────────────────────────────────────────────────────────────
  async function procesarArchivo(file) {
    const esPdf = file.type === 'application/pdf'
    const esImg = file.type.startsWith('image/')
    if (!esPdf && !esImg) { setOcrMsg('⚠️ Solo imágenes o PDF'); return }

    if (esImg) setImgPreview(URL.createObjectURL(file))
    else setImgPreview(null)

    setLeyendo(true)
    setOcrMsg(esPdf ? '📄 Leyendo PDF… (puede tardar unos segundos)' : '🔍 Leyendo factura…')

    try {
      const { datos, previewUrl } = await extraerDatosFactura(file)
      if (previewUrl) setImgPreview(previewUrl)

      // Determinar importe_base e iva_pct
      let base = datos.importe_base != null ? datos.importe_base.toString() : ''
      let pct  = datos.iva_pct      != null ? datos.iva_pct.toString() : '21'
      let total = ''

      if (base) {
        total = calcTotal(base, pct).toFixed(2)
      } else if (datos.importe_total != null) {
        // Solo tenemos el total; lo guardamos directamente
        total = datos.importe_total.toString()
      }

      setForm(prev => ({
        ...prev,
        fecha:       datos.fecha       || prev.fecha,
        descripcion: datos.descripcion || prev.descripcion,
        importe_base: base || prev.importe_base,
        iva_pct:     pct,
        importe:     total || prev.importe,
        proveedor:   datos.proveedor   || prev.proveedor,
        factura_num: datos.factura_num || prev.factura_num,
        categoria:   CATEGORIAS.includes(datos.categoria) ? datos.categoria : prev.categoria,
      }))
      setOcrMsg('✅ Datos extraídos. Revisa y ajusta si es necesario.')
    } catch (err) {
      console.error('[OCR]', err)
      setOcrMsg('⚠️ No se pudo leer automáticamente. Rellena los campos manualmente.')
    } finally {
      setLeyendo(false)
    }
  }

  function onFileChange(e) { const f = e.target.files?.[0]; if (f) procesarArchivo(f) }
  function onDrop(e) { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) procesarArchivo(f) }

  // ── Guardar ───────────────────────────────────────────────────────────────
  async function save(e) {
    e.preventDefault(); setSaving(true); setError('')
    const user_id = await getUID()
    const base    = parseFloat(form.importe_base) || 0
    const pct     = parseFloat(form.iva_pct) || 0
    const total   = parseFloat(form.importe) || calcTotal(base, pct)

    const payload = {
      user_id, fecha: form.fecha, categoria: form.categoria,
      descripcion: form.descripcion,
      importe_base: base, iva_pct: pct, importe: total,
      obra_id: form.obra_id || null, proveedor: form.proveedor || null,
      factura_num: form.factura_num || null, notas: form.notas || null,
    }
    const { error: err } = editId
      ? await supabase.from('gastos').update(payload).eq('id', editId)
      : await supabase.from('gastos').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    setShowForm(false); load()
  }

  async function remove(id, desc) {
    if (!confirm(`¿Eliminar "${desc}"?`)) return
    await supabase.from('gastos').delete().eq('id', id)
    load()
  }

  const filtrados = gastos
    .filter(g => !filtroCat  || g.categoria === filtroCat)
    .filter(g => !filtroObra || g.obra_id === filtroObra)
    .filter(g => !mes        || g.fecha?.startsWith(mes))
    .filter(g => [g.descripcion, g.proveedor, g.categoria, g.factura_num]
      .some(v => v?.toLowerCase().includes(search.toLowerCase())))

  const totalFiltrado = filtrados.reduce((s, g) => s + parseFloat(g.importe || 0), 0)
  const porCategoria  = gastos.reduce((acc, g) => {
    acc[g.categoria] = (acc[g.categoria] || 0) + parseFloat(g.importe || 0)
    return acc
  }, {})
  const catOrdenadas = Object.entries(porCategoria).sort(([, a], [, b]) => b - a)
  const totalGeneral  = gastos.reduce((s, g) => s + parseFloat(g.importe || 0), 0)

  // Calcular preview del desglose IVA en el formulario
  const baseN   = parseFloat(form.importe_base) || 0
  const pctN    = parseFloat(form.iva_pct) || 0
  const ivaN    = baseN * pctN / 100
  const totalN  = baseN + ivaN

  // ── Setup ──────────────────────────────────────────────────────────────────
  if (setupNeeded) return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-ink mb-6">Gastos</h1>
      <div className="card border-gold border-2">
        <div className="flex items-start gap-4">
          <div className="text-3xl">⚙️</div>
          <div>
            <div className="font-bold text-ink mb-2">Paso previo: crear tabla en Supabase</div>
            <p className="text-sm text-ink-soft mb-3">Ve a <strong>Supabase → SQL Editor</strong> y ejecuta:</p>
            <div className="bg-navy text-gold font-mono text-sm px-4 py-3 rounded-xl mb-3">App/XANDER-SaaS/supabase/gastos.sql</div>
            <p className="text-sm text-ink-soft">Si la tabla ya existía, ejecuta las 2 líneas ALTER TABLE del final del archivo para añadir las columnas de IVA.</p>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Gastos</h1>
          <p className="text-sm text-ink-soft mt-0.5">{gastos.length} gasto{gastos.length !== 1 ? 's' : ''} · Total: {fmt(totalGeneral)}</p>
        </div>
        <button onClick={openNew} className="btn-primary">+ Nuevo gasto</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Resumen categorías */}
        <div className="card lg:col-span-1">
          <div className="text-xs font-bold uppercase tracking-widest text-ink-soft mb-4">Por categoría</div>
          {catOrdenadas.length === 0 ? (
            <div className="text-sm text-ink-soft text-center py-6">Sin datos aún</div>
          ) : (
            <div className="space-y-2.5">
              {catOrdenadas.slice(0, 7).map(([cat, val]) => {
                const pct = totalGeneral > 0 ? (val / totalGeneral) * 100 : 0
                return (
                  <div key={cat}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-ink-soft truncate max-w-[65%]">{cat}</span>
                      <span className="font-semibold text-ink">{fmt(val)}</span>
                    </div>
                    <div className="h-1.5 bg-edge rounded-full">
                      <div className="h-1.5 bg-gold rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Filtros y tabla */}
        <div className="lg:col-span-2">
          <div className="flex flex-wrap gap-2 mb-4">
            <input className="input flex-1 min-w-[160px]" placeholder="🔍  Buscar…" value={search} onChange={e => setSearch(e.target.value)} />
            <select className="input w-auto" value={filtroCat} onChange={e => setFiltroCat(e.target.value)}>
              <option value="">Todas las categorías</option>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="input w-auto" value={filtroObra} onChange={e => setFiltroObra(e.target.value)}>
              <option value="">Todas las obras</option>
              {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>
            <input className="input w-auto" type="month" value={mes} onChange={e => setMes(e.target.value)} />
          </div>

          {(search || filtroCat || filtroObra || mes) && (
            <div className="flex items-center justify-between bg-gold/10 border border-gold/30 rounded-xl px-4 py-2.5 mb-3 text-sm">
              <span className="text-ink-soft">{filtrados.length} resultado{filtrados.length !== 1 ? 's' : ''}</span>
              <span className="font-bold text-ink">{fmt(totalFiltrado)}</span>
            </div>
          )}

          {loading ? (
            <div className="text-ink-soft text-sm py-8 text-center">Cargando…</div>
          ) : filtrados.length === 0 ? (
            <div className="card text-center py-12">
              <div className="text-4xl mb-2">💸</div>
              <div className="font-bold text-ink mb-1">{search || filtroCat || filtroObra || mes ? 'Sin resultados' : 'Sin gastos registrados'}</div>
              {!search && !filtroCat && !filtroObra && !mes && (
                <button onClick={openNew} className="btn-primary mt-4">+ Añadir gasto</button>
              )}
            </div>
          ) : (
            <div className="card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-edge text-ink-soft text-xs uppercase tracking-wide">
                    <th className="text-left px-4 py-2.5">Descripción</th>
                    <th className="text-left px-3 py-2.5 hidden md:table-cell">Categoría</th>
                    <th className="text-left px-3 py-2.5 hidden lg:table-cell">Fecha</th>
                    <th className="text-right px-3 py-2.5 hidden lg:table-cell">Base</th>
                    <th className="text-center px-2 py-2.5 hidden lg:table-cell">IVA</th>
                    <th className="text-right px-4 py-2.5">Total</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-edge">
                  {filtrados.map(g => (
                    <tr key={g.id} className="hover:bg-page/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink">{g.descripcion}</div>
                        {g.proveedor && <div className="text-xs text-ink-soft mt-0.5">{g.proveedor}</div>}
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell">
                        <span className="text-xs bg-edge text-ink-soft px-2 py-0.5 rounded-full">{g.categoria}</span>
                      </td>
                      <td className="px-3 py-3 hidden lg:table-cell text-ink-soft text-xs">
                        {g.fecha ? new Date(g.fecha + 'T12:00:00').toLocaleDateString('es-ES') : '—'}
                      </td>
                      <td className="px-3 py-3 hidden lg:table-cell text-right text-ink-soft text-xs">
                        {g.importe_base ? fmt(g.importe_base) : '—'}
                      </td>
                      <td className="px-2 py-3 hidden lg:table-cell text-center text-xs text-ink-soft">
                        {g.iva_pct != null ? `${g.iva_pct}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-ink">{fmt(g.importe)}</td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <button onClick={() => openEdit(g)} className="text-gold hover:text-gold-dark text-xs font-semibold mr-3">Editar</button>
                        <button onClick={() => remove(g.id, g.descripcion)} className="text-ink-soft/40 hover:text-red-500 text-xs">×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-edge border-t-2 border-page">
                    <td colSpan="5" className="px-4 py-2.5 text-xs font-bold text-ink-soft uppercase tracking-wide">
                      Total ({filtrados.length})
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-ink">{fmt(totalFiltrado)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Lightbox factura ────────────────────────────────────────────────── */}
      {lightbox && imgPreview && (
        <div
          className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4"
          onClick={() => setLightbox(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={e => e.stopPropagation()}>
            <img
              src={imgPreview}
              alt="Factura ampliada"
              className="w-full h-full object-contain rounded-xl shadow-2xl"
              style={{ maxHeight: '85vh' }}
            />
            <button
              onClick={() => setLightbox(false)}
              className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white rounded-full w-9 h-9 flex items-center justify-center text-xl font-bold transition-colors"
            >×</button>
          </div>
        </div>
      )}

      {/* ── Modal ───────────────────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[94vh] flex flex-col">
            <div className="px-6 py-4 border-b border-edge flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-bold text-ink">{editId ? 'Editar gasto' : 'Nuevo gasto'}</h2>
              <button onClick={() => setShowForm(false)} className="text-ink-soft hover:text-ink text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
            </div>

            <form onSubmit={save} className="p-6 space-y-4 overflow-y-auto">

              {/* ── Zona carga ── */}
              <div>
                <label className="label">📎 Foto de factura / ticket o PDF (auto-rellena los campos)</label>
                <div
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className={`relative border-2 border-dashed rounded-xl cursor-pointer transition-colors overflow-hidden
                    ${dragging ? 'border-gold bg-gold/10' : 'border-edge hover:border-gold hover:bg-gold/5'}`}
                >
                  {imgPreview ? (
                    <div className="flex items-center gap-4 p-3">
                      {/* Miniatura con lupa */}
                      <div className="relative flex-shrink-0 group">
                        <img src={imgPreview} alt="Factura" className="h-20 w-20 object-cover rounded-lg border border-edge" />
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setLightbox(true) }}
                          className="absolute inset-0 flex items-center justify-center bg-navy/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                          title="Ampliar factura"
                        >
                          <span className="text-white text-xl">🔍</span>
                        </button>
                      </div>
                      <div className="flex-1 min-w-0">
                        {leyendo ? (
                          <div className="flex items-center gap-2 text-sm text-ink">
                            <div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                            Analizando con IA…
                          </div>
                        ) : (
                          <p className={`text-xs leading-relaxed ${ocrMsg.startsWith('✅') ? 'text-green-700' : 'text-orange-600'}`}>{ocrMsg}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1">
                          <button type="button" onClick={e => { e.stopPropagation(); setLightbox(true) }}
                            className="text-xs text-gold hover:text-gold-dark font-semibold">🔍 Ampliar</button>
                          <button type="button" onClick={e => { e.stopPropagation(); resetOcr(); fileRef.current.value = '' }}
                            className="text-xs text-ink-soft hover:text-red-500">Cambiar archivo</button>
                        </div>
                      </div>
                    </div>
                  ) : leyendo ? (
                    <div className="py-5 flex items-center justify-center gap-3">
                      <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-ink-soft">{ocrMsg}</span>
                    </div>
                  ) : (
                    <div className="py-6 text-center">
                      <div className="text-3xl mb-1">📄</div>
                      <div className="text-sm text-ink-soft">Arrastra aquí o haz clic para subir</div>
                      <div className="text-xs text-ink-soft/60 mt-0.5">JPG, PNG, WEBP, PDF · La IA extrae los datos automáticamente</div>
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*,.pdf,application/pdf" className="sr-only" onChange={onFileChange} />
              </div>

              {/* ── Campos ── */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Fecha *</label>
                  <input className="input" type="date" value={form.fecha} onChange={e => setF('fecha', e.target.value)} required />
                </div>
                <div>
                  <label className="label">Categoría *</label>
                  <select className="input" value={form.categoria} onChange={e => setF('categoria', e.target.value)}>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Descripción / Concepto *</label>
                <input className="input" value={form.descripcion} onChange={e => setF('descripcion', e.target.value)} required placeholder="¿Qué se compró?" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Importe base (sin IVA) *</label>
                  <input className="input" type="number" min="0" step="0.01" value={form.importe_base}
                    onChange={e => setF('importe_base', e.target.value)} required placeholder="0.00" />
                </div>
                <div>
                  <label className="label">IVA %</label>
                  <select className="input" value={form.iva_pct} onChange={e => setF('iva_pct', e.target.value)}>
                    {IVA_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Desglose BASE / IVA / TOTAL */}
              <div className="grid grid-cols-3 gap-2 bg-navy rounded-xl overflow-hidden text-center text-xs">
                <div className="py-3">
                  <div className="text-ink-soft/60 uppercase tracking-widest mb-1">Base</div>
                  <div className="font-bold text-white">{fmt(baseN)}</div>
                </div>
                <div className="py-3 border-x border-white/10">
                  <div className="text-ink-soft/60 uppercase tracking-widest mb-1">IVA {pctN}%</div>
                  <div className="font-bold text-white">{fmt(ivaN)}</div>
                </div>
                <div className="py-3">
                  <div className="text-gold uppercase tracking-widest mb-1 font-semibold">Total</div>
                  <div className="font-bold text-gold text-sm">{fmt(totalN)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Proveedor</label>
                  <input className="input" value={form.proveedor} onChange={e => setF('proveedor', e.target.value)} placeholder="Leroy Merlin, etc." />
                </div>
                <div>
                  <label className="label">Nº factura / ticket</label>
                  <input className="input" value={form.factura_num} onChange={e => setF('factura_num', e.target.value)} />
                </div>
              </div>

              <div>
                <label className="label">Obra vinculada</label>
                <select className="input" value={form.obra_id} onChange={e => setF('obra_id', e.target.value)}>
                  <option value="">Sin obra</option>
                  {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                </select>
              </div>

              <div>
                <label className="label">Notas</label>
                <textarea className="input resize-none h-14 text-sm" value={form.notas} onChange={e => setF('notas', e.target.value)} />
              </div>

              {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={saving || leyendo} className="btn-primary flex-1">
                  {saving ? 'Guardando…' : 'Guardar gasto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
