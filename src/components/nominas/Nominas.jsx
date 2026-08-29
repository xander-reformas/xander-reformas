import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase, getUID } from '../../lib/supabase'

const MESES_KEYS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

// Cotizaciones trabajador 2025
const SS_TRAB = {
  contingencias: 4.70,
  desempleo:     1.55,
  fp:            0.10,
  mei:           0.12,
}
const SS_TRAB_TOTAL = Object.values(SS_TRAB).reduce((a,b)=>a+b,0) // 6.47%

// Cotizaciones empresa 2025 (construcción)
const SS_EMP_TOTAL = 34.18

function calcNomina(bruto, irpf_pct, otros_desc=0) {
  const ss_trab   = Math.round(bruto * (SS_TRAB_TOTAL/100) * 100) / 100
  const irpf      = Math.round(bruto * (irpf_pct/100) * 100) / 100
  const neto      = Math.round((bruto - ss_trab - irpf - otros_desc) * 100) / 100
  const ss_emp    = Math.round(bruto * (SS_EMP_TOTAL/100) * 100) / 100
  return { ss_trab, irpf, neto, ss_emp }
}

function fmt(n) { return Number(n||0).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' €' }

export default function Nominas() {
  const { t } = useTranslation()
  const mesLabel = (i) => t(`partes.meses.${MESES_KEYS[i]}`)
  const hoy = new Date()
  const [nominas,   setNominas]   = useState([])
  const [empleados, setEmpleados] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [mes,       setMes]       = useState(hoy.getMonth()+1)
  const [año,       setAño]       = useState(hoy.getFullYear())
  const [vista,     setVista]     = useState('mes') // 'mes' | 'historial'
  const [recibo,    setRecibo]    = useState(null)  // nómina en vista detalle
  const [generando, setGenerando] = useState(false)
  const [error,     setError]     = useState('')
  // Edición de nómina individual
  const [editNom,   setEditNom]   = useState(null)
  const [editForm,  setEditForm]  = useState({})
  const [saving,    setSaving]    = useState(false)

  useEffect(() => { load() }, [mes, año])

  async function load() {
    setLoading(true)
    const [{ data: noms }, { data: emps }] = await Promise.all([
      supabase.from('nominas')
        .select('*, empleados(nombre,apellidos,puesto,dni,num_ss,grupo_convenio)')
        .order('periodo_ano', { ascending: false })
        .order('periodo_mes', { ascending: false }),
      supabase.from('empleados').select('*').eq('estado','activo').order('apellidos'),
    ])
    setNominas(noms || [])
    setEmpleados(emps || [])
    setLoading(false)
  }

  // Nóminas del mes seleccionado
  const nominasMes = nominas.filter(n => n.periodo_mes === mes && n.periodo_ano === año)
  // Empleados sin nómina generada en el mes
  const sinNomina = empleados.filter(e => !nominasMes.some(n => n.empleado_id === e.id))

  async function generarTodas() {
    setGenerando(true); setError('')
    const uid = await getUID()
    for (const emp of sinNomina) {
      if (!emp.salario_bruto || emp.salario_bruto <= 0) continue
      const { ss_trab, irpf, neto, ss_emp } = calcNomina(emp.salario_bruto, 15, 0)
      await supabase.from('nominas').upsert({
        user_id: uid, empleado_id: emp.id,
        periodo_mes: mes, periodo_ano: año,
        salario_bruto: emp.salario_bruto,
        ss_trabajador: ss_trab, irpf_pct: 15, irpf_importe: irpf,
        otros_desc: 0, neto, ss_empresa: ss_emp, pagada: false,
      }, { onConflict: 'empleado_id,periodo_mes,periodo_ano' })
    }
    setGenerando(false); load()
  }

  async function marcarPagada(nom) {
    await supabase.from('nominas').update({
      pagada: !nom.pagada,
      fecha_pago: !nom.pagada ? new Date().toISOString().split('T')[0] : null,
    }).eq('id', nom.id)
    load()
  }

  async function eliminar(id) {
    if (!confirm(t('nominas.confirmDelete'))) return
    await supabase.from('nominas').delete().eq('id', id); load()
  }

  function openEdit(nom) {
    setEditNom(nom.id)
    setEditForm({
      salario_bruto: nom.salario_bruto,
      irpf_pct: nom.irpf_pct,
      otros_desc: nom.otros_desc || 0,
      notas: nom.notas || '',
    })
  }

  async function saveEdit(e) {
    e.preventDefault(); setSaving(true)
    const bruto = parseFloat(editForm.salario_bruto) || 0
    const irpf_pct = parseFloat(editForm.irpf_pct) || 0
    const otros = parseFloat(editForm.otros_desc) || 0
    const { ss_trab, irpf, neto, ss_emp } = calcNomina(bruto, irpf_pct, otros)
    await supabase.from('nominas').update({
      salario_bruto: bruto, irpf_pct, irpf_importe: irpf,
      ss_trabajador: ss_trab, otros_desc: otros,
      neto, ss_empresa: ss_emp,
      notas: editForm.notas || null,
    }).eq('id', editNom)
    setSaving(false); setEditNom(null); load()
  }

  const totalBruto   = nominasMes.reduce((s,n)=>s+parseFloat(n.salario_bruto||0),0)
  const totalNeto    = nominasMes.reduce((s,n)=>s+parseFloat(n.neto||0),0)
  const totalEmpresa = nominasMes.reduce((s,n)=>s+parseFloat(n.salario_bruto||0)+parseFloat(n.ss_empresa||0),0)
  const años = Array.from({length:5},(_,i)=>hoy.getFullYear()-i)

  return (
    <div className="p-6 max-w-5xl">
      {/* Cabecera */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t('nominas.title')}</h1>
          <p className="text-sm text-ink-soft mt-0.5">{t('nominas.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          {sinNomina.length > 0 && vista==='mes' && (
            <button onClick={generarTodas} disabled={generando} className="btn-gold">
              {generando ? t('nominas.generando') : t(sinNomina.length === 1 ? 'nominas.generarOne' : 'nominas.generarOther', { count: sinNomina.length })}
            </button>
          )}
        </div>
      </div>

      {/* Selector mes + tabs */}
      <div className="flex flex-wrap gap-3 items-end mb-6">
        <div>
          <label className="label">{t('partes.mesLabel')}</label>
          <select className="input w-36" value={mes} onChange={e=>setMes(Number(e.target.value))}>
            {MESES_KEYS.map((m,i)=><option key={i+1} value={i+1}>{mesLabel(i)}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{t('partes.anioLabel')}</label>
          <select className="input w-24" value={año} onChange={e=>setAño(Number(e.target.value))}>
            {años.map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="ml-auto flex gap-1 bg-edge rounded-xl p-1 self-end">
          <button onClick={()=>setVista('mes')} className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${vista==='mes'?'bg-surface text-ink shadow-sm':'text-ink-soft hover:text-ink'}`}>
            {mesLabel(mes-1)} {año}
          </button>
          <button onClick={()=>setVista('historial')} className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${vista==='historial'?'bg-surface text-ink shadow-sm':'text-ink-soft hover:text-ink'}`}>
            {t('nominas.historial')}
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">{error}</div>}

      {loading ? (
        <div className="text-ink-soft text-sm py-10 text-center">{t('nominas.loading')}</div>
      ) : vista === 'mes' ? (
        <div className="space-y-6">
          {/* KPIs del mes */}
          {nominasMes.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              <div className="card text-center py-3">
                <div className="text-lg font-black text-ink">{fmt(totalBruto)}</div>
                <div className="text-xs text-ink-soft">{t('nominas.totalBruto')}</div>
              </div>
              <div className="card text-center py-3">
                <div className="text-lg font-black text-ink">{fmt(totalNeto)}</div>
                <div className="text-xs text-ink-soft">{t('nominas.totalNeto')}</div>
              </div>
              <div className="card bg-navy text-center py-3">
                <div className="text-lg font-black text-gold">{fmt(totalEmpresa)}</div>
                <div className="text-xs text-white/70">{t('nominas.costeEmpresaTotal')}</div>
              </div>
            </div>
          )}

          {/* Aviso empleados sin nómina */}
          {sinNomina.length > 0 && (
            <div className="bg-gold/10 border border-gold/30 rounded-xl px-4 py-3 flex items-center justify-between">
              <div className="text-sm text-ink-soft">
                <strong>{t(sinNomina.length === 1 ? 'nominas.sinNominaOne' : 'nominas.sinNominaOther', { count: sinNomina.length })}</strong> {t('nominas.sinNominaSuffix', { mes: mesLabel(mes-1), lista: sinNomina.map(e=>`${e.nombre} ${e.apellidos}`).join(', ') })}
              </div>
              <button onClick={generarTodas} disabled={generando} className="btn-gold text-xs ml-4 whitespace-nowrap">
                {generando?'…':t('nominas.generarTodas')}
              </button>
            </div>
          )}

          {/* Lista nóminas del mes */}
          {nominasMes.length === 0 ? (
            <div className="card text-center py-14">
              <div className="text-5xl mb-3">📑</div>
              <div className="font-bold text-ink mb-1">{t('nominas.emptyTitle', { mes: mesLabel(mes-1), anio: año })}</div>
              <div className="text-sm text-ink-soft mb-5">
                {empleados.length === 0
                  ? t('nominas.emptySinEmpleados')
                  : t(empleados.length === 1 ? 'nominas.emptyConEmpleadosOne' : 'nominas.emptyConEmpleadosOther', { count: empleados.length })}
              </div>
              {empleados.length > 0 && <button onClick={generarTodas} disabled={generando} className="btn-gold">{generando?t('nominas.generando'):t('nominas.generarNominas')}</button>}
            </div>
          ) : (
            <div className="space-y-3">
              {nominasMes.map(nom => {
                const emp = nom.empleados
                const isEditing = editNom === nom.id
                return (
                  <div key={nom.id} className={`card border-l-4 ${nom.pagada?'border-green-400':'border-gold'}`}>
                    {isEditing ? (
                      /* ── Edición inline ── */
                      <form onSubmit={saveEdit} className="space-y-3">
                        <div className="font-bold text-ink mb-2">{emp?.nombre} {emp?.apellidos}</div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="label">{t('nominas.edit.salarioLabel')}</label>
                            <input className="input" type="number" step="0.01" value={editForm.salario_bruto}
                              onChange={e=>setEditForm(p=>({...p,salario_bruto:e.target.value}))} />
                          </div>
                          <div>
                            <label className="label">{t('nominas.edit.irpfLabel')}</label>
                            <input className="input" type="number" step="0.1" min="0" max="50" value={editForm.irpf_pct}
                              onChange={e=>setEditForm(p=>({...p,irpf_pct:e.target.value}))} />
                          </div>
                          <div>
                            <label className="label">{t('nominas.edit.otrasLabel')}</label>
                            <input className="input" type="number" step="0.01" min="0" value={editForm.otros_desc}
                              onChange={e=>setEditForm(p=>({...p,otros_desc:e.target.value}))} />
                          </div>
                        </div>
                        {(() => {
                          const { ss_trab, irpf, neto } = calcNomina(
                            parseFloat(editForm.salario_bruto)||0,
                            parseFloat(editForm.irpf_pct)||0,
                            parseFloat(editForm.otros_desc)||0
                          )
                          return (
                            <div className="bg-page rounded-xl px-4 py-2 text-xs text-ink-soft flex gap-6">
                              <span>{t('nominas.edit.ssTrabajadorPreview', { monto: fmt(ss_trab) })}</span>
                              <span>{t('nominas.edit.irpfPreview', { monto: fmt(irpf) })}</span>
                              <span>{t('nominas.edit.netoPreview', { monto: fmt(neto) })}</span>
                            </div>
                          )
                        })()}
                        <div>
                          <label className="label">{t('nominas.edit.notasLabel')}</label>
                          <input className="input" value={editForm.notas} onChange={e=>setEditForm(p=>({...p,notas:e.target.value}))} placeholder={t('nominas.edit.notasPlaceholder')} />
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={()=>setEditNom(null)} className="btn-secondary text-xs py-1.5">{t('nominas.edit.cancel')}</button>
                          <button type="submit" disabled={saving} className="btn-primary text-xs py-1.5">{saving?t('nominas.edit.saving'):t('nominas.edit.save')}</button>
                        </div>
                      </form>
                    ) : (
                      /* ── Vista normal ── */
                      <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="font-bold text-ink">{emp?.nombre} {emp?.apellidos}</span>
                            <span className="text-xs text-ink-soft">{emp?.puesto ? t(`empleados.puesto.${emp.puesto}`, emp.puesto) : ''}</span>
                            {nom.pagada
                              ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{t('nominas.pagadaBadge', { fecha: nom.fecha_pago ? new Date(nom.fecha_pago+'T12:00:00').toLocaleDateString('es-ES') : '' })}</span>
                              : <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gold/20 text-ink">{t('nominas.pendienteBadge')}</span>
                            }
                          </div>

                          {/* Desglose */}
                          <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                            <div className="bg-page rounded-lg px-3 py-2">
                              <div className="text-ink-soft mb-0.5">{t('nominas.salarioBruto')}</div>
                              <div className="font-bold text-ink">{fmt(nom.salario_bruto)}</div>
                            </div>
                            <div className="bg-page rounded-lg px-3 py-2">
                              <div className="text-ink-soft mb-0.5">{t('nominas.ssTrabajador', { pct: SS_TRAB_TOTAL.toFixed(2) })}</div>
                              <div className="font-bold text-red-600">− {fmt(nom.ss_trabajador)}</div>
                            </div>
                            <div className="bg-page rounded-lg px-3 py-2">
                              <div className="text-ink-soft mb-0.5">{t('nominas.irpf', { pct: nom.irpf_pct })}</div>
                              <div className="font-bold text-red-600">− {fmt(nom.irpf_importe)}</div>
                            </div>
                            {nom.otros_desc > 0 && (
                              <div className="bg-page rounded-lg px-3 py-2">
                                <div className="text-ink-soft mb-0.5">{t('nominas.otrasDeducciones')}</div>
                                <div className="font-bold text-red-600">− {fmt(nom.otros_desc)}</div>
                              </div>
                            )}
                            <div className="bg-navy rounded-lg px-3 py-2">
                              <div className="text-white/70 mb-0.5">{t('nominas.netoPercibir')}</div>
                              <div className="font-black text-gold">{fmt(nom.neto)}</div>
                            </div>
                          </div>

                          <div className="mt-2 text-xs text-ink-soft">
                            {t('nominas.costeEmpresaLine', { bruto: fmt(nom.salario_bruto), ss: fmt(nom.ss_empresa), total: fmt(parseFloat(nom.salario_bruto)+parseFloat(nom.ss_empresa)) })}
                          </div>
                          {nom.notas && <div className="mt-1 text-xs text-ink-soft italic">{nom.notas}</div>}
                        </div>

                        {/* Acciones */}
                        <div className="flex flex-col gap-2 flex-shrink-0 items-end">
                          <button onClick={()=>marcarPagada(nom)}
                            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${nom.pagada?'border-stone/30 text-ink-soft hover:border-red-300 hover:text-red-600':'border-green-400 text-green-600 hover:bg-green-50'}`}>
                            {nom.pagada ? t('nominas.desmarcar') : t('nominas.marcarPagada')}
                          </button>
                          <button onClick={()=>openEdit(nom)} className="text-xs text-gold hover:text-gold-dark font-semibold">{t('nominas.editar')}</button>
                          <button onClick={()=>eliminar(nom.id)} className="text-xs text-ink-soft/30 hover:text-red-500">{t('nominas.eliminar')}</button>
                          <button onClick={()=>setRecibo(nom)} className="text-xs text-ink-soft hover:text-ink font-semibold">{t('nominas.verRecibo')}</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        /* ── Historial ── */
        <div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-edge">
                  {[t('nominas.historialTable.periodo'), t('nominas.historialTable.empleado'), t('nominas.historialTable.bruto'), t('nominas.historialTable.neto'), t('nominas.historialTable.estado'), ''].map(h=>(
                    <th key={h} className={`py-2 px-3 text-xs font-bold text-ink-soft uppercase tracking-wide ${h===''?'':'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {nominas.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-10 text-ink-soft text-sm">{t('nominas.sinHistorial')}</td></tr>
                ) : nominas.map(nom=>(
                  <tr key={nom.id} className="border-b border-edge/50 hover:bg-page/30 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-ink">{mesLabel(nom.periodo_mes-1).slice(0,3)} {nom.periodo_ano}</td>
                    <td className="py-2.5 px-3">{nom.empleados?.nombre} {nom.empleados?.apellidos}</td>
                    <td className="py-2.5 px-3">{fmt(nom.salario_bruto)}</td>
                    <td className="py-2.5 px-3 font-bold text-ink">{fmt(nom.neto)}</td>
                    <td className="py-2.5 px-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${nom.pagada?'bg-green-100 text-green-700':'bg-gold/20 text-ink'}`}>
                        {nom.pagada?t('nominas.pagadaLabel'):t('nominas.pendienteLabel')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button onClick={()=>setRecibo(nom)} className="text-xs text-gold hover:text-gold-dark font-semibold">{t('nominas.verRecibo')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Recibo */}
      {recibo && <ReciboModal nom={recibo} onClose={()=>setRecibo(null)} mesLabel={mesLabel} />}
    </div>
  )
}

function ReciboModal({ nom, onClose, mesLabel }) {
  const { t } = useTranslation()
  const emp = nom.empleados
  const periodo = `${mesLabel(nom.periodo_mes-1)} ${nom.periodo_ano}`

  return (
    <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-edge flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">{t('nominas.recibo.title', { periodo })}</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
        </div>
        <div className="p-6 font-mono text-sm">
          {/* Empleado */}
          <div className="bg-page rounded-xl p-4 mb-4">
            <div className="font-bold text-ink text-base">{emp?.nombre} {emp?.apellidos}</div>
            <div className="text-ink-soft text-xs mt-1 space-y-0.5">
              {emp?.puesto && <div>{t('nominas.recibo.puesto', { v: t(`empleados.puesto.${emp.puesto}`, emp.puesto) })}</div>}
              {emp?.dni && <div>{t('nominas.recibo.dni', { v: emp.dni })}</div>}
              {emp?.num_ss && <div>{t('nominas.recibo.numSs', { v: emp.num_ss })}</div>}
              {emp?.grupo_convenio && <div>{t('nominas.recibo.grupoConvenio', { v: emp.grupo_convenio })}</div>}
            </div>
          </div>

          {/* Devengos */}
          <div className="mb-3">
            <div className="text-xs font-bold uppercase tracking-widest text-ink-soft mb-2">{t('nominas.recibo.devengosTitle')}</div>
            <div className="flex justify-between py-1 border-b border-edge">
              <span>{t('nominas.recibo.salarioBase')}</span>
              <span className="font-bold">{fmt(nom.salario_bruto)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-edge font-bold text-ink">
              <span>{t('nominas.recibo.totalDevengado')}</span>
              <span>{fmt(nom.salario_bruto)}</span>
            </div>
          </div>

          {/* Deducciones */}
          <div className="mb-3">
            <div className="text-xs font-bold uppercase tracking-widest text-ink-soft mb-2">{t('nominas.recibo.deduccionesTitle')}</div>
            <div className="flex justify-between py-1 border-b border-edge">
              <span>{t('nominas.recibo.cotizacionSS', { pct: SS_TRAB_TOTAL.toFixed(2) })}</span>
              <span className="text-red-600">− {fmt(nom.ss_trabajador)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-edge">
              <span>{t('nominas.recibo.retencionIrpf', { pct: nom.irpf_pct })}</span>
              <span className="text-red-600">− {fmt(nom.irpf_importe)}</span>
            </div>
            {nom.otros_desc > 0 && (
              <div className="flex justify-between py-1 border-b border-edge">
                <span>{t('nominas.recibo.otrasDeducciones')}</span>
                <span className="text-red-600">− {fmt(nom.otros_desc)}</span>
              </div>
            )}
            <div className="flex justify-between py-1 border-b border-edge font-bold text-red-600">
              <span>{t('nominas.recibo.totalDeducciones')}</span>
              <span>− {fmt(parseFloat(nom.ss_trabajador)+parseFloat(nom.irpf_importe)+(parseFloat(nom.otros_desc)||0))}</span>
            </div>
          </div>

          {/* Neto */}
          <div className="bg-navy rounded-xl p-4 flex justify-between items-center">
            <span className="text-white font-bold">{t('nominas.recibo.liquidoPercibir')}</span>
            <span className="text-gold font-black text-xl">{fmt(nom.neto)}</span>
          </div>

          {/* Coste empresa */}
          <div className="mt-3 text-xs text-ink-soft text-center">
            {t('nominas.recibo.costeEmpresaLine', { total: fmt(parseFloat(nom.salario_bruto)+parseFloat(nom.ss_empresa)), ss: fmt(nom.ss_empresa) })}
          </div>
          {nom.notas && <div className="mt-2 text-xs text-ink-soft text-center italic">{nom.notas}</div>}

          <div className="mt-6 flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">{t('nominas.recibo.cerrar')}</button>
            <button onClick={()=>window.print()} className="btn-primary flex-1">{t('nominas.recibo.imprimir')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
