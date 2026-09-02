import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { PRECIO_PRO, PRECIO_PRO_ANUAL } from '../../hooks/usePlan'

const ESPECIALIDADES = [
  'Reforma integral', 'Reforma de baño', 'Reforma de cocina', 'Cambio de uso',
  'Reforma de local', 'Distribuciones internas', 'Fontanería', 'Electricidad',
  'Alicatados y solados', 'Pladur', 'Pintura', 'Carpintería', 'Impermeabilización',
]

export default function MiEmpresa() {
  const { t } = useTranslation()
  const { profile, updateProfile } = useAuth()
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [stripeStatus, setStripeStatus] = useState(null) // { connected, charges_enabled, details_submitted }
  const [stripeLoading, setStripeLoading] = useState(false)
  const [stripeError, setStripeError] = useState('')

  const [planInfo, setPlanInfo] = useState(null) // override tras volver de Stripe Checkout / Portal
  const [planLoading, setPlanLoading] = useState('') // '' | 'mensual' | 'anual' | 'portal'
  const [planError, setPlanError] = useState('')
  const [suscripcionMsg, setSuscripcionMsg] = useState('')

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
        gestoria_nombre: profile.gestoria_nombre || '',
        gestoria_email: profile.gestoria_email || '',
        fecha_inicio_actividad: profile.fecha_inicio_actividad || '',
        tarifa_reducida: profile.tarifa_reducida || false,
        especialidades: profile.especialidades || [],
      })
      setStripeStatus({
        connected: !!profile.stripe_account_id,
        charges_enabled: !!profile.stripe_charges_enabled,
      })
    }
  }, [profile])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const flag = params.get('stripe')
    if (flag === 'return' || flag === 'refresh') {
      refreshStripeStatus()
      params.delete('stripe')
      const rest = params.toString()
      window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''))
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const flag = params.get('suscripcion')
    if (flag === 'ok' || flag === 'cancelado') {
      if (flag === 'ok') refreshPlan()
      setSuscripcionMsg(flag)
      params.delete('suscripcion')
      const rest = params.toString()
      window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''))
    }
  }, [])

  async function refreshPlan() {
    if (!profile?.id) return
    const { data } = await supabase
      .from('profiles')
      .select('plan, trial_ends_at, plan_expires_at, stripe_customer_id, stripe_subscription_id')
      .eq('id', profile.id)
      .single()
    if (data) setPlanInfo(data)
  }

  async function actualizarAPro(ciclo) {
    setPlanLoading(ciclo)
    setPlanError('')
    const { data, error: err } = await supabase.functions.invoke('stripe-crear-checkout-suscripcion', { body: { ciclo } })
    setPlanLoading('')
    if (err || data?.error) {
      setPlanError(data?.error || err.message || t('miEmpresa.errores.checkout'))
      return
    }
    window.location.href = data.url
  }

  async function gestionarSuscripcion() {
    setPlanLoading('portal')
    setPlanError('')
    const { data, error: err } = await supabase.functions.invoke('stripe-portal-suscripcion', { body: {} })
    setPlanLoading('')
    if (err || data?.error) {
      setPlanError(data?.error || err.message || t('miEmpresa.errores.portal'))
      return
    }
    window.location.href = data.url
  }

  async function refreshStripeStatus() {
    setStripeLoading(true)
    setStripeError('')
    const { data, error: err } = await supabase.functions.invoke('stripe-connect-status', { body: {} })
    setStripeLoading(false)
    if (err || data?.error) {
      setStripeError(data?.error || err.message || t('miEmpresa.errores.stripeStatus'))
      return
    }
    setStripeStatus(data)
  }

  async function conectarStripe() {
    setStripeLoading(true)
    setStripeError('')
    const { data, error: err } = await supabase.functions.invoke('stripe-connect-onboarding', { body: {} })
    setStripeLoading(false)
    if (err || data?.error) {
      setStripeError(data?.error || err.message || t('miEmpresa.errores.stripeConnect'))
      return
    }
    window.location.href = data.url
  }

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

  if (!form) return <div className="p-6 text-ink-soft text-sm">{t('miEmpresa.cargando')}</div>

  const plan = planInfo || profile
  const esPro = plan?.plan === 'pro' || plan?.plan === 'pro_annual'
  const trialActivo = !esPro && plan?.trial_ends_at && new Date(plan.trial_ends_at) > new Date()
  const trialDias = trialActivo ? Math.max(0, Math.ceil((new Date(plan.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24))) : 0

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">{t('miEmpresa.title')}</h1>
        <p className="text-sm text-ink-soft mt-0.5">{t('miEmpresa.subtitle')}</p>
      </div>

      <form onSubmit={save} className="space-y-8">
        {/* Datos personales */}
        <div className="card space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-soft border-b border-edge pb-3">{t('miEmpresa.datosPersonales')}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t('miEmpresa.nombre')}</label>
              <input className="input" value={form.nombre} onChange={e => setF('nombre', e.target.value)} />
            </div>
            <div>
              <label className="label">{t('miEmpresa.apellidos')}</label>
              <input className="input" value={form.apellidos} onChange={e => setF('apellidos', e.target.value)} />
            </div>
            <div>
              <label className="label">{t('miEmpresa.dniNie')}</label>
              <input className="input" value={form.dni_nie} onChange={e => setF('dni_nie', e.target.value)} />
            </div>
            <div>
              <label className="label">{t('miEmpresa.telefonoPersonal')}</label>
              <input className="input" type="tel" value={form.telefono_personal} onChange={e => setF('telefono_personal', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Datos de empresa */}
        <div className="card space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-soft border-b border-edge pb-3">{t('miEmpresa.datosEmpresa')}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">{t('miEmpresa.nombreComercial')}</label>
              <input className="input" value={form.empresa_nombre} onChange={e => setF('empresa_nombre', e.target.value)} />
            </div>
            <div>
              <label className="label">{t('miEmpresa.nif')}</label>
              <input className="input" value={form.empresa_nif} onChange={e => setF('empresa_nif', e.target.value)} />
            </div>
            <div>
              <label className="label">{t('miEmpresa.telefonoEmpresa')}</label>
              <input className="input" type="tel" value={form.empresa_telefono} onChange={e => setF('empresa_telefono', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">{t('miEmpresa.emailEmpresa')}</label>
              <input className="input" type="email" value={form.empresa_email} onChange={e => setF('empresa_email', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">{t('miEmpresa.direccionFiscal')}</label>
              <input className="input" value={form.empresa_direccion} onChange={e => setF('empresa_direccion', e.target.value)} />
            </div>
            <div>
              <label className="label">{t('miEmpresa.cp')}</label>
              <input className="input" value={form.empresa_cp} onChange={e => setF('empresa_cp', e.target.value)} />
            </div>
            <div>
              <label className="label">{t('miEmpresa.ciudad')}</label>
              <input className="input" value={form.empresa_ciudad} onChange={e => setF('empresa_ciudad', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">{t('miEmpresa.web')}</label>
              <input className="input" type="url" value={form.empresa_web} onChange={e => setF('empresa_web', e.target.value)} placeholder="https://" />
            </div>
          </div>
        </div>

        {/* Gestoría */}
        <div className="card space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-soft border-b border-edge pb-3">
            {t('miEmpresa.gestoriaTitulo', 'Gestoría / Asesoría')}
          </h2>
          <p className="text-sm text-ink-soft -mt-2">
            {t('miEmpresa.gestoriaDesc', 'Configura el email de tu gestoría para poder enviarle las facturas y gastos del mes desde la sección Gestoría, sin que se quede nada por mandar.')}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t('miEmpresa.gestoriaNombre', 'Nombre de contacto (opcional)')}</label>
              <input className="input" value={form.gestoria_nombre} onChange={e => setF('gestoria_nombre', e.target.value)} />
            </div>
            <div>
              <label className="label">{t('miEmpresa.gestoriaEmail', 'Email de la gestoría')}</label>
              <input className="input" type="email" value={form.gestoria_email} onChange={e => setF('gestoria_email', e.target.value)} placeholder="gestoria@ejemplo.com" />
            </div>
          </div>
        </div>

        {/* Actividad */}
        <div className="card space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-soft border-b border-edge pb-3">{t('miEmpresa.actividadProfesional')}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t('miEmpresa.fechaInicio')}</label>
              <input className="input" type="date" value={form.fecha_inicio_actividad} onChange={e => setF('fecha_inicio_actividad', e.target.value)} />
            </div>
            <div className="flex items-center gap-3 pt-5">
              <input type="checkbox" id="tarifa_red" checked={form.tarifa_reducida} onChange={e => setF('tarifa_reducida', e.target.checked)} className="w-4 h-4 accent-gold" />
              <label htmlFor="tarifa_red" className="text-sm text-ink cursor-pointer">
                {t('miEmpresa.tarifaReducida')}
                <span className="block text-xs text-ink-soft">{t('miEmpresa.tarifaReducidaSub')}</span>
              </label>
            </div>
          </div>

          <div>
            <label className="label mb-2">{t('miEmpresa.especialidades')}</label>
            <div className="flex flex-wrap gap-2">
              {ESPECIALIDADES.map(esp => {
                const active = form.especialidades.includes(esp)
                return (
                  <button key={esp} type="button" onClick={() => toggleEsp(esp)}
                    className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${active ? 'bg-navy text-gold border-navy' : 'bg-surface text-ink-soft border-edge hover:border-navy hover:text-ink'}`}>
                    {t(`miEmpresa.especialidad.${esp}`, esp)}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Mi plan */}
        <div className="card space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-soft border-b border-edge pb-3">{t('miEmpresa.miPlan')}</h2>

          {suscripcionMsg === 'ok' && (
            <div className="text-green-700 text-sm bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              {t('miEmpresa.pagoConfirmado')}
            </div>
          )}
          {suscripcionMsg === 'cancelado' && (
            <div className="text-sm text-ink-soft bg-surface border border-edge rounded-xl px-4 py-3">
              {t('miEmpresa.pagoCancelado')}
            </div>
          )}

          {esPro ? (
            <div className="text-green-700 text-sm bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2">
              {t('miEmpresa.planProActivo', { ciclo: plan?.plan === 'pro_annual' ? t('miEmpresa.cicloAnual') : t('miEmpresa.cicloMensual') })}
            </div>
          ) : trialActivo ? (
            <div className="text-amber-700 text-sm bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              {t('miEmpresa.trialActivo', { dias: trialDias, plural: trialDias === 1 ? '' : 's' })}
            </div>
          ) : (
            <div className="text-sm text-ink-soft bg-surface border border-edge rounded-xl px-4 py-3">
              {t('miEmpresa.planGratuito')}
            </div>
          )}

          {planError && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">{planError}</div>}

          {esPro ? (
            <div className="flex gap-3">
              <button type="button" onClick={gestionarSuscripcion} disabled={planLoading === 'portal'} className="btn-secondary px-6">
                {planLoading === 'portal' ? t('miEmpresa.abriendo') : t('miEmpresa.gestionarSuscripcion')}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => actualizarAPro('mensual')} disabled={!!planLoading} className="btn-primary px-6">
                {planLoading === 'mensual' ? t('miEmpresa.redirigiendo') : t('miEmpresa.actualizarPro', { precio: PRECIO_PRO })}
              </button>
              <button type="button" onClick={() => actualizarAPro('anual')} disabled={!!planLoading} className="btn-secondary px-6">
                {planLoading === 'anual' ? t('miEmpresa.redirigiendo') : t('miEmpresa.planAnual', { precio: PRECIO_PRO_ANUAL })}
              </button>
            </div>
          )}
          <p className="text-xs text-ink-soft/70">{t('miEmpresa.sinPermanencia')}</p>
        </div>

        {/* Cobros online */}
        <div className="card space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-soft border-b border-edge pb-3">{t('miEmpresa.cobrosOnline')}</h2>
          <p className="text-sm text-ink-soft">{t('miEmpresa.cobrosOnlineDesc')}</p>

          {stripeStatus?.charges_enabled ? (
            <div className="text-green-700 text-sm bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2">
              {t('miEmpresa.stripeActiva')}
            </div>
          ) : stripeStatus?.connected ? (
            <div className="text-amber-700 text-sm bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              {t('miEmpresa.stripeVerificacion')}
            </div>
          ) : (
            <div className="text-sm text-ink-soft bg-surface border border-edge rounded-xl px-4 py-3">
              {t('miEmpresa.stripeNoConectada')}
            </div>
          )}

          {stripeError && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">{stripeError}</div>}

          <div className="flex gap-3">
            <button type="button" onClick={conectarStripe} disabled={stripeLoading} className="btn-primary px-6">
              {stripeLoading ? t('miEmpresa.cargandoBtn') : stripeStatus?.connected ? t('miEmpresa.completarConexion') : t('miEmpresa.conectarStripe')}
            </button>
            {stripeStatus?.connected && (
              <button type="button" onClick={refreshStripeStatus} disabled={stripeLoading} className="btn-secondary px-6">
                {t('miEmpresa.actualizarEstado')}
              </button>
            )}
          </div>
        </div>

        {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</div>}

        {saved && (
          <div className="text-green-700 text-sm bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2">
            {t('miEmpresa.datosGuardados')}
          </div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary px-8">
            {saving ? t('miEmpresa.guardando') : t('miEmpresa.guardarCambios')}
          </button>
        </div>
      </form>
    </div>
  )
}
