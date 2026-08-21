import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, getUID } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

const PASOS = [
  {
    key: 'cliente',
    icon: '👤',
    titulo: 'Añade tu primer cliente',
    desc: 'La ficha de contacto que luego se enlaza a obras, presupuestos y facturas.',
    to: 'clientes',
  },
  {
    key: 'obra',
    icon: '🔨',
    titulo: 'Crea tu primera obra',
    desc: 'Vincúlala a un cliente para llevar el seguimiento de fotos, etapas y equipo.',
    to: 'obras',
  },
  {
    key: 'presupuesto',
    icon: '📋',
    titulo: 'Haz tu primer presupuesto',
    desc: 'Usa las partidas de Tarifas & Precios para generarlo en minutos.',
    to: 'presupuestos',
  },
  {
    key: 'fiscal',
    icon: '🏢',
    titulo: 'Completa tus datos fiscales',
    desc: 'NIF, dirección y régimen — imprescindibles para presupuestos y facturas válidas.',
    to: 'mi-empresa',
  },
  {
    key: 'cobros',
    icon: '💳',
    titulo: 'Conecta el cobro con tarjeta',
    desc: 'Opcional: enlaza tu cuenta de Stripe para cobrar facturas directamente desde XANDER.',
    to: 'mi-empresa',
  },
]

export default function OnboardingChecklist() {
  const { profile, updateProfile } = useAuth()
  const navigate = useNavigate()
  const [estado, setEstado] = useState(null)
  const [loading, setLoading] = useState(true)
  const [ocultando, setOcultando] = useState(false)

  useEffect(() => {
    async function cargar() {
      const uid = await getUID()
      if (!uid) return
      const [
        { count: clientes },
        { count: obras },
        { count: presupuestos },
      ] = await Promise.all([
        supabase.from('clientes').select('*', { count: 'exact', head: true }),
        supabase.from('obras').select('*', { count: 'exact', head: true }),
        supabase.from('presupuestos').select('*', { count: 'exact', head: true }),
      ])
      setEstado({
        cliente: (clientes || 0) > 0,
        obra: (obras || 0) > 0,
        presupuesto: (presupuestos || 0) > 0,
        fiscal: !!profile?.empresa_nif,
        cobros: !!profile?.stripe_account_id,
      })
      setLoading(false)
    }
    cargar()
  }, [profile?.empresa_nif, profile?.stripe_account_id])

  if (loading || !estado) return null

  const completados = PASOS.filter(p => estado[p.key]).length
  const total = PASOS.length
  const colapsado = !!profile?.onboarding_checklist_dismissed
  const completo = completados === total

  async function toggle() {
    setOcultando(true)
    await updateProfile({ onboarding_checklist_dismissed: !colapsado })
    setOcultando(false)
  }

  // Colapsado: barra compacta que se puede volver a abrir con un clic —
  // nunca desaparece del todo, siempre queda accesible desde el Dashboard.
  if (colapsado) {
    return (
      <button
        onClick={toggle}
        disabled={ocultando}
        className="card mb-2 w-full flex items-center justify-between text-left hover:bg-surface-alt transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-base">{completo ? '🎉' : '🚀'}</span>
          <span className="text-sm font-medium text-ink">Primeros pasos en XANDER</span>
          <span className="text-xs text-ink-soft">{completados}/{total}</span>
        </div>
        <span className="text-xs text-gold font-medium whitespace-nowrap ml-4">Mostrar ▾</span>
      </button>
    )
  }

  return (
    <div className="card mb-2">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h2 className="font-semibold text-ink">Primeros pasos en XANDER</h2>
          <p className="text-xs text-ink-soft mt-0.5">
            {completo
              ? '¡Completados! Ya conoces las bases de XANDER.'
              : `${completados} de ${total} completados — te acompañamos hasta que la app forme parte de tu rutina.`}
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={ocultando}
          className="text-xs text-ink-soft hover:text-ink whitespace-nowrap ml-4"
        >
          Ocultar ▴
        </button>
      </div>

      <div className="w-full h-1.5 bg-surface-alt rounded-full mt-3 mb-4 overflow-hidden">
        <div
          className="h-full bg-gold rounded-full transition-all"
          style={{ width: `${(completados / total) * 100}%` }}
        />
      </div>

      <div className="space-y-1">
        {PASOS.map(p => {
          const hecho = estado[p.key]
          return (
            <button
              key={p.key}
              onClick={() => navigate(`/dashboard/${p.to}`)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                hecho ? 'opacity-50' : 'hover:bg-surface-alt'
              }`}
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                hecho ? 'bg-green-100 text-green-700' : 'bg-gold/20 text-gold'
              }`}>
                {hecho ? '✓' : p.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${hecho ? 'text-ink-soft line-through' : 'text-ink'}`}>
                  {p.titulo}
                </div>
                {!hecho && <div className="text-xs text-ink-soft mt-0.5">{p.desc}</div>}
              </div>
              {!hecho && <span className="text-ink-soft text-sm flex-shrink-0">→</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
