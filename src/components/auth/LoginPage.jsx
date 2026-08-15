import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export default function LoginPage() {
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
    if (error) setError('Email o contraseña incorrectos.')
    else navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-arena flex">
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
          <blockquote className="text-white text-xl font-light leading-relaxed mb-6">
            "La herramienta que todo autónomo del sector necesita, construida por alguien del sector."
          </blockquote>
          <div className="flex gap-8 text-sm">
            {['Presupuestos', 'Facturación', 'Obras', 'Tarifas'].map(f => (
              <div key={f} className="flex items-center gap-2 text-stone-light">
                <span className="w-1.5 h-1.5 bg-gold rounded-full" />
                {f}
              </div>
            ))}
          </div>
        </div>
        <div className="text-xs text-stone-light">© 2026 XANDER Gestión · Madrid</div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden text-2xl font-black mb-8">
            <span className="text-gold">X</span>
            <span className="text-navy">ANDER</span>
          </div>

          <h1 className="text-2xl font-bold text-navy mb-1">Bienvenido</h1>
          <p className="text-sm text-stone mb-8">Accede a tu cuenta</p>

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
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-stone">
            ¿No tienes cuenta?{' '}
            <Link to="/registro" className="text-gold font-semibold hover:underline">
              Regístrate gratis
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
