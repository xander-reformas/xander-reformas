import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const ESPECIALIDADES = [
  'Reformas integrales', 'Baños', 'Cocinas', 'Pintura', 'Pladur',
  'Electricidad', 'Fontanería', 'Carpintería', 'Alicatados', 'Fachadas',
]

export default function OnboardingWizard() {
  const { updateProfile, signOut } = useAuth()
  const navigate = useNavigate()

  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [data, setData] = useState({
    nombre: '',
    apellidos: '',
    empresa_nombre: '',
    especialidades: [],
  })

  const set = (key, val) => {
    setData(p => ({ ...p, [key]: val }))
    // Limpiar error al escribir
    if (errors[key]) setErrors(p => ({ ...p, [key]: '' }))
  }

  const toggleEsp = (e) => setData(p => ({
    ...p,
    especialidades: p.especialidades.includes(e)
      ? p.especialidades.filter(x => x !== e)
      : [...p.especialidades, e]
  }))

  function validate() {
    const errs = {}
    if (!data.nombre.trim())        errs.nombre        = 'El nombre es obligatorio.'
    if (!data.empresa_nombre.trim()) errs.empresa_nombre = 'El nombre de empresa es obligatorio.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function finish() {
    if (!validate()) return
    setSaving(true)
    await updateProfile({
      nombre:          data.nombre.trim(),
      apellidos:       data.apellidos.trim(),
      empresa_nombre:  data.empresa_nombre.trim(),
      especialidades:  data.especialidades,
      // Valores por defecto para campos que se completan después en Mi Empresa
      color_primario:  '#1A1A2E',
      color_secundario:'#C9A84C',
      onboarding_completado: true,
    })
    setSaving(false)
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-arena flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="text-2xl font-black mb-1">
          <span className="text-gold">X</span>
          <span className="text-navy">ANDER</span>
        </div>
        <p className="text-sm text-stone">Cuéntanos quién eres — solo lo esencial</p>
      </div>

      {/* Card */}
      <div className="card w-full max-w-md">
        <h2 className="text-lg font-bold text-navy mb-1">Bienvenido a XANDER</h2>
        <p className="text-sm text-stone mb-6">
          Rellena dos datos y ya puedes empezar. Puedes completar el resto del perfil más tarde.
        </p>

        <div className="space-y-5">
          {/* Nombre */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                className={`input ${errors.nombre ? 'border-red-400 focus:ring-red-300' : ''}`}
                value={data.nombre}
                onChange={e => set('nombre', e.target.value)}
                placeholder="Alexander"
              />
              {errors.nombre && <p className="text-red-500 text-xs mt-1">{errors.nombre}</p>}
            </div>
            <div>
              <label className="label">Apellidos</label>
              <input
                className="input"
                value={data.apellidos}
                onChange={e => set('apellidos', e.target.value)}
                placeholder="Aguilar Rodríguez"
              />
            </div>
          </div>

          {/* Empresa */}
          <div>
            <label className="label">
              Nombre de empresa <span className="text-red-500">*</span>
            </label>
            <input
              className={`input ${errors.empresa_nombre ? 'border-red-400 focus:ring-red-300' : ''}`}
              value={data.empresa_nombre}
              onChange={e => set('empresa_nombre', e.target.value)}
              placeholder="XANDER Reformas de Interiores"
            />
            {errors.empresa_nombre && <p className="text-red-500 text-xs mt-1">{errors.empresa_nombre}</p>}
          </div>

          {/* Especialidades — opcional */}
          <div>
            <label className="label">
              Especialidades
              <span className="text-stone font-normal ml-1">(opcional)</span>
            </label>
            <p className="text-xs text-stone mb-2">¿Qué trabajos realizas habitualmente?</p>
            <div className="flex flex-wrap gap-2">
              {ESPECIALIDADES.map(e => (
                <button key={e} type="button"
                  onClick={() => toggleEsp(e)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                    data.especialidades.includes(e)
                      ? 'bg-navy text-gold border-navy'
                      : 'bg-white text-stone border-arena-dark hover:border-navy'
                  }`}>
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Aviso datos adicionales */}
        <div className="mt-6 bg-arena rounded-lg px-4 py-3 text-xs text-stone flex gap-2">
          <span>ℹ️</span>
          <span>Puedes añadir NIF, dirección, teléfonos y más en <strong>Mi Empresa</strong> cuando quieras. Son necesarios para imprimir presupuestos y facturas completos.</span>
        </div>

        {/* Botones */}
        <div className="flex justify-between mt-6 pt-4 border-t border-arena-dark">
          <button onClick={signOut} className="text-sm text-stone hover:text-navy">
            Salir
          </button>
          <button onClick={finish} disabled={saving} className="btn-gold">
            {saving ? 'Guardando...' : '¡Empezar! →'}
          </button>
        </div>
      </div>
    </div>
  )
}
