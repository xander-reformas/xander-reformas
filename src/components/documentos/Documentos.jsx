import { useState, useEffect, useRef } from 'react'
import { supabase, getUID } from '../../lib/supabase'

// ── Plantillas ──────────────────────────────────────────────────────────────
const PLANTILLAS = [
  {
    id: 'contrato-obra',
    titulo: 'Contrato de obra',
    desc: 'Contrato tipo para reforma de vivienda o local. Incluye descripción de trabajos, plazo, forma de pago y garantías.',
    icon: '📝',
    categoria: 'Contratos',
    contenido: `CONTRATO DE EJECUCIÓN DE OBRA
═══════════════════════════════

En Madrid, a __ de __________ de 20__

REUNIDOS
▸ CONTRATISTA: [Tu nombre / empresa], con NIF __________, domicilio en __________
▸ CLIENTE: [Nombre del cliente], con NIF __________, domicilio en __________

EXPONEN que acuerdan el presente contrato de obra bajo las siguientes

CLÁUSULAS

1. OBJETO
El contratista se compromete a realizar los siguientes trabajos en el inmueble sito en [dirección]:
[Descripción detallada de los trabajos según presupuesto nº _____]

2. PRECIO Y FORMA DE PAGO
El precio total acordado es de __________ € (IVA incluido al __%).
  - 30% a la firma del contrato: __________ €
  - 30% al inicio de obra:       __________ €
  - 30% a mitad de obra:        __________ €
  - 10% a la entrega:           __________ €

3. PLAZO DE EJECUCIÓN
Las obras comenzarán el __ de __________ y se estima su finalización para el __ de __________.
El plazo puede verse modificado por causas de fuerza mayor o cambios solicitados por el cliente.

4. MATERIALES
Los materiales se ajustarán a lo especificado en el presupuesto. Cualquier cambio de material requerirá acuerdo escrito entre las partes.

5. EXTRAS Y MODIFICACIONES
Cualquier trabajo no contemplado en el presupuesto inicial deberá ser aprobado por escrito por el cliente antes de su ejecución, con indicación del coste adicional.

6. GARANTÍAS
  - Daños materiales: 1 año
  - Defectos constructivos que afecten a la habitabilidad: 3 años
  - Defectos estructurales: 10 años (si aplica)

7. RESOLUCIÓN DE CONFLICTOS
Las partes se someten a los Juzgados y Tribunales de Madrid para cualquier controversia derivada del presente contrato.

Firmado por duplicado en Madrid, en la fecha arriba indicada.

EL CONTRATISTA                    EL CLIENTE

_______________________          _______________________
[Tu nombre]                      [Nombre cliente]
`,
  },
  {
    id: 'acta-inicio',
    titulo: 'Acta de inicio de obra',
    desc: 'Documento que formaliza el comienzo de los trabajos y el estado del inmueble antes de la reforma.',
    icon: '🔨',
    categoria: 'Contratos',
    contenido: `ACTA DE INICIO DE OBRA
═══════════════════════

Fecha: __ de __________ de 20__
Obra: [Descripción de la obra]
Dirección: [Dirección del inmueble]

PRESENTES:
▸ Por el contratista: [Nombre]
▸ Por el cliente:     [Nombre]

DECLARACIONES

1. ESTADO PREVIO DEL INMUEBLE
Ambas partes reconocen que el inmueble se encuentra en el estado descrito a continuación antes del inicio de las obras:
[Descripción del estado actual: pintura, revestimientos, instalaciones, etc.]

2. INICIO DE TRABAJOS
Se da inicio a los trabajos correspondientes al presupuesto nº _____, firmado el __________.

3. ACCESO A LA PROPIEDAD
El cliente facilita acceso al inmueble en el horario: [lunes a viernes de 8:00 a 18:00 / según acuerdo].
Llaves entregadas: □ Sí  □ No — Número de copias: ___

4. GESTIÓN DE ESCOMBROS
Los escombros generados serán gestionados por el contratista mediante [contenedor / retirada por transportista autorizado].

5. PROTECCIONES
El contratista se compromete a proteger adecuadamente las zonas no afectadas por la obra (suelos, muebles, etc.).

Ambas partes firman el presente acta en señal de conformidad.

EL CONTRATISTA                    EL CLIENTE

_______________________          _______________________
`,
  },
  {
    id: 'acta-fin',
    titulo: 'Acta de fin de obra y conformidad',
    desc: 'Documento de entrega de obra terminada. El cliente firma la conformidad con los trabajos realizados.',
    icon: '✅',
    categoria: 'Contratos',
    contenido: `ACTA DE FIN DE OBRA Y CONFORMIDAD
══════════════════════════════════

Fecha: __ de __________ de 20__
Obra: [Descripción de la obra]
Dirección: [Dirección del inmueble]

PRESENTES:
▸ Por el contratista: [Nombre]
▸ Por el cliente:     [Nombre]

DECLARACIONES

1. TRABAJOS REALIZADOS
El contratista ha ejecutado los trabajos correspondientes al presupuesto nº _____, a saber:
[Descripción de los trabajos realizados]

2. CONFORMIDAD DEL CLIENTE
El cliente declara haber revisado los trabajos y estar conforme con el resultado, salvo los siguientes puntos pendientes de subsanación:

  □ Ninguno — Obra completamente terminada y conforme
  □ Pendientes:
    - ___________________________________
    - ___________________________________

3. ENTREGA DE LLAVES
  □ Se devuelven al cliente ___ copias de llave
  □ No se habían entregado llaves al contratista

4. DOCUMENTACIÓN ENTREGADA
  □ Manual de mantenimiento de instalaciones
  □ Garantías de materiales
  □ Certificado de instalación eléctrica (si aplica)
  □ Otro: _______________

5. PAGO FINAL
Pendiente de pago en el momento de la firma: __________ €
Método de pago acordado: _______________

Ambas partes firman el presente acta en señal de conformidad con lo indicado.

EL CONTRATISTA                    EL CLIENTE

_______________________          _______________________
`,
  },
  {
    id: 'parte-trabajo',
    titulo: 'Parte de trabajo diario',
    desc: 'Registro diario de trabajos realizados en obra. Útil para control interno y justificación ante el cliente.',
    icon: '📋',
    categoria: 'Otros',
    contenido: `PARTE DE TRABAJO DIARIO
═══════════════════════

Fecha: __ / __ / 20__
Obra: [Nombre de la obra]
Dirección: [Dirección]

PERSONAL EN OBRA:
┌─────────────────────┬────────────┬────────────┬────────────┐
│ Nombre              │ Entrada    │ Salida     │ Horas      │
├─────────────────────┼────────────┼────────────┼────────────┤
│                     │            │            │            │
│                     │            │            │            │
│                     │            │            │            │
└─────────────────────┴────────────┴────────────┴────────────┘

TRABAJOS REALIZADOS HOY:
□ _______________________________________________
□ _______________________________________________
□ _______________________________________________

MATERIALES UTILIZADOS / RECIBIDOS:
_______________________________________________
_______________________________________________

INCIDENCIAS / OBSERVACIONES:
_______________________________________________
_______________________________________________

TRABAJOS PREVISTOS PARA MAÑANA:
_______________________________________________
_______________________________________________

Vº Bº Encargado: _______________________
`,
  },
  {
    id: 'presupuesto-extras',
    titulo: 'Presupuesto de trabajos extra',
    desc: 'Para documentar y aprobar trabajos adicionales no contemplados en el presupuesto original.',
    icon: '➕',
    categoria: 'Presupuestos',
    contenido: `PRESUPUESTO DE TRABAJOS ADICIONALES / EXTRAS
══════════════════════════════════════════════

Nº de extra: EXTRA-____
Fecha: __ de __________ de 20__
Obra principal referenciada: [Nº presupuesto o descripción]
Cliente: [Nombre del cliente]
Dirección de la obra: [Dirección]

DESCRIPCIÓN DE LOS TRABAJOS ADICIONALES:

[Descripción detallada de qué ha surgido, por qué no estaba contemplado y qué se va a hacer]

DESGLOSE ECONÓMICO:

┌────────────────────────────────────────┬────────────┬──────────┬────────────┐
│ Concepto                               │ Unidades   │ Precio   │ Subtotal   │
├────────────────────────────────────────┼────────────┼──────────┼────────────┤
│                                        │            │          │            │
│                                        │            │          │            │
│                                        │            │          │            │
└────────────────────────────────────────┴────────────┴──────────┴────────────┘

                                          Base:       __________ €
                                          IVA (10%):  __________ €
                                          TOTAL:      __________ €

APROBACIÓN DEL CLIENTE:
Fecha de aprobación: __ / __ / 20__

El cliente firma su conformidad con la ejecución de los trabajos indicados y su coste:

_______________________
[Nombre del cliente]
`,
  },
  {
    id: 'politica-privacidad',
    titulo: 'Cláusula de privacidad (RGPD)',
    desc: 'Texto de información sobre protección de datos para incluir en presupuestos y contratos.',
    icon: '🔒',
    categoria: 'Contratos',
    contenido: `INFORMACIÓN BÁSICA SOBRE PROTECCIÓN DE DATOS
(Art. 13 RGPD y LOPDGDD)

RESPONSABLE: [Tu nombre completo], NIF: __________, con domicilio en __________, email: __________

FINALIDAD: Gestión de la relación comercial y prestación de servicios de reformas contratados.

LEGITIMACIÓN: Ejecución del contrato (Art. 6.1.b RGPD) y cumplimiento de obligaciones legales.

CONSERVACIÓN: Durante la vigencia de la relación contractual y, posteriormente, durante los plazos legales aplicables (mínimo 5 años para documentación fiscal).

DESTINATARIOS: Los datos no serán cedidos a terceros salvo obligación legal o necesidad para la prestación del servicio (subcontratistas implicados en la obra, gestores administrativos).

DERECHOS: Puede ejercer sus derechos de acceso, rectificación, supresión, limitación, portabilidad y oposición dirigiéndose a la dirección indicada, adjuntando copia de su DNI.

RECLAMACIONES: Tiene derecho a presentar reclamación ante la Agencia Española de Protección de Datos (aepd.es).

Al firmar el presente presupuesto/contrato, el cliente declara haber leído y comprendido esta información.
`,
  },
]

// ── Carpetas de "Mis documentos" ────────────────────────────────────────────
const CARPETAS = [
  { cat: 'Plan de Negocio',       icon: '📊', desc: 'Plan completo con módulos de organización, captación, presupuestos, precios, imagen y herramientas.' },
  { cat: 'Fiscalidad',            icon: '💰', desc: 'Declaraciones de IVA, IRPF, modelos 303, 130, 100 y cualquier documento de la Agencia Tributaria.' },
  { cat: 'SS y Hacienda',         icon: '🏛️', desc: 'Alta en autónomos, recibos de cuota RETA, notificaciones de la Seguridad Social y Hacienda.' },
  { cat: 'Seguros',               icon: '🛡️', desc: 'Pólizas de seguro de responsabilidad civil, seguro de obra y cualquier otra cobertura contratada.' },
  { cat: 'Contratos',             icon: '📝', desc: 'Contratos con clientes, acuerdos con proveedores, subcontratas y cualquier documento firmado.' },
  { cat: 'Licencias de Obra',     icon: '🏗️', desc: 'Permisos municipales, comunicaciones previas, licencias de actividad y documentación urbanística.' },
  { cat: 'Branding',              icon: '🎨', desc: 'Logo, wallpaper corporativo, imagen de marca y materiales de identidad visual.' },
  { cat: 'Subcontratas',          icon: '🤝', desc: 'Contratos y acuerdos con subcontratistas, empresas colaboradoras y autónomos.' },
  { cat: 'Otros Documentos',      icon: '📁', desc: 'Licencias, certificados, permisos y cualquier otro documento del negocio.' },
]

const CARPETAS_FORMACION = [
  { cat: 'Certificados Obligatorios', icon: '📜', desc: 'PRL construcción (obligatorio 60h), habilitaciones legales, carnets y acreditaciones exigidas por ley.' },
  { cat: 'Formación Continua',        icon: '📚', desc: 'Cursos de mejora profesional: pladur, impermeabilización, electricidad, fontanería, gestión, presupuestos.' },
]

const BUCKET = 'documentos-empresa'

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmtSize(bytes) {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileIcon(nombre) {
  if (!nombre) return '📄'
  const ext = nombre.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return '📕'
  if (['doc', 'docx'].includes(ext)) return '📘'
  if (['xls', 'xlsx'].includes(ext)) return '📗'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return '🖼️'
  if (['zip', 'rar', '7z'].includes(ext)) return '🗜️'
  return '📄'
}

function copiarPlantilla(contenido) {
  navigator.clipboard.writeText(contenido).then(() => alert('Plantilla copiada al portapapeles ✓'))
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function Documentos() {
  const [tab, setTab] = useState('mis-docs')
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState({})   // { [cat]: true/false }
  const [storageError, setStorageError] = useState(false)
  const [error, setError] = useState('')
  const [plantillaVista, setPlantillaVista] = useState(null)
  const [search, setSearch] = useState('')
  const fileInputRefs = useRef({})

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('documentos')
      .select('*')
      .order('created_at', { ascending: false })
    if (!err) setDocs(data || [])
    setLoading(false)
  }

  function docsForCat(cat) {
    return docs.filter(d => d.categoria === cat)
  }

  function triggerUpload(cat) {
    const ref = fileInputRefs.current[cat]
    if (!ref) return
    ref.value = ''
    ref.click()
  }

  async function handleUpload(cat, files) {
    if (!files?.length) return
    setUploading(u => ({ ...u, [cat]: true }))
    setError('')
    const uid = await getUID()
    const slug = cat.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

    for (const file of Array.from(files)) {
      const path = `${uid}/${slug}/${Date.now()}_${file.name}`

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: false })

      if (upErr) {
        if (upErr.message?.includes('Bucket not found') || upErr.statusCode === 400) {
          setStorageError(true)
        } else {
          setError(`Error al subir "${file.name}": ${upErr.message}`)
        }
        continue
      }

      const { data: { publicUrl } } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(path)

      await supabase.from('documentos').insert({
        user_id: uid,
        categoria: cat,
        nombre: file.name,
        url: publicUrl,
        storage_path: path,
        file_size: file.size,
        fecha: new Date().toISOString().split('T')[0],
      })
    }

    setUploading(u => ({ ...u, [cat]: false }))
    load()
  }

  async function handleDelete(doc) {
    if (!confirm(`¿Eliminar "${doc.nombre}"?`)) return
    if (doc.storage_path) {
      await supabase.storage.from(BUCKET).remove([doc.storage_path])
    }
    await supabase.from('documentos').delete().eq('id', doc.id)
    load()
  }

  const plantillasFiltradas = PLANTILLAS.filter(p =>
    [p.titulo, p.desc, p.categoria].some(v => v.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="p-6 max-w-5xl">
      {/* Cabecera */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Centro de Documentos</h1>
        <p className="text-sm text-ink-soft mt-0.5">Plantillas profesionales y gestión de archivos</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-edge rounded-xl p-1 w-fit mb-6">
        <button onClick={() => setTab('plantillas')}
          className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${tab === 'plantillas' ? 'bg-surface text-ink shadow-sm' : 'text-ink-soft hover:text-ink'}`}>
          📄 Plantillas ({PLANTILLAS.length})
        </button>
        <button onClick={() => setTab('mis-docs')}
          className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${tab === 'mis-docs' ? 'bg-surface text-ink shadow-sm' : 'text-ink-soft hover:text-ink'}`}>
          📁 Mis documentos {!loading && `(${docs.length})`}
        </button>
      </div>

      {/* Error general */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm flex justify-between items-center">
          {error}
          <button onClick={() => setError('')} className="font-bold ml-4 text-lg leading-none">×</button>
        </div>
      )}

      {/* ── PLANTILLAS ──────────────────────────────────────────────────── */}
      {tab === 'plantillas' && (
        <div>
          <input
            className="input max-w-xs mb-5"
            placeholder="🔍  Buscar plantilla…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="bg-gold/10 border border-gold/30 rounded-xl px-4 py-3 mb-5 text-sm text-ink-soft">
            📋 Plantillas editables para tu día a día. Cópialas, personalízalas y úsalas libremente.
          </div>
          {plantillasFiltradas.length === 0 ? (
            <div className="card text-center py-12">
              <div className="text-4xl mb-2">🔍</div>
              <div className="font-bold text-ink">Sin resultados</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {plantillasFiltradas.map(p => (
                <div key={p.id} className="card hover:shadow-md transition-shadow flex flex-col">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-2xl flex-shrink-0">{p.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-ink">{p.titulo}</div>
                      <span className="text-xs bg-edge text-ink-soft px-2 py-0.5 rounded-full mt-0.5 inline-block">{p.categoria}</span>
                    </div>
                  </div>
                  <p className="text-sm text-ink-soft flex-1 mb-4">{p.desc}</p>
                  <div className="flex gap-2 mt-auto">
                    <button onClick={() => setPlantillaVista(p)} className="btn-secondary text-sm flex-1 py-2">Ver plantilla</button>
                    <button onClick={() => copiarPlantilla(p.contenido)} className="btn-primary text-sm flex-1 py-2">📋 Copiar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MIS DOCUMENTOS ──────────────────────────────────────────────── */}
      {tab === 'mis-docs' && (
        storageError ? (
          /* Aviso de configuración del bucket */
          <div className="card border-2 border-gold/40">
            <div className="flex items-start gap-4">
              <div className="text-3xl">⚙️</div>
              <div className="flex-1">
                <div className="font-bold text-ink mb-2">Paso previo: crear el bucket de almacenamiento</div>
                <p className="text-sm text-ink-soft mb-4">
                  Ve a <strong>Supabase → Storage</strong> y crea un bucket llamado <code className="bg-page px-1.5 py-0.5 rounded font-mono text-xs">documentos-empresa</code>.
                  Márcalo como <strong>Public</strong> y guarda. Luego ejecuta la migración SQL indicada abajo.
                </p>
                <div className="bg-navy text-gold font-mono text-xs px-4 py-3 rounded-xl mb-4 whitespace-pre">
{`-- En Supabase SQL Editor:
-- (archivo: supabase/documentos_v2.sql)

ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS file_size    bigint;`}
                </div>
                <button onClick={() => { setStorageError(false); load() }} className="btn-primary text-sm">
                  Ya está configurado — reintentar
                </button>
              </div>
            </div>
          </div>
        ) : loading ? (
          <div className="text-ink-soft text-sm py-10 text-center">Cargando archivos…</div>
        ) : (
          <div className="space-y-8">

            {/* ── Sección principal ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {CARPETAS.map(c => {
                const archivos = docsForCat(c.cat)
                const isUp = uploading[c.cat]
                return (
                  <div key={c.cat} className="card flex flex-col">
                    {/* File input oculto */}
                    <input
                      type="file"
                      multiple
                      ref={el => { fileInputRefs.current[c.cat] = el }}
                      onChange={e => handleUpload(c.cat, e.target.files)}
                      className="sr-only"
                      accept="*/*"
                    />

                    {/* Cabecera carpeta */}
                    <div className="flex items-start gap-3 mb-2">
                      <span className="text-xl flex-shrink-0">{c.icon}</span>
                      <div>
                        <div className="font-bold text-ink text-sm leading-tight">{c.cat}</div>
                        <div className={`text-xs mt-0.5 font-semibold ${archivos.length ? 'text-gold' : 'text-ink-soft'}`}>
                          {archivos.length
                            ? `${archivos.length} archivo${archivos.length > 1 ? 's' : ''}`
                            : 'Sin archivos'}
                        </div>
                      </div>
                    </div>

                    {/* Descripción */}
                    <p className="text-xs text-ink-soft leading-relaxed mb-3">{c.desc}</p>

                    {/* Lista de archivos */}
                    {archivos.length > 0 && (
                      <div className="space-y-1 mb-3">
                        {archivos.map(f => (
                          <div key={f.id} className="flex items-center gap-2 bg-page rounded-lg px-2 py-1.5">
                            <span className="text-sm flex-shrink-0">{fileIcon(f.nombre)}</span>
                            <span className="text-xs text-ink truncate flex-1 min-w-0">{f.nombre}</span>
                            {f.file_size ? (
                              <span className="text-xs text-ink-soft flex-shrink-0">{fmtSize(f.file_size)}</span>
                            ) : null}
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {f.url && (
                                <a href={f.url} target="_blank" rel="noopener noreferrer"
                                  title="Ver archivo"
                                  className="w-5 h-5 flex items-center justify-center text-ink-soft hover:text-ink transition-colors">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </a>
                              )}
                              <button onClick={() => handleDelete(f)} title="Eliminar"
                                className="w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded flex items-center justify-center text-xs font-bold transition-colors">
                                ×
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Botón subir */}
                    <div className="mt-auto">
                      {archivos.length === 0 ? (
                        <button onClick={() => triggerUpload(c.cat)}
                          disabled={isUp}
                          className="btn-gold w-full text-xs py-2 flex items-center justify-center gap-2 disabled:opacity-60">
                          {isUp
                            ? <><span className="w-3 h-3 border-2 border-navy border-t-transparent rounded-full animate-spin" /> Subiendo…</>
                            : '📎 Subir archivo'}
                        </button>
                      ) : (
                        <button onClick={() => triggerUpload(c.cat)}
                          disabled={isUp}
                          className="w-full text-xs text-ink-soft hover:text-ink font-semibold text-center py-1.5 border border-dashed border-stone/30 rounded-lg hover:border-navy/40 transition-colors disabled:opacity-60">
                          {isUp
                            ? <span className="flex items-center justify-center gap-1"><span className="w-3 h-3 border-2 border-stone border-t-transparent rounded-full animate-spin" /> Subiendo…</span>
                            : '+ Añadir otro'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── Sección Formación y Certificados ── */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xl">🎓</span>
                <h2 className="text-base font-bold text-ink">Formación y Certificados</h2>
                <div className="flex-1 h-px bg-edge" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {CARPETAS_FORMACION.map(c => {
                  const archivos = docsForCat(c.cat)
                  const isUp = uploading[c.cat]
                  return (
                    <div key={c.cat} className="card flex flex-col">
                      <input
                        type="file"
                        multiple
                        ref={el => { fileInputRefs.current[c.cat] = el }}
                        onChange={e => handleUpload(c.cat, e.target.files)}
                        className="hidden"
                        accept="*/*"
                      />

                      {/* Header con botón inline */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-start gap-3">
                          <span className="text-xl flex-shrink-0">{c.icon}</span>
                          <div>
                            <div className="font-bold text-ink text-sm leading-tight">{c.cat}</div>
                            <div className={`text-xs mt-0.5 font-semibold ${archivos.length ? 'text-gold' : 'text-ink-soft'}`}>
                              {archivos.length
                                ? `${archivos.length} certificado${archivos.length > 1 ? 's' : ''}`
                                : 'Sin certificados'}
                            </div>
                          </div>
                        </div>
                        <button onClick={() => triggerUpload(c.cat)}
                          disabled={isUp}
                          className="btn-gold text-xs px-3 py-1 flex-shrink-0 disabled:opacity-60">
                          {isUp ? '…' : '+ Añadir'}
                        </button>
                      </div>

                      <p className="text-xs text-ink-soft leading-relaxed mb-3">{c.desc}</p>

                      {archivos.length > 0 ? (
                        <div className="space-y-1">
                          {archivos.map(f => (
                            <div key={f.id} className="flex items-center gap-2 bg-page rounded-lg px-2 py-1.5">
                              <span className="text-sm flex-shrink-0">{fileIcon(f.nombre)}</span>
                              <span className="text-xs text-ink truncate flex-1 min-w-0">{f.nombre}</span>
                              {f.file_size ? <span className="text-xs text-ink-soft flex-shrink-0">{fmtSize(f.file_size)}</span> : null}
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {f.url && (
                                  <a href={f.url} target="_blank" rel="noopener noreferrer"
                                    className="w-5 h-5 flex items-center justify-center text-ink-soft hover:text-ink transition-colors">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                  </a>
                                )}
                                <button onClick={() => handleDelete(f)}
                                  className="w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded flex items-center justify-center text-xs font-bold transition-colors">
                                  ×
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-ink-soft/40 text-center py-4">
                          Ningún certificado añadido aún
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

          </div>
        )
      )}

      {/* ── Modal ver plantilla ──────────────────────────────────────────── */}
      {plantillaVista && (
        <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-2xl my-4">
            <div className="px-6 py-4 border-b border-edge flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-ink">{plantillaVista.titulo}</h2>
                <span className="text-xs bg-edge text-ink-soft px-2 py-0.5 rounded-full">{plantillaVista.categoria}</span>
              </div>
              <button onClick={() => setPlantillaVista(null)}
                className="text-ink-soft hover:text-ink text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
            </div>
            <div className="p-6">
              <pre className="text-xs text-ink font-mono whitespace-pre-wrap bg-page rounded-xl p-4 max-h-[60vh] overflow-y-auto leading-relaxed">
                {plantillaVista.contenido}
              </pre>
              <div className="flex gap-3 mt-4">
                <button onClick={() => setPlantillaVista(null)} className="btn-secondary flex-1">Cerrar</button>
                <button onClick={() => copiarPlantilla(plantillaVista.contenido)} className="btn-primary flex-1">📋 Copiar al portapapeles</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
