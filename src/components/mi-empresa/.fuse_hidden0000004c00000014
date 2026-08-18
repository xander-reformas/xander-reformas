import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

const ESPECIALIDADES = [
  'Reforma integral', 'Reforma de baño', 'Reforma de cocina', 'Cambio de uso',
  'Reforma de local', 'Distribuciones internas', 'Fontanería', 'Electricidad',
  'Alicatados y solados', 'Pladur', 'Pintura', 'Carpintería', 'Impermeabilización',
]

export default function MiEmpresa() {
  const { profile, updateProfile } = useAuth()
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (profile) {
      setForm({
        nombre: profile.nombre || '',
        apellidos: profile.apellidos || '',
        dni_nie: profile.dni_nie || '',
        telefono_personal: profile.telefono_personal || '',
        empresa_nombre: profile.empresa_nombre || '',
        empresa_nif: profile.empresa_nif || '',
        empresa_direccion: profile.empresa_direccion || '',
        empresa_cp: profile.empresa_cp || '',
        empresa_ciudad: profile.empresa_ciudad || '',
        empresa_email: profile.empresa_email || '',
        empresa_telefono: profile.empresa_telefono || '',
        empresa_web: profile.empresa_web || '',
        fecha_inicio_actividad: profile.fecha_inicio_actividad || '',
        tarifa_reducida: profile.tarifa_reducida || false,
        especialidades: profile.especialidades || [],
      })
    }
  }, [profile])

  function setF(f, v) { setForm(p => ({ ...p, [f]: v })) }

  function toggleEsp(esp) {
    setForm(p => ({
      ...p,
      especialidades: p.especialidades.includes(esp)
        ? p.especialidades.filter(e => e !== esp)
        : [...p.especialidades, esp]
    }))
  }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    const { error: err } = await updateProfile({
      ...form,
      fecha_inicio_actividad: form.fecha_inicio_actividad || null,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (!form) return <div className="p-6 text-stone text-sm">Cargando…</div>

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy">Mi Empresa</h1>
        <p className="text-sm text-stone mt-0.5">Estos datos aparecerán en tus presupuestos y facturas</p>
      </div>

      <form onSubmit={save} className="space-y-8">
        {/* Datos personales */}
        <div className="card space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-stone border-b border-arena-dark pb-3">Datos personales</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nombre</label>
              <input className="input" value={form.nombre} onChange={e => setF('nombre', e.target.value)} />
            </div>
            <div>
              <label className="label">Apellidos</label>
              <input className="input" value={form.apellidos} onChange={e => setF('apellidos', e.target.value)} />
            </div>
            <div>
              <label className="label">DNI / NIE</label>
              <input className="input" value={form.dni_nie} onChange={e => setF('dni_nie', e.target.value)} />
            </div>
            <div>
              <label className="label">Teléfono personal</label>
              <input className="input" type="tel" value={form.telefono_personal} onChange={e => setF('telefono_personal', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Datos de empresa */}
        <div className="card space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-stone border-b border-arena-dark pb-3">Datos de empresa / actividad</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Nombre comercial / empresa *</label>
              <input className="input" value={form.empresa_nombre} onChange={e => setF('empresa_nombre', e.target.value)} />
            </div>
            <div>
              <label className="label">NIF / CIF</label>
              <input className="input" value={form.empresa_nif} onChange={e => setF('empresa_nif', e.target.value)} />
            </div>
            <div>
              <label className="label">Teléfono empresa</label>
              <input className="input" type="tel" value={form.empresa_telefono} onChange={e => setF('empresa_telefono', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">Email de empresa</label>
              <input className="input" type="email" value={form.empresa_email} onChange={e => setF('empresa_email', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">Dirección fiscal</label>
              <input className="input" value={form.empresa_direccion} onChange={e => setF('empresa_direccion', e.target.value)} />
            </div>
            <div>
              <label className="label">CP</label>
              <input className="input" value={form.empresa_cp} onChange={e => setF('empresa_cp', e.target.value)} />
            </div>
            <div>
              <label className="label">Ciudad</label>
              <input className="input" value={form.empresa_ciudad} onChange={e => setF('empresa_ciudad', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">Web</label>
              <input className="input" type="url" value={form.empresa_web} onChange={e => setF('empresa_web', e.target.value)} placeholder="https://" />
            </div>
          </div>
        </div>

        {/* Actividad */}
        <div className="card space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-stone border-b border-arena-dark pb-3">Actividad profesional</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Fecha inicio actividad</label>
              <input className="input" type="date" value={form.fecha_inicio_actividad} onChange={e => setF('fecha_inicio_actividad', e.target.value)} />
            </div>
            <div className="flex items-center gap-3 pt-5">
              <input type="checkbox" id="tarifa_red" checked={form.tarifa_reducida} onChange={e => setF('tarifa_reducida', e.target.checked)} className="w-4 h-4 accent-gold" />
              <label htmlFor="tarifa_red" className="text-sm text-navy cursor-pointer">
                Tarifa plana / reducida activa
                <span className="block text-xs text-stone">Primeros 2 años como autónomo</span>
              </label>
            </div>
          </div>

          <div>
            <label className="label mb-2">Especialidades</label>
            <div className="flex flex-wrap gap-2">
              {ESPECIALIDADES.map(esp => {
                const active = form.especialidades.includes(esp)
                return (
                  <button key={esp} type="button" onClick={() => toggleEsp(esp)}
                    className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${active ? 'bg-navy text-gold border-navy' : 'bg-white text-stone border-arena-dark hover:border-navy hover:text-navy'}`}>
                    {esp}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</div>}

        {saved && (
          <div className="text-green-700 text-sm bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2">
            ✓ Datos guardados correctamente
          </div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary px-8">
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}
