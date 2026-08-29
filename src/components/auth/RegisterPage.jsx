import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import GoogleButton from './GoogleButton'
import ThemeToggle from '../dashboard/ThemeToggle'
import LanguageSwitcher from '../shared/LanguageSwitcher'

export default function RegisterPage() {
  const { t } = useTranslation()
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) {
      setError(t('auth.register.passwordsNoCoinciden'))
      return
    }
    if (form.password.length < 8) {
      setError(t('auth.register.passwordCorta'))
      return
    }
    setLoading(true)
    let refCode = ''
    try { refCode = localStorage.getItem('xander_ref') || '' } catch { /* noop */ }
    const { error } = await signUp(form.email, form.password, refCode ? { ref_code: refCode } : {})
    setLoading(false)
    if (error) setError(error.message)
    else setDone(true)
  }

  if (done) return (
    <div className="min-h-screen bg-page flex items-center justify-center p-8">
      <div className="card max-w-md w-full text-center">
        <div className="w-12 h-12 bg-gold/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-gold text-2xl">✓</span>
        </div>
        <h2 className="text-xl font-bold text-ink mb-2">{t('auth.register.revisaEmail')}</h2>
        <p className="text-sm text-ink-soft mb-6">
          <Trans i18nKey="auth.register.enlaceConfirmacion" values={{ email: form.email }} components={{ strong: <strong /> }} />
        </p>
        <Link to="/login" className="btn-primary inline-block">{t('auth.register.irLogin')}</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-page flex relative">
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle compact />
      </div>
      <div className="hidden lg:flex w-1/2 bg-navy flex-col justify-between p-12">
        <div>
          <div className="text-3xl font-black">
            <span className="text-gold">X</span>
            <span className="text-white">ANDER</span>
          </div>
          <div className="text-xs tracking-widest text-stone-light mt-1">{t('auth.tagline')}</div>
        </div>
        <div className="space-y-4">
          {t('auth.register.features', { returnObjects: true }).map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-3 text-white text-sm">
              <span className="text-lg">{icon}</span>
              {text}
            </div>
          ))}
        </div>
        <div className="text-xs text-stone-light">{t('auth.register.gratisBeta')}</div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden text-2xl font-black mb-8">
            <span className="text-gold">X</span>
            <span className="text-ink">ANDER</span>
          </div>

          <h1 className="text-2xl font-bold text-ink mb-1">{t('auth.register.creaTuCuenta')}</h1>
          <p className="text-sm text-ink-soft mb-6">{t('auth.register.gratisSinLimites')}</p>

          {/* Google */}
          <GoogleButton label={t('auth.register.registrarseGoogle')} />
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-edge" />
            <span className="text-xs text-ink-soft">{t('auth.orConEmail')}</span>
            <div className="flex-1 h-px bg-edge" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">{t('auth.register.emailProfesional')}</label>
              <input type="email" className="input" placeholder={t('auth.emailPlaceholder')}
                value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
            </div>
            <div>
              <label className="label">{t('auth.register.contrasena')}</label>
              <input type="password" className="input" placeholder={t('auth.register.minimoCaracteres')}
                value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required />
            </div>
            <div>
              <label className="label">{t('auth.register.confirmarContrasena')}</label>
              <input type="password" className="input" placeholder={t('auth.register.repiteContrasena')}
                value={form.confirm} onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))} required />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? t('auth.register.creandoCuenta') : t('auth.register.crearCuentaGratuita')}
            </button>

            <p className="text-xs text-ink-soft text-center">
              {t('auth.register.aceptasTerminosPre')}{' '}
              <a href="#" className="text-gold hover:underline">{t('auth.register.terminosUso')}</a>
              {' '}{t('auth.register.y')}{' '}
              <a href="#" className="text-gold hover:underline">{t('auth.register.politicaPrivacidad')}</a>
            </p>
          </form>

          <div className="mt-6 text-center text-sm text-ink-soft">
            {t('auth.register.yaTienesCuenta')}{' '}
            <Link to="/login" className="text-gold font-semibold hover:underline">{t('auth.register.accedeAqui')}</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
