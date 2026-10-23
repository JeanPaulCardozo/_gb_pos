// Reglas de negocio puras (sin React ni almacenamiento). El backend puede replicarlas tal cual.
import type { Account, Convenio, Ingredient, Invoice, Payment, State, SubRecipe } from './types.ts'

export const money = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

export const uid = () => Math.random().toString(36).slice(2, 10)

/** Convierte una receta (con subrecetas anidadas) en cantidades por insumo de inventario. */
export function explode(
  ingredients: Ingredient[],
  subRecipes: SubRecipe[],
  factor = 1,
  out: Record<string, number> = {},
  depth = 0,
): Record<string, number> {
  if (depth > 10) throw new Error('Subrecetas en ciclo')
  for (const ing of ingredients) {
    if (ing.kind === 'stock') out[ing.id] = (out[ing.id] ?? 0) + ing.qty * factor
    else {
      const sub = subRecipes.find((s) => s.id === ing.id)
      if (sub) explode(sub.ingredients, subRecipes, ing.qty * factor, out, depth + 1)
    }
  }
  return out
}

export function recipeCost(ingredients: Ingredient[], s: Pick<State, 'stock' | 'subRecipes'>) {
  const needs = explode(ingredients, s.subRecipes)
  return Object.entries(needs).reduce((sum, [id, q]) => sum + q * (s.stock.find((i) => i.id === id)?.cost ?? 0), 0)
}

export function accountTotals(acc: Account, convenios: Convenio[], taxRate: number) {
  const lines = acc.lines.filter((l) => l.status !== 'void')
  const gross = lines.reduce((s, l) => s + l.price * l.qty, 0)
  const pct = convenios.find((c) => c.id === acc.convenioId)?.discountPct ?? 0
  const discount = Math.round((gross * pct) / 100)
  const total = gross - discount
  const tax = Math.round(total - total / (1 + taxRate / 100))
  return { gross, discount, total, tax, pending: lines.filter((l) => l.status === 'pending').length }
}

/** Divide un total en n partes enteras; el residuo va a la última. */
export function splitEven(total: number, n: number): number[] {
  const part = Math.floor(total / n)
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? total - part * (n - 1) : part))
}

export function cashSummary(sessionId: string, base: number, invoices: Invoice[]) {
  const byMethod: Record<string, number> = {}
  let sales = 0
  for (const inv of invoices) {
    if (inv.cashSessionId !== sessionId || inv.voided) continue
    sales += inv.total
    for (const p of inv.payments) byMethod[p.method] = (byMethod[p.method] ?? 0) + p.amount
  }
  const cash = byMethod['Efectivo'] ?? 0
  return { sales, byMethod, expectedCash: base + cash, count: invoices.filter((i) => i.cashSessionId === sessionId).length }
}

export const paid = (payments: Payment[]) => payments.reduce((s, p) => s + p.amount, 0)

/** CUFE simulado: el real lo calcula el proveedor tecnológico (SHA-384 sobre campos DIAN). */
export const fakeCufe = (num: string, total: number, at: string) =>
  Array.from(`${num}|${total}|${at}`).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(16).padStart(8, '0') + uid() + uid()
