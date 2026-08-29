import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import GoogleButton from './GoogleButton'
import ThemeToggle from '../dashboard/ThemeToggle'
import LanguageSwitcher from '../shared/LanguageSwitcher'

export default function LoginPage() {
  const { t } = useTranslation()
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    const { error } = await signIn(form.email, form.password)
    setLoading(false)
    if (error) setError(t('auth.login.errorCredenciales'))
    else navigate('/dashboard')
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
          <blockquote className="text-white text-xl font-light leading-relaxed mb-6">
            {t('auth.login.quote')}
          </blockquote>
          <div className="flex gap-8 text-sm">
            {t('auth.login.features', { returnObjects: true }).map(f => (
              <div key={f} className="flex items-center gap-2 text-stone-light">
                <span className="w-1.5 h-1.5 bg-gold rounded-full" />
                {f}
              </div>
            ))}
          </div>
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

          <h1 className="text-2xl font-bold text-ink mb-1">{t('auth.login.bienvenido')}</h1>
          <p className="text-sm text-ink-soft mb-6">{t('auth.login.accedeCuenta')}</p>

          {/* Google */}
          <GoogleButton label={t('auth.login.continuarGoogle')} />
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-edge" />
            <span className="text-xs text-ink-soft">{t('auth.orConEmail')}</span>
            <div className="flex-1 h-px bg-edge" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">{t('auth.emailLabel')}</label>
              <input
                type="email"
                className="input"
                placeholder={t('auth.emailPlaceholder')}
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                required
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">{t('auth.login.contrasena')}</label>
                <Link to="/recuperar-password" className="text-xs text-gold hover:underline">
                  {t('auth.login.olvidasteContrasena')}
                </Link>
              </div>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? t('auth.login.entrando') : t('auth.login.entrar')}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-ink-soft">
            {t('auth.login.noTienesCuenta')}{' '}
            <Link to="/registro" className="text-gold font-semibold hover:underline">
              {t('auth.login.registrateGratis')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
