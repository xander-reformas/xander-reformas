import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

/**
 * PortalSetPasswordPage
 *
 * A esta página llega el cliente desde el email de invitación al Portal
 * (enlace generado por la Edge Function clientes-invitar-portal), con los
 * tokens de sesión en el fragmento de la URL. Supabase los detecta solo
 * (detectSessionInUrl) y dispara SIGNED_IN (invite/magic link) o
 * PASSWORD_RECOVERY (si en el futuro se reenvía por "olvidé mi contraseña").
 * En cualquiera de los dos casos dejamos al cliente fijar su contraseña.
 */
export default function PortalSetPasswordPage() {
  const navigate = useNavigate()
  const [form, setForm]       = useState({ password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)
  const [error, setError]     = useState('')
  const [ready, setReady]     = useState(false)

  useEffect(() => {
    // Por si el evento ya se disparó antes de montar este listener.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (form.password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
    if (form.password !== form.confirm) return setError('Las contraseñas no coinciden.')

    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password: form.password })
    setLoading(false)

    if (err) {
      setError('No se pudo guardar la contraseña. Vuelve a solicitar el enlace de invitación.')
    } else {
      setDone(true)
      setTimeout(() => navigate('/portal'), 2000)
    }
  }

  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-3xl font-black mb-1">
            <span className="text-gold">X</span>
            <span className="text-ink">ANDER</span>
          </div>
          <div className="text-xs tracking-widest text-ink-soft">PORTAL DEL CLIENTE</div>
        </div>

        <div className="card">
          {done ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-ink mb-2">Contraseña creada</h1>
              <p className="text-sm text-ink-soft">Entrando a tu portal…</p>
              <div className="mt-4 w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : !ready ? (
            <div className="text-center py-4">
              <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-ink-soft">Verificando tu enlace de invitación…</p>
              <p className="text-xs text-ink-soft mt-4">
                Si el enlace ha caducado, pide a tu empresa de reformas que te reenvíe la invitación.
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-bold text-ink mb-1">Crea tu contraseña</h1>
              <p className="text-sm text-ink-soft mb-6">Con ella entrarás a tu Portal cuando quieras ver el estado de tu obra.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Contraseña</label>
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
                  <label className="label">Repite la contraseña</label>
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
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
                )}

                <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
                  {loading ? 'Guardando…' : 'Crear contraseña y entrar'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
