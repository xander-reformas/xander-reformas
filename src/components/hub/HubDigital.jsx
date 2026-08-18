const SECCIONES = [
  {
    titulo: 'Presencia local (Google)',
    icon: '🗺️',
    items: [
      {
        titulo: 'Google Business Profile',
        desc: 'Tu ficha en Google Maps. Fundamental para que te encuentren clientes locales en Madrid.',
        tags: ['Gratis', 'Prioritario'],
        url: 'https://business.google.com',
        tips: ['Sube fotos de obras terminadas (antes y después)', 'Responde todas las reseñas, buenas y malas', 'Publica cada reforma completada como actualización'],
      },
      {
        titulo: 'Google Ads local',
        desc: 'Anuncios geolocalizados en Madrid para aparecer cuando alguien busca "empresa reformas Madrid".',
        tags: ['De pago'],
        tips: ['Empieza con 5-10€/día y ajusta', 'Segmenta por código postal de tus zonas objetivo', 'Usa extensiones de llamada directa'],
      },
    ],
  },
  {
    titulo: 'Plataformas de reformas',
    icon: '🏠',
    items: [
      {
        titulo: 'Habitissimo',
        desc: 'La plataforma líder en España para captar clientes de reformas. Alta visibilidad con buenas valoraciones.',
        tags: ['Pago por lead'],
        url: 'https://www.habitissimo.es/profesionales',
        tips: ['Responde peticiones en menos de 1h (el algoritmo te premia)', 'Pide valoración a cada cliente satisfecho', 'Completa el perfil al 100% con fotos reales'],
      },
      {
        titulo: 'Houzz',
        desc: 'Red social de diseño de interiores y reforma. Muy buena para el segmento medio-alto.',
        tags: ['Gratis', 'Clase media-alta'],
        url: 'https://www.houzz.es/pro',
        tips: ['Sube proyectos completos con descripciones detalladas', 'Usa etiquetas de estilo y materiales', 'El cliente de Houzz valora calidad, no precio'],
      },
      {
        titulo: 'Milanuncios / Wallapop',
        desc: 'Para obras pequeñas y mantenimiento. Alta demanda pero precio más ajustado.',
        tags: ['Gratis', 'Volumen alto'],
        tips: ['Separa anuncios por tipo de trabajo', 'Pon precio orientativo para filtrar clientes', 'Actualiza los anuncios cada semana para visibilidad'],
      },
    ],
  },
  {
    titulo: 'Redes sociales',
    icon: '📱',
    items: [
      {
        titulo: 'Instagram',
        desc: 'Visual y potente para reformas. El cliente de clase media-alta usa Instagram para inspirarse antes de contratar.',
        tags: ['Gratis', 'Visual'],
        tips: ['Publica antes/después de cada obra', 'Usa Reels con el proceso de la obra (30-60 seg)', 'Hashtags: #reformasMadrid #reformaIntegral #interiorismo', 'Stories con el día a día de la obra conectan con el público'],
      },
      {
        titulo: 'LinkedIn',
        desc: 'Para posicionarte como profesional y captar clientes empresariales (cambios de uso, locales).',
        tags: ['Gratis', 'B2B'],
        tips: ['Comparte casos de éxito con métricas (m² reformados, plazo cumplido)', 'Conecta con arquitectos y gestores de fincas', 'Artículos sobre tendencias en reformas dan autoridad'],
      },
    ],
  },
  {
    titulo: 'Herramientas de productividad',
    icon: '⚙️',
    items: [
      {
        titulo: 'WhatsApp Business',
        desc: 'Imprescindible. Perfil de empresa, catálogo de servicios, respuestas rápidas automatizadas.',
        tags: ['Gratis'],
        tips: ['Configura mensaje de bienvenida automático', 'Crea etiquetas: Nuevo lead, Presupuesto enviado, Cliente activo', 'Mensaje de ausencia fuera de horario laboral'],
      },
      {
        titulo: 'Canva',
        desc: 'Diseño de presupuestos visuales, presentaciones y contenido para redes.',
        tags: ['Gratis / Pro'],
        url: 'https://www.canva.com',
        tips: ['Usa las plantillas de "antes y después"', 'Crea una plantilla de dossier de empresa con tu branding XANDER'],
      },
    ],
  },
]

export default function HubDigital() {
  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Hub Digital</h1>
        <p className="text-sm text-ink-soft mt-0.5">Estrategia de captación y presencia online para tu negocio de reformas</p>
      </div>

      <div className="bg-navy rounded-xl p-5 mb-8 flex items-start gap-4">
        <div className="text-3xl">🎯</div>
        <div>
          <div className="text-gold font-bold mb-1">Tu objetivo: cliente medio-alto en Madrid</div>
          <div className="text-white/70 text-sm leading-relaxed">
            Este perfil de cliente busca calidad y confianza antes que precio. Prioriza Google Business y Houzz sobre plataformas de precio bajo. Cada foto de obra terminada bien ejecutada vale más que cualquier anuncio.
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {SECCIONES.map(sec => (
          <div key={sec.titulo}>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">{sec.icon}</span>
              <h2 className="text-lg font-bold text-ink">{sec.titulo}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sec.items.map(item => (
                <div key={item.titulo} className="card hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-ink">{item.titulo}</h3>
                    <div className="flex flex-wrap gap-1 flex-shrink-0">
                      {item.tags.map(t => (
                        <span key={t} className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          t === 'Gratis' ? 'bg-green-100 text-green-700' :
                          t === 'Prioritario' ? 'bg-gold/20 text-gold-dark' :
                          t === 'De pago' ? 'bg-red-100 text-red-600' :
                          'bg-edge text-ink-soft'
                        }`}>{t}</span>
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-ink-soft mb-3">{item.desc}</p>
                  <div className="space-y-1">
                    {item.tips.map((tip, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-ink-soft">
                        <span className="text-gold mt-0.5 flex-shrink-0">→</span>
                        <span>{tip}</span>
                      </div>
                    ))}
                  </div>
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer"
                      className="inline-block mt-4 text-xs font-semibold text-gold hover:text-gold-dark">
                      Abrir plataforma →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
