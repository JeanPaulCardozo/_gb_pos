// Estado del demo guardado en localStorage. Para conectar el backend, cada acción de este
// archivo se reemplaza por su llamada a la API; las pantallas no cambian.
import { useSyncExternalStore } from 'react'
import type { Account, CashSession, Customer, Invoice, OrderLine, Payment, Product, Role, State, StockItem, User } from './types.ts'
import { accountTotals, explode, fakeCufe, paid, uid } from './logic.ts'
import { defaultRoom, makeSeed } from './seed.ts'
import { ADMIN_ONLY, DEFAULT_PERMS, type Perm } from './config.ts'

const KEY = 'mc-pos-v1'

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s: State = JSON.parse(raw)
      // cuentas abiertas sin productos (se abrieron y se abandonaron) no deben ocupar la mesa
      s.accounts = s.accounts.filter((a) => a.status !== 'open' || a.lines.length > 0)
      s.room ??= defaultRoom() // datos guardados antes de que existiera la planta del local
      return s
    }
  } catch { /* almacenamiento bloqueado: se usa la semilla */ }
  return makeSeed()
}

let state = load()
let ui: { user?: User; print: Ticket[]; toast?: { msg: string; kind: 'ok' | 'error' } } = { print: [] }
try { const id = sessionStorage.getItem(KEY + '-user'); ui.user = state.users.find((u) => u.id === id) } catch { /* sin sesión */ }

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l))

export const useStore = () => useSyncExternalStore(subscribe, () => state)
export const useUi = () => useSyncExternalStore(subscribe, () => ui)
export const getState = () => state

function set(fn: (d: State) => void) {
  const d = structuredClone(state)
  fn(d)
  state = d
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { toast('No se pudo guardar en el navegador', 'error') }
  emit()
}
const setUi = (patch: Partial<typeof ui>) => { ui = { ...ui, ...patch }; emit() }

const now = () => new Date().toISOString()
const me = () => ui.user?.id ?? '?'
const acc = (d: State, id: string) => d.accounts.find((a) => a.id === id)!

export function toast(msg: string, kind: 'ok' | 'error' = 'ok') {
  setUi({ toast: { msg, kind } })
  setTimeout(() => ui.toast?.msg === msg && setUi({ toast: undefined }), 3000)
}

// ---------- impresión ----------
export interface Ticket {
  title: string
  subtitle?: string
  lines: { left: string; right?: string; note?: string; bold?: boolean }[]
  footer?: string[]
}
export const print = (t: Ticket) => setUi({ print: [...ui.print, t] })
export const clearPrint = () => setUi({ print: [] })

// ---------- permisos ----------
export const rolesFor = (perm: Perm): Role[] => state.settings.perms?.[perm] ?? DEFAULT_PERMS[perm]
/** El admin siempre puede todo; los demás según lo que el admin haya dado o quitado. */
export const can = (role: Role | undefined, perm: Perm) =>
  role === 'admin' || (!!role && !ADMIN_ONLY.includes(perm) && rolesFor(perm).includes(role))
export function setPerm(perm: Perm, role: Role, on: boolean) {
  if (role === 'admin' || ADMIN_ONLY.includes(perm)) return
  const cur = rolesFor(perm)
  set((d) => { d.settings.perms = { ...d.settings.perms, [perm]: on ? [...new Set([...cur, role])] : cur.filter((r) => r !== role) } })
}
export const resetPerms = () => set((d) => { d.settings.perms = {} })

// ---------- sesión ----------
export const findByPin = (pin: string) => state.users.find((u) => u.active && u.pin === pin)

export function login(pin: string) {
  const u = findByPin(pin)
  if (u) { setUi({ user: u }); try { sessionStorage.setItem(KEY + '-user', u.id) } catch { /* */ } }
  return u
}
export function logout() { setUi({ user: undefined }); try { sessionStorage.removeItem(KEY + '-user') } catch { /* */ } }

/** Marca entrada o salida del turno. */
export function clock(pin: string) {
  const u = findByPin(pin)
  if (!u) return undefined
  const open = state.attendance.find((a) => a.userId === u.id && !a.out)
  set((d) => {
    if (open) d.attendance.find((a) => a.id === open.id)!.out = now()
    else d.attendance.push({ id: uid(), userId: u.id, in: now() })
  })
  return { user: u, action: open ? 'salida' : 'entrada' }
}

// ---------- CRUD genérico (productos, mesas, usuarios, convenios, insumos, subrecetas) ----------
type Coll = 'products' | 'tables' | 'users' | 'convenios' | 'stock' | 'subRecipes'
export function upsert<K extends Coll>(key: K, item: State[K][number]) {
  set((d) => {
    const list = d[key] as { id: string }[]
    const i = list.findIndex((x) => x.id === item.id)
    if (i >= 0) list[i] = item
    else list.push(item)
  })
}
export function remove(key: Coll, id: string) {
  set((d) => { (d[key] as { id: string }[]) = (d[key] as { id: string }[]).filter((x) => x.id !== id) })
}
export const setRoom = (room: State['room']) => set((d) => { d.room = room })
export const updateSettings =(patch: Partial<State['settings']>) => set((d) => { Object.assign(d.settings, patch) })
export const toggleAvailable = (p: Product) => upsert('products', { ...p, available: !p.available })

// ---------- cuentas y pedidos ----------
export function openAccount(tableId: string) {
  const id = uid()
  set((d) => {
    const n = d.accounts.filter((a) => a.tableId === tableId && a.status === 'open').length + 1
    d.accounts.push({ id, tableId, label: `Cuenta ${n}`, lines: [], status: 'open', openedAt: now(), openedBy: me() })
  })
  return id
}

/** Unidades que quedan para vender de un producto en conteo (descuenta lo pendiente de enviar en todas las cuentas). */
export function remaining(p: Product, s: State = state) {
  if (p.count == null) return Infinity
  const reserved = s.accounts.filter((a) => a.status === 'open').flatMap((a) => a.lines).filter((l) => l.status === 'pending' && l.productId === p.id).reduce((x, l) => x + l.qty, 0)
  return p.count - reserved
}
export const setCount = (p: Product, count: number | null) => upsert('products', { ...p, count: count == null ? null : Math.max(0, Math.round(count)) })

export function addLine(accountId: string, p: Product, qty: number, comment: string) {
  if (remaining(p) < qty) return toast(`Solo quedan ${Math.max(0, remaining(p))} de ${p.name}`, 'error')
  set((d) => {
    const a = acc(d, accountId)
    const same = a.lines.find((l) => l.status === 'pending' && l.productId === p.id && l.comment === comment)
    if (same) same.qty += qty
    else a.lines.push({ id: uid(), productId: p.id, name: p.name, price: p.price, qty, comment, status: 'pending', by: me() })
  })
}

export function updatePending(accountId: string, lineId: string, patch: Partial<Pick<OrderLine, 'qty' | 'comment'>>) {
  set((d) => {
    const a = acc(d, accountId)
    const l = a.lines.find((x) => x.id === lineId)!
    if (l.status !== 'pending') return
    const p = d.products.find((x) => x.id === l.productId)
    if (p && patch.qty && patch.qty > l.qty && remaining(p, d) < patch.qty - l.qty) return toast(`No quedan más ${p.name} en conteo`, 'error')
    Object.assign(l, patch)
    if (l.qty <= 0) a.lines = a.lines.filter((x) => x.id !== lineId)
  })
}

/** Envía los pendientes: descuenta inventario por receta e imprime la comanda por estación. */
export function sendOrder(accountId: string) {
  const a = state.accounts.find((x) => x.id === accountId)!
  const pending = a.lines.filter((l) => l.status === 'pending')
  if (!pending.length) return
  const table = state.tables.find((t) => t.id === a.tableId)?.name ?? '?'
  set((d) => {
    for (const l of acc(d, accountId).lines.filter((x) => x.status === 'pending')) {
      l.status = 'sent'; l.sentAt = now()
      const p = d.products.find((x) => x.id === l.productId)
      if (!p) continue
      if (p.count != null) p.count = Math.max(0, p.count - l.qty)
      for (const [itemId, q] of Object.entries(explode(p.recipe, d.subRecipes, l.qty))) {
        const it = d.stock.find((s) => s.id === itemId)
        if (it) it.qty -= q
        d.movements.push({ id: uid(), at: now(), itemId, delta: -q, reason: 'venta', note: `${table} · ${l.name}`, by: me() })
      }
    }
  })
  const station = (id: string) => state.products.find((p) => p.id === id)?.station ?? 'cocina'
  const by = ui.user ? `${ui.user.name} (${ui.user.role})` : '?'
  for (const st of ['cocina', 'barra'] as const) {
    const ls = pending.filter((l) => station(l.productId) === st)
    if (!ls.length) continue
    print({
      title: `COMANDA ${st.toUpperCase()}`,
      subtitle: `Mesa ${table} · ${a.label}`,
      lines: ls.map((l) => ({ left: `${l.qty} × ${l.name}`, note: l.comment, bold: true })),
      footer: [`Pidió: ${by}`, new Date().toLocaleString('es-CO')],
    })
  }
  toast('Pedido enviado')
}

export function voidLine(accountId: string, lineId: string, reason: string, authorizer: User) {
  set((d) => {
    const a = acc(d, accountId)
    const l = a.lines.find((x) => x.id === lineId)!
    l.status = 'void'
    d.voids.push({ id: uid(), at: now(), by: authorizer.id, requestedBy: me(), accountId, tableName: d.tables.find((t) => t.id === a.tableId)?.name ?? '?', detail: `${l.qty} × ${l.name}`, amount: l.qty * l.price, reason })
  })
  closeEmpty(accountId)
}

export function voidAccount(accountId: string, reason: string, authorizer: User) {
  set((d) => {
    const a = acc(d, accountId)
    const total = accountTotals(a, d.convenios, d.settings.taxRate).total
    Object.assign(a, { status: 'void', closedAt: now(), closedBy: authorizer.id } satisfies Partial<Account>)
    d.voids.push({ id: uid(), at: now(), by: authorizer.id, requestedBy: me(), accountId, tableName: d.tables.find((t) => t.id === a.tableId)?.name ?? '?', detail: `Cuenta completa (${a.label})`, amount: total, reason })
  })
}

/** Cierra una cuenta sin nada que cobrar para liberar la mesa: si nunca tuvo productos se borra, si todo se anuló queda como anulada. */
export function closeEmpty(accountId: string) {
  const a = state.accounts.find((x) => x.id === accountId)
  if (!a || a.status !== 'open' || a.lines.some((l) => l.status !== 'void')) return
  set((d) => {
    if (!a.lines.length) d.accounts = d.accounts.filter((x) => x.id !== accountId)
    else Object.assign(acc(d, accountId), { status: 'void', closedAt: now(), closedBy: me() } satisfies Partial<Account>)
  })
}

/** Separa líneas a una cuenta nueva de la misma mesa (para pagar en dos cuentas). */
export function moveLines(accountId: string, lineIds: string[]) {
  const id = openAccount(state.accounts.find((a) => a.id === accountId)!.tableId)
  set((d) => {
    const from = acc(d, accountId), to = acc(d, id)
    to.lines = from.lines.filter((l) => lineIds.includes(l.id))
    from.lines = from.lines.filter((l) => !lineIds.includes(l.id))
  })
  return id
}

export const setConvenio = (accountId: string, convenioId?: string) => set((d) => { acc(d, accountId).convenioId = convenioId })
export const renameAccount = (accountId: string, label: string) => set((d) => { acc(d, accountId).label = label })

export const openCash = () => state.cashSessions.find((c) => !c.closedAt)

export function pay(accountId: string, payments: Payment[], customer?: Customer): Invoice | undefined {
  const cash = openCash()
  if (!cash) return toast('Primero abre la caja', 'error'), undefined
  const a = state.accounts.find((x) => x.id === accountId)!
  const t = accountTotals(a, state.convenios, state.settings.taxRate)
  if (paid(payments) !== t.total) return toast('Los pagos no suman el total', 'error'), undefined
  const number = `${state.settings.invoicePrefix}-${state.settings.nextInvoice}`
  const at = now()
  const inv: Invoice = {
    id: uid(), number, kind: customer ? 'FE' : 'POS', at, accountId, cashSessionId: cash.id, cashierId: me(), customer,
    tableName: state.tables.find((x) => x.id === a.tableId)?.name ?? '?',
    lines: a.lines.filter((l) => l.status !== 'void').map(({ productId, name, qty, price }) => ({ productId, name, qty, price })),
    gross: t.gross, discount: t.discount, total: t.total, tax: t.tax,
    payments: payments.filter((p) => p.amount > 0), cufe: fakeCufe(number, t.total, at), emailStatus: customer ? 'simulado' : 'n/a',
  }
  set((d) => {
    d.invoices.push(inv)
    d.settings.nextInvoice++
    Object.assign(acc(d, accountId), { status: 'paid', invoiceId: inv.id, closedAt: at, closedBy: me() } satisfies Partial<Account>)
  })
  print(invoiceTicket(inv))
  return inv
}

/** Precuenta: lo consumido hasta ahora, sin valor fiscal. */
export function preBill(accountId: string) {
  const a = state.accounts.find((x) => x.id === accountId)!
  const t = accountTotals(a, state.convenios, state.settings.taxRate)
  const conv = state.convenios.find((c) => c.id === a.convenioId)
  print({
    title: 'PRECUENTA',
    subtitle: `${state.settings.businessName}
Mesa ${state.tables.find((x) => x.id === a.tableId)?.name} · ${a.label}
Abierta ${new Date(a.openedAt).toLocaleString('es-CO')}`,
    lines: [
      ...a.lines.filter((l) => l.status !== 'void').map((l) => ({ left: `${l.qty} × ${l.name}`, right: fmt(l.qty * l.price), note: l.status === 'pending' ? 'sin enviar' : undefined })),
      ...(t.discount ? [{ left: `Descuento ${conv?.name ?? ''}`, right: '-' + fmt(t.discount) }] : []),
      { left: 'TOTAL A PAGAR', right: fmt(t.total), bold: true },
      { left: `${state.settings.taxName} ${state.settings.taxRate}% incluido`, right: fmt(t.tax) },
    ],
    footer: ['Documento informativo, no es factura', `Atendió: ${state.users.find((u) => u.id === a.openedBy)?.name ?? ''}`, new Date().toLocaleString('es-CO')],
  })
}

export function invoiceTicket(inv: Invoice): Ticket {
  const s = state.settings
  return {
    title: s.businessName,
    subtitle: `NIT ${s.nit}\n${s.address}\n${inv.kind === 'FE' ? 'Factura electrónica de venta' : 'Documento equivalente POS electrónico'} ${inv.number}`,
    lines: [
      ...inv.lines.map((l) => ({ left: `${l.qty} × ${l.name}`, right: fmt(l.qty * l.price) })),
      ...(inv.discount ? [{ left: 'Descuento convenio', right: '-' + fmt(inv.discount) }] : []),
      { left: 'TOTAL', right: fmt(inv.total), bold: true },
      { left: `${s.taxName} ${s.taxRate}% incluido`, right: fmt(inv.tax) },
      ...inv.payments.map((p) => ({ left: p.method, right: fmt(p.amount) })),
    ],
    footer: [
      ...(inv.customer ? [`Cliente: ${inv.customer.name}`, `${inv.customer.docType} ${inv.customer.doc}`, `Enviada a ${inv.customer.email} (simulado)`] : ['Consumidor final']),
      `Mesa ${inv.tableName} · ${new Date(inv.at).toLocaleString('es-CO')}`,
      `CUFE/CUDE (simulado): ${inv.cufe}`,
    ],
  }
}
const fmt = (n: number) => '$' + n.toLocaleString('es-CO')

// shortcut: anulación local; en producción el backend emite la nota crédito electrónica ante la DIAN.
export function voidInvoice(id: string, reason: string, authorizer: User) {
  set((d) => {
    const inv = d.invoices.find((i) => i.id === id)!
    inv.voided = true
    d.voids.push({ id: uid(), at: now(), by: authorizer.id, requestedBy: me(), accountId: inv.accountId, tableName: inv.tableName, detail: `Factura ${inv.number} (nota crédito)`, amount: inv.total, reason })
  })
}

// ---------- caja ----------
export function openCashSession(base: number) {
  if (openCash()) return
  set((d) => { d.cashSessions.push({ id: uid(), openedAt: now(), openedBy: me(), base }) })
  toast('Caja abierta')
}
export function closeCashSession(countedCash: number, note: string) {
  set((d) => { Object.assign(d.cashSessions.find((c) => !c.closedAt)!, { closedAt: now(), closedBy: me(), countedCash, note } satisfies Partial<CashSession>) })
}

// ---------- inventario ----------
export function adjustStock(itemId: string, delta: number, note = 'Ajuste manual') {
  set((d) => {
    d.stock.find((s) => s.id === itemId)!.qty += delta
    d.movements.push({ id: uid(), at: now(), itemId, delta, reason: 'ajuste', note, by: me() })
  })
}

export interface PurchaseLineInput { itemId?: string; newItem?: Omit<StockItem, 'id' | 'qty' | 'cost'>; qty: number; unitCost: number }

/** Factura de compra: suma cantidades, recalcula costo promedio y crea insumos nuevos. */
export function registerPurchase(supplier: string, number: string, lines: PurchaseLineInput[]) {
  set((d) => {
    const out = lines.map((l) => {
      let it = d.stock.find((s) => s.id === l.itemId)
      if (!it) { it = { id: uid(), qty: 0, cost: l.unitCost, ...l.newItem! }; d.stock.push(it) }
      const totalQty = Math.max(it.qty, 0) + l.qty
      it.cost = totalQty ? (Math.max(it.qty, 0) * it.cost + l.qty * l.unitCost) / totalQty : l.unitCost
      it.qty += l.qty
      d.movements.push({ id: uid(), at: now(), itemId: it.id, delta: l.qty, reason: 'compra', note: `${supplier} #${number}`, by: me() })
      return { itemId: it.id, qty: l.qty, unitCost: l.unitCost }
    })
    d.purchases.push({ id: uid(), at: now(), supplier, number, lines: out, total: out.reduce((s, l) => s + l.qty * l.unitCost, 0), by: me() })
  })
  toast('Factura de compra registrada, inventario actualizado')
}

// ---------- datos ----------
export function resetDemo() { state = makeSeed(); set(() => {}); logout() }
export function importData(json: string) { const s = JSON.parse(json) as State; if (!s.settings || !s.products) throw new Error('Archivo inválido'); s.room ??= defaultRoom(); set((d) => Object.assign(d, s)) }
