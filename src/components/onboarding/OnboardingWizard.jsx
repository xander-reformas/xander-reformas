import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const ESPECIALIDADES = [
  'Reformas integrales', 'Baños', 'Cocinas', 'Pintura', 'Pladur',
  'Electricidad', 'Fontanería', 'Carpintería', 'Alicatados', 'Fachadas',
]

const STEPS = ['Datos personales', 'Empresa', 'Actividad', 'Branding', 'Especialidades']

function calcTarifaReducida(fechaInicio) {
  if (!fechaInicio) return null
  const inicio = new Date(fechaInicio)
  const hoy = new Date()
  const meses = (hoy.getFullYear() - inicio.getFullYear()) * 12 + (hoy.getMonth() - inicio.getMonth())
  if (meses < 12) return { aplica: true, año: 1, desc: 'Tarifa plana primer año (~80 €/mes)' }
  if (meses < 24) return { aplica: true, año: 2, desc: 'Tarifa plana segundo año (reducción progresiva)' }
  return { aplica: false, desc: 'Tarifa general por tramos de ingresos netos' }
}

export default function OnboardingWizard() {
  const { updateProfile, signOut } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState({
    nombre: '', apellidos: '', dni_nie: '', telefono_personal: '',
    empresa_nombre: '', empresa_nif: '', empresa_direccion: '',
    empresa_cp: '', empresa_ciudad: '', empresa_email: '', empresa_telefono: '',
    fecha_inicio_actividad: '',
    color_primario: '#1A1A2E', color_secundario: '#C9A84C',
    especialidades: [],
  })

  const set = (key, val) => setData(p => ({ ...p, [key]: val }))
  const toggleEsp = (e) => setData(p => ({
    ...p,
    especialidades: p.especialidades.includes(e)
      ? p.especialidades.filter(x => x !== e)
      : [...p.especialidades, e]
  }))

  const tarifa = calcTarifaReducida(data.fecha_inicio_actividad)

  async function finish() {
    setSaving(true)
    await updateProfile({
      ...data,
      tarifa_reducida: tarifa?.aplica ?? false,
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
        <p className="text-sm text-stone">Configura tu perfil — {step + 1} de {STEPS.length}</p>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-lg mb-6">
        <div className="flex gap-1">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={`h-1.5 rounded-full transition-colors ${i <= step ? 'bg-gold' : 'bg-arena-dark'}`} />
              <div className={`text-xs mt-1 text-center hidden sm:block ${i === step ? 'text-navy font-semibold' : 'text-stone'}`}>
                {s}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Card */}
      <div className="card w-full max-w-lg">

        {/* PASO 0: Datos personales */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-navy mb-4">Tus datos personales</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Nombre</label>
                <input className="input" value={data.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Alexander" />
              </div>
              <div>
                <label className="label">Apellidos</label>
                <input className="input" value={data.apellidos} onChange={e => set('apellidos', e.target.value)} placeholder="Aguilar Rodríguez" />
              </div>
            </div>
            <div>
              <label className="label">DNI / NIE</label>
              <input className="input" value={data.dni_nie} onChange={e => set('dni_nie', e.target.value)} placeholder="12345678A" />
            </div>
            <div>
              <label className="label">Teléfono personal</label>
              <input className="input" value={data.telefono_personal} onChange={e => set('telefono_personal', e.target.value)} placeholder="640 689 121" />
            </div>
          </div>
        )}

        {/* PASO 1: Empresa */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-navy mb-4">Tu empresa</h2>
            <div>
              <label className="label">Nombre comercial</label>
              <input className="input" value={data.empresa_nombre} onChange={e => set('empresa_nombre', e.target.value)} placeholder="XANDER Reformas de Interiores" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">NIF / CIF</label>
                <input className="input" value={data.empresa_nif} onChange={e => set('empresa_nif', e.target.value)} placeholder="12345678A" />
              </div>
              <div>
                <label className="label">Teléfono empresa</label>
                <input className="input" value={data.empresa_telefono} onChange={e => set('empresa_telefono', e.target.value)} placeholder="640 689 121" />
              </div>
            </div>
            <div>
              <label className="label">Dirección fiscal</label>
              <input className="input" value={data.empresa_direccion} onChange={e => set('empresa_direccion', e.target.value)} placeholder="Calle Ejemplo 1, 2.º A" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">CP</label>
                <input className="input" value={data.empresa_cp} onChange={e => set('empresa_cp', e.target.value)} placeholder="28001" />
              </div>
              <div>
                <label className="label">Ciudad</label>
                <input className="input" value={data.empresa_ciudad} onChange={e => set('empresa_ciudad', e.target.value)} placeholder="Madrid" />
              </div>
            </div>
            <div>
              <label className="label">Email de empresa</label>
              <input className="input" type="email" value={data.empresa_email} onChange={e => set('empresa_email', e.target.value)} placeholder="reformasxander@gmail.com" />
            </div>
          </div>
        )}

        {/* PASO 2: Actividad y tarifa */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-navy mb-1">Tu actividad como autónomo</h2>
            <p className="text-sm text-stone mb-4">
              La fecha de inicio nos permite calcular si tienes derecho a la tarifa reducida de autónomo.
            </p>
            <div>
              <label className="label">Fecha de inicio de actividad en RETA</label>
              <input className="input" type="date" value={data.fecha_inicio_actividad}
                onChange={e => set('fecha_inicio_actividad', e.target.value)} />
            </div>

            {tarifa && (
              <div className={`rounded-lg p-4 mt-2 ${tarifa.aplica ? 'bg-green-50 border border-green-200' : 'bg-arena border border-arena-dark'}`}>
                <div className={`font-semibold text-sm mb-1 ${tarifa.aplica ? 'text-green-700' : 'text-stone'}`}>
                  {tarifa.aplica ? '✓ Tarifa reducida aplicable' : 'Tarifa general'}
                </div>
                <div className="text-sm text-stone">{tarifa.desc}</div>
                {tarifa.aplica && (
                  <div className="text-xs text-green-600 mt-1">
                    La app te recordará cuándo cambia tu tramo de cotización.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* PASO 3: Branding */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-navy mb-1">Tu identidad visual</h2>
            <p className="text-sm text-stone mb-4">
              Los colores se usarán en tus presupuestos y facturas.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Color principal</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={data.color_primario}
                    onChange={e => set('color_primario', e.target.value)}
                    className="w-12 h-10 rounded border border-arena-dark cursor-pointer" />
                  <input className="input flex-1" value={data.color_primario}
                    onChange={e => set('color_primario', e.target.value)} placeholder="#1A1A2E" />
                </div>
              </div>
              <div>
                <label className="label">Color acento</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={data.color_secundario}
                    onChange={e => set('color_secundario', e.target.value)}
                    className="w-12 h-10 rounded border border-arena-dark cursor-pointer" />
                  <input className="input flex-1" value={data.color_secundario}
                    onChange={e => set('color_secundario', e.target.value)} placeholder="#C9A84C" />
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-lg overflow-hidden border border-arena-dark mt-2">
              <div style={{ background: data.color_primario }} className="p-4 flex items-center gap-3">
                <div className="text-xl font-black" style={{ color: data.color_secundario }}>X</div>
                <div className="text-lg font-bold text-white">ANDER</div>
                <div className="ml-auto text-xs text-white/50">Vista previa</div>
              </div>
              <div className="p-4 bg-white">
                <div className="text-sm font-semibold text-gray-800 mb-1">PRESUPUESTO — PRE-2026-001</div>
                <div className="text-xs text-gray-400">Cliente · Obra · Fecha</div>
              </div>
            </div>
          </div>
        )}

        {/* PASO 4: Especialidades */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-navy mb-1">Tus especialidades</h2>
            <p className="text-sm text-stone mb-4">Selecciona los trabajos que realizas habitualmente.</p>
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
            {data.especialidades.length > 0 && (
              <div className="text-xs text-stone mt-2">
                {data.especialidades.length} especialidad{data.especialidades.length > 1 ? 'es' : ''} seleccionada{data.especialidades.length > 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}

        {/* Navegación */}
        <div className="flex justify-between mt-8 pt-4 border-t border-arena-dark">
          {step > 0
            ? <button onClick={() => setStep(s => s - 1)} className="btn-secondary">Atrás</button>
            : <button onClick={signOut} className="text-sm text-stone hover:text-navy">Salir</button>
          }
          {step < STEPS.length - 1
            ? <button onClick={() => setStep(s => s + 1)} className="btn-primary">Siguiente →</button>
            : <button onClick={finish} disabled={saving} className="btn-gold">
                {saving ? 'Guardando...' : '¡Empezar! →'}
              </button>
          }
        </div>
      </div>
    </div>
  )
}
