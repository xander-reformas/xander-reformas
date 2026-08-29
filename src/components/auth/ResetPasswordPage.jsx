import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import ThemeToggle from '../dashboard/ThemeToggle'
import LanguageSwitcher from '../shared/LanguageSwitcher'

/**
 * ResetPasswordPage
 *
 * Supabase redirige aquí desde el email de recuperación con los tokens
 * en el fragmento de la URL (#access_token=...&type=recovery).
 * onAuthStateChange detecta el evento PASSWORD_RECOVERY y establece la
 * sesión, lo que nos permite llamar a updateUser para cambiar la contraseña.
 */
export default function ResetPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [form, setForm]           = useState({ password: '', confirm: '' })
  const [loading, setLoading]     = useState(false)
  const [done, setDone]           = useState(false)
  const [error, setError]         = useState('')
  const [ready, setReady]         = useState(false)  // sesión de recuperación activa

  useEffect(() => {
    // Escucha el evento PASSWORD_RECOVERY que Supabase lanza cuando detecta
    // los tokens de recuperación en la URL.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (form.password.length < 8) {
      return setError(t('auth.reset.passwordCorta'))
    }
    if (form.password !== form.confirm) {
      return setError(t('auth.reset.passwordsNoCoinciden'))
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: form.password })
    setLoading(false)

    if (error) {
      setError(t('auth.reset.errorActualizar'))
    } else {
      setDone(true)
      // Redirigir al dashboard tras 2 segundos
      setTimeout(() => navigate('/dashboard'), 2000)
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
            {t('auth.reset.sidebarText')}
          </p>
        </div>
        <div className="text-xs text-stone-light">{t('auth.footer')}</div>
      </div>

      {/* Panel derecho */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden text-2xl font-black mb-8">
            <span className="text-gold">X</span>
            <span className="text-ink">ANDER</span>
          </div>

          {done ? (
            /* ── Éxito ── */
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-ink mb-2">{t('auth.reset.passwordActualizada')}</h1>
              <p className="text-sm text-ink-soft">{t('auth.reset.redirigiendo')}</p>
              <div className="mt-4 w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : !ready ? (
            /* ── Esperando el token de Supabase ── */
            <div className="text-center">
              <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-ink-soft">{t('auth.reset.verificandoEnlace')}</p>
              <p className="text-xs text-ink-soft mt-4">
                {t('auth.reset.enlaceCaducadoAviso')}{' '}
                <a href="/recuperar-password" className="text-gold hover:underline">{t('auth.reset.solicitaUnoNuevo')}</a>
              </p>
            </div>
          ) : (
            /* ── Formulario nueva contraseña ── */
            <>
              <h1 className="text-2xl font-bold text-ink mb-1">{t('auth.reset.nuevaContrasena')}</h1>
              <p className="text-sm text-ink-soft mb-8">{t('auth.reset.eligeNuevaPassword')}</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">{t('auth.reset.nuevaContrasena')}</label>
                  <input
                    type="password"
                    className="input"
                    placeholder={t('auth.reset.minimoCaracteres')}
                    value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    required
                    minLength={8}
                  />
                </div>
                <div>
                  <label className="label">{t('auth.reset.confirmarContrasena')}</label>
                  <input
                    type="password"
                    className="input"
                    placeholder={t('auth.reset.repiteContrasena')}
                    value={form.confirm}
                    onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))}
                    required
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
                  {loading ? t('auth.reset.guardando') : t('auth.reset.establecerNuevaContrasena')}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
