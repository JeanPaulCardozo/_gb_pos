// Datos de prueba del demo, incluye 14 días de historial para que los reportes muestren algo.
import type { Account, CashSession, OrderLine, Ingredient, Invoice, Product, State, StockItem, VoidRecord } from './types.ts'
import { accountTotals, explode, fakeCufe } from './logic.ts'

const st = (id: string, qty: number): Ingredient => ({ kind: 'stock', id, qty })
const sub = (id: string, qty = 1): Ingredient => ({ kind: 'sub', id, qty })

const stock: StockItem[] = [
  ['cafe', 'Café en grano', 'g', 5000, 1000, 60],
  ['leche', 'Leche entera', 'ml', 20000, 5000, 4.5],
  ['avena', 'Leche de avena', 'ml', 5000, 1000, 12],
  ['azucar', 'Azúcar', 'g', 5000, 1000, 4],
  ['vainilla', 'Extracto de vainilla', 'ml', 500, 100, 80],
  ['chocolate', 'Chocolate amargo', 'g', 2000, 500, 30],
  ['vodka', 'Vodka', 'ml', 3000, 750, 60],
  ['licor', 'Licor de café', 'ml', 2000, 700, 90],
  ['ron', 'Ron añejo', 'ml', 3000, 750, 70],
  ['hielo', 'Hielo', 'g', 20000, 5000, 0.5],
  ['tonica', 'Agua tónica', 'ml', 5000, 1000, 8],
  ['naranja', 'Naranja', 'und', 40, 10, 800],
  ['croissant', 'Croissant', 'und', 30, 10, 2500],
  ['pan', 'Pan masa madre (tajada)', 'und', 40, 10, 1200],
  ['jamon', 'Jamón serrano', 'g', 2000, 500, 40],
  ['queso', 'Queso madurado', 'g', 3000, 500, 35],
  ['huevo', 'Huevo', 'und', 60, 15, 600],
  ['aguacate', 'Aguacate', 'und', 20, 5, 2500],
  ['brownie', 'Brownie', 'und', 20, 5, 3000],
  ['cheesecake', 'Cheesecake (porción)', 'und', 16, 4, 4500],
].map(([id, name, unit, qty, minQty, cost]) => ({ id, name, unit, qty, minQty, cost }) as StockItem)

const subRecipes = [
  { id: 'shot', name: 'Shot de espresso', ingredients: [st('cafe', 18)] },
  { id: 'lechetex', name: 'Leche texturizada', ingredients: [st('leche', 180)] },
  { id: 'jarabe', name: 'Jarabe de vainilla casero', ingredients: [st('azucar', 15), st('vainilla', 2)] },
  { id: 'coldbrew', name: 'Base cold brew', ingredients: [st('cafe', 30)] },
]

const P = (id: string, name: string, category: string, price: number, recipe: Ingredient[], station: Product['station'] = 'barra'): Product =>
  ({ id, name, category, price, recipe, station, available: true })

const products: Product[] = [
  P('espresso', 'Espresso', 'Bebidas calientes', 5000, [sub('shot')]),
  P('americano', 'Americano', 'Bebidas calientes', 6000, [sub('shot')]),
  P('capuccino', 'Capuccino', 'Bebidas calientes', 8500, [sub('shot'), sub('lechetex')]),
  P('latte', 'Latte de vainilla', 'Bebidas calientes', 10000, [sub('shot'), sub('lechetex'), sub('jarabe')]),
  P('mocaccino', 'Mocaccino', 'Bebidas calientes', 10500, [sub('shot'), sub('lechetex'), st('chocolate', 20)]),
  P('coldbrew', 'Cold brew', 'Bebidas frías', 9500, [sub('coldbrew'), st('hielo', 150)]),
  P('tonic', 'Espresso tonic', 'Bebidas frías', 12000, [sub('shot'), st('tonica', 150), st('hielo', 100), st('naranja', 0.1)]),
  P('martini', 'Espresso martini', 'Cócteles', 28000, [sub('shot'), st('vodka', 45), st('licor', 30), st('azucar', 5)]),
  P('carajillo', 'Carajillo', 'Cócteles', 24000, [sub('shot'), st('licor', 45), st('hielo', 100)]),
  P('maldita', 'Maldita conducta (firma)', 'Cócteles', 32000, [st('ron', 60), sub('coldbrew'), st('naranja', 0.25), sub('jarabe')]),
  P('croissant', 'Croissant jamón y queso', 'Comidas', 16000, [st('croissant', 1), st('jamon', 40), st('queso', 30)], 'cocina'),
  P('tostada', 'Tostada de aguacate', 'Comidas', 22000, [st('pan', 1), st('aguacate', 0.5), st('huevo', 1)], 'cocina'),
  P('sandwich', 'Sándwich clandestino', 'Comidas', 26000, [st('pan', 2), st('jamon', 60), st('queso', 40), st('huevo', 1)], 'cocina'),
  P('brownie', 'Brownie', 'Postres', 9000, [st('brownie', 1)], 'cocina'),
  P('cheesecake', 'Cheesecake', 'Postres', 14000, [st('cheesecake', 1)], 'cocina'),
  P('happy', 'Happy hour 2x1 espresso martini', 'Promociones', 40000, [sub('shot', 2), st('vodka', 90), st('licor', 60), st('azucar', 10)]),
  P('combo', 'Café + croissant', 'Promociones', 20000, [sub('shot'), sub('lechetex'), st('croissant', 1), st('jamon', 40), st('queso', 30)], 'cocina'),
]

const users = [
  { id: 'u1', name: 'Dueño', role: 'admin', pin: '1111', active: true },
  { id: 'u2', name: 'Valentina', role: 'lider', pin: '2222', active: true },
  { id: 'u3', name: 'Andrés', role: 'barra', pin: '3333', active: true },
  { id: 'u4', name: 'Camila', role: 'cajero', pin: '4444', active: true },
  { id: 'u5', name: 'Mateo', role: 'mesero', pin: '5555', active: true },
  { id: 'u6', name: 'Sofía', role: 'mesero', pin: '6666', active: true },
] satisfies State['users']

const tables: State['tables'] = [
  { id: 't0', name: 'Mostrador', x: 13, y: 12, shape: 'bar', seats: 0 },
  ...[1, 2, 3, 4].map((n) => ({ id: `b${n}`, name: `B${n}`, x: 30 + n * 12, y: 12, shape: 'round' as const, seats: 1 })),
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
    id: `m${n}`, name: `M${n}`, x: 14 + ((n - 1) % 4) * 22, y: n <= 4 ? 45 : 75,
    shape: (n % 2 ? 'round' : 'square') as 'round' | 'square', seats: n % 3 ? 4 : 2,
  })),
]

const settings: State['settings'] = {
  businessName: 'Maldita Conducta S.A.S.',
  nit: '900.000.000-0',
  address: 'Dirección por definir',
  taxName: 'INC',
  taxRate: 8,
  invoicePrefix: 'MC',
  nextInvoice: 1,
  categories: ['Bebidas calientes', 'Bebidas frías', 'Cócteles', 'Comidas', 'Postres', 'Promociones'],
  paymentMethods: ['Efectivo', 'Tarjeta débito', 'Tarjeta crédito', 'Nequi', 'Daviplata', 'Transferencia'],
  autoPrint: false,
}

function history(s: State) {
  let seed = 42
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]
  const waiters = ['u5', 'u6', 'u4']
  const methods = ['Efectivo', 'Efectivo', 'Tarjeta débito', 'Tarjeta crédito', 'Nequi', 'Daviplata']
  for (let d = 14; d >= 1; d--) {
    const day = new Date(); day.setDate(day.getDate() - d); day.setHours(8, 0, 0, 0)
    const session: CashSession = { id: `cs-${d}`, openedAt: day.toISOString(), openedBy: 'u4', base: 200000 }
    const n = 15 + Math.floor(rnd() * 20) + (day.getDay() >= 4 ? 15 : 0)
    for (let i = 0; i < n; i++) {
      const at = new Date(day); at.setHours(9 + Math.floor(rnd() * 13), Math.floor(rnd() * 60))
      const tbl = pick(s.tables)
      const lines = Array.from({ length: 1 + Math.floor(rnd() * 4) }, (_, k) => {
        const p = at.getHours() >= 18 && rnd() < 0.5 ? pick(products.filter((x) => x.category === 'Cócteles' || x.category === 'Promociones')) : pick(products)
        return { id: `l${d}-${i}-${k}`, productId: p.id, name: p.name, price: p.price, qty: 1 + Math.floor(rnd() * 2), comment: '', status: 'sent' as OrderLine['status'], by: 'u5', sentAt: at.toISOString() }
      })
      const acc: Account = { id: `a${d}-${i}`, tableId: tbl.id, label: 'Cuenta 1', lines, status: 'paid', openedAt: at.toISOString(), openedBy: pick(waiters) }
      if (rnd() < 0.05) {
        const l = lines[0]; l.status = 'void'
        s.voids.push({ id: `v${d}-${i}`, at: at.toISOString(), by: 'u1', requestedBy: acc.openedBy, accountId: acc.id, tableName: tbl.name, detail: `${l.qty} × ${l.name}`, amount: l.price * l.qty, reason: pick(['Error de digitación', 'Cliente cambió el pedido', 'Producto devuelto']) } satisfies VoidRecord)
      }
      const t = accountTotals(acc, s.convenios, settings.taxRate)
      if (t.total === 0) continue
      const number = `${settings.invoicePrefix}-${settings.nextInvoice++}`
      const m = pick(methods)
      const payments = rnd() < 0.15 ? [{ method: 'Efectivo', amount: Math.floor(t.total / 2) }, { method: m === 'Efectivo' ? 'Nequi' : m, amount: t.total - Math.floor(t.total / 2) }] : [{ method: m, amount: t.total }]
      const inv: Invoice = {
        id: `i${d}-${i}`, number, kind: rnd() < 0.2 ? 'FE' : 'POS', at: at.toISOString(), accountId: acc.id, tableName: tbl.name, cashSessionId: session.id, cashierId: 'u4',
        lines: lines.filter((l) => l.status !== 'void').map(({ productId, name, qty, price }) => ({ productId, name, qty, price })),
        ...t, payments, cufe: fakeCufe(number, t.total, at.toISOString()), emailStatus: 'n/a',
      }
      const closed = new Date(+at + (30 + Math.floor(rnd() * 40)) * 60000).toISOString()
      Object.assign(acc, { invoiceId: inv.id, closedAt: closed, closedBy: 'u4' }); inv.at = closed
      s.accounts.push(acc); s.invoices.push(inv)
    }
    const cash = s.invoices.filter((i) => i.cashSessionId === session.id).flatMap((i) => i.payments).filter((p) => p.method === 'Efectivo').reduce((a, p) => a + p.amount, 0)
    const close = new Date(day); close.setHours(22)
    Object.assign(session, { closedAt: close.toISOString(), closedBy: 'u4', countedCash: session.base + cash - (rnd() < 0.2 ? Math.round(rnd() * 30) * 1000 : 0) })
    s.cashSessions.push(session)
    // mermas ocasionales para el reporte de pérdidas
    if (rnd() < 0.4) s.movements.push({ id: `mv${d}`, at: close.toISOString(), itemId: pick(['croissant', 'aguacate', 'brownie']), delta: -(1 + Math.floor(rnd() * 3)), reason: 'ajuste', note: 'Merma / vencido', by: 'u2' })
  }
}

export function makeSeed(): State {
  const s: State = {
    settings, users, tables, stock, subRecipes, products,
    attendance: [], accounts: [], invoices: [], cashSessions: [], voids: [], movements: [], purchases: [],
    convenios: [
      { id: 'c1', name: 'Empleados', discountPct: 20, active: true },
      { id: 'c2', name: 'Coworking vecino', discountPct: 10, active: true },
      { id: 'c3', name: 'Influencers (prueba)', discountPct: 15, active: false },
    ],
  }
  history(s)
  void explode // la historia no descuenta inventario: el stock inicial es el de hoy
  return structuredClone(s)
}
