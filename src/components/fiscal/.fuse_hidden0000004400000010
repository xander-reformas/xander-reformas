const TRIMESTRES = [
  { t: '1T', meses: 'Enero – Marzo', presentacion: 'Hasta el 20 de abril' },
  { t: '2T', meses: 'Abril – Junio', presentacion: 'Hasta el 20 de julio' },
  { t: '3T', meses: 'Julio – Septiembre', presentacion: 'Hasta el 20 de octubre' },
  { t: '4T', meses: 'Octubre – Diciembre', presentacion: 'Hasta el 30 de enero (año siguiente)' },
]

const MODELOS = [
  {
    num: '130', nombre: 'IRPF fraccionado', periodo: 'Trimestral',
    desc: 'Pago a cuenta del IRPF. Si facturas con retención del 15% a empresas, es posible que no tengas que presentarlo. Calcula el 20% sobre el rendimiento neto (ingresos menos gastos).',
    color: 'bg-blue-100 text-blue-700',
  },
  {
    num: '303', nombre: 'IVA', periodo: 'Trimestral',
    desc: 'IVA repercutido (el que cobras en facturas) menos IVA soportado (el que pagas en compras y gastos). El resultado positivo se ingresa; el negativo se compensa.',
    color: 'bg-gold/20 text-gold-dark',
  },
  {
    num: '111', nombre: 'Retenciones IRPF', periodo: 'Trimestral',
    desc: 'Si tienes trabajadores o pagas a profesionales con retención, debes liquidar las retenciones practicadas.',
    color: 'bg-purple-100 text-purple-700',
  },
  {
    num: '100', nombre: 'Declaración de la Renta', periodo: 'Anual',
    desc: 'Presentación entre abril y junio del año siguiente. Incluye todos los rendimientos de actividad económica del año.',
    color: 'bg-green-100 text-green-700',
  },
  {
    num: '390', nombre: 'Resumen anual IVA', periodo: 'Anual',
    desc: 'Resumen de todos los trimestres del Modelo 303. Se presenta en enero del año siguiente.',
    color: 'bg-orange-100 text-orange-700',
  },
]

const TIPS = [
  { icon: '🧾', titulo: 'Guarda TODOS los tickets', desc: 'Materiales, gasolina, herramientas, ropa de trabajo, móvil (50%), dietas en obra. Si no tienes el justificante, no es deducible.' },
  { icon: '🏠', titulo: 'Despacho en casa', desc: 'Si usas parte de tu vivienda para trabajo, puedes deducir un % proporcional de suministros (luz, internet). Consulta con tu gestor el porcentaje.' },
  { icon: '🚗', titulo: 'Vehículo profesional', desc: 'Si tienes vehículo exclusivamente profesional (furgoneta de trabajo) deduces el 100%. Turismo personal: solo si es de uso exclusivo profesional.' },
  { icon: '📱', titulo: 'Teléfono y tecnología', desc: 'Móvil, ordenador, software: deducible al 100% si es uso exclusivamente profesional, al 50% si es mixto.' },
  { icon: '📅', titulo: 'Tarifa plana de autónomo', desc: 'Primeros 12 meses: cuota fija reducida. Prorrogable 12 meses más si los ingresos no superan el SMI. Gestiona bien el momento del alta.' },
  { icon: '💡', titulo: 'IVA en reformas', desc: 'Tipo reducido 10% para obras de rehabilitación de viviendas particulares con más de 2 años de antigüedad. Tipo general 21% para locales y obras nuevas.' },
]

export default function Fiscal() {
  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy">Fiscal</h1>
        <p className="text-sm text-stone mt-0.5">Guía fiscal para autónomos del sector reformas en España</p>
      </div>

      <div className="bg-gold/10 border border-gold/30 rounded-xl px-4 py-3 mb-8 text-sm text-stone">
        ⚠️ Esta guía es orientativa. Consulta siempre con tu gestor o asesor fiscal para decisiones concretas.
      </div>

      {/* Calendario trimestral */}
      <div className="mb-8">
        <h2 className="text-sm font-bold uppercase tracking-widest text-stone mb-4">📅 Calendario de declaraciones</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {TRIMESTRES.map(t => {
            const ahora = new Date()
            const mesActual = ahora.getMonth() + 1
            const esActual = (t.t === '1T' && mesActual <= 4) || (t.t === '2T' && mesActual <= 7 && mesActual >= 4) || (t.t === '3T' && mesActual <= 10 && mesActual >= 7) || (t.t === '4T' && mesActual >= 10)
            return (
              <div key={t.t} className={`card text-center ${esActual ? 'border-gold border-2 bg-gold/5' : ''}`}>
                <div className={`text-2xl font-black mb-1 ${esActual ? 'text-gold' : 'text-navy'}`}>{t.t}</div>
                <div className="text-xs text-stone mb-2">{t.meses}</div>
                <div className={`text-xs font-semibold ${esActual ? 'text-gold-dark' : 'text-stone'}`}>{t.presentacion}</div>
                {esActual && <div className="mt-2 text-xs bg-gold text-navy font-bold px-2 py-0.5 rounded-full">Próximo</div>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Modelos */}
      <div className="mb-8">
        <h2 className="text-sm font-bold uppercase tracking-widest text-stone mb-4">📋 Modelos a presentar</h2>
        <div className="space-y-3">
          {MODELOS.map(m => (
            <div key={m.num} className="card flex items-start gap-4">
              <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center font-black text-lg ${m.color}`}>
                {m.num}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <span className="font-bold text-navy">{m.nombre}</span>
                  <span className="text-xs bg-arena-dark text-stone px-2 py-0.5 rounded-full">{m.periodo}</span>
                </div>
                <p className="text-sm text-stone">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tips deducibles */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest text-stone mb-4">💡 Gastos deducibles clave</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TIPS.map(tip => (
            <div key={tip.titulo} className="card">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{tip.icon}</span>
                <div>
                  <div className="font-bold text-navy text-sm mb-1">{tip.titulo}</div>
                  <p className="text-xs text-stone leading-relaxed">{tip.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
