import { useState } from 'react'
import { useTranslation } from 'react-i18next'

// ─── Normativa estatal (aplica en toda España) ────────────────────────────────
const NORMATIVA_ESTATAL = [
  {
    titulo: 'Tipos de intervención en obra',
    icon: '🏛️',
    items: [
      {
        titulo: 'Obra menor / Comunicación previa o Declaración Responsable',
        tipo: 'Comunicación previa',
        plazo: '1–4 semanas aprox.',
        desc: 'Intervenciones que no afectan a estructura, fachada ni elementos comunes. La denominación exacta y el umbral varían por CCAA y municipio — selecciona tu comunidad para ver el detalle.',
        incluye: ['Reforma de baño o cocina', 'Cambio de distribución no estructural', 'Pladur / tabiquería interior', 'Alicatados y solados', 'Instalaciones (fontanería, electricidad)', 'Pintura y revestimientos'],
      },
      {
        titulo: 'Obra mayor / Licencia urbanística',
        tipo: 'Licencia',
        plazo: '1–6 meses aprox.',
        desc: 'Cuando se afecta a estructura, fachada, se produce cambio de uso o la superficie es considerable. Requiere proyecto firmado por técnico competente (arquitecto o arquitecto técnico según el caso).',
        incluye: ['Cambio de uso de local a vivienda', 'Modificación de estructura o cimentación', 'Ampliación de superficie', 'Reforma de fachada o cubierta', 'Legalización de obras ejecutadas sin licencia'],
      },
      {
        titulo: 'Obras en comunidades de vecinos',
        tipo: 'Acuerdo de Junta',
        plazo: 'Variable',
        desc: 'Cualquier obra que afecte a elementos comunes requiere acuerdo de la Junta de Propietarios según la LPH (Ley 49/1960). El quórum varía según el tipo de actuación.',
        incluye: ['Instalación de ascensor', 'Reforma de fachada o portal', 'Obras en zonas comunes', 'Instalaciones que atraviesen elementos comunes', 'Supresión de barreras arquitectónicas'],
      },
    ],
  },
  {
    titulo: 'Seguridad y salud en obra',
    icon: '⛑️',
    items: [
      {
        titulo: 'Real Decreto 1627/1997 — Seguridad en obras',
        tipo: 'Obligatorio',
        plazo: 'Antes del inicio',
        desc: 'Aplica en toda España. Para obras con proyecto, debe nombrarse Coordinador de Seguridad y Salud. En obras sin proyecto, las obligaciones recaen en el contratista.',
        incluye: ['Aviso previo a la Autoridad Laboral', 'Plan de Seguridad y Salud (obras >500 m² o >30 días)', 'Libro de Subcontratación', 'Apertura de centro de trabajo', 'Coordinador de S&S en obras con varios contratistas'],
      },
      {
        titulo: 'EPI — Equipos de Protección Individual',
        tipo: 'Uso obligatorio',
        plazo: 'Siempre',
        desc: 'El Real Decreto 773/1997 obliga a proporcionar y usar EPIs adecuados al riesgo. Su incumplimiento puede implicar sanciones graves y responsabilidad civil y penal.',
        incluye: ['Casco de seguridad', 'Calzado de seguridad (puntera + antiperforación)', 'Guantes adecuados al trabajo', 'Gafas de protección en demoliciones', 'Arnés y línea de vida en trabajos en altura', 'Mascarilla en trabajos con polvo o fibras'],
      },
    ],
  },
  {
    titulo: 'Normativa técnica',
    icon: '📐',
    items: [
      {
        titulo: 'CTE — Código Técnico de la Edificación (RD 314/2006)',
        tipo: 'Obligatorio en obra mayor',
        plazo: 'Aplicación constante',
        desc: 'Marco normativo de carácter estatal que establece las exigencias básicas de calidad de los edificios y sus instalaciones. Aplica especialmente en rehabilitaciones integrales y cambios de uso.',
        incluye: ['DB-SI: Seguridad en caso de incendio', 'DB-SUA: Seguridad de utilización y accesibilidad', 'DB-HS: Salubridad (humedades, ventilación, agua)', 'DB-HE: Ahorro de energía', 'DB-SE: Seguridad estructural', 'DB-HR: Protección frente al ruido'],
      },
      {
        titulo: 'REBT — Reglamento Electrotécnico (RD 842/2002)',
        tipo: 'Obligatorio',
        plazo: 'Aplicación constante',
        desc: 'Toda instalación eléctrica nueva o modificada debe cumplir el REBT. Requiere instalador autorizado por la CCAA y certificado de instalación para el trámite ante la distribuidora.',
        incluye: ['Instalador eléctrico con carnet habilitado', 'Certificado de instalación eléctrica', 'Inscripción en el órgano competente de la CCAA', 'Inspección preceptiva en instalaciones de cierta entidad'],
      },
      {
        titulo: 'RITE — Reglamento Instalaciones Térmicas (RD 1027/2007)',
        tipo: 'Obligatorio',
        plazo: 'Aplicación constante',
        desc: 'Regula el diseño, dimensionado, ejecución, mantenimiento e inspección de las instalaciones de climatización, agua caliente sanitaria y ventilación.',
        incluye: ['Instalador acreditado por la CCAA', 'Proyecto o memoria técnica según potencia', 'Certificado de instalación para el trámite de puesta en marcha', 'Mantenimiento periódico obligatorio'],
      },
      {
        titulo: 'LOE — Ley de Ordenación de la Edificación (Ley 38/1999)',
        tipo: 'Marco general',
        plazo: 'Siempre',
        desc: 'Define los agentes de la edificación, sus obligaciones y las garantías del proceso constructivo. Fundamental para entender responsabilidades y plazos de garantía.',
        incluye: ['Garantía de 1 año: acabados y terminaciones', 'Garantía de 3 años: habitabilidad', 'Garantía de 10 años: daños estructurales', 'Seguro decenal obligatorio en obra nueva de viviendas', 'Responsabilidad solidaria de los agentes'],
      },
    ],
  },
  {
    titulo: 'Relación con clientes y obligaciones fiscales',
    icon: '📄',
    items: [
      {
        titulo: 'Contrato de obra',
        tipo: 'Recomendado siempre',
        plazo: 'Antes del inicio',
        desc: 'El Código Civil regula el contrato de obra en toda España (arts. 1588–1600). Protege a ambas partes. Debe detallar trabajos, materiales, plazos, precios y condiciones de modificación.',
        incluye: ['Descripción detallada de trabajos y materiales', 'Plazo de ejecución y penalizaciones', 'Forma y calendario de pagos', 'Procedimiento para extras y modificaciones', 'Garantías según LOE', 'Cláusula de resolución de conflictos'],
      },
      {
        titulo: 'RGPD y LOPDGDD — Protección de datos',
        tipo: 'Obligatorio',
        plazo: 'Inmediato',
        desc: 'El Reglamento General de Protección de Datos (UE 2016/679) y la LOPDGDD (Ley Orgánica 3/2018) regulan el tratamiento de datos personales de clientes en toda España.',
        incluye: ['Cláusula informativa en presupuestos y contratos', 'Política de privacidad si tienes web o app', 'Registro de actividades de tratamiento', 'No ceder datos a terceros sin consentimiento', 'Derecho de supresión y acceso del interesado'],
      },
      {
        titulo: 'Facturación y obligaciones como autónomo',
        tipo: 'Obligatorio',
        plazo: 'Siempre',
        desc: 'Como autónomo (RETA), debes emitir factura por cada trabajo, declarar IVA trimestralmente (modelo 303) e IRPF (modelo 130 o retenciones). La ley antifraude exige software de facturación homologado desde 2025.',
        incluye: ['Alta en IAE (epígrafe 501–505 según actividad)', 'Facturación con todos los elementos legales', 'Declaración trimestral de IVA (mod. 303)', 'Pago fraccionado IRPF (mod. 130)', 'Conservación de facturas 4 años (IRPF) / 10 años (mercantil)'],
      },
    ],
  },
]

// ─── Datos por comunidad autónoma ─────────────────────────────────────────────
const COMUNIDADES = [
  {
    id: 'andalucia', nombre: 'Andalucía',
    ley: 'Ley 7/2021 LISTA (Ley de Impulso para la Sostenibilidad del Territorio)',
    menorNombre: 'Declaración Responsable Urbanística',
    mayorNombre: 'Licencia Urbanística',
    organismo: 'Ayuntamiento + Junta de Andalucía (Consejería de Fomento)',
    notas: 'La LISTA simplificó el régimen de licencias. Muchas obras antes sujetas a licencia pasan a Declaración Responsable. Cada municipio adapta el régimen mediante sus ordenanzas. Destacan las zonas de especial protección (litoral, centros históricos) con requisitos adicionales.',
    enlace: 'https://www.juntadeandalucia.es/organismos/fomentoinfraestructurasyordenaciondelterritorio',
    colegios: 'Colegio Oficial de Arquitectos de Andalucía Oriental / Occidental',
  },
  {
    id: 'aragon', nombre: 'Aragón',
    ley: 'Decreto Legislativo 1/2014 — Ley Urbanística de Aragón (LUArg)',
    menorNombre: 'Comunicación Previa',
    mayorNombre: 'Licencia Urbanística',
    organismo: 'Ayuntamiento + Gobierno de Aragón (Dpto. de Vertebración del Territorio)',
    notas: 'En Zaragoza capital rige la Ordenanza Municipal de Edificación. La comunicación previa aplica a obras de escasa entidad. Las zonas de protección patrimonial requieren informe previo de Patrimonio Cultural de Aragón.',
    enlace: 'https://www.aragon.es/organismos/departamento-de-vertebracion-del-territorio-movilidad-y-vivienda',
    colegios: 'Colegio Oficial de Arquitectos de Aragón',
  },
  {
    id: 'asturias', nombre: 'Asturias',
    ley: 'Decreto Legislativo 1/2004 — Texto Refundido Ley del Suelo (TROTU)',
    menorNombre: 'Comunicación Previa',
    mayorNombre: 'Licencia Urbanística',
    organismo: 'Ayuntamiento + Principado de Asturias (Consejería de Ordenación del Territorio)',
    notas: 'El litoral asturiano y las áreas del interior montañoso tienen restricciones específicas. Los conjuntos históricos de Oviedo, Gijón y Avilés requieren tramitación adicional ante la Consejería de Cultura.',
    enlace: 'https://www.asturias.es/portal/site/asturias/menuitem.4b41ede42e3d8d87ea2c34f4a8a0a0a0',
    colegios: 'Colegio Oficial de Arquitectos de Asturias',
  },
  {
    id: 'baleares', nombre: 'Illes Balears',
    ley: 'Ley 12/2017 — Urbanismo de las Illes Balears (LUIB)',
    menorNombre: 'Comunicació Prèvia / Declaració Responsable',
    mayorNombre: 'Llicència Urbanística',
    organismo: 'Ajuntament + Govern de les Illes Balears (Conselleria de Medi Ambient i Territori)',
    notas: 'La LUIB diferencia entre intervenciones en suelo urbano consolidado y en zonas protegidas. Los Consells Insulars (Mallorca, Menorca, Eivissa, Formentera) tienen competencias urbanísticas propias. Especial atención a las zonas de costa y ATIPs.',
    enlace: 'https://www.caib.es/sites/conselleriamediambient',
    colegios: 'Col·legi Oficial d\'Arquitectes de les Illes Balears (COAIB)',
  },
  {
    id: 'canarias', nombre: 'Canarias',
    ley: 'Ley 4/2017 — Suelo y Espacios Naturales Protegidos (LSENPC)',
    menorNombre: 'Comunicación Previa / Declaración Responsable',
    mayorNombre: 'Licencia Urbanística',
    organismo: 'Ayuntamiento + Gobierno de Canarias (Consejería de Transición Ecológica)',
    notas: 'El archipiélago tiene regulación específica por su insularidad y espacios naturales (Red Canaria de Espacios Naturales). Los cabildos insulares tienen competencias propias. Existen restricciones especiales en zonas costeras y áreas turísticas.',
    enlace: 'https://www.gobiernodecanarias.org/agricultura/',
    colegios: 'Colegio Oficial de Arquitectos de Canarias',
  },
  {
    id: 'cantabria', nombre: 'Cantabria',
    ley: 'Ley 2/2001 — Ordenación Territorial y Régimen Urbanístico del Suelo (LOTRUS)',
    menorNombre: 'Comunicación Previa',
    mayorNombre: 'Licencia de Obras',
    organismo: 'Ayuntamiento + Gobierno de Cantabria (Consejería de Obras Públicas)',
    notas: 'La Ley de Costas tiene especial impacto en el litoral cántabro. Los municipios del interior con patrimonios etnográficos y naturales pueden requerir informes sectoriales adicionales.',
    enlace: 'https://www.cantabria.es/web/consejeria-de-obras-publicas',
    colegios: 'Colegio Oficial de Arquitectos de Cantabria',
  },
  {
    id: 'castilla-la-mancha', nombre: 'Castilla-La Mancha',
    ley: 'Decreto Legislativo 1/2023 — Texto Refundido de la Ley de Ordenación del Territorio',
    menorNombre: 'Declaración Responsable',
    mayorNombre: 'Licencia Urbanística',
    organismo: 'Ayuntamiento + Junta de CLL (Consejería de Fomento)',
    notas: 'La normativa distingue claramente entre actos sujetos a licencia y actos sujetos a declaración responsable. Los conjuntos histórico-artísticos (Toledo, Cuenca...) tienen régimen especial de la Consejería de Cultura.',
    enlace: 'https://www.castillalamancha.es/gobierno/fomentoyvivienda',
    colegios: 'Colegio Oficial de Arquitectos de Castilla-La Mancha',
  },
  {
    id: 'castilla-leon', nombre: 'Castilla y León',
    ley: 'Ley 5/1999 — Urbanismo de Castilla y León (LUCyL) y modificaciones',
    menorNombre: 'Comunicación Previa',
    mayorNombre: 'Licencia Urbanística',
    organismo: 'Ayuntamiento + Junta de CyL (Consejería de Medio Ambiente, Vivienda y Ordenación del Territorio)',
    notas: 'Extensa región con gran variedad de situaciones. Las ciudades con conjuntos históricos declarados BIC (Ávila, Segovia, Salamanca, Burgos, León...) requieren informe previo de la Dirección General de Patrimonio Cultural. Las zonas rurales tienen reglas específicas de uso del suelo.',
    enlace: 'https://www.jcyl.es/web/es/medio-ambiente-vivienda-ordenacion',
    colegios: 'Colegio Oficial de Arquitectos de Castilla y León (COACyL)',
  },
  {
    id: 'cataluna', nombre: 'Catalunya',
    ley: 'Decreto Legislativo 1/2010 — Llei d\'Urbanisme de Catalunya (LUC)',
    menorNombre: 'Comunicat Previ / Assabentat',
    mayorNombre: 'Llicència d\'Obres',
    organismo: 'Ajuntament + Generalitat de Catalunya (Dept. de Territori)',
    notas: 'Barcelona ciudad tiene su propia Ordenança Metropolitana d\'Edificació i la normativa de l\'Àrea Metropolitana (AMB). Las actuaciones en el Barri Gòtic o en edificis catalogats requieren autorització de Patrimoni Cultural. El PMH (Pla de Millores d\'Habitatge) ofrece ayudas específicas a reformas.',
    enlace: 'https://territori.gencat.cat',
    colegios: 'Col·legi d\'Arquitectes de Catalunya (COAC)',
  },
  {
    id: 'extremadura', nombre: 'Extremadura',
    ley: 'Ley 15/2001 — Suelo y Ordenación Territorial de Extremadura (LESOTEX)',
    menorNombre: 'Comunicación Previa',
    mayorNombre: 'Licencia Urbanística',
    organismo: 'Ayuntamiento + Junta de Extremadura (Consejería de Ordenación del Territorio)',
    notas: 'Gran protagonismo del patrimonio natural (Parque Nacional de Monfragüe, Parque Natural de Cornalvo...) y cultural (Mérida, Cáceres, Trujillo con conjuntos BIC) que condicionan las actuaciones en zonas afectadas.',
    enlace: 'https://www.juntaex.es/con05/',
    colegios: 'Colegio Oficial de Arquitectos de Extremadura',
  },
  {
    id: 'galicia', nombre: 'Galicia',
    ley: 'Ley 2/2016 — Suelo de Galicia (LSG)',
    menorNombre: 'Comunicación Previa de Obras',
    mayorNombre: 'Licencia Urbanística',
    organismo: 'Ayuntamiento + Xunta de Galicia (Consellería de Medio Ambiente, Territorio e Vivenda)',
    notas: 'La LSG tiene un régimen especial para el "núcleo rural" y las edificaciones en suelo rústico. Santiago de Compostela, como ciudad Patrimonio de la Humanidad, cuenta con un Plan Especial de Protección del casco histórico. La Ley de Costas afecta intensamente al litoral gallego.',
    enlace: 'https://cmatv.xunta.gal',
    colegios: 'Colexio Oficial de Arquitectos de Galicia (COAG)',
  },
  {
    id: 'madrid', nombre: 'Comunidad de Madrid',
    ley: 'Ley 9/2001 — Suelo de la Comunidad de Madrid (LSCM)',
    menorNombre: 'Comunicación Previa de Obras',
    mayorNombre: 'Licencia Urbanística de Edificación',
    organismo: 'Ayuntamiento + Comunidad de Madrid (Consejería de Vivienda y Administración Local)',
    notas: 'En el municipio de Madrid rige el Plan General de Ordenación Urbana (PGOU). La comunicación previa permite inicio inmediato de obras. Los edificios catalogados y los APE/APR requieren informes de la Oficina de Supervisión de Proyectos. Los distritos centrales (Centro, Salamanca, Chamberí) tienen normas de protección del paisaje urbano.',
    enlace: 'https://gestiona3.madrid.org/ayud_vivienda/run/j/AyuVivienda.icm',
    colegios: 'Colegio Oficial de Arquitectos de Madrid (COAM)',
  },
  {
    id: 'murcia', nombre: 'Región de Murcia',
    ley: 'Decreto Legislativo 1/2005 — Ley del Suelo de la Región de Murcia (LSRM)',
    menorNombre: 'Declaración Responsable',
    mayorNombre: 'Licencia de Obras',
    organismo: 'Ayuntamiento + CARM (Consejería de Turismo, Cultura y Medio Ambiente)',
    notas: 'La Mar Menor y el litoral murciano tienen legislación de protección específica. Cartagena y Lorca tienen conjuntos arqueológicos que condicionan las obras en su entorno. Las ordenanzas municipales varían significativamente entre el litoral y el interior.',
    enlace: 'https://www.carm.es/web/pagina?IDCONTENIDO=1&IDTIPO=100&RASTRO=c3$m',
    colegios: 'Colegio Oficial de Arquitectos de Murcia',
  },
  {
    id: 'navarra', nombre: 'Navarra',
    ley: 'Ley Foral 5/2015 — Ordenación del Territorio y Urbanismo (LFOTU)',
    menorNombre: 'Comunicación Previa',
    mayorNombre: 'Licencia Urbanística',
    organismo: 'Ayuntamiento + Gobierno de Navarra (Dpto. de Ordenación del Territorio)',
    notas: 'Navarra cuenta con fuero propio que le otorga competencias fiscales y normativas especiales. El Camino de Santiago atraviesa la comunidad y genera zonas de protección específicas. La Bardena Real como espacio natural protegido condiciona las actuaciones en municipios limítrofes.',
    enlace: 'https://www.navarra.es/es/web/territorio-y-vivienda',
    colegios: 'Colegio Oficial de Arquitectos Vasco-Navarro (COAVN) — Delegación Navarra',
  },
  {
    id: 'pais-vasco', nombre: 'País Vasco / Euskadi',
    ley: 'Ley 2/2006 — Suelo y Urbanismo del País Vasco (LSPV)',
    menorNombre: 'Comunicazio Aurretiaskoa / Komunikazioa (Comunicación Previa)',
    mayorNombre: 'Hirigintza Lizentzia / Licencia Urbanística',
    organismo: 'Udala (Ayuntamiento) + Eusko Jaurlaritza (Dpto. de Planificación Territorial)',
    notas: 'El País Vasco tiene concierto económico propio con un régimen fiscal diferenciado. Las Juntas Generales de los tres Territorios Históricos (Álava, Bizkaia, Gipuzkoa) tienen competencias normativas propias. El patrimonio industrial vasco está especialmente protegido. Bilbao, San Sebastián y Vitoria-Gasteiz tienen planes generales con normas específicas.',
    enlace: 'https://www.euskadi.eus/gobierno-vasco/departamento-planificacion-territorial-vivienda-transporte/',
    colegios: 'Colegio Oficial de Arquitectos Vasco-Navarro (COAVN)',
  },
  {
    id: 'la-rioja', nombre: 'La Rioja',
    ley: 'Ley 5/2006 — Ordenación del Territorio y Urbanismo de La Rioja (LOTUR)',
    menorNombre: 'Comunicación Previa',
    mayorNombre: 'Licencia Urbanística',
    organismo: 'Ayuntamiento + Gobierno de La Rioja (Consejería de Fomento)',
    notas: 'Comunidad pequeña con regulación relativamente simplificada. Logroño y los municipios vitivinícolas del Camino de Santiago tienen áreas de especial protección. La bodega como elemento constructivo singular tiene normativa propia en zonas de Denominación de Origen.',
    enlace: 'https://www.larioja.org/fomento-es',
    colegios: 'Colegio Oficial de Arquitectos de La Rioja',
  },
  {
    id: 'valencia', nombre: 'Comunitat Valenciana',
    ley: 'Ley 5/2014 — Ordenación del Territorio, Urbanismo y Paisaje (LOTUP)',
    menorNombre: 'Declaració Responsable / Comunicació d\'Actuació',
    mayorNombre: 'Llicència Urbanística / Licencia Urbanística',
    organismo: 'Ajuntament + Generalitat Valenciana (Conselleria de Territori)',
    notas: 'La LOTUP incorpora la evaluación ambiental y paisajística al proceso urbanístico. El litoral valenciano (PATIVEL) tiene protección especial. Valencia ciudad tiene un Plan General propio. Las áreas inundables (ZP o ZFC) condicionan las actuaciones en planta baja, sótanos y elementos en contacto con el suelo.',
    enlace: 'https://politicaterritorial.gva.es',
    colegios: 'Col·legi Territorial d\'Arquitectes de València (CTAV)',
  },
]

const BADGE_COLORS = {
  'Obligatorio': 'bg-red-100 text-red-700 border border-red-200',
  'Obligatorio en obra mayor': 'bg-orange-100 text-orange-700 border border-orange-200',
  'Uso obligatorio': 'bg-red-100 text-red-700 border border-red-200',
  'Comunicación previa': 'bg-blue-100 text-blue-700 border border-blue-200',
  'Licencia': 'bg-purple-100 text-purple-700 border border-purple-200',
  'Acuerdo de Junta': 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  'Marco general': 'bg-navy/10 text-ink border border-navy/20',
  'Recomendado siempre': 'bg-green-100 text-green-700 border border-green-200',
}

export default function Legislacion() {
  const { t } = useTranslation()
  const [ccaaId, setCcaaId] = useState('')
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
      <div className="bg-gold/10 border border-gold/30 rounded-xl px-4 py-3 mb-8 text-sm text-ink-soft">
        ℹ️ <strong>{t('legislacion.avisoTitle')}</strong> {t('legislacion.avisoText')}
      </div>

      {/* Normativa estatal — contenido normativo español, se mantiene en español */}
      <div className="space-y-10">
        {NORMATIVA_ESTATAL.map(sec => (
          <div key={sec.titulo}>
            <div className="flex items-center gap-3 mb-5">
              <span className="text-2xl">{sec.icon}</span>
              <div>
                <h2 className="text-lg font-bold text-ink">{sec.titulo}</h2>
                <div className="text-xs text-ink-soft">{t('legislacion.estatalCaption')}</div>
              </div>
            </div>
            <div className="space-y-4">
              {sec.items.map(item => (
                <div key={item.titulo} className="card">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-ink mb-1">{item.titulo}</h3>
                      <p className="text-sm text-ink-soft leading-relaxed">{item.desc}</p>
                    </div>
                    <div className="flex-shrink-0 text-right space-y-1">
                      <div className={`text-xs font-semibold px-3 py-1 rounded-full ${BADGE_COLORS[item.tipo] || 'bg-navy/10 text-ink'}`}>
                        {item.tipo}
                      </div>
                      <div className="text-xs text-ink-soft">{item.plazo}</div>
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
              ))}
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
