import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

/**
 * ResetPasswordPage
 *
 * Supabase redirige aquí desde el email de recuperación con los tokens
 * en el fragmento de la URL (#access_token=...&type=recovery).
 * onAuthStateChange detecta el evento PASSWORD_RECOVERY y establece la
 * sesión, lo que nos permite llamar a updateUser para cambiar la contraseña.
 */
export default function ResetPasswordPage() {
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
      return setError('La contraseña debe tener al menos 8 caracteres.')
    }
    if (form.password !== form.confirm) {
      return setError('Las contraseñas no coinciden.')
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: form.password })
    setLoading(false)

    if (error) {
      setError('No se pudo actualizar la contraseña. El enlace puede haber caducado.')
    } else {
      setDone(true)
      // Redirigir al dashboard tras 2 segundos
      setTimeout(() => navigate('/dashboard'), 2000)
    }
  }

  return (
    <div className="min-h-screen bg-page flex">
      {/* Panel izquierdo — branding */}
      <div className="hidden lg:flex w-1/2 bg-navy flex-col justify-between p-12">
        <div>
          <div className="text-3xl font-black">
            <span className="text-gold">X</span>
            <span className="text-white">ANDER</span>
          </div>
          <div className="text-xs tracking-widest text-stone-light mt-1">GESTIÓN DE REFORMAS</div>
        </div>
        <div>
          <p className="text-white text-lg font-light leading-relaxed">
            Elige una contraseña segura. Te recomendamos usar al menos 8 caracteres combinando letras y números.
          </p>
        </div>
        <div className="text-xs text-stone-light">© 2026 XANDER Gestión · Madrid</div>
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
              <h1 className="text-2xl font-bold text-ink mb-2">Contraseña actualizada</h1>
              <p className="text-sm text-ink-soft">Redirigiendo a tu cuenta...</p>
              <div className="mt-4 w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : !ready ? (
            /* ── Esperando el token de Supabase ── */
            <div className="text-center">
              <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-ink-soft">Verificando enlace de recuperación...</p>
              <p className="text-xs text-ink-soft mt-4">
                Si ves este mensaje durante más de 10 segundos, el enlace puede haber caducado.{' '}
                <a href="/recuperar-password" className="text-gold hover:underline">Solicita uno nuevo.</a>
              </p>
            </div>
          ) : (
            /* ── Formulario nueva contraseña ── */
            <>
              <h1 className="text-2xl font-bold text-ink mb-1">Nueva contraseña</h1>
              <p className="text-sm text-ink-soft mb-8">Elige una nueva contraseña para tu cuenta.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Nueva contraseña</label>
                  <input
                    type="password"
                    className="input"
                    placeholder="Mínimo 8 caracteres"
                    value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    required
                    minLength={8}
                  />
                </div>
                <div>
                  <label className="label">Confirmar contraseña</label>
                  <input
                    type="password"
                    className="input"
                    placeholder="Repite la contraseña"
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
                  {loading ? 'Guardando...' : 'Establecer nueva contraseña'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
