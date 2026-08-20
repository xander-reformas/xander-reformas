/**
 * usePlan — Estado del plan de suscripción del usuario
 *
 * Uso:
 *   const { isPro, isTrial, trialDaysLeft, canUse } = usePlan()
 *
 *   // Verificar si el usuario puede usar una función
 *   if (!canUse('clientes')) return <PlanGate feature="clientes" />
 */

import { useAuth } from './useAuth'

// ─── Límites por plan ──────────────────────────────────────────────────────────
// Durante el free tier (sin trial activo) estas son las restricciones.
// Cuando sea el momento de activar monetización real, ajusta aquí los números.
export const PLAN_LIMITS = {
  free: {
    clientes:      3,   // máximo 3 clientes
    obras:         3,
    presupuestos:  5,
    facturas:      5,
    empleados:     1,
    // funciones desactivadas en free
    agente_ia:     false,
    exportar_pdf:  false,
    nominas:       false,
    rentabilidad:  false,
  },
  trial: {
    // trial = acceso completo durante 30 días
    clientes:      Infinity,
    obras:         Infinity,
    presupuestos:  Infinity,
    facturas:      Infinity,
    empleados:     Infinity,
    agente_ia:     true,
    exportar_pdf:  true,
    nominas:       true,
    rentabilidad:  true,
  },
  pro: {
    clientes:      Infinity,
    obras:         Infinity,
    presupuestos:  Infinity,
    facturas:      Infinity,
    empleados:     Infinity,
    agente_ia:     true,
    exportar_pdf:  true,
    nominas:       true,
    rentabilidad:  true,
  },
}

// Precio orientativo (para mostrar en banners de upgrade)
// Mantener sincronizado con PRECIO_CENTIMOS en
// supabase/functions/stripe-crear-checkout-suscripcion/index.ts
export const PRECIO_PRO = '19 €/mes'
export const PRECIO_PRO_ANUAL = '190 €/año'

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function usePlan() {
  const { profile } = useAuth()

  const plan          = profile?.plan ?? 'free'
  const trialEndsAt   = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null
  const planExpiresAt = profile?.plan_expires_at ? new Date(profile.plan_expires_at) : null

  const isPro   = plan === 'pro' || plan === 'pro_annual'
  const isTrial = !isPro && trialEndsAt != null && trialEndsAt > new Date()

  // Días restantes de trial (0 si no hay trial o ya expiró)
  const trialDaysLeft = isTrial
    ? Math.max(0, Math.ceil((trialEndsAt - new Date()) / (1000 * 60 * 60 * 24)))
    : 0

  // Estado efectivo para obtener los límites correctos
  const estadoEfectivo = isPro ? 'pro' : isTrial ? 'trial' : 'free'
  const limits = PLAN_LIMITS[estadoEfectivo]

  /**
   * canUse(feature, currentCount?)
   *
   * Devuelve true si el usuario puede usar la función.
   * Si la función tiene un límite numérico, pasa el conteo actual como segundo arg.
   *
   * Ejemplos:
   *   canUse('agente_ia')          → true/false
   *   canUse('clientes', 4)        → false si free y ya tiene 4
   */
  function canUse(feature, currentCount = 0) {
    // Mientras no esté activa la monetización, todo el mundo tiene acceso completo.
    // Cambia MONETIZACION_ACTIVA a true cuando quieras empezar a restringir.
    if (!MONETIZACION_ACTIVA) return true

    const limit = limits[feature]
    if (limit === undefined) return true          // feature no gestionada = libre
    if (typeof limit === 'boolean') return limit  // feature booleana
    return currentCount < limit                   // feature con límite numérico
  }

  return {
    plan,
    isPro,
    isTrial,
    trialDaysLeft,
    trialEndsAt,
    planExpiresAt,
    estadoEfectivo,
    limits,
    canUse,
  }
}

// ─── Interruptor global ───────────────────────────────────────────────────────
// Pon esto en true cuando quieras activar las restricciones de plan.
// Mientras sea false, TODOS los usuarios tienen acceso completo (fase de captación).
const MONETIZACION_ACTIVA = false
