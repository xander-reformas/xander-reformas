import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { usePortalCliente } from '../../hooks/usePortalCliente'

// Login del Portal del Cliente. Usa el mismo sistema de autenticación
// (Supabase Auth) que el resto de la app — solo cambia el destino tras entrar.
export default function PortalLoginPage() {
  const { signIn, user } = useAuth()
  const { esCliente, loading } = usePortalCliente()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  // Si ya hay sesión activa, redirige directamente sin mostrar el formulario.
  useEffect(() => {
    if (loading || !user) return
    navigate(esCliente ? '/portal' : '/dashboard', { replace: true })
  }, [loading, user, esCliente, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setEnviando(true)
    const { error: err } = await signIn(form.email, form.password)
    setEnviando(false)
    if (err) setError('Email o contraseña incorrectos.')
    // Si el login es correcto, el useEffect de arriba se encarga de redirigir
    // en cuanto usePortalCliente resuelva el rol.
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
          <h1 className="text-lg font-bold text-ink mb-1">Accede al estado de tu obra</h1>
          <p className="text-sm text-ink-soft mb-6">Consulta el progreso, las fotos y las novedades en cualquier momento.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                placeholder="tu@email.com"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label">Contraseña</label>
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
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
            )}

            <button type="submit" disabled={enviando} className="btn-primary w-full mt-2">
              {enviando ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <p className="text-xs text-ink-soft text-center mt-6">
            Si has recibido una invitación por email, usa el enlace de ese correo la primera vez para crear tu contraseña.
          </p>
        </div>
      </div>
    </div>
  )
}
