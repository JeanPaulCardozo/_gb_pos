import { useEffect, useRef, useState } from 'react'
import { accountTotals, money } from '../logic.ts'
import { ROOM_SHAPES } from '../seed.ts'
import { setRoom, toast, upsert, useStore } from '../store.ts'
import type { Room, Table } from '../types.ts'

// Maqueta del salón. Se dibuja con una proyección propia (no CSS 3D) para que tocar y arrastrar
// caigan exactamente donde se ve la mesa. Unidades de vista: el ancho total mide 100.
const PAD = 4
const WALL = 7 // alto de las paredes al fondo

type View = ReturnType<typeof makeView>
function makeView(room: Room, flat: boolean, narrow: boolean) {
  const W = 100 - 2 * PAD
  // en celular el local se estira un poco hacia abajo para que las filas de mesas no se monten
  const aspect = narrow ? Math.max(room.depth / room.width, 1.15) : room.depth / room.width
  const tilt = flat ? 1 : narrow ? 0.66 : 0.56 // cuánto se acuesta el piso
  const far = flat ? 1 : 0.84 // el fondo se ve más angosto que el frente
  const top = flat ? PAD : PAD + WALL
  return { W, aspect, tilt, far, top, flat, H: top + W * aspect * tilt + (flat ? PAD : 3), T: narrow ? 12 : 8 }
}
/** Punto del piso (% de ancho y fondo) → punto en la vista. s = escala por profundidad. */
function proj(v: View, x: number, y: number) {
  const s = v.far + (1 - v.far) * (y / 100)
  return { x: 50 + (PAD + (x * v.W) / 100 - 50) * s, y: v.top + (y / 100) * v.W * v.aspect * v.tilt, s }
}
/** Inverso, solo para la vista plana (la de edición). */
const unproj = (v: View, x: number, y: number) => ({ x: ((x - PAD) / v.W) * 100, y: ((y - v.top) / (v.W * v.aspect)) * 100 })
const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n * 2) / 2))
const pts = (list: { x: number; y: number }[]) => list.map((p) => `${p.x},${p.y}`).join(' ')
/** ¿El punto cae dentro del contorno? (cruce de rayos) */
const inside = (p: { x: number; y: number }, poly: Room['points']) =>
  poly.reduce((acc, a, i) => { const b = poly[(i + 1) % poly.length]; return (a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x ? !acc : acc }, false)

function useNarrow() {
  const q = '(max-width: 800px)'
  const [narrow, setNarrow] = useState(() => matchMedia(q).matches)
  useEffect(() => {
    const m = matchMedia(q), on = () => setNarrow(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return narrow
}

type Grab = { kind: 'table'; id: string; x: number; y: number } | { kind: 'corner'; i: number; x: number; y: number }
type Drag = Grab & { dx: number; dy: number }

export default function Floor({ editing, sel, onTap }: { editing: boolean; sel?: string; onTap: (t: Table) => void }) {
  const s = useStore()
  const narrow = useNarrow()
  const box = useRef<HTMLDivElement>(null)
  const moved = useRef(false)
  const [drag, setDrag] = useState<Drag>()
  const [corner, setCorner] = useState<number>()
  const v = makeView(s.room, editing, narrow)

  const points = s.room.points.map((p, i) => (drag?.kind === 'corner' && drag.i === i ? drag : p))
  const tablePos = (t: Table) => (drag?.kind === 'table' && drag.id === t.id ? drag : t)
  const open = s.accounts.filter((a) => a.status === 'open')

  // posición del puntero en % del piso (la edición siempre es en vista plana)
  const at = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect()
    return unproj(v, ((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * v.H)
  }
  // se respeta dónde se agarró el objeto: no salta al centro del dedo
  const grab = (e: React.PointerEvent, d: Grab) => {
    if (!editing) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = at(e)
    moved.current = false
    setDrag({ ...d, dx: d.x - p.x, dy: d.y - p.y })
  }
  const move = (e: React.PointerEvent) => {
    if (!drag) return
    const p = at(e)
    moved.current = true
    setDrag({ ...drag, x: clamp(p.x + drag.dx), y: clamp(p.y + drag.dy) })
  }
  const drop = () => {
    if (!drag) return
    if (drag.kind === 'table') { const t = s.tables.find((x) => x.id === drag.id)!; upsert('tables', { ...t, x: drag.x, y: drag.y }) }
    else setRoom({ ...s.room, points: points.map(({ x, y }) => ({ x, y })) })
    setDrag(undefined)
  }
  // flechas del teclado: misma edición sin mouse
  const nudge = (e: React.KeyboardEvent, apply: (dx: number, dy: number) => void) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]
    if (!editing || !d) return
    e.preventDefault(); apply(d[0], d[1])
  }
  const setPoints = (list: Room['points']) => setRoom({ ...s.room, points: list })

  const proj3 = (x: number, y: number) => proj(v, x, y)
  const floor = points.map((p) => proj3(p.x, p.y))
  // orientación del contorno para saber qué paredes dan al fondo (esas se levantan completas)
  const area = points.reduce((a, p, i) => { const q = points[(i + 1) % points.length]; return a + p.x * q.y - q.x * p.y }, 0)
  const walls = editing ? [] : points.map((p, i) => {
    const q = points[(i + 1) % points.length]
    const ny = area > 0 ? -(q.x - p.x) : q.x - p.x
    const a = proj3(p.x, p.y), b = proj3(q.x, q.y)
    const h = ny <= 0 ? WALL : 1.2 // las paredes del frente quedan como un borde bajo para no tapar mesas
    return { back: ny <= 0, quad: [a, b, { x: b.x, y: b.y - h * b.s }, { x: a.x, y: a.y - h * a.s }] }
  })

  // sillas alrededor de cada mesa, en coordenadas del piso, para que la perspectiva también las acueste
  const toPct = (ux: number, uy: number) => ({ x: (ux / v.W) * 100, y: (uy / (v.W * v.aspect)) * 100 })
  const chairs = s.tables.flatMap((t) => {
    const p = tablePos(t)
    if (t.shape === 'bar') return Array.from({ length: t.seats }, (_, i) => { const o = toPct(((i + 0.5) / t.seats - 0.5) * v.T * 2.2, v.T * 0.62); return proj3(p.x + o.x, p.y + o.y) })
    const r = v.T * (t.shape === 'round' ? 0.72 : 0.78)
    return Array.from({ length: t.seats }, (_, i) => {
      const ang = Math.PI / 2 + (i * 2 * Math.PI) / t.seats + (t.shape === 'square' && t.seats > 4 ? Math.PI / t.seats : 0)
      const o = toPct(Math.cos(ang) * r, Math.sin(ang) * r)
      return proj3(p.x + o.x, p.y + o.y)
    })
  })

  return (
    <div className="stack">
      {editing && <RoomPanel room={s.room} corner={corner} outside={s.tables.filter((t) => !inside(t, s.room.points)).map((t) => t.name)} onShape={(list) => { setPoints(list); setCorner(undefined) }}
        onRemoveCorner={() => { if (corner == null) return; setPoints(s.room.points.filter((_, i) => i !== corner)); setCorner(undefined) }} />}
      <div ref={box} className={`floor3d ${editing ? 'editing' : ''}`} style={{ aspectRatio: `100 / ${v.H}` }} onPointerMove={move} onPointerUp={drop} onPointerCancel={drop}>
        <svg viewBox={`0 0 100 ${v.H}`} aria-hidden>
          <defs>
            <linearGradient id="piso" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--floor-far)" /><stop offset="1" stopColor="var(--floor-near)" /></linearGradient>
            <radialGradient id="luz"><stop offset="0" stopColor="#ffb547" stopOpacity=".55" /><stop offset="1" stopColor="#ffb547" stopOpacity="0" /></radialGradient>
          </defs>
          {walls.filter((w) => w.back).map((w, i) => <polygon key={i} points={pts(w.quad)} className="wall" />)}
          <polygon points={pts(floor)} className="piso" />
          {/* luz cálida bajo las mesas ocupadas: se ve de lejos qué zona del salón está activa */}
          {!editing && s.tables.filter((t) => open.some((a) => a.tableId === t.id)).map((t) => {
            const c = proj3(tablePos(t).x, tablePos(t).y)
            return <ellipse key={t.id} cx={c.x} cy={c.y} rx={v.T * 1.3 * c.s} ry={v.T * 1.3 * c.s * v.tilt} fill="url(#luz)" />
          })}
          {chairs.map((c, i) => <ellipse key={i} cx={c.x} cy={c.y} rx={1.5 * c.s} ry={1.5 * c.s * v.tilt} className="silla" />)}
          {walls.filter((w) => !w.back).map((w, i) => <polygon key={i} points={pts(w.quad)} className="wall front" />)}
        </svg>

        {/* las de atrás se dibujan primero para que las de adelante las tapen, como en la vida real */}
        {[...s.tables].sort((a, b) => tablePos(a).y - tablePos(b).y).map((t) => {
          const p = tablePos(t), c = proj3(p.x, p.y)
          const accs = open.filter((a) => a.tableId === t.id)
          const pending = accs.some((a) => a.lines.some((l) => l.status === 'pending'))
          const total = accs.reduce((x, a) => x + accountTotals(a, s.convenios, s.settings.taxRate).total, 0)
          const w = v.T * (t.shape === 'bar' ? 2.2 : 1) * c.s
          return (
            <button key={t.id} className={`tbl3d ${t.shape} ${accs.length ? 'busy' : ''} ${pending ? 'pending' : ''} ${sel === t.id ? 'sel' : ''}`}
              style={{ left: `${c.x}%`, top: `${(c.y / v.H) * 100}%`, width: `${w}%`, aspectRatio: `${t.shape === 'bar' ? 2.2 : 1} / ${v.tilt}`, cursor: editing ? 'grab' : 'pointer' }}
              aria-label={`Mesa ${t.name}${accs.length ? `, ${accs.length} cuentas abiertas, ${money(total)}` : ', libre'}${pending ? ', pedido sin enviar' : ''}`}
              onPointerDown={(e) => grab(e, { kind: 'table', id: t.id, x: t.x, y: t.y })}
              onKeyDown={(e) => nudge(e, (dx, dy) => upsert('tables', { ...t, x: clamp(t.x + dx), y: clamp(t.y + dy) }))}
              onClick={() => { if (!moved.current) onTap(t); moved.current = false }}>
              <span>{t.name}{accs.length > 0 && <small>{accs.length > 1 ? `${accs.length} cuentas · ` : ''}{money(total)}</small>}</span>
            </button>
          )
        })}

        {editing && points.map((p, i) => {
          const c = proj3(p.x, p.y), q = points[(i + 1) % points.length], m = proj3((p.x + q.x) / 2, (p.y + q.y) / 2)
          return [
            <button key={`c${i}`} className={`corner ${corner === i ? 'sel' : ''}`} style={{ left: `${c.x}%`, top: `${(c.y / v.H) * 100}%` }} aria-label={`Esquina ${i + 1}`} aria-pressed={corner === i}
              onPointerDown={(e) => { setCorner(i); grab(e, { kind: 'corner', i, x: p.x, y: p.y }) }}
              onKeyDown={(e) => nudge(e, (dx, dy) => setPoints(s.room.points.map((x, j) => (j === i ? { x: clamp(x.x + dx), y: clamp(x.y + dy) } : x))))} />,
            <button key={`m${i}`} className="corner add" style={{ left: `${m.x}%`, top: `${(m.y / v.H) * 100}%` }} aria-label={`Agregar esquina entre ${i + 1} y ${((i + 1) % points.length) + 1}`}
              onClick={() => { setPoints([...s.room.points.slice(0, i + 1), { x: clamp((p.x + q.x) / 2), y: clamp((p.y + q.y) / 2) }, ...s.room.points.slice(i + 1)]); setCorner(i + 1) }}>+</button>,
          ]
        })}
      </div>
    </div>
  )
}

function RoomPanel({ room, corner, outside, onShape, onRemoveCorner }: { room: Room; corner?: number; outside: string[]; onShape: (p: Room['points']) => void; onRemoveCorner: () => void }) {
  const dim = (k: 'width' | 'depth', v: string) => {
    const n = +v
    if (n >= 2 && n <= 200) setRoom({ ...room, [k]: n })
  }
  return (
    <div className="card stack">
      <div className="row">
        <label className="stack grow">Ancho del local (m)<input type="number" inputMode="decimal" min={2} max={200} step="0.5" defaultValue={room.width} onChange={(e) => dim('width', e.target.value)} /></label>
        <label className="stack grow">Fondo del local (m)<input type="number" inputMode="decimal" min={2} max={200} step="0.5" defaultValue={room.depth} onChange={(e) => dim('depth', e.target.value)} /></label>
      </div>
      <div className="row">
        <span className="muted">Empezar desde</span>
        {Object.entries(ROOM_SHAPES).map(([name, p]) => <button key={name} className="sm" onClick={() => onShape(p)}>{name}</button>)}
      </div>
      <p className="muted" style={{ margin: 0 }}>Arrastra las esquinas para ajustar el contorno, toca un <b>+</b> para agregar una esquina y arrastra las mesas a su lugar. Con teclado: flechas.</p>
      {outside.length > 0 && <div className="alert"><strong>Fuera del local:</strong> {outside.join(', ')}. Arrástralas adentro o ajusta el contorno.</div>}
      {corner != null && (
        <button className="danger sm" style={{ justifySelf: 'start' }}
          onClick={() => (room.points.length > 3 ? onRemoveCorner() : toast('El local necesita al menos 3 esquinas', 'error'))}>Quitar esquina {corner + 1}</button>
      )}
    </div>
  )
}
