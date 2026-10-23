import { useState } from 'react'
import { FileUp, X } from 'lucide-react'
import { money } from '../logic.ts'
import { registerPurchase, toast, useStore, type PurchaseLineInput } from '../store.ts'
import type { Unit } from '../types.ts'

type Draft = { itemId: string; name: string; unit: Unit; qty: number; unitCost: number }

/** Lee las líneas de una factura electrónica UBL 2.1 (también si viene envuelta en AttachedDocument, como la mandan los proveedores). */
export function parseUbl(xml: string): { supplier: string; number: string; lines: { name: string; qty: number; total: number }[] } {
  let doc = new DOMParser().parseFromString(xml, 'application/xml')
  const tag = (el: Element | Document, name: string) => el.getElementsByTagNameNS('*', name)
  const inner = [...tag(doc, 'Description')].map((d) => d.textContent ?? '').find((t) => t.includes('<Invoice'))
  if (inner) doc = new DOMParser().parseFromString(inner.trim(), 'application/xml')
  const inv = tag(doc, 'Invoice')[0] ?? doc.documentElement
  const direct = (el: Element, name: string) => [...el.children].find((c) => c.localName === name)?.textContent ?? ''
  const party = tag(inv, 'AccountingSupplierParty')[0]
  return {
    supplier: party ? tag(party, 'RegistrationName')[0]?.textContent ?? '' : '',
    number: direct(inv, 'ID'),
    lines: [...tag(inv, 'InvoiceLine')].map((l) => ({
      name: tag(l, 'Description')[0]?.textContent?.trim() ?? '',
      qty: +(tag(l, 'InvoicedQuantity')[0]?.textContent ?? 0),
      total: +(direct(l, 'LineExtensionAmount') || 0),
    })),
  }
}

export default function Compras() {
  const s = useStore()
  const [supplier, setSupplier] = useState('')
  const [number, setNumber] = useState('')
  const [lines, setLines] = useState<Draft[]>([])
  const [over, setOver] = useState(false)
  const set = (k: number, patch: Partial<Draft>) => setLines(lines.map((l, j) => (j === k ? { ...l, ...patch } : l)))
  const total = lines.reduce((x, l) => x + l.qty * l.unitCost, 0)
  const valid = supplier.trim() && number.trim() && lines.length && lines.every((l) => l.qty > 0 && (l.itemId || l.name.trim()))

  const loadXml = async (f?: File) => {
    if (!f) return
    try {
      const r = parseUbl(await f.text())
      if (!r.lines.length) throw new Error()
      setSupplier(r.supplier); setNumber(r.number)
      setLines(r.lines.map((l) => {
        const match = s.stock.find((i) => l.name.toLowerCase().includes(i.name.toLowerCase()) || i.name.toLowerCase().includes(l.name.toLowerCase()))
        return { itemId: match?.id ?? '', name: l.name, unit: match?.unit ?? 'und', qty: l.qty, unitCost: l.qty ? Math.round((l.total / l.qty) * 100) / 100 : 0 }
      }))
      toast(`${r.lines.length} líneas leídas. Revisa las unidades antes de guardar.`)
    } catch { toast('No se pudo leer el XML de la factura', 'error') }
  }

  const save = () => {
    registerPurchase(supplier, number, lines.map((l): PurchaseLineInput => l.itemId
      ? { itemId: l.itemId, qty: l.qty, unitCost: l.unitCost }
      : { newItem: { name: l.name, unit: l.unit, minQty: 0 }, qty: l.qty, unitCost: l.unitCost }))
    setSupplier(''); setNumber(''); setLines([])
  }

  return (
    <div className="stack" style={{ maxWidth: 1000 }}>
      <h1>Compras</h1>
      <div className="card stack">
        <h2>Subir factura del proveedor</h2>
        <p className="muted">Al guardar, el inventario se actualiza solo: suma cantidades, recalcula el costo promedio y crea los insumos que no existan.</p>
        <label className={`dropzone ${over ? 'over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); loadXml(e.dataTransfer.files[0]) }}>
          <FileUp className="ico" size={40} aria-hidden />
          <b>Arrastra aquí el XML de la factura electrónica</b>
          <span className="muted">o toca para elegir el archivo · también puedes llenar las líneas a mano abajo</span>
          <input type="file" accept=".xml" onChange={(e) => loadXml(e.target.files?.[0])} style={{ display: 'none' }} />
        </label>
        <div className="row">
          <input className="grow" placeholder="Proveedor" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
          <input className="grow" placeholder="Número de factura" value={number} onChange={(e) => setNumber(e.target.value)} />
        </div>
        {lines.map((l, k) => (
          <div key={k} className="row card">
            <select value={l.itemId} onChange={(e) => set(k, { itemId: e.target.value, unit: s.stock.find((i) => i.id === e.target.value)?.unit ?? l.unit })}>
              <option value="">+ Insumo nuevo</option>
              {s.stock.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
            {!l.itemId && <>
              <input placeholder="Nombre del insumo" value={l.name} onChange={(e) => set(k, { name: e.target.value })} />
              <select value={l.unit} onChange={(e) => set(k, { unit: e.target.value as Unit })} aria-label="Unidad"><option>g</option><option>ml</option><option>und</option></select>
            </>}
            <label className="row">Cant.<input type="number" min={0} step="any" value={l.qty} onChange={(e) => set(k, { qty: +e.target.value })} style={{ width: 90 }} /> {l.unit}</label>
            <label className="row">Costo/{l.unit}<input type="number" min={0} step="any" value={l.unitCost} onChange={(e) => set(k, { unitCost: +e.target.value })} style={{ width: 100 }} /></label>
            <button className="sm ghost" aria-label="Quitar línea" onClick={() => setLines(lines.filter((_, j) => j !== k))}><X size={16} /></button>
          </div>
        ))}
        <div className="row spread">
          <button className="sm" onClick={() => setLines([...lines, { itemId: s.stock[0]?.id ?? '', name: '', unit: s.stock[0]?.unit ?? 'und', qty: 1, unitCost: 0 }])}>+ Línea</button>
          <b>Total {money(total)}</b>
        </div>
        <button className="primary" disabled={!valid} onClick={save}>Guardar y actualizar inventario</button>
      </div>

      <div className="card scroll">
        <h3>Compras registradas</h3>
        <table>
          <thead><tr><th>Fecha</th><th>Proveedor</th><th>Factura</th><th className="num">Líneas</th><th className="num">Total</th></tr></thead>
          <tbody>{[...s.purchases].reverse().map((p) => <tr key={p.id}><td>{new Date(p.at).toLocaleDateString('es-CO')}</td><td>{p.supplier}</td><td>{p.number}</td><td className="num">{p.lines.length}</td><td className="num">{money(p.total)}</td></tr>)}</tbody>
        </table>
        {!s.purchases.length && <p className="muted">Aún no hay compras.</p>}
      </div>
    </div>
  )
}
