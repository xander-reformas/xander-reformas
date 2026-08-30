import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import ThemeToggle from '../dashboard/ThemeToggle'
import LanguageSwitcher from '../shared/LanguageSwitcher'
import { PRECIO_PRO } from '../../hooks/usePlan'

const WHATSAPP_NUMERO = '34640689121'

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
  const { t } = useTranslation()
  const [form, setForm] = useState({ nombre: '', contacto: '', mensaje: '' })
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function enviar(e) {
    e.preventDefault()
    if (!form.nombre.trim() || !form.contacto.trim()) {
      setError(t('landing.form.errorRequerido'))
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
    if (err) { setError(t('landing.form.errorEnvio')); return }
    setEnviado(true)
  }

  if (enviado) {
    return (
      <div className="card text-center py-8">
        <div className="text-3xl mb-2">✓</div>
        <div className="font-bold text-ink">{t('landing.form.gracias', { nombre: form.nombre.split(' ')[0] })}</div>
        <p className="text-sm text-ink-soft mt-1">{t('landing.form.contactamos24h')}</p>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} className="card space-y-4">
      <div>
        <label className="label">{t('landing.form.nombre')}</label>
        <input className="input" value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder={t('landing.form.nombrePlaceholder')} />
      </div>
      <div>
        <label className="label">{t('landing.form.emailOTelefono')}</label>
        <input className="input" value={form.contacto} onChange={e => set('contacto', e.target.value)} placeholder={t('landing.form.contactoPlaceholder')} />
      </div>
      <div>
        <label className="label">{t('landing.form.mensaje')} <span className="text-ink-soft font-normal">{t('landing.form.opcional')}</span></label>
        <textarea className="input" rows={3} value={form.mensaje} onChange={e => set('mensaje', e.target.value)} placeholder={t('landing.form.mensajePlaceholder')} />
      </div>
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <button type="submit" disabled={enviando} className="btn-primary w-full">
        {enviando ? t('landing.form.enviando') : t('landing.form.quieroContacten')}
      </button>
    </form>
  )
}

export default function LandingPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  useRefCapture()

  const WHATSAPP_MENSAJE = encodeURIComponent(t('landing.whatsappMensaje'))
  const FUNCIONES = t('landing.funciones', { returnObjects: true })
  const PLANES = [
    { ...t('landing.planPrueba', { returnObjects: true }), precio: '0 €', destacado: false },
    { ...t('landing.planPro', { returnObjects: true }), precio: PRECIO_PRO, destacado: true },
  ]

  const ctaHref = user ? '/dashboard' : '/registro'
  const ctaLabel = user ? t('landing.iraMiCuenta') : t('landing.pruebaGratis30')

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
            <a href="#funciones" className="hover:text-ink transition-colors">{t('landing.nav.funciones')}</a>
            <a href="#planes" className="hover:text-ink transition-colors">{t('landing.nav.planes')}</a>
            <a href="#contacto" className="hover:text-ink transition-colors">{t('landing.nav.contacto')}</a>
          </nav>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <ThemeToggle compact />
            {user ? (
              <Link to="/dashboard" className="btn-primary text-sm px-4 py-2">{t('landing.miCuenta')}</Link>
            ) : (
              <>
                <Link to="/login" className="text-sm font-semibold text-ink-soft hover:text-ink hidden sm:block">{t('landing.entrar')}</Link>
                <Link to="/registro" className="btn-primary text-sm px-4 py-2">{t('landing.pruebaGratis')}</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 text-center">
        <div className="inline-block bg-gold/10 text-gold text-xs font-bold tracking-widest uppercase rounded-full px-4 py-1.5 mb-6">
          {t('landing.heroTag')}
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-ink leading-tight max-w-3xl mx-auto"
          dangerouslySetInnerHTML={{ __html: t('landing.heroTitle') }} />
        <p className="text-lg text-ink-soft mt-5 max-w-2xl mx-auto">
          {t('landing.heroDesc')}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
          <Link to={ctaHref} className="btn-primary px-8 py-3 text-base">{ctaLabel}</Link>
          <a href="#funciones" className="btn-secondary px-8 py-3 text-base">{t('landing.verFunciones')}</a>
        </div>
        <p className="text-xs text-ink-soft/70 mt-4">{t('landing.sinTarjeta')}</p>
      </section>

      {/* Funciones */}
      <section id="funciones" className="max-w-6xl mx-auto px-6 py-16 border-t border-edge">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-black text-ink">{t('landing.funcionesTitle')}</h2>
          <p className="text-ink-soft mt-2">{t('landing.funcionesSubtitle')}</p>
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
            {t('auth.login.quote')}
          </blockquote>
          <div className="mt-5 text-stone-light text-sm">{t('landing.testimonioAutor')}</div>
        </div>
      </section>

      {/* Planes */}
      <section id="planes" className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-black text-ink">{t('landing.planesTitle')}</h2>
          <p className="text-ink-soft mt-2">{t('landing.planesSubtitle')}</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-6">
          {PLANES.map(p => (
            <div
              key={p.nombre}
              className={`card relative ${p.destacado ? 'border-2 border-gold' : ''}`}
            >
              {p.destacado && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold text-navy text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                  {t('landing.recomendado')}
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
          <h2 className="text-2xl md:text-3xl font-black text-ink">{t('landing.contactoTitle')}</h2>
          <p className="text-ink-soft mt-2">{t('landing.contactoSubtitle')}</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-6 items-start">
          <LeadForm />
          <div className="card">
            <div className="font-bold text-ink mb-3">{t('landing.contactoDirecto')}</div>
            <a
              href={`https://wa.me/${WHATSAPP_NUMERO}?text=${WHATSAPP_MENSAJE}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary w-full flex items-center justify-center gap-2 mb-3"
            >
              <span>💬</span> {t('landing.escribirWhatsapp')}
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
          <p className="text-sm text-ink-soft">{t('landing.footerText')}</p>
        </div>
        <div className="text-center text-xs text-ink-soft/60 pb-6">{t('landing.footerCopyright')}</div>
      </footer>

      {/* Botón flotante WhatsApp */}
      <a
        href={`https://wa.me/${WHATSAPP_NUMERO}?text=${WHATSAPP_MENSAJE}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-5 right-5 z-30 bg-[#25D366] text-white w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-lg hover:scale-105 transition-transform"
        aria-label={t('landing.escribirWhatsapp')}
      >
        💬
      </a>
    </div>
  )
}
