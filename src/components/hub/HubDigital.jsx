import { useTranslation } from 'react-i18next'

const SECCIONES = [
  {
    key: 'presenciaLocal',
    icon: '🗺️',
    items: [
      { key: 'gbp', tags: ['gratis', 'prioritario'], url: 'https://business.google.com' },
      { key: 'adsLocal', tags: ['pago'] },
    ],
  },
  {
    key: 'plataformas',
    icon: '🏠',
    items: [
      { key: 'habitissimo', tags: ['pagoPorLead'], url: 'https://www.habitissimo.es/profesionales' },
      { key: 'houzz', tags: ['gratis', 'claseMediaAlta'], url: 'https://www.houzz.es/pro' },
      { key: 'milanuncios', tags: ['gratis', 'volumenAlto'] },
    ],
  },
  {
    key: 'redesSociales',
    icon: '📱',
    items: [
      { key: 'instagram', tags: ['gratis', 'visual'] },
      { key: 'linkedin', tags: ['gratis', 'b2b'] },
    ],
  },
  {
    key: 'productividad',
    icon: '⚙️',
    items: [
      { key: 'whatsapp', tags: ['gratis'] },
      { key: 'canva', tags: ['gratisPro'], url: 'https://www.canva.com' },
    ],
  },
]

const TAG_COLOR = {
  gratis: 'bg-green-100 text-green-700',
  prioritario: 'bg-gold/20 text-gold-dark',
  pago: 'bg-red-100 text-red-600',
}

export default function HubDigital() {
  const { t } = useTranslation()

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">{t('hub.title')}</h1>
        <p className="text-sm text-ink-soft mt-0.5">{t('hub.subtitle')}</p>
      </div>

      <div className="bg-navy rounded-xl p-5 mb-8 flex items-start gap-4">
        <div className="text-3xl">🎯</div>
        <div>
          <div className="text-gold font-bold mb-1">{t('hub.objetivoTitle')}</div>
          <div className="text-white/70 text-sm leading-relaxed">{t('hub.objetivoText')}</div>
        </div>
      </div>

      <div className="space-y-8">
        {SECCIONES.map(sec => (
          <div key={sec.key}>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">{sec.icon}</span>
              <h2 className="text-lg font-bold text-ink">{t(`hub.secciones.${sec.key}.titulo`)}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sec.items.map(item => {
                const base = `hub.secciones.${sec.key}.items.${item.key}`
                const tips = t(`${base}.tips`, { returnObjects: true })
                return (
                  <div key={item.key} className="card hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-bold text-ink">{t(`${base}.titulo`)}</h3>
                      <div className="flex flex-wrap gap-1 flex-shrink-0">
                        {item.tags.map(tagKey => (
                          <span key={tagKey} className={`text-xs px-2 py-0.5 rounded-full font-medium ${TAG_COLOR[tagKey] || 'bg-edge text-ink-soft'}`}>
                            {t(`hub.tag.${tagKey}`)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-ink-soft mb-3">{t(`${base}.desc`)}</p>
                    <div className="space-y-1">
                      {Array.isArray(tips) && tips.map((tip, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-ink-soft">
                          <span className="text-gold mt-0.5 flex-shrink-0">→</span>
                          <span>{tip}</span>
                        </div>
                      ))}
                    </div>
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer"
                        className="inline-block mt-4 text-xs font-semibold text-gold hover:text-gold-dark">
                        {t('hub.abrirPlataforma')}
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
