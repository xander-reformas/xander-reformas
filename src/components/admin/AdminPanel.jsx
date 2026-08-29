import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'

export default function AdminPanel() {
  const { t } = useTranslation()
  const [users, setUsers]           = useState([])
  const [notifs, setNotifs]         = useState([])
  const [leads, setLeads]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [activeTab, setActiveTab]   = useState('usuarios')
  const [stats, setStats]           = useState({ total: 0, semana: 0, activos: 0 })

  useEffect(() => {
    loadAll()
    // Escuchar nuevas notificaciones en tiempo real
    const canal = supabase
      .channel('admin_notifs')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'admin_notificaciones',
      }, payload => {
        setNotifs(prev => [payload.new, ...prev])
      })
      .subscribe()
    return () => supabase.removeChannel(canal)
  }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: usersData }, { data: notifsData }, { data: leadsData }] = await Promise.all([
      supabase.rpc('admin_get_all_profiles'),
      supabase
        .from('admin_notificaciones')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('leads_saas')
        .select('*')
        .order('created_at', { ascending: false }),
    ])
    if (leadsData) setLeads(leadsData)

    if (usersData) {
      setUsers(usersData)
      const ahora = new Date()
      const haceUnaSemana = new Date(ahora - 7 * 24 * 60 * 60 * 1000)
      setStats({
        total: usersData.length,
        semana: usersData.filter(u => new Date(u.created_at) > haceUnaSemana).length,
        activos: usersData.filter(u => u.onboarding_completado).length,
      })
    }
    if (notifsData) setNotifs(notifsData)
    setLoading(false)
  }

  async function marcarLeida(id) {
    await supabase.rpc('admin_marcar_notificacion_leida', { notificacion_id: id })
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n))
  }

  async function marcarTodasLeidas() {
    const noLeidas = notifs.filter(n => !n.leida)
    await Promise.all(noLeidas.map(n =>
      supabase.rpc('admin_marcar_notificacion_leida', { notificacion_id: n.id })
    ))
    setNotifs(prev => prev.map(n => ({ ...n, leida: true })))
  }

  async function toggleAtendido(id, valorActual) {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, atendido: !valorActual } : l))
    await supabase.from('leads_saas').update({ atendido: !valorActual }).eq('id', id)
  }

  const noLeidas = notifs.filter(n => !n.leida).length
  const leadsPendientes = leads.filter(l => !l.atendido).length

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <div className="text-ink-soft text-sm">{t('admin.cargandoPanel')}</div>
        </div>
      </div>
    )
  }

  const TABS = [
    { id: 'usuarios',        label: t('admin.tabs.usuarios'),        icon: '👤' },
    { id: 'leads',           label: t('admin.tabs.leads'),           icon: '📨', badge: leadsPendientes },
    { id: 'notificaciones',  label: t('admin.tabs.notificaciones'),  icon: '🔔', badge: noLeidas },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Cabecera */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink flex items-center gap-2">
            {t('admin.title')}
          </h1>
          <p className="text-ink-soft text-sm mt-0.5">{t('admin.subtitle')}</p>
        </div>
        <button
          onClick={loadAll}
          className="text-xs text-ink-soft hover:text-ink border border-stone/20 rounded-lg px-3 py-1.5 transition-colors"
        >
          {t('admin.actualizar')}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-surface rounded-xl p-5 border border-stone/10">
          <div className="text-3xl font-black text-ink">{stats.total}</div>
          <div className="text-sm text-ink-soft mt-1">{t('admin.stats.totalRegistrados')}</div>
        </div>
        <div className="bg-surface rounded-xl p-5 border border-stone/10">
          <div className="text-3xl font-black text-green-600">{stats.semana}</div>
          <div className="text-sm text-ink-soft mt-1">{t('admin.stats.nuevosSemana')}</div>
        </div>
        <div className="bg-surface rounded-xl p-5 border border-stone/10">
          <div className="text-3xl font-black text-gold">{stats.activos}</div>
          <div className="text-sm text-ink-soft mt-1">{t('admin.stats.perfilCompleto')}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-stone/10">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? 'border-gold text-ink'
                : 'border-transparent text-ink-soft hover:text-ink'
            }`}
          >
            {tab.icon} {tab.label}
            {tab.badge > 0 && (
              <span className="bg-gold text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Usuarios */}
      {activeTab === 'usuarios' && (
        <div className="bg-surface rounded-xl border border-stone/10 overflow-hidden">
          {users.length === 0 ? (
            <div className="py-16 text-center text-ink-soft">
              <div className="text-4xl mb-3">👤</div>
              <div className="font-medium">{t('admin.usuarios.sinUsuarios')}</div>
              <div className="text-sm mt-1">{t('admin.usuarios.sinUsuariosSub')}</div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-navy/5 border-b border-stone/10">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-soft tracking-wider">{t('admin.usuarios.nombre')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-soft tracking-wider">{t('admin.usuarios.email')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-soft tracking-wider">{t('admin.usuarios.empresa')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-soft tracking-wider">{t('admin.usuarios.ciudad')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-soft tracking-wider">{t('admin.usuarios.registro')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-soft tracking-wider">{t('admin.usuarios.ultimoAcceso')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-soft tracking-wider">{t('admin.usuarios.estado')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone/5">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-stone/5 transition-colors">
                    <td className="px-4 py-3 font-medium text-ink">
                      {u.nombre || u.apellidos
                        ? `${u.nombre || ''} ${u.apellidos || ''}`.trim()
                        : <span className="text-ink-soft/50 italic">{t('admin.usuarios.sinNombre')}</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{u.email}</td>
                    <td className="px-4 py-3 text-ink-soft">{u.empresa_nombre || '—'}</td>
                    <td className="px-4 py-3 text-ink-soft">{u.empresa_ciudad || '—'}</td>
                    <td className="px-4 py-3 text-ink-soft">
                      {new Date(u.created_at).toLocaleDateString('es-ES', {
                        day: '2-digit', month: 'short', year: 'numeric'
                      })}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {u.last_sign_in_at
                        ? new Date(u.last_sign_in_at).toLocaleDateString('es-ES', {
                            day: '2-digit', month: 'short', year: 'numeric'
                          })
                        : '—'
                      }
                    </td>
                    <td className="px-4 py-3">
                      {u.onboarding_completado
                        ? <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs font-medium">{t('admin.usuarios.activo')}</span>
                        : <span className="px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded-full text-xs font-medium">{t('admin.usuarios.pendiente')}</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab: Leads */}
      {activeTab === 'leads' && (
        <div className="bg-surface rounded-xl border border-stone/10 overflow-hidden">
          {leads.length === 0 ? (
            <div className="py-16 text-center text-ink-soft">
              <div className="text-4xl mb-3">📨</div>
              <div className="font-medium">{t('admin.leads.sinLeads')}</div>
              <div className="text-sm mt-1">{t('admin.leads.sinLeadsSub')}</div>
            </div>
          ) : (
            <div className="divide-y divide-stone/5">
              {leads.map(l => (
                <div key={l.id} className={`flex items-start gap-3 px-4 py-3.5 transition-colors ${l.atendido ? 'opacity-50' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-ink text-sm">{l.nombre}</div>
                    <div className="text-xs text-ink-soft mt-0.5">
                      {[l.email, l.telefono].filter(Boolean).join(' · ') || t('admin.leads.sinDatosContacto')}
                    </div>
                    {l.mensaje && <div className="text-xs text-ink mt-1.5 bg-page rounded-lg px-3 py-2">{l.mensaje}</div>}
                    <div className="text-xs text-ink-soft/50 mt-1.5">
                      {new Date(l.created_at).toLocaleString('es-ES', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                      })}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleAtendido(l.id, l.atendido)}
                    className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 transition-colors ${
                      l.atendido
                        ? 'bg-green-50 text-green-700'
                        : 'bg-gold/10 text-gold hover:bg-gold/20'
                    }`}
                  >
                    {l.atendido ? t('admin.leads.atendido') : t('admin.leads.marcarAtendido')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Notificaciones */}
      {activeTab === 'notificaciones' && (
        <div className="bg-surface rounded-xl border border-stone/10 overflow-hidden">
          {notifs.length === 0 ? (
            <div className="py-16 text-center text-ink-soft">
              <div className="text-4xl mb-3">🔔</div>
              <div className="font-medium">{t('admin.notif.sinNotificaciones')}</div>
              <div className="text-sm mt-1">{t('admin.notif.sinNotificacionesSub')}</div>
            </div>
          ) : (
            <>
              {noLeidas > 0 && (
                <div className="px-4 py-2.5 border-b border-stone/10 flex items-center justify-between bg-gold/5">
                  <span className="text-xs text-ink-soft">{t(noLeidas === 1 ? 'admin.notif.sinLeerOne' : 'admin.notif.sinLeerOther', { count: noLeidas })}</span>
                  <button
                    onClick={marcarTodasLeidas}
                    className="text-xs text-gold hover:text-gold/70 font-medium transition-colors"
                  >
                    {t('admin.notif.marcarTodasLeidas')}
                  </button>
                </div>
              )}
              <div className="divide-y divide-stone/5">
                {notifs.map(n => (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3.5 transition-colors ${
                      n.leida ? 'opacity-60' : 'bg-gold/5'
                    }`}
                  >
                    <div className="text-lg mt-0.5">
                      {n.tipo === 'nuevo_registro' ? '👤' : '🔔'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-ink text-sm">{n.titulo}</div>
                      <div className="text-xs text-ink-soft mt-0.5">{n.mensaje}</div>
                      <div className="text-xs text-ink-soft/50 mt-1">
                        {new Date(n.created_at).toLocaleString('es-ES', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </div>
                    {!n.leida && (
                      <button
                        onClick={() => marcarLeida(n.id)}
                        className="text-xs text-ink-soft hover:text-ink transition-colors flex-shrink-0 mt-1"
                        title={t('admin.notif.marcarLeida')}
                      >
                        ✓
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
