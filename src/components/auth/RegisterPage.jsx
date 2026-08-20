import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import GoogleButton from './GoogleButton'
import ThemeToggle from '../dashboard/ThemeToggle'

export default function RegisterPage() {
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
      setError('Las contraseñas no coinciden.')
      return
    }
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
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
        <h2 className="text-xl font-bold text-ink mb-2">Revisa tu email</h2>
        <p className="text-sm text-ink-soft mb-6">
          Te hemos enviado un enlace de confirmación a <strong>{form.email}</strong>.
          Confirma tu cuenta y podrás empezar a configurar tu perfil.
        </p>
        <Link to="/login" className="btn-primary inline-block">Ir al login</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-page flex relative">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle compact />
      </div>
      <div className="hidden lg:flex w-1/2 bg-navy flex-col justify-between p-12">
        <div>
          <div className="text-3xl font-black">
            <span className="text-gold">X</span>
            <span className="text-white">ANDER</span>
          </div>
          <div className="text-xs tracking-widest text-stone-light mt-1">GESTIÓN DE REFORMAS</div>
        </div>
        <div className="space-y-4">
          {[
            { icon: '📋', text: 'Presupuestos profesionales en minutos' },
            { icon: '🔨', text: 'Seguimiento de obras y clientes' },
            { icon: '📊', text: 'Tarifas y rentabilidad por obra' },
            { icon: '📧', text: 'Facturas enviadas directamente desde la app' },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-3 text-white text-sm">
              <span className="text-lg">{icon}</span>
              {text}
            </div>
          ))}
        </div>
        <div className="text-xs text-stone-light">Gratis durante la beta · Sin tarjeta de crédito</div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden text-2xl font-black mb-8">
            <span className="text-gold">X</span>
            <span className="text-ink">ANDER</span>
          </div>

          <h1 className="text-2xl font-bold text-ink mb-1">Crea tu cuenta</h1>
          <p className="text-sm text-ink-soft mb-6">Gratis durante la beta · Sin límites</p>

          {/* Google */}
          <GoogleButton label="Registrarse con Google" />
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-edge" />
            <span className="text-xs text-ink-soft">o con email</span>
            <div className="flex-1 h-px bg-edge" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email profesional</label>
              <input type="email" className="input" placeholder="tu@email.com"
                value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <input type="password" className="input" placeholder="Mínimo 8 caracteres"
                value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Confirmar contraseña</label>
              <input type="password" className="input" placeholder="Repite la contraseña"
                value={form.confirm} onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))} required />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Creando cuenta...' : 'Crear cuenta gratuita'}
            </button>

            <p className="text-xs text-ink-soft text-center">
              Al registrarte aceptas nuestros{' '}
              <a href="#" className="text-gold hover:underline">Términos de uso</a>
              {' '}y{' '}
              <a href="#" className="text-gold hover:underline">Política de privacidad</a>
            </p>
          </form>

          <div className="mt-6 text-center text-sm text-ink-soft">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-gold font-semibold hover:underline">Accede aquí</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
