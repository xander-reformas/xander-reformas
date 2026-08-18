import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export default function ForgotPasswordPage() {
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
      setError('No se pudo enviar el email. Comprueba la dirección e inténtalo de nuevo.')
    } else {
      setSent(true)
    }
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
          <p className="text-white text-lg font-light leading-relaxed">
            Te enviaremos un enlace para que puedas establecer una nueva contraseña de forma segura.
          </p>
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

          {sent ? (
            /* ── Estado: email enviado ── */
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-navy mb-2">Email enviado</h1>
              <p className="text-sm text-stone mb-6">
                Hemos enviado un enlace de recuperación a <strong>{email}</strong>.
                Revisa también la carpeta de spam.
              </p>
              <p className="text-xs text-stone mb-6">
                El enlace caduca en 1 hora. Si no lo recibes, puedes volver a intentarlo.
              </p>
              <Link to="/login" className="btn-primary w-full block text-center">
                Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            /* ── Formulario ── */
            <>
              <h1 className="text-2xl font-bold text-navy mb-1">Recuperar contraseña</h1>
              <p className="text-sm text-stone mb-8">
                Introduce tu email y te enviaremos un enlace para restablecer tu contraseña.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="tu@email.com"
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
                  {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-stone">
                <Link to="/login" className="text-gold font-semibold hover:underline">
                  ← Volver al inicio de sesión
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
