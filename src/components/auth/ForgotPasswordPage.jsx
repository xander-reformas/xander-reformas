import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import ThemeToggle from '../dashboard/ThemeToggle'
import LanguageSwitcher from '../shared/LanguageSwitcher'

export default function ForgotPasswordPage() {
  const { t } = useTranslation()
  const { resetPassword } = useAuth()
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    const { error } = await resetPassword(email)
    setLoading(false)
    if (error) {
      setError(t('auth.forgot.errorEnvio'))
    } else {
      setSent(true)
    }
  }

  return (
    <div className="min-h-screen bg-page flex relative">
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle compact />
      </div>
      {/* Panel izquierdo — branding */}
      <div className="hidden lg:flex w-1/2 bg-navy flex-col justify-between p-12">
        <div>
          <div className="text-3xl font-black">
            <span className="text-gold">X</span>
            <span className="text-white">ANDER</span>
          </div>
          <div className="text-xs tracking-widest text-stone-light mt-1">{t('auth.tagline')}</div>
        </div>
        <div>
          <p className="text-white text-lg font-light leading-relaxed">
            {t('auth.forgot.sidebarText')}
          </p>
        </div>
        <div className="text-xs text-stone-light">{t('auth.footer')}</div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden text-2xl font-black mb-8">
            <span className="text-gold">X</span>
            <span className="text-ink">ANDER</span>
          </div>

          {sent ? (
            /* ── Estado: email enviado ── */
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-ink mb-2">{t('auth.forgot.emailEnviado')}</h1>
              <p className="text-sm text-ink-soft mb-6">
                <Trans i18nKey="auth.forgot.enlaceEnviadoA" values={{ email }} components={{ strong: <strong /> }} />
              </p>
              <p className="text-xs text-ink-soft mb-6">
                {t('auth.forgot.enlaceCaduca')}
              </p>
              <Link to="/login" className="btn-primary w-full block text-center">
                {t('auth.forgot.volverInicioSesion')}
              </Link>
            </div>
          ) : (
            /* ── Formulario ── */
            <>
              <h1 className="text-2xl font-bold text-ink mb-1">{t('auth.forgot.recuperarContrasena')}</h1>
              <p className="text-sm text-ink-soft mb-8">
                {t('auth.forgot.introduceEmail')}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">{t('auth.emailLabel')}</label>
                  <input
                    type="email"
                    className="input"
                    placeholder={t('auth.emailPlaceholder')}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
                  {loading ? t('auth.forgot.enviando') : t('auth.forgot.enviarEnlace')}
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-ink-soft">
                <Link to="/login" className="text-gold font-semibold hover:underline">
                  {t('auth.forgot.flechaVolver')}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
