import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const DISMISSED_KEY = 'xander_notif_dismissed'

function getDismissed() {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]')
  } catch {
    return []
  }
}

function diasEntre(fecha) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const d = new Date(fecha + (fecha.length === 10 ? 'T00:00:00' : ''))
  return Math.round((hoy - d) / 86400000)
}

export function useNotifications() {
  const [notificaciones, setNotificaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(getDismissed)

  const cargar = useCallback(async () => {
    setLoading(true)
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    const hoyStr = hoy.toISOString().split('T')[0]
    const en3dias = new Date(hoy); en3dias.setDate(en3dias.getDate() + 3)

    const [facturasRes, presupuestosRes, obrasRes, eventosRes] = await Promise.all([
      supabase.from('facturas').select('id, numero, fecha_vencimiento, vencimiento, estado, clientes(nombre)').in('estado', ['enviada', 'vista']),
      supabase.from('presupuestos').select('id, numero, fecha, validez_dias, estado, clientes(nombre)').in('estado', ['borrador', 'enviado']),
      supabase.from('obras').select('id, nombre, estado, fecha_fin_prevista, clientes(nombre)').eq('estado', 'en_curso'),
      supabase.from('calendario_eventos').select('id, titulo, fecha, hora, tipo, notificar_email').gte('fecha', hoyStr).lte('fecha', en3dias.toISOString().split('T')[0]),
    ])

    const items = []

    // 1. Cobros vencidos (facturas enviadas/vistas con fecha de vencimiento pasada)
    ;(facturasRes.data || []).forEach(f => {
      const venc = f.fecha_vencimiento || f.vencimiento
      if (!venc) return
      const dias = diasEntre(venc)
      if (dias > 0) {
        items.push({
          id: `cobro-${f.id}`,
          tipo: 'cobro',
          icono: '💳',
          titulo: 'Cobro vencido',
          mensaje: `Factura ${f.numero || ''} de ${f.clientes?.nombre || 'cliente'} — ${dias} día${dias === 1 ? '' : 's'} de retraso`,
          ruta: '/dashboard/cobros',
          prioridad: 'alta',
          dias,
        })
      }
    })

    // 2. Presupuestos caducados (fecha + validez_dias ya pasada, sigue en borrador/enviado)
    ;(presupuestosRes.data || []).forEach(p => {
      if (!p.fecha || !p.validez_dias) return
      const expira = new Date(p.fecha)
      expira.setDate(expira.getDate() + p.validez_dias)
      const dias = diasEntre(expira.toISOString().split('T')[0])
      if (dias > 0) {
        items.push({
          id: `presupuesto-${p.id}`,
          tipo: 'presupuesto',
          icono: '📋',
          titulo: 'Presupuesto caducado',
          mensaje: `Presupuesto ${p.numero || ''} de ${p.clientes?.nombre || 'cliente'} — caducó hace ${dias} día${dias === 1 ? '' : 's'}`,
          ruta: '/dashboard/presupuestos',
          prioridad: 'media',
          dias,
        })
      }
    })

    // 3. Obras que han superado su fecha de fin prevista y siguen en curso
    ;(obrasRes.data || []).forEach(o => {
      if (!o.fecha_fin_prevista) return
      const dias = diasEntre(o.fecha_fin_prevista)
      if (dias > 0) {
        items.push({
          id: `obra-${o.id}`,
          tipo: 'obra',
          icono: '🔨',
          titulo: 'Obra retrasada',
          mensaje: `"${o.nombre}" (${o.clientes?.nombre || 'cliente'}) — ${dias} día${dias === 1 ? '' : 's'} fuera de plazo`,
          ruta: '/dashboard/obras',
          prioridad: 'alta',
          dias,
        })
      }
    })

    // 4. Eventos de calendario próximos (hoy y siguientes 3 días)
    ;(eventosRes.data || []).forEach(e => {
      const esHoy = e.fecha === hoyStr
      items.push({
        id: `evento-${e.id}`,
        tipo: 'calendario',
        icono: '📅',
        titulo: esHoy ? 'Tarea programada hoy' : 'Tarea próxima en tu calendario',
        mensaje: `${e.titulo}${e.hora ? ` · ${e.hora.slice(0, 5)}` : ''}${esHoy ? '' : ` — ${new Date(e.fecha + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`}`,
        ruta: '/dashboard',
        prioridad: esHoy ? 'alta' : 'baja',
        dias: 0,
      })
    })

    // Orden: alta > media > baja, y dentro de cada grupo por más días de retraso
    const orden = { alta: 0, media: 1, baja: 2 }
    items.sort((a, b) => (orden[a.prioridad] - orden[b.prioridad]) || (b.dias - a.dias))

    setNotificaciones(items)
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  function descartar(id) {
    setDismissed(prev => {
      const next = [...new Set([...prev, id])]
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(next))
      return next
    })
  }

  function descartarTodo() {
    const next = [...new Set([...dismissed, ...visibles.map(n => n.id)])]
    setDismissed(next)
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(next))
  }

  const visibles = notificaciones.filter(n => !dismissed.includes(n.id))

  return { notificaciones: visibles, loading, recargar: cargar, descartar, descartarTodo }
}
