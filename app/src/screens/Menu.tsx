import { useState } from 'react'
import { X } from 'lucide-react'
import { money, recipeCost, uid } from '../logic.ts'
import { can, remaining, remove, setCount, toggleAvailable, upsert, useStore, useUi } from '../store.ts'
import type { Ingredient, Product, SubRecipe } from '../types.ts'
import { Modal } from '../ui.tsx'

export default function Menu() {
  const s = useStore()
  const { user } = useUi()
  const [tab, setTab] = useState<'productos' | 'subrecetas'>('productos')
  const [editP, setEditP] = useState<Product>()
  const [editS, setEditS] = useState<SubRecipe>()
  const admin = can(user?.role, 'menu.editar')
  const canBlock = can(user?.role, 'menu.bloquear')
  const canCount = can(user?.role, 'menu.conteo')

  return (
    <div className="stack">
      <div className="row spread">
        <h1>Menú y recetas</h1>
        <div className="seg">
          <button aria-pressed={tab === 'productos'} onClick={() => setTab('productos')}>Productos de venta</button>
          <button aria-pressed={tab === 'subrecetas'} onClick={() => setTab('subrecetas')}>Subrecetas</button>
        </div>
      </div>

      {tab === 'productos' && <>
        {admin && <button style={{ justifySelf: 'start' }} onClick={() => setEditP({ id: uid(), name: '', category: s.settings.categories[0], price: 0, station: 'barra', available: true, recipe: [] })}>+ Nuevo producto</button>}
        {s.settings.categories.map((cat) => {
          const list = s.products.filter((p) => p.category === cat)
          if (!list.length) return null
          return (
            <div key={cat} className="card scroll">
              <h3>{cat}</h3>
              <table>
                <thead><tr><th>Producto</th><th className="num">Precio</th>{admin && <><th className="num">Costo receta</th><th className="num">Margen</th></>}<th>Estado</th><th>Conteo</th><th /></tr></thead>
                <tbody>
                  {list.map((p) => {
                    const cost = recipeCost(p.recipe, s)
                    return (
                      <tr key={p.id}>
                        <td>{p.name} <span className="muted">· {p.station}</span></td>
                        <td className="num">{money(p.price)}</td>
                        {admin && <><td className="num">{money(cost)}</td><td className="num">{p.price ? Math.round((1 - cost / p.price) * 100) : 0}%</td></>}
                        <td>{canBlock
                          ? <button className={`sm ${p.available ? '' : 'danger'}`} onClick={() => toggleAvailable(p)}>{p.available ? 'Disponible' : 'Bloqueado'}</button>
                          : <span className={`pill ${p.available ? 'ok' : 'bad'}`}>{p.available ? 'Disponible' : 'Agotado'}</span>}</td>
                        <td><Conteo p={p} editable={canCount} /></td>
                        <td>{admin && <button className="sm" onClick={() => setEditP(p)}>Editar</button>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })}
      </>}

      {tab === 'subrecetas' && <>
        <p className="muted">Preparaciones base que se usan dentro de otras recetas (shot de espresso, jarabes, salsas…). Rinden 1 porción.</p>
        {admin && <button style={{ justifySelf: 'start' }} onClick={() => setEditS({ id: uid(), name: '', ingredients: [] })}>+ Nueva subreceta</button>}
        <div className="grid">
          {s.subRecipes.map((r) => (
            <div key={r.id} className="card stack">
              <div className="row spread"><b>{r.name}</b><span>{money(recipeCost(r.ingredients, s))}</span></div>
              <RecipeList items={r.ingredients} />
              {admin && <button className="sm" onClick={() => setEditS(r)}>Editar</button>}
            </div>
          ))}
        </div>
      </>}

      {editP && <ProductForm initial={editP} onClose={() => setEditP(undefined)} />}
      {editS && <SubForm initial={editS} onClose={() => setEditS(undefined)} />}
    </div>
  )
}

/** Conteo: cuántas unidades se pueden vender (ej. 20 espressos con el café molido de hoy). Al llegar a 0 no se vende más. */
function Conteo({ p, editable }: { p: Product; editable: boolean }) {
  const [draft, setDraft] = useState('')
  if (p.count == null) return editable
    ? <span className="row" style={{ flexWrap: 'nowrap' }}><input type="number" min={0} placeholder="Sin límite" value={draft} onChange={(e) => setDraft(e.target.value)} style={{ width: 100 }} aria-label={`Conteo de ${p.name}`} />
      <button className="sm" disabled={draft === ''} onClick={() => { setCount(p, +draft); setDraft('') }}>Poner</button></span>
    : <span className="muted">Sin límite</span>
  const left = remaining(p)
  return (
    <span className="row" style={{ flexWrap: 'nowrap' }}>
      <span className={`pill ${left <= 0 ? 'bad' : left <= 3 ? 'warn' : 'gold'}`}>{left <= 0 ? 'Agotado' : `Quedan ${left}`}</span>
      {editable && <>
        <button className="sm" aria-label="Restar uno" onClick={() => setCount(p, (p.count ?? 0) - 1)}>−</button>
        <button className="sm" aria-label="Sumar uno" onClick={() => setCount(p, (p.count ?? 0) + 1)}>+</button>
        <button className="sm ghost" onClick={() => setCount(p, null)}>Quitar</button>
      </>}
    </span>
  )
}

function RecipeList({ items }: { items: Ingredient[] }) {
  const s = useStore()
  return <ul className="muted" style={{ margin: 0, paddingLeft: '1.2rem' }}>{items.map((i, k) => {
    const st = s.stock.find((x) => x.id === i.id)
    return <li key={k}>{i.kind === 'stock' ? `${i.qty} ${st?.unit ?? ''} ${st?.name ?? '¿?'}` : `${i.qty} × ${s.subRecipes.find((x) => x.id === i.id)?.name ?? '¿?'} (subreceta)`}</li>
  })}</ul>
}

/** Editor de receta: cada ingrediente es un insumo del inventario o una subreceta. */
function RecipeEditor({ value, onChange, excludeSub }: { value: Ingredient[]; onChange: (v: Ingredient[]) => void; excludeSub?: string }) {
  const s = useStore()
  const options = [
    ...s.stock.map((i) => ({ key: `stock:${i.id}`, label: `${i.name} (${i.unit})` })),
    ...s.subRecipes.filter((r) => r.id !== excludeSub).map((r) => ({ key: `sub:${r.id}`, label: `↳ ${r.name} (porción)` })),
  ]
  const set = (k: number, patch: Partial<Ingredient>) => onChange(value.map((x, j) => (j === k ? { ...x, ...patch } : x)))
  return (
    <div className="stack">
      {value.map((ing, k) => (
        <div key={k} className="row">
          <select className="grow" value={`${ing.kind}:${ing.id}`} onChange={(e) => { const [kind, id] = e.target.value.split(':'); set(k, { kind: kind as Ingredient['kind'], id }) }}>
            {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <input type="number" min={0} step="any" value={ing.qty} onChange={(e) => set(k, { qty: +e.target.value })} style={{ width: 90 }} aria-label="Cantidad" />
          <button className="sm ghost" aria-label="Quitar" onClick={() => onChange(value.filter((_, j) => j !== k))}><X size={16} /></button>
        </div>
      ))}
      <button className="sm" style={{ justifySelf: 'start' }} onClick={() => onChange([...value, { kind: 'stock', id: s.stock[0]?.id ?? '', qty: 1 }])}>+ Ingrediente</button>
    </div>
  )
}

function ProductForm({ initial, onClose }: { initial: Product; onClose: () => void }) {
  const s = useStore()
  const [p, setP] = useState(initial)
  const exists = s.products.some((x) => x.id === p.id)
  return (
    <Modal title={exists ? 'Editar producto' : 'Nuevo producto'} onClose={onClose}>
      <div className="stack">
        <label className="stack">Nombre<input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></label>
        <div className="row">
          <label className="stack grow">Categoría<select value={p.category} onChange={(e) => setP({ ...p, category: e.target.value })}>{s.settings.categories.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="stack grow">Imprime en<select value={p.station} onChange={(e) => setP({ ...p, station: e.target.value as Product['station'] })}><option value="barra">Barra</option><option value="cocina">Cocina</option></select></label>
        </div>
        <label className="stack">Precio de venta (impuesto incluido)<input type="number" min={0} value={p.price} onChange={(e) => setP({ ...p, price: Math.round(+e.target.value) })} /></label>
        <h3>Receta · costo {money(recipeCost(p.recipe, s))}</h3>
        <RecipeEditor value={p.recipe} onChange={(recipe) => setP({ ...p, recipe })} />
        <div className="row">
          <button className="primary grow" disabled={!p.name.trim()} onClick={() => { upsert('products', p); onClose() }}>Guardar</button>
          {exists && <button className="danger" onClick={() => { if (confirm(`¿Eliminar ${p.name}?`)) { remove('products', p.id); onClose() } }}>Eliminar</button>}
        </div>
      </div>
    </Modal>
  )
}

function SubForm({ initial, onClose }: { initial: SubRecipe; onClose: () => void }) {
  const s = useStore()
  const [r, setR] = useState(initial)
  const exists = s.subRecipes.some((x) => x.id === r.id)
  const used = [...s.products.map((p) => p.recipe), ...s.subRecipes.map((x) => x.ingredients)].some((ings) => ings.some((i) => i.kind === 'sub' && i.id === r.id))
  return (
    <Modal title={exists ? 'Editar subreceta' : 'Nueva subreceta'} onClose={onClose}>
      <div className="stack">
        <label className="stack">Nombre<input value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} /></label>
        <h3>Ingredientes por porción · costo {money(recipeCost(r.ingredients, s))}</h3>
        <RecipeEditor value={r.ingredients} onChange={(ingredients) => setR({ ...r, ingredients })} excludeSub={r.id} />
        <div className="row">
          <button className="primary grow" disabled={!r.name.trim()} onClick={() => { upsert('subRecipes', r); onClose() }}>Guardar</button>
          {exists && <button className="danger" disabled={used} title={used ? 'Está en uso en otras recetas' : ''} onClick={() => { remove('subRecipes', r.id); onClose() }}>Eliminar</button>}
        </div>
      </div>
    </Modal>
  )
}
