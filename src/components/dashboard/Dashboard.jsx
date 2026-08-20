import { useState, useEffect } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import CalendarioWidget from './CalendarioWidget'
import AgenteChat from './AgenteChat'
import NotificationBell from './NotificationBell'
import OnboardingChecklist from './OnboardingChecklist'
import ThemeToggle from './ThemeToggle'
import OfflineBadge from '../shared/OfflineBadge'
import AdminPanel from '../admin/AdminPanel'
import Clientes from '../clientes/Clientes'
import Obras from '../obras/Obras'
import Presupuestos from '../presupuestos/Presupuestos'
import Facturas from '../facturas/Facturas'
import Cobros from '../cobros/Cobros'
import Rentabilidad from '../rentabilidad/Rentabilidad'
import Gastos from '../gastos/Gastos'
import Resultados from '../resultados/Resultados'
import HubDigital from '../hub/HubDigital'
import Fiscal from '../fiscal/Fiscal'
import Legislacion from '../legislacion/Legislacion'
import Tarifas from '../tarifas/Tarifas'
import MiEmpresa from '../mi-empresa/MiEmpresa'
import Documentos from '../documentos/Documentos'
import Empleados from '../empleados/Empleados'
import PartesTrabajo from '../partes/PartesTrabajo'
import Nominas from '../nominas/Nominas'
import Referidos from '../referidos/Referidos'

const ADMIN_EMAIL = 'reformasxander@gmail.com'

const NAV_GROUPS = [
  {
    label: 'GENERAL',
    items: [
      { to: '', label: 'Dashboard', icon: '⊞', end: true },
    ],
  },
  {
    label: 'NEGOCIO',
    items: [
      { to: 'clientes',           label: 'Clientes',          icon: '👤' },
      { to: 'obras',              label: 'Obras',             icon: '🔨' },
      { to: 'rentabilidad',       label: 'Rentabilidad obras', icon: '📈' },
    ],
  },
  {
    label: 'FACTURACIÓN',
    items: [
      { to: 'presupuestos',       label: 'Presupuestos',      icon: '📋' },
      { to: 'facturas',           label: 'Facturas',          icon: '📄' },
      { to: 'cobros',             label: 'Cobros',            icon: '💳' },
    ],
  },
  {
    label: 'CONTROL',
    items: [
      { to: 'gastos',             label: 'Gastos',            icon: '💸' },
      { to: 'empleados',          label: 'Empleados',         icon: '👷' },
      { to: 'partes',             label: 'Partes de trabajo', icon: '🕐' },
      { to: 'nominas',            label: 'Nóminas',           icon: '📑' },
    ],
  },
  {
    label: 'EXPANSIÓN',
    items: [
      { to: 'hub-digital',        label: 'Hub Digital',       icon: '🌐' },
      { to: 'fiscal',             label: 'Fiscal',            icon: '🏛️' },
      { to: 'legislacion',        label: 'Legislación',       icon: '⚖️' },
      { to: 'resultados',         label: 'Resultados',        icon: '📊' },
      { to: 'referidos',          label: 'Referidos',         icon: '🎁' },
    ],
  },
  {
    label: 'MI EMPRESA',
    items: [
      { to: 'mi-empresa',         label: 'Mi Empresa',        icon: '🏢' },
      { to: 'tarifas',            label: 'Tarifas & Precios', icon: '💰' },
      { to: 'documentos',         label: 'Documentos',        icon: '📁' },
    ],
  },
]

function Placeholder({ title }) {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh]">
      <div className="text-center text-ink-soft">
        <div className="text-5xl mb-4">🚧</div>
        <div className="font-bold text-ink text-lg">{title}</div>
        <div className="text-sm mt-1 text-ink-soft">Próximamente</div>
      </div>
    </div>
  )
}

function HomePanel({ profile }) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    async function loadStats() {
      const [
        { count: clientes },
        { count: obrasActivas },
        { count: presPendientes },
        { data: facturasPendientes },
      ] = await Promise.all([
        supabase.from('clientes').select('*', { count: 'exact', head: true }),
        supabase.from('obras').select('*', { count: 'exact', head: true }).eq('estado', 'en_curso'),
        supabase.from('presupuestos').select('*', { count: 'exact', head: true }).in('estado', ['borrador', 'enviado']),
        supabase.from('facturas').select('items, iva, descuento, retencion').in('estado', ['enviada', 'vista']),
      ])
      const pendienteCobro = (facturasPendientes || []).reduce((s, f) => {
        const base = (f.items || []).reduce((a, i) => a + (parseFloat(i.importe) || 0), 0)
        const dto = base * (f.descuento || 0) / 100
        const baseDto = base - dto
        const iva = baseDto * (f.iva || 0) / 100
        const ret = baseDto * (f.retencion || 0) / 100
        return s + baseDto + iva - ret
      }, 0)
      setStats({ clientes, obrasActivas, presPendientes, pendienteCobro })
    }
    loadStats()
  }, [])

  const cards = [
    { label: 'Clientes', value: stats ? stats.clientes : '—', sub: 'en cartera' },
    { label: 'Obras activas', value: stats ? stats.obrasActivas : '—', sub: 'en curso ahora' },
    { label: 'Presupuestos', value: stats ? stats.presPendientes : '—', sub: 'pendientes respuesta' },
    {
      label: 'Pendiente cobro',
      value: stats ? stats.pendienteCobro.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }) : '—',
      sub: 'facturas enviadas',
      highlight: stats && stats.pendienteCobro > 0,
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">
          Hola, {profile?.nombre || 'bienvenido'} 👋
        </h1>
        <p className="text-sm text-ink-soft mt-0.5">
          {profile?.empresa_nombre || 'XANDER Gestión'} ·{' '}
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      <OnboardingChecklist />

      {profile?.tarifa_reducida && (
        <div className="bg-navy rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-gold/20 rounded-lg flex items-center justify-center text-gold text-lg">€</div>
          <div>
            <div className="text-gold font-semibold text-sm">Tarifa reducida activa</div>
            <div className="text-white/60 text-xs">Estás en período de tarifa plana de autónomo</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(s => (
          <div key={s.label} className={`card text-center ${s.highlight ? 'border-gold border-2' : ''}`}>
            <div className={`text-2xl font-bold ${s.highlight ? 'text-gold-dark' : 'text-ink'}`}>{s.value}</div>
            <div className="text-sm font-semibold text-ink mt-1">{s.label}</div>
            <div className="text-xs text-ink-soft mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      <CalendarioWidget />
    </div>
  )
}


export default function Dashboard() {
  const { user, profile, signOut } = useAuth()
  const [sidebarOpen, setSidebarOpen]   = useState(true)
  const [notifCount, setNotifCount]     = useState(0)
  const isAdmin = user?.email === ADMIN_EMAIL

  // Cargar badge de notificaciones (solo admin)
  useEffect(() => {
    if (!isAdmin) return
    supabase.rpc('admin_contar_no_leidas').then(({ data }) => {
      if (data != null) setNotifCount(data)
    })
    // Escuchar nuevas notificaciones en tiempo real
    const canal = supabase
      .channel('admin_badge')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'admin_notificaciones',
      }, () => setNotifCount(c => c + 1))
      .subscribe()
    return () => supabase.removeChannel(canal)
  }, [isAdmin])

  return (
    <div className="min-h-screen flex bg-page">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-56' : 'w-16'} bg-navy flex flex-col transition-all duration-200 flex-shrink-0`}>
        {/* Logo */}
        <div className="p-4 border-b border-white/10 flex items-center gap-3">
          <div className="text-xl font-black flex-shrink-0">
            <span className="text-gold">X</span>
            {sidebarOpen && <span className="text-white">ANDER</span>}
          </div>
          {sidebarOpen && (
            <div className="text-[9px] tracking-widest text-white/30 leading-tight mt-0.5">
              GESTIÓN DE NEGOCIO
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(p => !p)}
            className="ml-auto text-white/30 hover:text-white text-xs"
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV_GROUPS.map(group => (
            <div key={group.label} className="mb-2">
              {sidebarOpen && (
                <div className="px-4 py-1.5 text-[10px] font-semibold tracking-widest text-white/25">
                  {group.label}
                </div>
              )}
              <div className="px-2 space-y-0.5">
                {group.items.map(({ to, label, icon, end }) => (
                  <NavLink
                    key={to}
                    to={`/dashboard/${to}`}
                    end={end}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-gold/20 text-gold font-semibold'
                          : 'text-white/55 hover:text-white hover:bg-white/5'
                      }`
                    }
                  >
                    <span className="text-base flex-shrink-0">{icon}</span>
                    {sidebarOpen && <span className="truncate">{label}</span>}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}

          {/* Sección Admin — solo visible para el administrador */}
          {isAdmin && (
            <div className="mb-2 mt-2 border-t border-white/10 pt-3">
              {sidebarOpen && (
                <div className="px-4 py-1.5 text-[10px] font-semibold tracking-widest text-gold/50">
                  ADMINISTRACIÓN
                </div>
              )}
              <div className="px-2">
                <NavLink
                  to="/dashboard/admin"
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-gold/20 text-gold font-semibold'
                        : 'text-white/55 hover:text-white hover:bg-white/5'
                    }`
                  }
                >
                  <span className="text-base flex-shrink-0 relative">
                    🛡️
                    {notifCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
                        {notifCount > 9 ? '9+' : notifCount}
                      </span>
                    )}
                  </span>
                  {sidebarOpen && (
                    <span className="truncate flex-1">Panel Admin</span>
                  )}
                  {sidebarOpen && notifCount > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold leading-none flex-shrink-0">
                      {notifCount > 9 ? '9+' : notifCount}
                    </span>
                  )}
                </NavLink>
              </div>
            </div>
          )}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-white/10">
          <div className={`flex items-center gap-2 ${sidebarOpen ? '' : 'justify-center'}`}>
            <div className="w-8 h-8 bg-gold/20 rounded-full flex items-center justify-center text-gold text-sm font-bold flex-shrink-0">
              {profile?.nombre?.[0]?.toUpperCase() || '?'}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <div className="text-white text-xs font-medium truncate">{profile?.nombre} {profile?.apellidos}</div>
                <div className="text-white/35 text-xs truncate">{profile?.empresa_nombre}</div>
              </div>
            )}
          </div>
          {sidebarOpen && (
            <button
              onClick={signOut}
              className="mt-3 w-full text-xs text-white/30 hover:text-white/70 text-left px-1 transition-colors"
            >
              Cerrar sesión
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto flex flex-col">
        {/* Barra superior */}
        <header className="flex items-center justify-end gap-2 px-6 py-3 border-b border-edge bg-surface flex-shrink-0">
          <OfflineBadge />
          <NotificationBell />
          <ThemeToggle compact />
        </header>

        <div className="flex-1 overflow-auto">
          <Routes>
            <Route index               element={<HomePanel profile={profile} />} />
            <Route path="clientes"     element={<Clientes />} />
            <Route path="obras"        element={<Obras />} />
            <Route path="presupuestos" element={<Presupuestos />} />
            <Route path="tarifas"      element={<Tarifas />} />
            <Route path="mi-empresa"   element={<MiEmpresa />} />
            <Route path="rentabilidad" element={<Rentabilidad />} />
            <Route path="facturas"     element={<Facturas />} />
            <Route path="cobros"       element={<Cobros />} />
            <Route path="gastos"       element={<Gastos />} />
            <Route path="hub-digital"  element={<HubDigital />} />
            <Route path="fiscal"       element={<Fiscal />} />
            <Route path="legislacion"  element={<Legislacion />} />
            <Route path="resultados"   element={<Resultados />} />
            <Route path="documentos"   element={<Documentos />} />
            <Route path="empleados"    element={<Empleados />} />
            <Route path="partes"       element={<PartesTrabajo />} />
            <Route path="nominas"      element={<Nominas />} />
            <Route path="referidos"    element={<Referidos />} />
            {isAdmin && (
              <Route path="admin" element={<AdminPanel />} />
            )}
          </Routes>
        </div>
      </main>

      {/* Agente flotante */}
      <AgenteChat />
    </div>
  )
}
