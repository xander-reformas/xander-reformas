import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'
import { supabase, getUID } from '../../lib/supabase'

const IDIOMA_NOMBRE = {
  es: 'español', en: 'English', uk: 'українською', ro: 'română', ar: 'العربية', pt: 'português', zh: '中文',
}

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY
const GROQ_MODEL = 'openai/gpt-oss-20b'
const MAX_HISTORIAL = 20  // mensajes que se envían como contexto a Groq

const SYSTEM_PROMPT = `Eres el asistente de negocio personal de XANDER Reformas, una empresa de reformas interiores en Madrid especializada en clientes de clase media-alta. El propietario es autónomo y te usa para gestionar su día a día.

Puedes ayudar con:
- Consultas sobre su negocio: clientes, obras, presupuestos, facturas y cobros
- Redactar emails, presupuestos, contratos y comunicaciones profesionales
- Calcular precios, márgenes y rentabilidad de obras
- Fiscal: IVA 10% obras residenciales con más de 2 años de antigüedad, IVA 21% locales y obra nueva, IRPF, Modelos 130 y 303 trimestrales
- Normativa en Madrid: obra menor (comunicación previa), obra mayor (licencia urbanística), CTE, REBT
- Estrategias de captación de clientes clase media-alta: Habitissimo, Houzz, Google Business, Instagram
- Gestión de situaciones difíciles con clientes, negociación, reclamación de pagos

DATOS ACTUALES DEL NEGOCIO:
{context}

Responde siempre en {idioma}. Sé conciso y práctico. Cuando hagas listas, usa puntos o pasos numerados. Si no tienes información suficiente para responder con certeza, indícalo claramente y sugiere qué dato necesitas.`

async function obtenerContexto() {
  try {
    const [
      { count: clientes },
      { count: obrasActivas },
      { count: presPendientes },
      { data: facturasPendientes },
      { data: obrasRecientes },
    ] = await Promise.all([
      supabase.from('clientes').select('*', { count: 'exact', head: true }),
      supabase.from('obras').select('*', { count: 'exact', head: true }).eq('estado', 'en_curso'),
      supabase.from('presupuestos').select('*', { count: 'exact', head: true }).in('estado', ['borrador', 'enviado']),
      supabase.from('facturas').select('items, iva, descuento, retencion').in('estado', ['enviada', 'vista']),
      supabase.from('obras').select('nombre, estado, presupuesto, coste_real, fecha_inicio, fecha_fin_prevista').order('created_at', { ascending: false }).limit(5),
    ])

    const pendienteCobro = (facturasPendientes || []).reduce((s, f) => {
      const base = (f.items || []).reduce((a, i) => a + (parseFloat(i.importe) || 0), 0)
      const baseDto = base - base * (f.descuento || 0) / 100
      return s + baseDto + baseDto * (f.iva || 0) / 100 - baseDto * (f.retencion || 0) / 100
    }, 0)

    const obrasTexto = (obrasRecientes || []).map(o =>
      `- ${o.nombre} (${o.estado}) · Presupuesto: ${o.presupuesto ? o.presupuesto.toLocaleString('es-ES') + '€' : 'sin definir'}`
    ).join('\n')

    return `
- Clientes en cartera: ${clientes ?? '?'}
- Obras en curso: ${obrasActivas ?? '?'}
- Presupuestos pendientes de respuesta: ${presPendientes ?? '?'}
- Pendiente de cobro (facturas enviadas): ${pendienteCobro.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
- Obras recientes:
${obrasTexto || '  (ninguna)'}
    `.trim()
  } catch {
    return 'No se pudieron cargar los datos del negocio en este momento.'
  }
}

async function llamarGroq(mensajes, contexto) {
  const idioma = IDIOMA_NOMBRE[i18n.language] || IDIOMA_NOMBRE.es
  const systemPrompt = SYSTEM_PROMPT.replace('{context}', contexto).replace('{idioma}', idioma)

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...mensajes,
      ],
      max_tokens: 1024,
      temperature: 0.6,
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Error ${response.status}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

export default function AgenteChat() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState([])
  const [input, setInput] = useState('')
  const [pensando, setPensando] = useState(false)
  const [setupNeeded, setSetupNeeded] = useState(false)
  const [tablaFalta, setTablaFalta] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // Cargar historial al abrir
  useEffect(() => {
    if (!open) return
    if (!GROQ_API_KEY) { setSetupNeeded(true); return }
    cargarHistorial()
  }, [open])

  // Scroll automático al último mensaje
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, pensando])

  // Foco en input al abrir
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  async function cargarHistorial() {
    const { data, error: err } = await supabase
      .from('chat_mensajes')
      .select('role, content, created_at')
      .order('created_at', { ascending: true })
      .limit(50)

    if (err?.code === '42P01') { setTablaFalta(true); return }

    const historial = data || []
    if (historial.length === 0) {
      setMsgs([{ role: 'assistant', content: t('agenteChat.bienvenida') }])
    } else {
      setMsgs(historial.map(m => ({ role: m.role, content: m.content })))
    }
  }

  async function guardarMensaje(role, content) {
    const user_id = await getUID()
    await supabase.from('chat_mensajes').insert({ role, content, user_id })
  }

  async function enviar() {
    const texto = input.trim()
    if (!texto || pensando) return
    setInput('')
    setError('')

    const nuevoMsg = { role: 'user', content: texto }
    setMsgs(prev => [...prev, nuevoMsg])
    setPensando(true)

    try {
      // Guardar mensaje del usuario
      await guardarMensaje('user', texto)

      // Preparar historial para Groq (últimos N mensajes)
      const historialGroq = [...msgs, nuevoMsg]
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-MAX_HISTORIAL)
        .map(m => ({ role: m.role, content: m.content }))

      // Obtener contexto del negocio
      const contexto = await obtenerContexto()

      // Llamar a Groq
      const respuesta = await llamarGroq(historialGroq, contexto)

      // Guardar respuesta y mostrar
      await guardarMensaje('assistant', respuesta)
      setMsgs(prev => [...prev, { role: 'assistant', content: respuesta }])
    } catch (e) {
      setError(e.message || t('agenteChat.errorConectar'))
    } finally {
      setPensando(false)
    }
  }

  async function nuevaConversacion() {
    if (!confirm(t('agenteChat.confirmBorrarHistorial'))) return
    await supabase.from('chat_mensajes').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    setMsgs([{ role: 'assistant', content: t('agenteChat.conversacionNueva') }])
  }

  // Formato básico de texto con negritas y saltos de línea
  function renderTexto(text) {
    return text.split('\n').map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g)
      return (
        <span key={i}>
          {parts.map((part, j) =>
            part.startsWith('**') && part.endsWith('**')
              ? <strong key={j}>{part.slice(2, -2)}</strong>
              : part
          )}
          {i < text.split('\n').length - 1 && <br />}
        </span>
      )
    })
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-20 right-5 w-96 bg-surface rounded-2xl shadow-2xl border border-edge z-50 flex flex-col overflow-hidden" style={{ height: '520px' }}>
          {/* Header */}
          <div className="bg-navy px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${setupNeeded ? 'bg-red-400' : 'bg-green-400 animate-pulse'}`} />
              <span className="text-white text-sm font-bold">{t('agenteChat.titulo')}</span>
              {!setupNeeded && <span className="text-white/40 text-xs">· Groq AI</span>}
            </div>
            <div className="flex items-center gap-3">
              {!setupNeeded && !tablaFalta && (
                <button onClick={nuevaConversacion} className="text-white/40 hover:text-white/80 text-xs" title={t('agenteChat.limpiarTooltip')}>
                  {t('agenteChat.limpiar')}
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white text-xl leading-none">×</button>
            </div>
          </div>

          {/* Estado: falta configurar API key */}
          {setupNeeded ? (
            <div className="flex-1 p-5 flex flex-col justify-center">
              <div className="text-center mb-4">
                <div className="text-3xl mb-2">🔑</div>
                <div className="font-bold text-ink mb-2">{t('agenteChat.faltaApiKey')}</div>
                <p className="text-xs text-ink-soft mb-4" dangerouslySetInnerHTML={{ __html: t('agenteChat.faltaApiKeyDesc') }} />
              </div>
              <div className="bg-navy text-gold font-mono text-xs px-4 py-3 rounded-xl mb-4 leading-relaxed">
                VITE_GROQ_API_KEY=gsk_xxxxxxxxxxxx
              </div>
              <ol className="text-xs text-ink-soft space-y-1 list-decimal list-inside">
                <li dangerouslySetInnerHTML={{ __html: t('agenteChat.pasoGroq1') }} />
                <li>{t('agenteChat.pasoGroq2')}</li>
                <li>{t('agenteChat.pasoGroq3')}</li>
                <li>{t('agenteChat.pasoGroq4')}</li>
                <li>{t('agenteChat.pasoGroq5')}</li>
              </ol>
            </div>
          ) : tablaFalta ? (
            <div className="flex-1 p-5 flex flex-col justify-center">
              <div className="text-center mb-4">
                <div className="text-3xl mb-2">⚙️</div>
                <div className="font-bold text-ink mb-2">{t('agenteChat.pasoPrevioSupabase')}</div>
                <p className="text-xs text-ink-soft mb-4">{t('agenteChat.ejecutaSql')}</p>
              </div>
              <div className="bg-navy text-gold font-mono text-xs px-4 py-3 rounded-xl">
                supabase/chat_mensajes.sql
              </div>
            </div>
          ) : (
            <>
              {/* Mensajes */}
              <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                {msgs.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {m.role === 'assistant' && (
                      <div className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center text-xs flex-shrink-0 mr-2 mt-0.5">X</div>
                    )}
                    <div className={`text-sm px-3 py-2.5 rounded-2xl max-w-[85%] leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-navy text-white rounded-br-sm'
                        : 'bg-page text-ink rounded-bl-sm'
                    }`}>
                      {renderTexto(m.content)}
                    </div>
                  </div>
                ))}

                {pensando && (
                  <div className="flex justify-start">
                    <div className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center text-xs flex-shrink-0 mr-2 mt-0.5">X</div>
                    <div className="bg-page text-ink text-sm px-4 py-2.5 rounded-2xl rounded-bl-sm flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-stone/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-stone/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-stone/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}

                {error && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mx-1">
                    ⚠️ {error}
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t border-edge flex gap-2 flex-shrink-0">
                <input
                  ref={inputRef}
                  className="flex-1 text-sm border border-edge rounded-xl px-3 py-2 focus:outline-none focus:border-gold resize-none"
                  placeholder={t('agenteChat.placeholder')}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
                  disabled={pensando}
                />
                <button
                  onClick={enviar}
                  disabled={pensando || !input.trim()}
                  className="bg-gold text-navy text-sm font-bold px-4 rounded-xl hover:bg-gold-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  →
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Botón flotante */}
      <button
        onClick={() => setOpen(p => !p)}
        className="fixed bottom-5 right-5 w-13 h-13 bg-gold rounded-full shadow-lg flex items-center justify-center text-navy text-2xl hover:bg-gold-dark transition-all hover:scale-110 z-50"
        style={{ width: 52, height: 52 }}
        title={t('agenteChat.titulo')}
      >
        {open ? '✕' : '💬'}
      </button>
    </>
  )
}
