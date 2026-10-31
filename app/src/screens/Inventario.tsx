import { useState } from 'react'
import { money, uid } from '../logic.ts'
import { can, adjustStock, upsert, useStore, useUi } from '../store.ts'
import type { StockItem, Unit } from '../types.ts'
import { Modal } from '../ui.tsx'

export default function Inventario() {
  const s = useStore()
  const { user } = useUi()
  const [tab, setTab] = useState<'insumos' | 'movimientos'>('insumos')
  const [edit, setEdit] = useState<StockItem>()
  const [steps, setSteps] = useState<Record<string, number>>({})
  const canAdjust = can(user?.role, 'inventario.ajustar')
  const admin = can(user?.role, 'compras')
  const low = s.stock.filter((i) => i.qty <= i.minQty)

  return (
    <div className="stack">
      <div className="row spread">
        <h1>Inventario</h1>
        <div className="seg">
          <button aria-pressed={tab === 'insumos'} onClick={() => setTab('insumos')}>Insumos</button>
          <button aria-pressed={tab === 'movimientos'} onClick={() => setTab('movimientos')}>Movimientos</button>
        </div>
      </div>
      {low.length > 0 && <div className="alert"><strong>Stock bajo:</strong> {low.map((i) => i.name).join(', ')}</div>}

      {tab === 'insumos' && (
        <div className="card scroll">
          {admin && <button className="sm" onClick={() => setEdit({ id: uid(), name: '', unit: 'und', qty: 0, minQty: 0, cost: 0 })}>+ Nuevo insumo</button>}
          <table>
            <thead><tr><th>Insumo</th><th className="num">Cantidad</th><th className="num">Mínimo</th><th className="num">Costo unit.</th><th className="num">Valor</th>{canAdjust && <th>Ajustar</th>}<th /></tr></thead>
            <tbody>
              {s.stock.map((i) => {
                const step = steps[i.id] ?? (i.unit === 'und' ? 1 : 100)
                return (
                  <tr key={i.id}>
                    <td>{i.name} {i.qty <= i.minQty && <span className="pill bad">bajo</span>}</td>
                    <td className={`num ${i.qty < 0 ? 'neon' : ''}`}>{+i.qty.toFixed(2)} {i.unit}</td>
                    <td className="num">{i.minQty} {i.unit}</td>
                    <td className="num">{money(i.cost)}</td>
                    <td className="num">{money(Math.max(0, i.qty) * i.cost)}</td>
                    {canAdjust && <td><span className="qty">
                      <button onClick={() => adjustStock(i.id, -step)} aria-label={`Restar ${step}`}>−</button>
                      <input type="number" min={0} value={step} onChange={(e) => setSteps({ ...steps, [i.id]: +e.target.value })} style={{ width: 70 }} aria-label="Paso" />
                      <button onClick={() => adjustStock(i.id, step)} aria-label={`Sumar ${step}`}>+</button>
                    </span></td>}
                    <td>{admin && <button className="sm" onClick={() => setEdit(i)}>Editar</button>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'movimientos' && (
        <div className="card scroll">
          <table>
            <thead><tr><th>Fecha</th><th>Insumo</th><th>Tipo</th><th className="num">Cantidad</th><th>Detalle</th><th>Usuario</th></tr></thead>
            <tbody>
              {[...s.movements].reverse().slice(0, 200).map((m) => {
                const it = s.stock.find((x) => x.id === m.itemId)
                return <tr key={m.id}><td>{new Date(m.at).toLocaleString('es-CO')}</td><td>{it?.name}</td><td>{m.reason}</td><td className={`num ${m.delta < 0 ? 'neon' : ''}`}>{+m.delta.toFixed(2)} {it?.unit}</td><td className="muted">{m.note}</td><td>{s.users.find((u) => u.id === m.by)?.name}</td></tr>
              })}
            </tbody>
          </table>
        </div>
      )}

      {edit && <ItemForm initial={edit} onClose={() => setEdit(undefined)} />}
    </div>
  )
}

function ItemForm({ initial, onClose }: { initial: StockItem; onClose: () => void }) {
  const [i, setI] = useState(initial)
  return (
    <Modal title={i.name || 'Nuevo insumo'} onClose={onClose}>
      <div className="stack">
        <label className="stack">Nombre<input value={i.name} onChange={(e) => setI({ ...i, name: e.target.value })} /></label>
        <div className="row">
          <label className="stack grow">Unidad<select value={i.unit} onChange={(e) => setI({ ...i, unit: e.target.value as Unit })}><option value="g">g</option><option value="ml">ml</option><option value="und">und</option></select></label>
          <label className="stack grow">Mínimo<input type="number" min={0} value={i.minQty} onChange={(e) => setI({ ...i, minQty: +e.target.value })} /></label>
          <label className="stack grow">Costo por {i.unit}<input type="number" min={0} step="any" value={i.cost} onChange={(e) => setI({ ...i, cost: +e.target.value })} /></label>
        </div>
        <p className="muted">La cantidad se mueve con compras, ventas o ajustes, así queda trazabilidad.</p>
        <button className="primary" disabled={!i.name.trim()} onClick={() => { upsert('stock', i); onClose() }}>Guardar</button>
      </div>
    </Modal>
  )
}
