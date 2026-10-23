import { useRef, useState } from 'react'
import { Pointer } from 'lucide-react'
import { accountTotals, money, uid } from '../logic.ts'
import { can, openAccount, remove, toast, upsert, useStore, useUi } from '../store.ts'
import type { Table } from '../types.ts'
import { Modal } from '../ui.tsx'
import type { Go } from '../App.tsx'

export default function Mesas({ go }: { go: Go }) {
  const s = useStore()
  const { user } = useUi()
  const [editing, setEditing] = useState(false)
  const [sel, setSel] = useState<string>()
  const [drag, setDrag] = useState<{ id: string; x: number; y: number }>()
  const floor = useRef<HTMLDivElement>(null)

  const open = s.accounts.filter((a) => a.status === 'open')
  const tableAccounts = (id: string) => open.filter((a) => a.tableId === id)
  const selected = s.tables.find((t) => t.id === sel)

  const pos = (e: React.PointerEvent) => {
    const r = floor.current!.getBoundingClientRect()
    const c = (v: number) => Math.min(97, Math.max(3, Math.round(v * 2) / 2))
    return { x: c(((e.clientX - r.left) / r.width) * 100), y: c(((e.clientY - r.top) / r.height) * 100) }
  }

  const addTable = () => {
    const n = s.tables.filter((t) => t.name.startsWith('M')).length + 1
    const t: Table = { id: uid(), name: `M${n}`, x: 50, y: 50, shape: 'square', seats: 4 }
    upsert('tables', t); setSel(t.id)
  }
  const delTable = (t: Table) => {
    if (tableAccounts(t.id).length) return toast('La mesa tiene cuentas abiertas', 'error')
    if (confirm(`¿Quitar la mesa ${t.name}?`)) { remove('tables', t.id); setSel(undefined) }
  }

  return (
    <div className="stack">
      <div className="row spread">
        <h1>Salón</h1>
        <div className="row">
          <span className="pill ok">● Libre</span><span className="pill gold">● Ocupada</span><span className="pill warn">● Pedido sin enviar</span>
          {can(user?.role, 'mesas.editar') && <button className={editing ? 'primary' : ''} onClick={() => { setEditing(!editing); setSel(undefined) }}>{editing ? 'Listo' : 'Editar plano'}</button>}
        </div>
      </div>
      {editing && <div className="row"><button onClick={addTable}>+ Agregar mesa</button><span className="muted">Arrastra las mesas para ubicarlas. Toca una para editarla.</span></div>}
      {!editing && <div className="card" style={{ borderLeft: '4px solid var(--neon)' }}><Pointer size={18} style={{ verticalAlign: '-3px', color: 'var(--neon)' }} /> <b>Toca una mesa para tomar el pedido.</b> <span className="muted">Para clientes en barra o para llevar, usa "Mostrador".</span></div>}

      <div ref={floor} className={`floor ${editing ? 'editing' : ''}`}>
        {s.tables.map((t) => {
          const accs = tableAccounts(t.id)
          const pending = accs.some((a) => a.lines.some((l) => l.status === 'pending'))
          const p = drag?.id === t.id ? drag : t
          const total = accs.reduce((sum, a) => sum + accountTotals(a, s.convenios, s.settings.taxRate).total, 0)
          return (
            <button
              key={t.id}
              className={`tbl ${t.shape} ${accs.length ? 'busy' : ''} ${pending ? 'pending' : ''} ${sel === t.id ? 'sel' : ''}`}
              style={{ left: `${p.x}%`, top: `${p.y}%`, cursor: editing ? 'grab' : 'pointer' }}
              aria-label={`Mesa ${t.name}${accs.length ? `, ${accs.length} cuentas abiertas` : ', libre'}`}
              onPointerDown={(e) => { if (!editing) return; e.currentTarget.setPointerCapture(e.pointerId); setDrag({ id: t.id, ...pos(e) }) }}
              onPointerMove={(e) => drag?.id === t.id && setDrag({ id: t.id, ...pos(e) })}
              onPointerUp={() => { if (drag) { upsert('tables', { ...t, x: drag.x, y: drag.y }); setDrag(undefined) } }}
              onClick={() => setSel(t.id)}
            >
              <span>{t.name}{accs.length > 0 && <small>{accs.length > 1 ? `${accs.length} cuentas · ` : ''}{money(total)}</small>}</span>
            </button>
          )
        })}
      </div>

      {!editing && open.length > 0 && (
        <div className="card stack">
          <h3>Cuentas abiertas</h3>
          <div className="row">
            {open.map((a) => {
              const t = accountTotals(a, s.convenios, s.settings.taxRate)
              return (
                <button key={a.id} onClick={() => go('cuenta', a.id)}>
                  Mesa {s.tables.find((x) => x.id === a.tableId)?.name} · {a.label} · <b>{money(t.total)}</b>
                  {t.pending > 0 && <span className="pill warn"> {t.pending} sin enviar</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {selected && editing && (
        <Modal title={`Editar ${selected.name}`} onClose={() => setSel(undefined)}>
          <TableForm t={selected} onDelete={() => delTable(selected)} />
        </Modal>
      )}

      {selected && !editing && (
        <Modal title={`Mesa ${selected.name}`} onClose={() => setSel(undefined)}>
          <div className="stack">
            {tableAccounts(selected.id).map((a) => {
              const t = accountTotals(a, s.convenios, s.settings.taxRate)
              return (
                <button key={a.id} className="row spread" onClick={() => go('cuenta', a.id)}>
                  <span>{a.label} <span className="muted">· {s.users.find((u) => u.id === a.openedBy)?.name}</span>{t.pending > 0 && <span className="pill warn"> {t.pending} sin enviar</span>}</span>
                  <b>{money(t.total)}</b>
                </button>
              )
            })}
            {!tableAccounts(selected.id).length && <p className="muted">Mesa libre.</p>}
            <button className="primary" onClick={() => go('cuenta', openAccount(selected.id))}>+ Nueva cuenta</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function TableForm({ t, onDelete }: { t: Table; onDelete: () => void }) {
  const set = (patch: Partial<Table>) => upsert('tables', { ...t, ...patch })
  return (
    <div className="stack">
      <label className="stack">Nombre<input value={t.name} onChange={(e) => set({ name: e.target.value })} /></label>
      <label className="stack">Puestos<input type="number" min={0} value={t.seats} onChange={(e) => set({ seats: +e.target.value })} /></label>
      <label className="stack">Forma
        <select value={t.shape} onChange={(e) => set({ shape: e.target.value as Table['shape'] })}>
          <option value="round">Redonda</option><option value="square">Cuadrada</option><option value="bar">Barra / mostrador</option>
        </select>
      </label>
      <button className="danger" onClick={onDelete}>Quitar mesa</button>
    </div>
  )
}
