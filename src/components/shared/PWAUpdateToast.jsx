import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Gestiona el ciclo de vida del Service Worker de la PWA:
 * - Avisa cuando hay una nueva versión y permite actualizarla con un clic.
 * - Confirma brevemente cuando la app ya puede usarse sin conexión.
 * Se monta una única vez, a nivel global (fuera de las rutas).
 */
export default function PWAUpdateToast() {
  const { t } = useTranslation()
  const [showOfflineReady, setShowOfflineReady] = useState(false)

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Comprueba si hay una versión nueva cada hora mientras la app está abierta.
      if (registration) {
        setInterval(() => {
          registration.update().catch(() => {})
        }, 60 * 60 * 1000)
      }
    },
  })

  useEffect(() => {
    if (offlineReady) {
      setShowOfflineReady(true)
      const t = setTimeout(() => {
        setShowOfflineReady(false)
        setOfflineReady(false)
      }, 4000)
      return () => clearTimeout(t)
    }
  }, [offlineReady, setOfflineReady])

  const cerrarOfflineReady = () => {
    setShowOfflineReady(false)
    setOfflineReady(false)
  }

  const actualizar = () => updateServiceWorker(true)
  const descartarActualizacion = () => setNeedRefresh(false)

  if (!needRefresh && !showOfflineReady) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 items-end">
      {needRefresh && (
        <div className="bg-surface border border-edge rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 max-w-xs animate-in fade-in slide-in-from-bottom-2">
          <span className="text-lg flex-shrink-0">⬆️</span>
          <div className="flex-1 text-sm text-ink">
            {t('pwaUpdate.nuevaVersion')}
          </div>
          <div className="flex flex-col gap-1 flex-shrink-0">
            <button
              onClick={actualizar}
              className="bg-gold text-navy text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-gold-light transition-colors"
            >
              {t('pwaUpdate.actualizar')}
            </button>
            <button
              onClick={descartarActualizacion}
              className="text-[11px] text-ink-soft hover:text-ink"
            >
              {t('pwaUpdate.ahoraNo')}
            </button>
          </div>
        </div>
      )}

      {showOfflineReady && !needRefresh && (
        <div className="bg-surface border border-edge rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 max-w-xs">
          <span className="text-lg flex-shrink-0">✓</span>
          <div className="flex-1 text-sm text-ink">
            {t('pwaUpdate.yaFuncionaOffline')}
          </div>
          <button onClick={cerrarOfflineReady} className="text-ink-soft hover:text-ink text-sm flex-shrink-0">
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
