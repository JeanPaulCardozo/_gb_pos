import { useState } from 'react'
import { cashSummary, money, recipeCost } from '../logic.ts'
import { useStore } from '../store.ts'
import type { State } from '../types.ts'
import { Bars } from '../ui.tsx'

const RANGES = { hoy: 0, '7 días': 7, '30 días': 30, todo: 3650 } as const

export default function Reportes() {
  const s = useStore()
  const [range, setRange] = useState<keyof typeof RANGES>('7 días')
  const from = new Date(); from.setHours(0, 0, 0, 0); from.setDate(from.getDate() - Math.max(0, RANGES[range] - 1))
  const inRange = (iso: string) => new Date(iso) >= from

  const invoices = s.invoices.filter((i) => !i.voided && inRange(i.at))
  const sales = invoices.reduce((x, i) => x + i.total, 0)
  const discounts = invoices.reduce((x, i) => x + i.discount, 0)
  const tax = invoices.reduce((x, i) => x + i.tax, 0)
  // shortcut: costo con las recetas y costos actuales; para costo histórico el backend debe guardar el costo en cada venta.
  const costOf = Object.fromEntries(s.products.map((p) => [p.id, recipeCost(p.recipe, s)]))
  const byProduct: Record<string, { name: string; cat: string; qty: number; sales: number; cost: number }> = {}
  for (const i of invoices) for (const l of i.lines) {
    const p = s.products.find((x) => x.id === l.productId)
    const r = (byProduct[l.productId] ??= { name: l.name, cat: p?.category ?? '—', qty: 0, sales: 0, cost: 0 })
    r.qty += l.qty; r.sales += l.qty * l.price; r.cost += l.qty * (costOf[l.productId] ?? 0)
  }
  const prods = Object.values(byProduct).sort((a, b) => b.sales - a.sales)
  const cost = prods.reduce((x, p) => x + p.cost, 0)
  const net = sales - tax
  const voids = s.voids.filter((v) => inRange(v.at))
  const waste = s.movements.filter((m) => m.reason === 'ajuste' && m.delta < 0 && inRange(m.at))
  const wasteValue = waste.reduce((x, m) => x + -m.delta * (s.stock.find((i) => i.id === m.itemId)?.cost ?? 0), 0)
  const closes = s.cashSessions.filter((c) => c.closedAt && inRange(c.openedAt)).map((c) => ({ c, diff: (c.countedCash ?? 0) - cashSummary(c.id, c.base, s.invoices).expectedCash }))
  const shortage = closes.reduce((x, { diff }) => x + Math.min(0, diff), 0)

  const group = (key: (i: (typeof invoices)[number]) => string | string[], val: (i: (typeof invoices)[number]) => number = (i) => i.total) => {
    const out: Record<string, number> = {}
    for (const i of invoices) for (const k of [key(i)].flat()) out[k] = (out[k] ?? 0) + val(i)
    return out
  }
  const byDay = Object.entries(group((i) => new Date(i.at).toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: '2-digit' }))).slice(-14)
  const byHour = Object.entries(group((i) => `${String(new Date(i.at).getHours()).padStart(2, '0')}:00`)).sort()
  const byMethod: Record<string, number> = {}
  for (const i of invoices) for (const p of i.payments) byMethod[p.method] = (byMethod[p.method] ?? 0) + p.amount
  const waiterOf = (accountId: string) => s.users.find((u) => u.id === s.accounts.find((a) => a.id === accountId)?.openedBy)?.name ?? '—'
  const byWaiter = group((i) => waiterOf(i.accountId))
  const byCat: Record<string, number> = {}
  for (const p of prods) byCat[p.cat] = (byCat[p.cat] ?? 0) + p.sales
  const sorted = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1])
  const name = (id: string) => s.users.find((u) => u.id === id)?.name ?? '—'

  const Kpi = ({ label, value, hint, bad }: { label: string; value: string; hint?: string; bad?: boolean }) => (
    <div className="card"><div className="muted">{label}</div><div className={`kpi ${bad ? 'bad-text' : ''}`}>{value}</div>{hint && <div className="muted" style={{ fontSize: '.8rem' }}>{hint}</div>}</div>
  )

  return (
    <div className="stack">
      <div className="row spread">
        <h1>Reportes</h1>
        <div className="row">
          {Object.keys(RANGES).map((r) => <button key={r} className={r === range ? 'primary' : ''} onClick={() => setRange(r as keyof typeof RANGES)}>{r}</button>)}
          <ExportMenu s={s} />
        </div>
      </div>

      <div className="grid" style={{ '--min': '190px' } as React.CSSProperties}>
        <Kpi label="Ventas" value={money(sales)} hint={`${invoices.length} facturas`} />
        <Kpi label="Ticket promedio" value={money(invoices.length ? Math.round(sales / invoices.length) : 0)} />
        <Kpi label="Ganancia bruta" value={money(Math.round(net - cost))} hint={`Ventas sin ${s.settings.taxName} − costo de recetas (${net ? Math.round(((net - cost) / net) * 100) : 0}%)`} />
        <Kpi label="Costo de lo vendido" value={money(Math.round(cost))} />
        <Kpi label="Anulaciones" value={money(voids.reduce((x, v) => x + v.amount, 0))} hint={`${voids.length} registros`} bad={voids.length > 0} />
        <Kpi label="Mermas" value={money(Math.round(wasteValue))} hint="Ajustes negativos de inventario" bad={wasteValue > 0} />
        <Kpi label="Descuadres de caja" value={money(shortage)} hint={`${closes.filter((c) => c.diff !== 0).length} cierres con diferencia`} bad={shortage < 0} />
        <Kpi label="Descuentos convenios" value={money(discounts)} />
      </div>

      <div className="grid" style={{ '--min': '340px' } as React.CSSProperties}>
        <div className="card"><h3>Ventas por día</h3><Bars data={byDay} /></div>
        <div className="card"><h3>Ventas por hora</h3><Bars data={byHour} /></div>
        <div className="card"><h3>Por categoría</h3><Bars data={sorted(byCat)} /></div>
        <div className="card"><h3>Por método de pago</h3><Bars data={sorted(byMethod)} /></div>
        <div className="card"><h3>Por mesero (quien abrió la cuenta)</h3><Bars data={sorted(byWaiter)} /></div>
      </div>

      <div className="card scroll">
        <h3>Rentabilidad por producto</h3>
        <table>
          <thead><tr><th>Producto</th><th className="num">Unidades</th><th className="num">Ventas</th><th className="num">Costo</th><th className="num">Margen</th></tr></thead>
          <tbody>{prods.map((p) => {
            const base = p.sales / (1 + s.settings.taxRate / 100)
            const m = base ? Math.round(((base - p.cost) / base) * 100) : 0
            return <tr key={p.name}><td>{p.name}</td><td className="num">{p.qty}</td><td className="num">{money(p.sales)}</td><td className="num">{money(Math.round(p.cost))}</td><td className={`num ${m < 50 ? 'neon' : ''}`}>{m}%</td></tr>
          })}</tbody>
        </table>
      </div>

      <div className="card scroll">
        <h3>Anulaciones</h3>
        <table>
          <thead><tr><th>Fecha</th><th>Mesa</th><th>Detalle</th><th>Motivo</th><th>Pidió</th><th>Autorizó</th><th className="num">Valor</th></tr></thead>
          <tbody>{[...voids].reverse().map((v) => <tr key={v.id}><td>{new Date(v.at).toLocaleString('es-CO')}</td><td>{v.tableName}</td><td>{v.detail}</td><td>{v.reason}</td><td>{name(v.requestedBy)}</td><td>{name(v.by)}</td><td className="num">{money(v.amount)}</td></tr>)}</tbody>
        </table>
        {!voids.length && <p className="muted">Sin anulaciones en el rango.</p>}
      </div>
    </div>
  )
}

/** CSV por tabla, listos para cargar en Power BI (modelo estrella: ver docs/INTEGRACIONES.md). */
function ExportMenu({ s }: { s: State }) {
  const csv = (name: string, rows: Record<string, unknown>[]) => {
    if (!rows.length) return
    const cols = Object.keys(rows[0])
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const body = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' }))
    a.download = `${name}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const exportAll = () => {
    csv('ventas_lineas', s.invoices.flatMap((i) => i.lines.map((l) => ({ factura: i.number, fecha: i.at, tipo: i.kind, mesa: i.tableName, producto_id: l.productId, producto: l.name, cantidad: l.qty, precio: l.price, anulada: !!i.voided }))))
    csv('ventas', s.invoices.map((i) => ({ factura: i.number, fecha: i.at, tipo: i.kind, mesa: i.tableName, cajero_id: i.cashierId, bruto: i.gross, descuento: i.discount, total: i.total, impuesto: i.tax, cliente_doc: i.customer?.doc, anulada: !!i.voided })))
    csv('pagos', s.invoices.flatMap((i) => i.payments.map((p) => ({ factura: i.number, fecha: i.at, metodo: p.method, valor: p.amount }))))
    csv('anulaciones', s.voids.map((v) => ({ fecha: v.at, mesa: v.tableName, detalle: v.detail, motivo: v.reason, pidio_id: v.requestedBy, autorizo_id: v.by, valor: v.amount })))
    csv('cierres_caja', s.cashSessions.map((c) => ({ apertura: c.openedAt, cierre: c.closedAt, base: c.base, contado: c.countedCash, esperado: cashSummary(c.id, c.base, s.invoices).expectedCash })))
    csv('movimientos_inventario', s.movements.map((m) => ({ fecha: m.at, insumo_id: m.itemId, tipo: m.reason, cantidad: m.delta, nota: m.note })))
    csv('productos', s.products.map((p) => ({ id: p.id, nombre: p.name, categoria: p.category, precio: p.price, costo: Math.round(recipeCost(p.recipe, s)) })))
    csv('empleados', s.users.map((u) => ({ id: u.id, nombre: u.name, rol: u.role })))
  }
  return <button onClick={exportAll} title="Descarga un CSV por tabla">Exportar CSV (Power BI)</button>
}
