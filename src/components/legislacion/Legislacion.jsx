import { useState } from 'react'
import { useTranslation } from 'react-i18next'

// ─── Normativa estatal (aplica en toda España) — traducida vía i18n ───────────
const NORMATIVA_ESTATAL_KEYS = [
  { seccion: 'tiposIntervencion', icon: '🏛️', items: ['obraMenor', 'obraMayor', 'obrasComunidades'] },
  { seccion: 'seguridadSalud', icon: '⛑️', items: ['rd1627', 'epi'] },
  { seccion: 'normativaTecnica', icon: '📐', items: ['cte', 'rebt', 'rite', 'loe'] },
  { seccion: 'relacionClientes', icon: '📄', items: ['contratoObra', 'rgpd', 'facturacion'] },
]

// ─── Datos por comunidad autónoma — nombre/enlace/colegios fijos, resto vía i18n ───
const COMUNIDADES_META = [
  { id: 'andalucia', nombre: 'Andalucía', enlace: 'https://www.juntadeandalucia.es/organismos/fomentoinfraestructurasyordenaciondelterritorio', colegios: 'Colegio Oficial de Arquitectos de Andalucía Oriental / Occidental' },
  { id: 'aragon', nombre: 'Aragón', enlace: 'https://www.aragon.es/organismos/departamento-de-vertebracion-del-territorio-movilidad-y-vivienda', colegios: 'Colegio Oficial de Arquitectos de Aragón' },
  { id: 'asturias', nombre: 'Asturias', enlace: 'https://www.asturias.es/portal/site/asturias/menuitem.4b41ede42e3d8d87ea2c34f4a8a0a0a0', colegios: 'Colegio Oficial de Arquitectos de Asturias' },
  { id: 'baleares', nombre: 'Illes Balears', enlace: 'https://www.caib.es/sites/conselleriamediambient', colegios: 'Col·legi Oficial d\'Arquitectes de les Illes Balears (COAIB)' },
  { id: 'canarias', nombre: 'Canarias', enlace: 'https://www.gobiernodecanarias.org/agricultura/', colegios: 'Colegio Oficial de Arquitectos de Canarias' },
  { id: 'cantabria', nombre: 'Cantabria', enlace: 'https://www.cantabria.es/web/consejeria-de-obras-publicas', colegios: 'Colegio Oficial de Arquitectos de Cantabria' },
  { id: 'castilla-la-mancha', nombre: 'Castilla-La Mancha', enlace: 'https://www.castillalamancha.es/gobierno/fomentoyvivienda', colegios: 'Colegio Oficial de Arquitectos de Castilla-La Mancha' },
  { id: 'castilla-leon', nombre: 'Castilla y León', enlace: 'https://www.jcyl.es/web/es/medio-ambiente-vivienda-ordenacion', colegios: 'Colegio Oficial de Arquitectos de Castilla y León (COACyL)' },
  { id: 'cataluna', nombre: 'Catalunya', enlace: 'https://territori.gencat.cat', colegios: 'Col·legi d\'Arquitectes de Catalunya (COAC)' },
  { id: 'extremadura', nombre: 'Extremadura', enlace: 'https://www.juntaex.es/con05/', colegios: 'Colegio Oficial de Arquitectos de Extremadura' },
  { id: 'galicia', nombre: 'Galicia', enlace: 'https://cmatv.xunta.gal', colegios: 'Colexio Oficial de Arquitectos de Galicia (COAG)' },
  { id: 'madrid', nombre: 'Comunidad de Madrid', enlace: 'https://gestiona3.madrid.org/ayud_vivienda/run/j/AyuVivienda.icm', colegios: 'Colegio Oficial de Arquitectos de Madrid (COAM)' },
  { id: 'murcia', nombre: 'Región de Murcia', enlace: 'https://www.carm.es/web/pagina?IDCONTENIDO=1&IDTIPO=100&RASTRO=c3$m', colegios: 'Colegio Oficial de Arquitectos de Murcia' },
  { id: 'navarra', nombre: 'Navarra', enlace: 'https://www.navarra.es/es/web/territorio-y-vivienda', colegios: 'Colegio Oficial de Arquitectos Vasco-Navarro (COAVN) — Delegación Navarra' },
  { id: 'pais-vasco', nombre: 'País Vasco / Euskadi', enlace: 'https://www.euskadi.eus/gobierno-vasco/departamento-planificacion-territorial-vivienda-transporte/', colegios: 'Colegio Oficial de Arquitectos Vasco-Navarro (COAVN)' },
  { id: 'la-rioja', nombre: 'La Rioja', enlace: 'https://www.larioja.org/fomento-es', colegios: 'Colegio Oficial de Arquitectos de La Rioja' },
  { id: 'valencia', nombre: 'Comunitat Valenciana', enlace: 'https://politicaterritorial.gva.es', colegios: 'Col·legi Territorial d\'Arquitectes de València (CTAV)' },
]

const BADGE_COLORS = {
  'obligatorio': 'bg-red-100 text-red-700 border border-red-200',
  'obligatorioObraMayor': 'bg-orange-100 text-orange-700 border border-orange-200',
  'usoObligatorio': 'bg-red-100 text-red-700 border border-red-200',
  'comunicacionPrevia': 'bg-blue-100 text-blue-700 border border-blue-200',
  'licencia': 'bg-purple-100 text-purple-700 border border-purple-200',
  'acuerdoJunta': 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  'marcoGeneral': 'bg-navy/10 text-ink border border-navy/20',
  'recomendadoSiempre': 'bg-green-100 text-green-700 border border-green-200',
}

export default function Legislacion() {
  const { t } = useTranslation()
  const [ccaaId, setCcaaId] = useState('')
  const comunidadesTr = t('legislacion.comunidadesTr', { returnObjects: true })
  const COMUNIDADES = COMUNIDADES_META.map(m => ({ ...m, ...(comunidadesTr[m.id] || {}) }))
  const ccaa = COMUNIDADES.find(c => c.id === ccaaId)

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">{t('legislacion.title')}</h1>
        <p className="text-sm text-ink-soft mt-0.5">{t('legislacion.subtitle')}</p>
      </div>

      {/* Selector CCAA */}
      <div className="card mb-6 bg-navy text-white">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <div className="text-xs font-bold uppercase tracking-widest text-gold mb-1">{t('legislacion.selector.label')}</div>
            <p className="text-sm text-white/70">{t('legislacion.selector.desc')}</p>
          </div>
          <select
            value={ccaaId}
            onChange={e => setCcaaId(e.target.value)}
            className="bg-white text-navy border border-white/20 rounded-xl px-4 py-2.5 text-sm min-w-[220px] focus:outline-none focus:ring-2 focus:ring-gold"
          >
            <option value="">{t('legislacion.selector.placeholder')}</option>
            {COMUNIDADES.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Ficha CCAA seleccionada — contenido normativo específico de España, se mantiene en español */}
      {ccaa && (
        <div className="card border-2 border-gold/40 mb-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-gold mb-1">{t('legislacion.ccaa.badgeNormativa')}</div>
              <h2 className="text-xl font-bold text-ink">{ccaa.nombre}</h2>
              <p className="text-sm text-ink-soft mt-1">{ccaa.ley}</p>
            </div>
            <a
              href={ccaa.enlace}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-gold text-xs whitespace-nowrap flex-shrink-0"
            >
              {t('legislacion.ccaa.portalOficial')}
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-blue-600 mb-1">{t('legislacion.ccaa.obraMenor')}</div>
              <div className="font-semibold text-ink text-sm">{ccaa.menorNombre}</div>
              <div className="text-xs text-ink-soft mt-1">{t('legislacion.ccaa.obraMenorDesc')}</div>
            </div>
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-purple-600 mb-1">{t('legislacion.ccaa.obraMayor')}</div>
              <div className="font-semibold text-ink text-sm">{ccaa.mayorNombre}</div>
              <div className="text-xs text-ink-soft mt-1">{t('legislacion.ccaa.obraMayorDesc')}</div>
            </div>
          </div>

          <div className="bg-page rounded-xl p-4 mb-3">
            <div className="text-xs font-bold uppercase tracking-wide text-ink-soft mb-2">{t('legislacion.ccaa.organismoCompetente')}</div>
            <div className="text-sm text-ink">{ccaa.organismo}</div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-3">
            <div className="text-xs font-bold uppercase tracking-wide text-amber-700 mb-2">{t('legislacion.ccaa.aspectosDestacados', { nombre: ccaa.nombre })}</div>
            <p className="text-sm text-ink-soft leading-relaxed">{ccaa.notas}</p>
          </div>

          <div className="text-xs text-ink-soft/60 flex items-center gap-1.5">
            <span>🏛️</span>
            <span>{ccaa.colegios}</span>
          </div>
        </div>
      )}

      {/* Aviso general */}
      <div className="bg-gold/10 border border-gold/30 rounded-xl px-4 py-3 mb-4 text-sm text-ink-soft">
        ℹ️ <strong>{t('legislacion.avisoTitle')}</strong> {t('legislacion.avisoText')}
      </div>

      {/* Aviso de contenido oficial en español */}
      <div className="mb-8 bg-navy/5 border border-navy/15 rounded-xl px-4 py-3 flex items-start gap-3 text-xs text-ink-soft">
        <span className="text-base flex-shrink-0">ℹ️</span>
        <div>
          <div className="font-semibold text-ink">{t('legalAviso.titulo')}</div>
          <div className="mt-0.5">{t('legalAviso.texto')}</div>
        </div>
      </div>

      {/* Normativa estatal — contenido normativo español, traducido con aviso de contenido oficial */}
      <div className="space-y-10">
        {NORMATIVA_ESTATAL_KEYS.map(sec => (
          <div key={sec.seccion}>
            <div className="flex items-center gap-3 mb-5">
              <span className="text-2xl">{sec.icon}</span>
              <div>
                <h2 className="text-lg font-bold text-ink">{t(`legislacion.normativaSecciones.${sec.seccion}`)}</h2>
                <div className="text-xs text-ink-soft">{t('legislacion.estatalCaption')}</div>
              </div>
            </div>
            <div className="space-y-4">
              {sec.items.map(itemKey => {
                const item = t(`legislacion.items.${itemKey}`, { returnObjects: true })
                return (
                  <div key={itemKey} className="card">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-ink mb-1">{item.titulo}</h3>
                        <p className="text-sm text-ink-soft leading-relaxed">{item.desc}</p>
                      </div>
                      <div className="flex-shrink-0 text-right space-y-1">
                        <div className={`text-xs font-semibold px-3 py-1 rounded-full ${BADGE_COLORS[item.tipo] || 'bg-navy/10 text-ink'}`}>
                          {t(`legislacion.tipo.${item.tipo}`)}
                        </div>
                        <div className="text-xs text-ink-soft">{t(`legislacion.plazo.${item.plazo}`)}</div>
                      </div>
                    </div>
                    {item.incluye && (
                      <div className="bg-page rounded-xl p-3 mt-3">
                        <div className="text-xs font-semibold text-ink-soft uppercase tracking-wide mb-2">{t('legislacion.incluyeAplica')}</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                          {item.incluye.map((i, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs text-ink">
                              <span className="text-gold flex-shrink-0">✓</span>
                              {i}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer recursos */}
      <div className="mt-12 card bg-navy">
        <div className="text-xs font-bold uppercase tracking-widest text-gold mb-4">{t('legislacion.recursosUtiles')}</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { label: 'Código Técnico de la Edificación', url: 'https://www.codigotecnico.org' },
            { label: 'REBT — Ministerio para la Transición Ecológica', url: 'https://www.miteco.gob.es/es/energia/eficiencia/instalaciones-electricas/rebt.html' },
            { label: 'Ley de Ordenación de la Edificación (LOE)', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1999-21567' },
            { label: 'Seguridad y Salud — INSST', url: 'https://www.insst.es/legislacion/legislacion-espanola/obras-de-construccion' },
            { label: 'RGPD — Agencia Española Protección Datos', url: 'https://www.aepd.es' },
            { label: 'Catastro — Sede electrónica', url: 'https://www.sedecatastro.gob.es' },
          ].map(r => (
            <a key={r.label} href={r.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-white/80 hover:text-gold text-xs transition-colors py-1">
              <span className="text-gold/60">↗</span>
              {r.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
