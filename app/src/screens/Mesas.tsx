import { useState } from 'react'
import Floor from './Floor.tsx'
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

  const open = s.accounts.filter((a) => a.status === 'open')
  const tableAccounts = (id: string) => open.filter((a) => a.tableId === id)
  const selected = s.tables.find((t) => t.id === sel)

  const addTable = () => {
    const n = s.tables.filter((t) => t.name.startsWith('M')).length + 1
    const t: Table = { id: uid(), name: `M${n}`, x: 50, y: 50, shape: 'square', seats: 4 }
    upsert('tables', t); setSel(t.id)
  }
  // En servicio cada toque cuenta: mesa libre abre cuenta, mesa con una cuenta entra a ella.
  // Solo con varias cuentas se pregunta cuál.
  const tap = (t: Table) => {
    if (editing) return setSel(t.id)
    const accs = tableAccounts(t.id)
    if (accs.length === 0) return go('cuenta', openAccount(t.id))
    if (accs.length === 1) return go('cuenta', accs[0].id)
    setSel(t.id)
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
      {editing && <div className="row"><button onClick={addTable}>+ Agregar mesa</button><span className="muted">Toca una mesa para cambiar nombre, puestos o forma.</span></div>}
      {!editing && <p className="muted" style={{ margin: 0 }}>Toca una mesa para tomar el pedido. Para barra o para llevar, usa "Mostrador".</p>}

      <Floor editing={editing} sel={sel} onTap={tap} />

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
