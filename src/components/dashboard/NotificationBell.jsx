import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../../hooks/useNotifications'

const PRIORIDAD_STYLE = {
  alta:  'border-l-4 border-red-500',
  media: 'border-l-4 border-orange-400',
  baja:  'border-l-4 border-gold',
}

export default function NotificationBell() {
  const { notificaciones, loading, descartar, descartarTodo } = useNotifications()
  const [abierto, setAbierto] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    function onClickFuera(e) {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false)
    }
    document.addEventListener('mousedown', onClickFuera)
    return () => document.removeEventListener('mousedown', onClickFuera)
  }, [])

  const count = notificaciones.length
  const hayUrgentes = notificaciones.some(n => n.prioridad === 'alta')

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAbierto(p => !p)}
        className="relative w-9 h-9 rounded-full flex items-center justify-center text-ink-soft hover:text-ink hover:bg-surface-alt transition-colors"
        title="Notificaciones"
      >
        <span className="text-lg">🔔</span>
        {count > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 text-white text-[9px] rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center font-bold leading-none ${hayUrgentes ? 'bg-red-500' : 'bg-gold'}`}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 mt-2 w-80 max-h-[28rem] overflow-y-auto bg-surface border border-edge rounded-xl shadow-lg z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-edge">
            <span className="font-semibold text-ink text-sm">Notificaciones</span>
            {count > 0 && (
              <button onClick={descartarTodo} className="text-xs text-ink-soft hover:text-ink">
                Descartar todas
              </button>
            )}
          </div>

          {loading ? (
            <div className="text-center text-ink-soft text-sm py-8">Cargando…</div>
          ) : count === 0 ? (
            <div className="text-center text-ink-soft text-sm py-8 px-4">
              <div className="text-2xl mb-1">✓</div>
              Todo al día, sin avisos pendientes
            </div>
          ) : (
            <div className="divide-y divide-edge">
              {notificaciones.map(n => (
                <div
                  key={n.id}
                  className={`flex gap-3 px-4 py-3 hover:bg-surface-alt transition-colors ${PRIORIDAD_STYLE[n.prioridad] || ''}`}
                >
                  <span className="text-lg flex-shrink-0">{n.icono}</span>
                  <button
                    onClick={() => { navigate(n.ruta); setAbierto(false) }}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="text-xs font-semibold text-ink">{n.titulo}</div>
                    <div className="text-xs text-ink-soft mt-0.5 line-clamp-2">{n.mensaje}</div>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); descartar(n.id) }}
                    className="text-ink-soft hover:text-red-500 text-xs flex-shrink-0 self-start"
                    title="Descartar"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
