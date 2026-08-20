import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import ThemeToggle from '../dashboard/ThemeToggle'
import { PRECIO_PRO } from '../../hooks/usePlan'

const WHATSAPP_NUMERO = '34640689121'
const WHATSAPP_MENSAJE = encodeURIComponent('Hola, he visto XANDER Gestión y me gustaría saber más.')

const FUNCIONES = [
  { icon: '📋', title: 'Presupuestos', desc: 'Crea presupuestos profesionales por partidas en minutos, listos para enviar.' },
  { icon: '🧾', title: 'Facturación', desc: 'Facturas con Verifactu integrado — hash encadenado, QR y envío a AEAT.' },
  { icon: '🏗️', title: 'Obras', desc: 'Seguimiento de obra con fotos, etapas, equipo y partes de trabajo.' },
  { icon: '💳', title: 'Cobros con tarjeta', desc: 'Tus clientes pagan la factura online. El dinero llega directo a tu cuenta.' },
  { icon: '💶', title: 'Gastos y resultados', desc: 'Registra gastos por obra y ve la rentabilidad real de cada proyecto.' },
  { icon: '📊', title: 'Fiscal', desc: 'Documento de conciliación listo para tu gestoría antes de cada trimestre.' },
  { icon: '👷', title: 'Empleados y nóminas', desc: 'Partes de horas por obra y generador de recibos de nómina.' },
  { icon: '📱', title: 'App instalable', desc: 'Instálala en el móvil o el ordenador, funciona incluso sin conexión.' },
]

const PLANES = [
  {
    nombre: 'Prueba gratuita',
    precio: '0 €',
    periodo: '30 días',
    desc: 'Acceso completo, sin tarjeta.',
    features: ['Todos los módulos', 'Sin límite de clientes ni obras', 'Agente IA incluido'],
    cta: 'Empezar gratis',
    destacado: false,
  },
  {
    nombre: 'Pro',
    precio: PRECIO_PRO,
    periodo: 'por autónomo',
    desc: 'Para cuando decidas quedarte.',
    features: ['Todo lo del plan gratuito', 'Sin límites de uso', 'Soporte directo'],
    cta: 'Empezar gratis',
    destacado: true,
  },
]

function useRefCapture() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref')
    if (ref) {
      try { localStorage.setItem('xander_ref', ref) } catch { /* noop */ }
    }
  }, [])
}

function LeadForm() {
  const [form, setForm] = useState({ nombre: '', contacto: '', mensaje: '' })
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function enviar(e) {
    e.preventDefault()
    if (!form.nombre.trim() || !form.contacto.trim()) {
      setError('Necesitamos al menos tu nombre y un email o teléfono para poder contactarte.')
      return
    }
    setError('')
    setEnviando(true)
    const esEmail = form.contacto.includes('@')
    const { error: err } = await supabase.from('leads_saas').insert({
      nombre: form.nombre.trim(),
      email: esEmail ? form.contacto.trim() : null,
      telefono: esEmail ? null : form.contacto.trim(),
      mensaje: form.mensaje.trim() || null,
      origen: 'landing',
    })
    setEnviando(false)
    if (err) { setError('No se ha podido enviar. Prueba de nuevo o escríbenos por WhatsApp.'); return }
    setEnviado(true)
  }

  if (enviado) {
    return (
      <div className="card text-center py-8">
        <div className="text-3xl mb-2">✓</div>
        <div className="font-bold text-ink">¡Gracias, {form.nombre.split(' ')[0]}!</div>
        <p className="text-sm text-ink-soft mt-1">Te contactamos en menos de 24h.</p>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} className="card space-y-4">
      <div>
        <label className="label">Nombre</label>
        <input className="input" value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Tu nombre" />
      </div>
      <div>
        <label className="label">Email o teléfono</label>
        <input className="input" value={form.contacto} onChange={e => set('contacto', e.target.value)} placeholder="tu@email.com o 6XX XXX XXX" />
      </div>
      <div>
        <label className="label">Mensaje <span className="text-ink-soft font-normal">(opcional)</span></label>
        <textarea className="input" rows={3} value={form.mensaje} onChange={e => set('mensaje', e.target.value)} placeholder="Cuéntanos qué necesitas" />
      </div>
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <button type="submit" disabled={enviando} className="btn-primary w-full">
        {enviando ? 'Enviando...' : 'Quiero que me contacten'}
      </button>
    </form>
  )
}

export default function LandingPage() {
  const { user } = useAuth()
  useRefCapture()

  const ctaHref = user ? '/dashboard' : '/registro'
  const ctaLabel = user ? 'Ir a mi cuenta' : 'Prueba gratis 30 días'

  return (
    <div className="min-h-screen bg-page">
      {/* Nav */}
      <header className="sticky top-0 z-20 bg-page/90 backdrop-blur border-b border-edge">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="text-xl font-black">
            <span className="text-gold">X</span>
            <span className="text-ink">ANDER</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-ink-soft">
            <a href="#funciones" className="hover:text-ink transition-colors">Funciones</a>
            <a href="#planes" className="hover:text-ink transition-colors">Planes</a>
            <a href="#contacto" className="hover:text-ink transition-colors">Contacto</a>
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle compact />
            {user ? (
              <Link to="/dashboard" className="btn-primary text-sm px-4 py-2">Mi cuenta</Link>
            ) : (
              <>
                <Link to="/login" className="text-sm font-semibold text-ink-soft hover:text-ink hidden sm:block">Entrar</Link>
                <Link to="/registro" className="btn-primary text-sm px-4 py-2">Prueba gratis</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 text-center">
        <div className="inline-block bg-gold/10 text-gold text-xs font-bold tracking-widest uppercase rounded-full px-4 py-1.5 mb-6">
          Gestión para reformas de interior
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-ink leading-tight max-w-3xl mx-auto">
          Presupuestos, facturas y obras.<br />Todo en un solo sitio.
        </h1>
        <p className="text-lg text-ink-soft mt-5 max-w-2xl mx-auto">
          La herramienta de gestión pensada por y para autónomos de reformas: presupuestos en minutos,
          facturación con Verifactu, cobro con tarjeta y seguimiento real de cada obra.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
          <Link to={ctaHref} className="btn-primary px-8 py-3 text-base">{ctaLabel}</Link>
          <a href="#funciones" className="btn-secondary px-8 py-3 text-base">Ver funciones</a>
        </div>
        <p className="text-xs text-ink-soft/70 mt-4">Sin tarjeta · Sin permanencia · Cancela cuando quieras</p>
      </section>

      {/* Funciones */}
      <section id="funciones" className="max-w-6xl mx-auto px-6 py-16 border-t border-edge">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-black text-ink">Todo lo que necesitas para gestionar tu negocio</h2>
          <p className="text-ink-soft mt-2">Sin hojas de cálculo sueltas, sin carpetas de WhatsApp con presupuestos.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FUNCIONES.map(f => (
            <div key={f.title} className="card">
              <div className="text-3xl mb-3">{f.icon}</div>
              <div className="font-bold text-ink mb-1">{f.title}</div>
              <p className="text-sm text-ink-soft">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonio */}
      <section className="bg-navy py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <blockquote className="text-white text-xl md:text-2xl font-light leading-relaxed">
            "La herramienta que todo autónomo del sector necesita, construida por alguien del sector."
          </blockquote>
          <div className="mt-5 text-stone-light text-sm">— XANDER Reformas de Interiores, Madrid</div>
        </div>
      </section>

      {/* Planes */}
      <section id="planes" className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-black text-ink">Planes simples</h2>
          <p className="text-ink-soft mt-2">Empieza gratis. Sin sorpresas.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-6">
          {PLANES.map(p => (
            <div
              key={p.nombre}
              className={`card relative ${p.destacado ? 'border-2 border-gold' : ''}`}
            >
              {p.destacado && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold text-navy text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                  Recomendado
                </div>
              )}
              <div className="font-bold text-ink text-lg">{p.nombre}</div>
              <div className="flex items-baseline gap-1.5 mt-2 mb-1">
                <span className="text-3xl font-black text-ink">{p.precio}</span>
                <span className="text-sm text-ink-soft">{p.periodo}</span>
              </div>
              <p className="text-sm text-ink-soft mb-5">{p.desc}</p>
              <ul className="space-y-2 mb-6">
                {p.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-ink">
                    <span className="text-gold mt-0.5">✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link
                to={ctaHref}
                className={`block text-center w-full py-2.5 rounded-xl font-semibold text-sm ${p.destacado ? 'btn-primary' : 'btn-secondary'}`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Contacto */}
      <section id="contacto" className="max-w-4xl mx-auto px-6 py-16 border-t border-edge">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-black text-ink">¿Tienes dudas antes de empezar?</h2>
          <p className="text-ink-soft mt-2">Déjanos tus datos o escríbenos directamente por WhatsApp.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-6 items-start">
          <LeadForm />
          <div className="card">
            <div className="font-bold text-ink mb-3">Contacto directo</div>
            <a
              href={`https://wa.me/${WHATSAPP_NUMERO}?text=${WHATSAPP_MENSAJE}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary w-full flex items-center justify-center gap-2 mb-3"
            >
              <span>💬</span> Escribir por WhatsApp
            </a>
            <a href="mailto:reformasxander@gmail.com" className="text-sm text-ink-soft hover:text-ink transition-colors block">
              reformasxander@gmail.com
            </a>
            <a href="tel:+34640689121" className="text-sm text-ink-soft hover:text-ink transition-colors block mt-1">
              640 689 121
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-edge">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-lg font-black">
            <span className="text-gold">X</span>
            <span className="text-ink">ANDER</span>
          </div>
          <p className="text-sm text-ink-soft">XANDER Reformas de Interiores · Madrid</p>
        </div>
        <div className="text-center text-xs text-ink-soft/60 pb-6">© 2026 XANDER Gestión</div>
      </footer>

      {/* Botón flotante WhatsApp */}
      <a
        href={`https://wa.me/${WHATSAPP_NUMERO}?text=${WHATSAPP_MENSAJE}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-5 right-5 z-30 bg-[#25D366] text-white w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-lg hover:scale-105 transition-transform"
        aria-label="Escribir por WhatsApp"
      >
        💬
      </a>
    </div>
  )
}
