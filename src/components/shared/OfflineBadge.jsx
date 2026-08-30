import { useTranslation } from 'react-i18next'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'

/** Indicador discreto en la barra superior cuando no hay conexión a internet. */
export default function OfflineBadge() {
  const { t } = useTranslation()
  const online = useOnlineStatus()
  if (online) return null

  return (
    <div
      className="flex items-center gap-1.5 text-[11px] font-medium text-orange-700 bg-orange-100 border border-orange-200 rounded-full px-2.5 py-1"
      title={t('offlineBadge.tooltip')}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
      {t('offlineBadge.label')}
    </div>
  )
}
