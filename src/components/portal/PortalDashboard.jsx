import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { usePortalCliente } from '../../hooks/usePortalCliente'
import { supabase } from '../../lib/supabase'

// Debe reflejar el mismo orden que ETAPAS en src/components/obras/Obras.jsx
// (es la lista de etapas de una reforma, no cambia con frecuencia).
const ETAPAS = [
  'Planificación', 'Inicio de obra', 'Demolición', 'Albañilería',
  'Instalaciones', 'Revestimientos', 'Carpintería', 'Pintura', 'Acabados', 'Entrega'
]

const ESTADO_LABEL = {
  pendiente: 'Pendiente de inicio',
  en_curso: 'En curso',
  pausada: 'Pausada',
  completada: 'Completada',
  cancelada: 'Cancelada',
}

const BUCKET = 'obras-fotos'

function EtapaProgreso({ etapa }) {
  const idx = ETAPAS.indexOf(etapa)
  const pct = idx < 0 ? 0 : Math.round((idx / (ETAPAS.length - 1)) * 100)
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-semibold text-ink-soft uppercase tracking-wide">Progreso</span>
        <span className="text-xs font-bold text-gold-dark">{etapa || ETAPAS[0]} · {pct}%</span>
      </div>
      <div className="h-2.5 bg-edge rounded-full overflow-hidden">
        <div className="h-full bg-gold rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] text-ink-soft/60">{ETAPAS[0]}</span>
        <span className="text-[10px] text-ink-soft/60">{ETAPAS[ETAPAS.length - 1]}</span>
      </div>
    </div>
  )
}

function ObraCard({ obra }) {
  const [fotos, setFotos] = useState([])
  const [cargandoFotos, setCargandoFotos] = useState(true)

  useEffect(() => { cargarFotos() }, [obra.id])

  async function cargarFotos() {
    setCargandoFotos(true)
    const { data } = await supabase.storage.from(BUCKET).list(obra.id + '/', { sortBy: { column: 'created_at', order: 'desc' } })
    const archivos = (data || []).filter(f => f.name && !f.name.startsWith('.') && f.id)
    if (!archivos.length) { setFotos([]); setCargandoFotos(false); return }
    const paths = archivos.map(f => `${obra.id}/${f.name}`)
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600)
    setFotos(archivos.map((f, i) => ({ url: signed?.[i]?.signedUrl || '', nombre: f.name })))
    setCargandoFotos(false)
  }

  // Solo lo que el profesional ha marcado como visible para el cliente
  // (los cambios de etapa siempre lo son) — el resto de notas internas no se muestran aquí.
  const novedades = (obra.seguimiento || [])
    .filter(e => e.tipo === 'etapa' || e.visible_cliente)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))

  return (
    <div className="card mb-6">
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-ink">{obra.nombre}</h2>
          {obra.direccion_obra && <div className="text-sm text-ink-soft mt-0.5">📍 {obra.direccion_obra}</div>}
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gold/20 text-gold-dark">
          {ESTADO_LABEL[obra.estado] || obra.estado}
        </span>
      </div>

      <EtapaProgreso etapa={obra.etapa} />

      {/* Fotos */}
      <div className="mt-6">
        <div className="text-xs font-semibold text-ink-soft uppercase tracking-wide mb-2">Fotos del progreso</div>
        {cargandoFotos ? (
          <div className="text-sm text-ink-soft py-4 text-center">Cargando fotos…</div>
        ) : fotos.length === 0 ? (
          <div className="text-sm text-ink-soft py-4 text-center">Todavía no hay fotos subidas.</div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {fotos.map((f, i) => (
              <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden bg-page aspect-square">
                <img src={f.url} alt={f.nombre} className="w-full h-full object-cover hover:scale-105 transition-transform" />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Novedades / próximos pasos */}
      <div className="mt-6">
        <div className="text-xs font-semibold text-ink-soft uppercase tracking-wide mb-2">Novedades</div>
        {novedades.length === 0 ? (
          <div className="text-sm text-ink-soft py-4 text-center">Todavía no hay novedades publicadas.</div>
        ) : (
          <div className="space-y-3">
            {novedades.map(n => (
              <div key={n.id} className="flex gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                  n.tipo === 'etapa' ? 'bg-gold/20 text-gold-dark' : 'bg-navy text-white'
                }`}>
                  {n.tipo === 'etapa' ? '→' : '✍'}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-ink leading-relaxed">{n.nota}</p>
                  <span className="text-xs text-ink-soft/60">
                    {new Date(n.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function PortalDashboard() {
  const { signOut } = useAuth()
  const { cliente, loading } = usePortalCliente()
  const [obras, setObras] = useState([])
  const [cargandoObras, setCargandoObras] = useState(true)

  useEffect(() => {
    if (!cliente) return
    supabase.from('obras').select('*').eq('cliente_id', cliente.id).order('created_at', { ascending: false })
      .then(({ data }) => { setObras(data || []); setCargandoObras(false) })
  }, [cliente])

  if (loading) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-page">
      {/* Header */}
      <div className="bg-navy px-6 py-4 flex items-center justify-between">
        <div>
          <div className="text-lg font-black">
            <span className="text-gold">X</span>
            <span className="text-white">ANDER</span>
            <span className="text-[10px] tracking-widest text-white/40 ml-2 align-middle">PORTAL DEL CLIENTE</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {cliente?.nombre && <span className="text-white/70 text-sm hidden sm:inline">{cliente.nombre}</span>}
          <button onClick={signOut} className="text-white/60 hover:text-white text-xs font-semibold">Cerrar sesión</button>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-ink mb-1">El estado de tu obra</h1>
        <p className="text-sm text-ink-soft mb-6">Aquí puedes seguir el avance, ver las fotos del progreso y las últimas novedades.</p>

        {cargandoObras ? (
          <div className="text-center py-16 text-ink-soft text-sm">Cargando…</div>
        ) : obras.length === 0 ? (
          <div className="card text-center py-16">
            <div className="text-5xl mb-3">🔨</div>
            <div className="font-bold text-ink mb-1">Todavía no hay obras vinculadas a tu cuenta</div>
            <div className="text-sm text-ink-soft">En cuanto empecemos a trabajar en tu proyecto, lo verás reflejado aquí.</div>
          </div>
        ) : (
          obras.map(o => <ObraCard key={o.id} obra={o} />)
        )}
      </div>
    </div>
  )
}
