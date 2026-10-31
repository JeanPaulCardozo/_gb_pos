// Contrato de datos del POS. El backend debería exponer estas mismas entidades.
// Dinero: pesos colombianos enteros (COP). Fechas: ISO string.

export type Role = 'admin' | 'lider' | 'barra' | 'cajero' | 'mesero'

export interface User {
  id: string
  name: string
  role: Role
  pin: string // shortcut: PIN en texto plano, en backend guardar hash
  active: boolean
}

export interface Attendance {
  id: string
  userId: string
  in: string
  out?: string
}

export interface Table {
  id: string
  name: string
  x: number // % del ancho del plano
  y: number // % del alto del plano
  shape: 'round' | 'square' | 'bar'
  seats: number
}

/** Planta del local: medidas reales y contorno. Las mesas y las esquinas usan % de ancho × fondo. */
export interface Room {
  width: number // metros
  depth: number // metros
  points: { x: number; y: number }[] // contorno en orden, mínimo 3 esquinas
}

export type Unit = 'g' | 'ml' | 'und'

export interface StockItem {
  id: string
  name: string
  unit: Unit
  qty: number
  minQty: number
  cost: number // costo por unidad (g, ml o und)
}

export interface Ingredient {
  kind: 'stock' | 'sub'
  id: string // StockItem.id o SubRecipe.id
  qty: number // en la unidad del insumo, o porciones de la subreceta
}

export interface SubRecipe {
  id: string
  name: string
  ingredients: Ingredient[] // rinde 1 porción
}

export interface Product {
  id: string
  name: string
  category: string
  price: number // precio de venta con impuesto incluido
  station: 'cocina' | 'barra'
  available: boolean
  count?: number | null // conteo: unidades que quedan para vender; null = sin límite
  recipe: Ingredient[]
}

export interface OrderLine {
  id: string
  productId: string
  name: string
  price: number
  qty: number
  comment: string
  status: 'pending' | 'sent' | 'void'
  by: string // userId
  sentAt?: string
}

export interface Account {
  id: string
  tableId: string
  label: string
  lines: OrderLine[]
  status: 'open' | 'paid' | 'void'
  openedAt: string
  openedBy: string
  convenioId?: string
  invoiceId?: string
  closedAt?: string // pagada o anulada
  closedBy?: string
}

export interface Payment {
  method: string
  amount: number
}

export interface Customer {
  docType: 'NIT' | 'CC' | 'CE' | 'PAS'
  doc: string
  name: string
  email: string
}

export interface Invoice {
  id: string
  number: string
  kind: 'POS' | 'FE' // tiquete POS (consumidor final) o factura electrónica con datos del cliente
  at: string
  accountId: string
  tableName: string
  cashSessionId: string
  cashierId: string
  customer?: Customer
  lines: { productId: string; name: string; qty: number; price: number }[]
  gross: number
  discount: number
  total: number
  tax: number
  payments: Payment[]
  cufe: string // simulado hasta integrar el proveedor tecnológico DIAN
  emailStatus: 'n/a' | 'simulado'
  voided?: boolean
}

export interface CashSession {
  id: string
  openedAt: string
  openedBy: string
  base: number
  closedAt?: string
  closedBy?: string
  countedCash?: number
  note?: string
}

export interface VoidRecord {
  id: string
  at: string
  by: string // quien autorizó
  requestedBy: string
  accountId: string
  tableName: string
  detail: string
  amount: number
  reason: string
}

export interface Movement {
  id: string
  at: string
  itemId: string
  delta: number
  reason: 'venta' | 'compra' | 'ajuste'
  note?: string
  by: string
}

export interface Purchase {
  id: string
  at: string
  supplier: string
  number: string
  lines: { itemId: string; qty: number; unitCost: number }[]
  total: number
  by: string
}

export interface Convenio {
  id: string
  name: string
  discountPct: number
  active: boolean
}

export interface Settings {
  businessName: string
  nit: string
  address: string
  taxName: string
  taxRate: number // % incluido en el precio (restaurantes: INC 8%)
  invoicePrefix: string
  nextInvoice: number
  categories: string[]
  paymentMethods: string[]
  autoPrint: boolean
  perms?: Partial<Record<string, Role[]>> // permisos editados por el admin; lo que falte usa DEFAULT_PERMS
}

export interface State {
  settings: Settings
  users: User[]
  attendance: Attendance[]
  tables: Table[]
  room: Room
  stock: StockItem[]
  subRecipes: SubRecipe[]
  products: Product[]
  accounts: Account[]
  invoices: Invoice[]
  cashSessions: CashSession[]
  voids: VoidRecord[]
  movements: Movement[]
  purchases: Purchase[]
  convenios: Convenio[]
}
