import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase, getUID } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

export default function Referidos() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [referidos, setReferidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [copiado, setCopiado] = useState('')

  const codigo = profile?.codigo_referido || ''
  const enlace = codigo ? `${window.location.origin}/?ref=${codigo}` : ''
  const recompensaTexto = t('referidos.recompensaTexto')

  useEffect(() => {
    async function cargar() {
      const uid = await getUID()
      if (!uid) return
      const { data } = await supabase
        .from('referidos')
        .select('*')
        .eq('referrer_id', uid)
        .order('created_at', { ascending: false })
      setReferidos(data || [])
      setLoading(false)
    }
    cargar()
  }, [])

  const registrados = referidos.length
  const convertidos = referidos.filter(r => r.estado === 'convertido').length
  const recompensasGanadas = referidos.filter(r => r.recompensa_aplicada).length

  function copiar(texto, cual) {
    navigator.clipboard?.writeText(texto)
    setCopiado(cual)
    setTimeout(() => setCopiado(''), 2000)
  }

  const mensajeWhatsapp = encodeURIComponent(t('referidos.mensajeWhatsapp', { enlace }))

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-ink">{t('referidos.title')}</h1>
        <p className="text-sm text-ink-soft mt-0.5">{t('referidos.subtitle')}</p>
      </div>

      {/* Enlace de referido */}
      <div className="card">
        <h2 className="font-semibold text-ink mb-3">{t('referidos.tuEnlace')}</h2>

        {!codigo ? (
          <p className="text-sm text-ink-soft">{t('referidos.generando')}</p>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <input readOnly value={enlace} className="input flex-1 font-mono text-sm" />
              <button onClick={() => copiar(enlace, 'enlace')} className="btn-secondary whitespace-nowrap">
                {copiado === 'enlace' ? t('referidos.copiado') : t('referidos.copiarEnlace')}
              </button>
            </div>
            <div className="flex items-center gap-2 text-sm text-ink-soft mb-4">
              <span>{t('referidos.tuCodigo')}</span>
              <span className="font-mono font-bold text-gold tracking-wider">{codigo}</span>
              <button onClick={() => copiar(codigo, 'codigo')} className="text-xs text-gold hover:underline">
                {copiado === 'codigo' ? t('referidos.copiadoMin') : t('referidos.copiar')}
              </button>
            </div>
            <a
              href={`https://wa.me/?text=${mensajeWhatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-flex items-center gap-2"
            >
              {t('referidos.compartirWhatsapp')}
            </a>
          </>
        )}
      </div>

      {/* Cómo funciona */}
      <div className="card">
        <h2 className="font-semibold text-ink mb-4">{t('referidos.comoFunciona')}</h2>
        <div className="space-y-3">
          {[
            { n: '1', t: t('referidos.pasos.p1t'), d: t('referidos.pasos.p1d') },
            { n: '2', t: t('referidos.pasos.p2t'), d: t('referidos.pasos.p2d') },
            { n: '3', t: t('referidos.pasos.p3t'), d: t('referidos.pasos.p3d', { recompensa: recompensaTexto }) },
          ].map(step => (
            <div key={step.n} className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-gold/20 text-gold text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {step.n}
              </div>
              <div>
                <div className="text-sm font-semibold text-ink">{step.t}</div>
                <div className="text-xs text-ink-soft mt-0.5">{step.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats + lista */}
      <div className="card">
        <h2 className="font-semibold text-ink mb-4">{t('referidos.tusReferidos')}</h2>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="text-center bg-surface-alt rounded-lg py-3">
            <div className="text-xl font-bold text-ink">{registrados}</div>
            <div className="text-xs text-ink-soft mt-0.5">{t('referidos.registrados')}</div>
          </div>
          <div className="text-center bg-surface-alt rounded-lg py-3">
            <div className="text-xl font-bold text-ink">{convertidos}</div>
            <div className="text-xs text-ink-soft mt-0.5">{t('referidos.convertidosPro')}</div>
          </div>
          <div className="text-center bg-surface-alt rounded-lg py-3 border border-gold/30">
            <div className="text-xl font-bold text-gold-dark">{recompensasGanadas}</div>
            <div className="text-xs text-ink-soft mt-0.5">{t('referidos.mesesGanados')}</div>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-ink-soft">{t('referidos.cargando')}</p>
        ) : referidos.length === 0 ? (
          <p className="text-sm text-ink-soft">{t('referidos.sinInvitados')}</p>
        ) : (
          <div className="space-y-2">
            {referidos.map(r => (
              <div key={r.id} className="flex items-center justify-between text-sm border-b border-edge py-2 last:border-0">
                <div>
                  <div className="text-ink">
                    {t('referidos.registradoEl', { fecha: new Date(r.created_at).toLocaleDateString('es-ES') })}
                  </div>
                  {r.estado === 'convertido' && (
                    <div className="text-xs text-ink-soft mt-0.5">{r.recompensa_detalle}</div>
                  )}
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  r.estado === 'convertido'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-stone/20 text-ink-soft'
                }`}>
                  {r.estado === 'convertido' ? t('referidos.badgePro') : t('referidos.badgePendiente')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
