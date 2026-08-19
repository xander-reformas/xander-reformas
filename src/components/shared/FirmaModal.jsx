import { useRef, useState } from 'react'

// Modal reutilizable de firma manuscrita digital (canvas).
// No es firma electrónica cualificada (eIDAS) — es una firma dibujada en
// pantalla con dedo/ratón, igual que en reparto de paquetería o un TPV.
// Sirve como evidencia de conformidad, con nombre, fecha y hora.
//
// Uso:
//   <FirmaModal
//     titulo="Firmar presupuesto PRE-2026-001"
//     nombreDefault={cliente?.nombre}
//     onGuardar={({ firma_png, firma_nombre, firma_fecha }) => ...}
//     onCancel={() => ...}
//   />
export default function FirmaModal({ titulo, nombreDefault, onGuardar, onCancel }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const last = useRef({ x: 0, y: 0 })
  const [nombre, setNombre] = useState(nombreDefault || '')
  const [hasDrawn, setHasDrawn] = useState(false)
  const [guardando, setGuardando] = useState(false)

  function getPos(e) {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const point = e.touches?.[0] || e
    return {
      x: (point.clientX - rect.left) * (canvas.width / rect.width),
      y: (point.clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  function start(e) {
    e.preventDefault()
    drawing.current = true
    last.current = getPos(e)
  }
  function move(e) {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const pos = getPos(e)
    ctx.strokeStyle = '#1a1a2e'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    last.current = pos
    setHasDrawn(true)
  }
  function end() { drawing.current = false }

  function limpiar() {
    const canvas = canvasRef.current
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  async function confirmar() {
    if (!hasDrawn || !nombre.trim()) return
    setGuardando(true)
    const dataUrl = canvasRef.current.toDataURL('image/png')
    const firma_png = dataUrl.split(',')[1] // solo el base64, sin el prefijo data:image/...
    await onGuardar({ firma_png, firma_nombre: nombre.trim(), firma_fecha: new Date().toISOString() })
    setGuardando(false)
  }

  return (
    <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-edge flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">{titulo || 'Firmar documento'}</h2>
          <button onClick={onCancel} className="text-ink-soft hover:text-ink text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="label">Nombre de quien firma</label>
            <input className="input" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre y apellidos" />
          </div>

          <div>
            <label className="label mb-2">Firma</label>
            <canvas
              ref={canvasRef}
              width={600}
              height={220}
              className="w-full h-40 bg-white rounded-xl border-2 border-dashed border-edge touch-none cursor-crosshair"
              onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
              onTouchStart={start} onTouchMove={move} onTouchEnd={end}
            />
            <button type="button" onClick={limpiar} className="text-xs text-ink-soft hover:text-ink mt-1.5">Borrar y repetir</button>
          </div>

          <p className="text-[11px] text-ink-soft leading-snug">
            Al firmar, quien firma confirma su conformidad con el contenido de este documento. La firma queda
            guardada con fecha y hora como evidencia de aceptación (no es una firma electrónica cualificada eIDAS).
          </p>
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancelar</button>
          <button
            type="button"
            onClick={confirmar}
            disabled={!hasDrawn || !nombre.trim() || guardando}
            className="btn-primary flex-1"
          >
            {guardando ? 'Guardando…' : '✍️ Confirmar firma'}
          </button>
        </div>
      </div>
    </div>
  )
}
