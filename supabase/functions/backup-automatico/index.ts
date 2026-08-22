// Supabase Edge Function — backup-automatico
// Se ejecuta 1 vez por semana via pg_cron.
// Genera, para cada usuario, una copia de seguridad JSON de sus datos de
// trabajo (clientes, obras, presupuestos, facturas...) y la guarda en el
// bucket privado "backups" bajo {user_id}/auto-{timestamp}.json.
// Mantiene solo las últimas 4 copias automáticas por usuario.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BUCKET = 'backups'
const MAX_AUTO_BACKUPS = 4

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message
  try { return JSON.stringify(err) } catch { return String(err) }
}

// Mismo orden/tablas que en el frontend (src/components/backups/CopiasSeguridad.jsx)
const TABLAS = [
  'clientes', 'empleados', 'obras', 'tarifas', 'calendario_notas',
  'calendario_eventos', 'presupuestos', 'facturas', 'gastos',
  'documentos', 'partes_trabajo', 'nominas',
]

async function recopilarDatos(userId: string) {
  const data: Record<string, unknown[]> = {}

  for (const tabla of TABLAS) {
    const { data: rows, error } = await supabase.from(tabla).select('*').eq('user_id', userId)
    if (error) throw new Error(`${tabla}: ${errMsg(error)}`)
    data[tabla] = rows || []
  }

  const obraIds = ((data.obras || []) as Array<{ id: string }>).map(o => o.id)
  if (obraIds.length) {
    const { data: oe, error } = await supabase.from('obra_empleados').select('*').in('obra_id', obraIds)
    if (error) throw new Error(`obra_empleados: ${errMsg(error)}`)
    data.obra_empleados = oe || []
  } else {
    data.obra_empleados = []
  }

  return data
}

async function limpiarAntiguas(userId: string) {
  const { data: files, error } = await supabase.storage.from(BUCKET).list(userId)
  if (error || !files) return
  const autos = files
    .filter(f => f.name.startsWith('auto-'))
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  const sobran = autos.slice(MAX_AUTO_BACKUPS)
  if (sobran.length) {
    await supabase.storage.from(BUCKET).remove(sobran.map(f => `${userId}/${f.name}`))
  }
}

Deno.serve(async () => {
  try {
    const { data: perfiles, error } = await supabase.from('profiles').select('id')
    if (error) return new Response('DB profiles: ' + errMsg(error), { status: 500 })

    let ok = 0
    const errores: string[] = []

    for (const p of perfiles || []) {
      try {
        const data = await recopilarDatos(p.id)
        const backup = {
          version: 1,
          app: 'XANDER Gestión',
          creado: new Date().toISOString(),
          user_id: p.id,
          data,
        }
        const path = `${p.id}/auto-${Date.now()}.json`
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, new Blob([JSON.stringify(backup)], { type: 'application/json' }), { upsert: false })
        if (upErr) throw new Error(errMsg(upErr))
        await limpiarAntiguas(p.id)
        ok++
      } catch (err) {
        errores.push(`${p.id}: ${errMsg(err)}`)
      }
    }

    return new Response(
      `Copias automáticas creadas: ${ok}/${(perfiles || []).length}` +
      (errores.length ? `\nErrores:\n${errores.join('\n')}` : ''),
      { status: 200 }
    )
  } catch (err) {
    console.error(err)
    return new Response('Unhandled: ' + errMsg(err), { status: 500 })
  }
})
