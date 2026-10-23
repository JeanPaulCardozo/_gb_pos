import { test } from 'node:test'
import assert from 'node:assert/strict'
import { accountTotals, explode, recipeCost, splitEven } from './logic.ts'
import type { Account } from './types.ts'

const subRecipes = [
  { id: 'shot', name: 'Shot', ingredients: [{ kind: 'stock' as const, id: 'cafe', qty: 18 }] },
  { id: 'doble', name: 'Doble', ingredients: [{ kind: 'sub' as const, id: 'shot', qty: 2 }] },
]
const stock = [{ id: 'cafe', name: 'Café', unit: 'g' as const, qty: 1000, minQty: 0, cost: 50 }, { id: 'leche', name: 'Leche', unit: 'ml' as const, qty: 1000, minQty: 0, cost: 4 }]

test('explode resuelve subrecetas anidadas y multiplica por cantidad', () => {
  const r = explode([{ kind: 'sub', id: 'doble', qty: 1 }, { kind: 'stock', id: 'leche', qty: 200 }], subRecipes, 3)
  assert.deepEqual(r, { cafe: 108, leche: 600 })
})

test('recipeCost usa el costo unitario del inventario', () => {
  assert.equal(recipeCost([{ kind: 'sub', id: 'shot', qty: 1 }], { stock, subRecipes }), 900)
})

test('explode corta ciclos', () => {
  assert.throws(() => explode([{ kind: 'sub', id: 'a', qty: 1 }], [{ id: 'a', name: 'a', ingredients: [{ kind: 'sub', id: 'a', qty: 1 }] }]))
})

test('splitEven no pierde pesos', () => {
  assert.deepEqual(splitEven(10000, 3), [3333, 3333, 3334])
})

test('accountTotals ignora anulados y aplica convenio', () => {
  const acc = {
    convenioId: 'c', lines: [
      { status: 'sent', price: 10000, qty: 2 },
      { status: 'void', price: 5000, qty: 1 },
    ],
  } as unknown as Account
  const t = accountTotals(acc, [{ id: 'c', name: 'x', discountPct: 10, active: true }], 8)
  assert.equal(t.gross, 20000)
  assert.equal(t.discount, 2000)
  assert.equal(t.total, 18000)
  assert.equal(t.tax, 1333)
})
