/**
 * PlanGate — Bloquea contenido premium y muestra banner de upgrade
 *
 * Uso básico:
 *   <PlanGate feature="agente_ia">
 *     <AgenteChat />
 *   </PlanGate>
 *
 * Con conteo (límites numéricos):
 *   <PlanGate feature="clientes" currentCount={clientes.length}>
 *     <button onClick={crearCliente}>Nuevo cliente</button>
 *   </PlanGate>
 */

import { useTranslation } from 'react-i18next'
import { usePlan, PRECIO_PRO } from '../../hooks/usePlan'

export default function PlanGate({ feature, currentCount, children }) {
  const { t } = useTranslation()
  const { canUse, isTrial, trialDaysLeft, isPro } = usePlan()

  if (canUse(feature, currentCount)) {
    return children
  }

  return (
    <div className="relative">
      {/* Contenido difuminado */}
      <div className="pointer-events-none select-none opacity-30 blur-[2px]">
        {children}
      </div>

      {/* Banner de upgrade */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-surface rounded-2xl shadow-xl border border-stone/10 p-6 max-w-sm mx-4 text-center">
          <div className="text-3xl mb-3">🔒</div>
          <h3 className="font-bold text-ink text-base mb-1">
            {t('planGate.funcionExclusiva')}
          </h3>
          <p className="text-ink-soft text-sm mb-4">
            {t('planGate.paraUsar', { feature: t(`planGate.feature.${feature}`, feature) })}
          </p>

          {isTrial && (
            <div className="bg-amber-50 text-amber-700 text-xs rounded-lg px-3 py-2 mb-4">
              {t('planGate.pruebaTermina', { dias: trialDaysLeft })}
            </div>
          )}

          <a
            href="mailto:reformasxander@gmail.com?subject=Quiero el plan Pro de XANDER"
            className="inline-block w-full bg-navy text-gold font-semibold text-sm rounded-xl px-4 py-2.5 hover:bg-navy/90 transition-colors"
          >
            {t('planGate.activarPlan', { precio: PRECIO_PRO })}
          </a>
          <p className="text-xs text-ink-soft/50 mt-2">{t('planGate.sinPermanencia')}</p>
        </div>
      </div>
    </div>
  )
}

/**
 * TrialBanner — Aviso flotante cuando quedan pocos días de trial
 * Ponlo en Dashboard.jsx: <TrialBanner />
 */
export function TrialBanner() {
  const { t } = useTranslation()
  const { isTrial, trialDaysLeft } = usePlan()

  if (!isTrial || trialDaysLeft > 7) return null

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-sm text-amber-800">
        <span>⏳</span>
        <span dangerouslySetInnerHTML={{ __html: t('planGate.trialBannerText', { dias: trialDaysLeft, plural: trialDaysLeft !== 1 ? 's' : '' }) }} />
      </div>
      <a
        href="mailto:reformasxander@gmail.com?subject=Quiero el plan Pro de XANDER"
        className="flex-shrink-0 bg-amber-600 text-white text-xs font-semibold rounded-lg px-3 py-1.5 hover:bg-amber-700 transition-colors"
      >
        {t('planGate.verPlanes')}
      </a>
    </div>
  )
}
