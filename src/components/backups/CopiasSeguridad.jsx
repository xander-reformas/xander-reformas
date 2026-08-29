import { useState, useEffect, useRef } from 'react'
import { supabase, getUID } from '../../lib/supabase'

const BUCKET = 'backups'

// Tablas que se incluyen en la copia, en el orden seguro para restaurarlas
// (primero las que no dependen de nada, luego las que enlazan con ellas).
const TABLAS = [
  { key: 'clientes',           label: 'Clientes' },
  { key: 'empleados',          label: 'Empleados' },
  { key: 'obras',              label: 'Obras' },
  { key: 'tarifas',            label: 'Tarifas y precios', omitir: ['precio_cliente'] },
  { key: 'calendario_notas',   label: 'Notas de calendario' },
  { key: 'calendario_eventos', label: 'Eventos de calendario' },
  { key: 'presupuestos',       label: 'Presupuestos' },
  { key: 'facturas',           label: 'Facturas' },
  { key: 'gastos',             label: 'Gastos' },
  { key: 'documentos',         label: 'Documentos (solo la ficha, no el archivo)' },
  { key: 'partes_trabajo',     label: 'Partes de trabajo' },
  { key: 'nominas',            label: 'Nóminas' },
  { key: 'obra_empleados',     label: 'Equipo asignado a obras' },
]

function fmtSize(bytes) {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmtFecha(iso) {
  return new Date(iso).toLocaleString('es-ES', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function recopilarDatos(uid) {
  const simples = TABLAS.filter(t => t.key !== 'obra_empleados')
  const resultados = await Promise.all(
    simples.map(t => supabase.from(t.key).select('*').eq('user_id', uid))
  )
  const data = {}
  simples.forEach((t, i) => { data[t.key] = resultados[i].data || [] })

  // obra_empleados no tiene user_id propio: se filtra por las obras del usuario
  const obraIds = (data.obras || []).map(o => o.id)
  if (obraIds.length) {
    const { data: oe } = await supabase.from('obra_empleados').select('*').in('obra_id', obraIds)
    data.obra_empleados = oe || []
  } else {
    data.obra_empleados = []
  }

  return data
}

function descargarJSON(obj, nombre) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function CopiasSeguridad() {
  const [uid, setUid] = useState(null)
  const [copias, setCopias] = useState([])
  const [loading, setLoading] = useState(true)
  const [creando, setCreando] = useState(false)
  const [mensaje, setMensaje] = useState(null) // { tipo: 'ok'|'error', texto }
  const [pendiente, setPendiente] = useState(null) // { origen: 'storage'|'archivo', backup, nombre }
  const [restaurando, setRestaurando] = useState(false)
  const [resumenRestore, setResumenRestore] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => { init() }, [])

  async function init() {
    const id = await getUID()
    setUid(id)
    await listar(id)
  }

  async function listar(id) {
    setLoading(true)
    const { data, error } = await supabase.storage.from(BUCKET).list(id, {
      sortBy: { column: 'created_at', order: 'desc' },
    })
    if (error) {
      setMensaje({ tipo: 'error', texto: `No se pudo acceder al almacén de copias: ${error.message}` })
      setCopias([])
    } else {
      setCopias(data || [])
    }
    setLoading(false)
  }

  async function crearCopia() {
    setCreando(true)
    setMensaje(null)
    try {
      const id = uid || await getUID()
      const data = await recopilarDatos(id)
      const backup = {
        version: 1,
        app: 'XANDER Gestión',
        creado: new Date().toISOString(),
        user_id: id,
        data,
      }
      const nombreArchivo = `manual-${Date.now()}.json`
      const path = `${id}/${nombreArchivo}`

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, new Blob([JSON.stringify(backup)], { type: 'application/json' }), { upsert: false })

      if (upErr) {
        setMensaje({ tipo: 'error', texto: `No se pudo guardar la copia en tu cuenta: ${upErr.message}` })
      } else {
        setMensaje({ tipo: 'ok', texto: 'Copia de seguridad creada y guardada en tu cuenta.' })
        await listar(id)
      }

      // Además, siempre se descarga una copia local por si acaso
      descargarJSON(backup, `xander-backup-${new Date().toISOString().split('T')[0]}.json`)
    } catch (err) {
      setMensaje({ tipo: 'error', texto: `Error al crear la copia: ${err.message}` })
    }
    setCreando(false)
  }

  async function descargar(nombre) {
    const id = uid || await getUID()
    const { data, error } = await supabase.storage.from(BUCKET).download(`${id}/${nombre}`)
    if (error) {
      setMensaje({ tipo: 'error', texto: `No se pudo descargar: ${error.message}` })
      return
    }
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = nombre
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  async function eliminar(nombre) {
    if (!confirm(`¿Eliminar la copia "${nombre}"? Esta acción no se puede deshacer.`)) return
    const id = uid || await getUID()
    await supabase.storage.from(BUCKET).remove([`${id}/${nombre}`])
    await listar(id)
  }

  async function prepararRestauracionDesdeStorage(nombre) {
    const id = uid || await getUID()
    setMensaje(null)
    const { data, error } = await supabase.storage.from(BUCKET).download(`${id}/${nombre}`)
    if (error) {
      setMensaje({ tipo: 'error', texto: `No se pudo leer la copia: ${error.message}` })
      return
    }
    try {
      const texto = await data.text()
      const backup = JSON.parse(texto)
      setPendiente({ origen: 'storage', backup, nombre })
    } catch {
      setMensaje({ tipo: 'error', texto: 'El archivo de copia está dañado o no es válido.' })
    }
  }

  function handleArchivoSeleccionado(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setMensaje(null)
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const backup = JSON.parse(reader.result)
        setPendiente({ origen: 'archivo', backup, nombre: file.name })
      } catch {
        setMensaje({ tipo: 'error', texto: 'El archivo seleccionado no es una copia de seguridad válida (JSON).' })
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  async function confirmarRestauracion() {
    if (!pendiente?.backup?.data) return
    setRestaurando(true)
    setResumenRestore(null)
    const id = uid || await getUID()
    const backup = pendiente.backup
    const resumen = []

    for (const t of TABLAS) {
      const filas = backup.data[t.key]
      if (!Array.isArray(filas) || filas.length === 0) {
        resumen.push({ tabla: t.label, restauradas: 0, error: null })
        continue
      }

      // Fuerza el user_id actual y quita columnas generadas/no insertables
      const limpias = filas.map(f => {
        const copia = { ...f, user_id: f.user_id ?? id }
        ;(t.omitir || []).forEach(col => delete copia[col])
        return copia
      })

      let restauradas = 0
      let errorTabla = null
      for (const lote of chunk(limpias, 300)) {
        const { error } = await supabase
          .from(t.key)
          .upsert(lote, { onConflict: 'id' })
        if (error) { errorTabla = error.message; break }
        restauradas += lote.length
      }
      resumen.push({ tabla: t.label, restauradas, error: errorTabla })
    }

    setResumenRestore(resumen)
    setRestaurando(false)
    setPendiente(null)
  }

  const totalFilas = pendiente
    ? TABLAS.reduce((acc, t) => acc + (pendiente.backup?.data?.[t.key]?.length || 0), 0)
    : 0

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-ink">Copias de seguridad</h1>
        <p className="text-sm text-ink-soft mt-0.5">
          Guarda una foto de todos tus datos de trabajo (clientes, obras, presupuestos, facturas,
          cobros, gastos, empleados...) y recupérala si algo se borra o se estropea por error.
        </p>
      </div>

      {mensaje && (
        <div className={`rounded-lg px-4 py-3 text-sm ${
          mensaje.tipo === 'ok'
            ? 'bg-green-100 text-green-800'
            : 'bg-red-100 text-red-700'
        }`}>
          {mensaje.texto}
        </div>
      )}

      {/* Crear copia */}
      <div className="card">
        <h2 className="font-semibold text-ink mb-2">Crear una copia ahora</h2>
        <p className="text-xs text-ink-soft mb-4">
          Se guarda en tu cuenta (para poder restaurarla desde aquí cuando quieras) y además se
          descarga una copia a tu ordenador, por si prefieres guardarla tú mismo en otro sitio.
        </p>
        <button onClick={crearCopia} disabled={creando} className="btn-primary">
          {creando ? 'Creando copia...' : '💾 Crear copia de seguridad ahora'}
        </button>
      </div>

      {/* Restaurar desde archivo */}
      <div className="card">
        <h2 className="font-semibold text-ink mb-2">Restaurar desde un archivo</h2>
        <p className="text-xs text-ink-soft mb-4">
          Si guardaste una copia descargada anteriormente, súbela aquí para recuperar esos datos.
        </p>
        <input ref={fileInputRef} type="file" accept="application/json" onChange={handleArchivoSeleccionado} className="sr-only" />
        <button onClick={() => fileInputRef.current?.click()} className="btn-secondary">
          📤 Subir archivo de copia (.json)
        </button>
      </div>

      {/* Listado de copias guardadas */}
      <div className="card">
        <h2 className="font-semibold text-ink mb-4">Tus copias guardadas</h2>
        {loading ? (
          <p className="text-sm text-ink-soft">Cargando...</p>
        ) : copias.length === 0 ? (
          <p className="text-sm text-ink-soft">
            Todavía no tienes ninguna copia guardada. Crea la primera arriba.
          </p>
        ) : (
          <div className="space-y-2">
            {copias.map(c => (
              <div key={c.name} className="flex items-center justify-between text-sm border-b border-edge py-2.5 last:border-0">
                <div>
                  <div className="text-ink font-medium">
                    {c.name.startsWith('auto-') ? '🔄 Copia automática' : '💾 Copia manual'}
                  </div>
                  <div className="text-xs text-ink-soft mt-0.5">
                    {fmtFecha(c.created_at)} · {fmtSize(c.metadata?.size)}
                  </div>
                </div>
                <div className="flex gap-3 flex-shrink-0">
                  <button onClick={() => prepararRestauracionDesdeStorage(c.name)} className="text-xs text-gold font-medium hover:underline">
                    Restaurar
                  </button>
                  <button onClick={() => descargar(c.name)} className="text-xs text-ink-soft hover:text-ink">
                    Descargar
                  </button>
                  <button onClick={() => eliminar(c.name)} className="text-xs text-ink-soft hover:text-red-600">
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {resumenRestore && (
        <div className="card">
          <h2 className="font-semibold text-ink mb-3">Resultado de la restauración</h2>
          <div className="space-y-1.5">
            {resumenRestore.map(r => (
              <div key={r.tabla} className="flex items-center justify-between text-sm">
                <span className="text-ink-soft">{r.tabla}</span>
                {r.error
                  ? <span className="text-red-600 text-xs">Error: {r.error}</span>
                  : <span className="text-ink">{r.restauradas} fila{r.restauradas === 1 ? '' : 's'}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de confirmación */}
      {pendiente && (
        <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[94vh] flex flex-col">
            <div className="px-6 py-4 border-b border-edge flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-bold text-ink">Confirmar restauración</h2>
              <button onClick={() => setPendiente(null)} className="text-ink-soft hover:text-ink text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <p className="text-sm text-ink">
                Vas a restaurar <strong>{pendiente.nombre}</strong> ({totalFilas} registros en total).
              </p>
              <div className="bg-surface-alt rounded-lg px-4 py-3 text-xs text-ink-soft space-y-1">
                <p>• Esto <strong>recupera/actualiza</strong> los registros de la copia — no borra nada que hayas creado después.</p>
                <p>• Si un registro de la copia ya no existe (lo borraste), se vuelve a crear con sus datos originales.</p>
                <p>• Los documentos solo restauran su ficha (nombre, categoría, enlace); si el archivo también se borró del almacén, el enlace no funcionará.</p>
              </div>
              <button onClick={confirmarRestauracion} disabled={restaurando} className="btn-primary w-full">
                {restaurando ? 'Restaurando...' : 'Sí, restaurar esta copia'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
