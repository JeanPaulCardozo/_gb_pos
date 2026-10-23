import { useEffect, useState } from 'react'
import { CreditCard, Printer, X } from 'lucide-react'
import { accountTotals, money, paid, splitEven } from '../logic.ts'
import { can, addLine, closeEmpty, moveLines, openCash, pay, preBill, remaining, renameAccount, sendOrder, setConvenio, toast, updatePending, useStore, useUi, voidAccount, voidLine } from '../store.ts'
import type { Customer, Payment, Product } from '../types.ts'
import { AuthPrompt, CatIcon, Modal } from '../ui.tsx'
import type { Go } from '../App.tsx'

export const hhmm = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '—')
export const minutes = (from: string, to?: string) => Math.round(((to ? +new Date(to) : Date.now()) - +new Date(from)) / 60000)

export default function Cuenta({ accountId, go }: { accountId: string; go: Go }) {
  const s = useStore()
  const { user } = useUi()
  const a = s.accounts.find((x) => x.id === accountId)
  const [cat, setCat] = useState(s.settings.categories[0])
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState<Product>()
  const [voiding, setVoiding] = useState<string | 'all'>()
  const [splitting, setSplitting] = useState(false)
  const [paying, setPaying] = useState(false)
  // una cuenta que se abrió y se dejó sin nada no debe dejar la mesa ocupada
  useEffect(() => () => closeEmpty(accountId), [accountId])

  if (!a) return <div className="stack"><p>La cuenta ya no existe.</p><button onClick={() => go('mesas')}>← Salón</button></div>
  const table = s.tables.find((t) => t.id === a.tableId)
  const t = accountTotals(a, s.convenios, s.settings.taxRate)
  const products = s.products.filter((p) => (q ? p.name.toLowerCase().includes(q.toLowerCase()) : p.category === cat))
  const isOpen = a.status === 'open'
  const active = a.lines.filter((l) => l.status !== 'void')
  const lastSent = a.lines.map((l) => l.sentAt).filter(Boolean).sort().at(-1)
  const userName = (id?: string) => s.users.find((u) => u.id === id)?.name ?? '—'

  return (
    <div className="stack">
      <div className="row spread">
        <div className="row">
          <button className="ghost" onClick={() => go('mesas')}>← Salón</button>
          <h1 style={{ margin: 0 }}>Mesa {table?.name}</h1>
          <input aria-label="Nombre de la cuenta" value={a.label} onChange={(e) => renameAccount(a.id, e.target.value)} disabled={!isOpen} style={{ width: 160 }} />
          <span className={`pill ${isOpen ? 'gold' : a.status === 'paid' ? 'ok' : 'bad'}`}>{isOpen ? 'Abierta' : a.status === 'paid' ? 'Pagada' : 'Anulada'}</span>
        </div>
      </div>

      <div className="timeline" aria-label="Seguimiento de la cuenta">
        <span><small>Abierta</small>{hhmm(a.openedAt)} · {userName(a.openedBy)}</span>
        <span><small>Último envío</small>{hhmm(lastSent)}</span>
        <span><small>{a.status === 'void' ? 'Anulada' : 'Cerrada'}</small>{a.closedAt ? `${hhmm(a.closedAt)} · ${userName(a.closedBy)}` : '—'}</span>
        <span><small>Duración</small>{minutes(a.openedAt, a.closedAt)} min</span>
      </div>

      <div className="order">
        <section className="stack" aria-label="Productos">
          <input placeholder="Buscar producto…" value={q} onChange={(e) => setQ(e.target.value)} />
          {!q && <div className="cats">{s.settings.categories.map((c) => <button key={c} className={c === cat ? 'active' : ''} onClick={() => setCat(c)}><CatIcon c={c} size={16} /> {c}</button>)}</div>}
          <div className="grid" style={{ '--min': '160px' } as React.CSSProperties}>
            {products.map((p) => {
              const left = remaining(p)
              const off = !p.available || left <= 0
              return (
                <button key={p.id} className={`prod ${off ? 'off' : ''}`} disabled={!isOpen || off} onClick={() => setAdding(p)}>
                  <span className="ico"><CatIcon c={p.category} size={26} /></span><b>{p.name}</b><span className="price">{money(p.price)}</span>
                  {!p.available ? <span className="pill bad">Agotado</span> : p.count != null && <span className={`pill ${left <= 3 ? 'warn' : ''}`}>{left <= 0 ? 'Sin unidades' : `Quedan ${left}`}</span>}
                </button>
              )
            })}
          </div>
        </section>

        <aside className="card stack" aria-label="Cuenta">
          <div>
            {a.lines.length === 0 && <p className="muted">Sin productos. Toca uno para agregarlo.</p>}
            {a.lines.map((l) => (
              <div key={l.id} className={`line ${l.status === 'void' ? 'void' : ''}`}>
                <span>
                  {l.status === 'pending' ? (
                    <span className="qty">
                      <button onClick={() => updatePending(a.id, l.id, { qty: l.qty - 1 })} aria-label="Quitar uno">−</button>
                      {l.qty}
                      <button onClick={() => updatePending(a.id, l.id, { qty: l.qty + 1 })} aria-label="Agregar uno">+</button>
                    </span>
                  ) : <b>{l.qty} ×</b>} {l.name}
                  {l.status === 'pending' ? <span className="pill warn"> sin enviar</span> : l.sentAt && <span className="muted" style={{ fontSize: '.75rem' }}> · enviado {hhmm(l.sentAt)}</span>}
                </span>
                <span className="num">{money(l.price * l.qty)}</span>
                {l.status === 'pending'
                  ? <input placeholder="Comentario (sin azúcar, leche de avena…)" value={l.comment} onChange={(e) => updatePending(a.id, l.id, { comment: e.target.value })} style={{ gridColumn: '1 / -1', fontSize: '.85rem' }} />
                  : l.comment && <span className="muted" style={{ gridColumn: '1 / -1', fontSize: '.85rem' }}>» {l.comment}</span>}
                {l.status === 'sent' && isOpen && <button className="sm danger" style={{ justifySelf: 'start' }} onClick={() => setVoiding(l.id)}>Anular</button>}
              </div>
            ))}
          </div>

          <label className="row">Convenio
            <select className="grow" value={a.convenioId ?? ''} disabled={!isOpen} onChange={(e) => setConvenio(a.id, e.target.value || undefined)}>
              <option value="">Ninguno</option>
              {s.convenios.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name} (−{c.discountPct}%)</option>)}
            </select>
          </label>

          <div className="stack" style={{ gap: '.2rem' }}>
            {t.discount > 0 && <div className="row spread muted"><span>Subtotal</span><span>{money(t.gross)}</span></div>}
            {t.discount > 0 && <div className="row spread muted"><span>Descuento convenio</span><span>−{money(t.discount)}</span></div>}
            <div className="row spread"><b>Total</b><span className="kpi total">{money(t.total)}</span></div>
            <div className="row spread muted" style={{ fontSize: '.8rem' }}><span>{s.settings.taxName} {s.settings.taxRate}% incluido</span><span>{money(t.tax)}</span></div>
          </div>

          {isOpen && <>
            {t.pending > 0 && <button className="primary" onClick={() => sendOrder(a.id)}>Enviar pedido ({t.pending})</button>}
            {can(user?.role, 'cobrar') && active.length > 0 && (
              <button className={t.pending ? '' : 'primary'} disabled={!!t.pending} title={t.pending ? 'Envía los pendientes antes de cobrar' : ''} onClick={() => setPaying(true)}><CreditCard size={18} /> Cobrar y cerrar cuenta</button>
            )}
            <div className="row">
              <button className="grow" disabled={!active.length} onClick={() => preBill(a.id)}><Printer size={18} /> Precuenta</button>
              <button className="grow" disabled={active.length < 2} onClick={() => setSplitting(true)}>Separar cuenta</button>
            </div>
            {active.length === 0
              ? <button className="sm" onClick={() => { closeEmpty(a.id); go('mesas') }}>Cerrar cuenta vacía y liberar mesa</button>
              : <button className="danger sm" onClick={() => setVoiding('all')}>Anular cuenta completa</button>}
          </>}
          {!isOpen && active.length > 0 && <button onClick={() => preBill(a.id)}><Printer size={18} /> Reimprimir detalle</button>}
        </aside>
      </div>

      {adding && <AddModal p={adding} onClose={() => setAdding(undefined)} onAdd={(qty, c) => { addLine(a.id, adding, qty, c); setAdding(undefined) }} />}
      {voiding && <AuthPrompt title={voiding === 'all' ? 'Anular cuenta' : 'Anular producto'} onClose={() => setVoiding(undefined)}
        onOk={(auth, reason) => { if (voiding === 'all') { voidAccount(a.id, reason, auth); go('mesas') } else voidLine(a.id, voiding, reason, auth); toast('Anulación registrada') }} />}
      {splitting && <SplitModal accountId={a.id} onClose={() => setSplitting(false)} onDone={(id) => { setSplitting(false); go('cuenta', id) }} />}
      {paying && <PayModal accountId={a.id} total={t.total} onClose={() => setPaying(false)} onPaid={() => { setPaying(false); toast(`Mesa ${table?.name}: cuenta cerrada`); go('mesas') }} />}
    </div>
  )
}

function AddModal({ p, onClose, onAdd }: { p: Product; onClose: () => void; onAdd: (qty: number, comment: string) => void }) {
  const [qty, setQty] = useState(1)
  const [comment, setComment] = useState('')
  return (
    <Modal title={p.name} onClose={onClose}>
      <div className="stack">
        <div className="row spread">
          <span className="qty"><button onClick={() => setQty(Math.max(1, qty - 1))}>−</button><span className="kpi">{qty}</span><button onClick={() => setQty(qty + 1)}>+</button></span>
          <b>{money(p.price * qty)}</b>
        </div>
        <input autoFocus placeholder="Comentario para cocina/barra (opcional)" value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onAdd(qty, comment)} />
        <button className="primary" onClick={() => onAdd(qty, comment)}>Agregar</button>
      </div>
    </Modal>
  )
}

function SplitModal({ accountId, onClose, onDone }: { accountId: string; onClose: () => void; onDone: (newId: string) => void }) {
  const a = useStore().accounts.find((x) => x.id === accountId)!
  const [ids, setIds] = useState<string[]>([])
  const lines = a.lines.filter((l) => l.status !== 'void')
  return (
    <Modal title="Separar en otra cuenta" onClose={onClose}>
      <div className="stack">
        <p className="muted">Marca lo que va a la cuenta nueva de la misma mesa.</p>
        {lines.map((l) => (
          <label key={l.id} className="row">
            <input type="checkbox" checked={ids.includes(l.id)} onChange={(e) => setIds(e.target.checked ? [...ids, l.id] : ids.filter((x) => x !== l.id))} />
            <span className="grow">{l.qty} × {l.name}</span><span>{money(l.qty * l.price)}</span>
          </label>
        ))}
        <button className="primary" disabled={!ids.length || ids.length === lines.length} onClick={() => onDone(moveLines(accountId, ids))}>Crear cuenta nueva</button>
      </div>
    </Modal>
  )
}

function PayModal({ accountId, total, onClose, onPaid }: { accountId: string; total: number; onClose: () => void; onPaid: () => void }) {
  const { settings } = useStore()
  const methods = settings.paymentMethods
  const [payments, setPayments] = useState<Payment[]>([{ method: methods[0], amount: total }])
  const [received, setReceived] = useState(0)
  const [fe, setFe] = useState(false)
  const [cust, setCust] = useState<Customer>({ docType: 'NIT', doc: '', name: '', email: '' })
  const sum = paid(payments)
  const cashDue = payments.filter((p) => p.method === 'Efectivo').reduce((x, p) => x + p.amount, 0)
  const setP = (i: number, patch: Partial<Payment>) => setPayments(payments.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  const feOk = !fe || (cust.doc.trim() && cust.name.trim() && /\S+@\S+\.\S+/.test(cust.email))

  if (!openCash()) return <Modal title="Cobrar" onClose={onClose}><div className="alert"><strong>La caja está cerrada.</strong> Ábrela en la sección Caja con el valor de la base.</div></Modal>

  const submit = () => { if (pay(accountId, payments, fe ? cust : undefined)) onPaid() }

  return (
    <Modal title={`Cobrar ${money(total)}`} onClose={onClose}>
      <div className="stack">
        <div className="row">
          <span className="grow muted">Dividir el pago en</span>
          {[2, 3, 4].map((n) => <button key={n} className="sm" onClick={() => setPayments(splitEven(total, n).map((amount, i) => ({ method: payments[i]?.method ?? methods[0], amount })))}>{n} partes</button>)}
          <button className="sm" onClick={() => setPayments([...payments, { method: methods[0], amount: Math.max(0, total - sum) }])}>+ Pago</button>
        </div>
        {payments.map((p, i) => (
          <div key={i} className="row">
            <select value={p.method} onChange={(e) => setP(i, { method: e.target.value })}>{methods.map((m) => <option key={m}>{m}</option>)}</select>
            <input className="grow" type="number" min={0} value={p.amount} onChange={(e) => setP(i, { amount: Math.round(+e.target.value) })} aria-label="Monto" />
            {payments.length > 1 && <button className="sm ghost" aria-label="Quitar pago" onClick={() => setPayments(payments.filter((_, j) => j !== i))}><X size={16} /></button>}
          </div>
        ))}
        <div className={`row spread ${sum === total ? '' : 'neon'}`}><span>Pagado</span><b>{money(sum)} {sum !== total && `(faltan ${money(total - sum)})`}</b></div>
        {cashDue > 0 && (
          <div className="row"><span className="grow">Efectivo recibido</span><input type="number" min={0} value={received || ''} onChange={(e) => setReceived(+e.target.value)} style={{ width: 140 }} />
            {received > cashDue && <b>Cambio: {money(received - cashDue)}</b>}</div>
        )}

        <label className="row"><input type="checkbox" checked={fe} onChange={(e) => setFe(e.target.checked)} /> El cliente pide factura electrónica</label>
        {fe && (
          <div className="stack card">
            <div className="row">
              <select value={cust.docType} onChange={(e) => setCust({ ...cust, docType: e.target.value as Customer['docType'] })}>{['NIT', 'CC', 'CE', 'PAS'].map((d) => <option key={d}>{d}</option>)}</select>
              <input className="grow" placeholder="Número (NIT con dígito de verificación)" value={cust.doc} onChange={(e) => setCust({ ...cust, doc: e.target.value })} />
            </div>
            <input placeholder="Nombre o razón social" value={cust.name} onChange={(e) => setCust({ ...cust, name: e.target.value })} />
            <input type="email" placeholder="Correo para enviar la factura" value={cust.email} onChange={(e) => setCust({ ...cust, email: e.target.value })} />
            <span className="muted" style={{ fontSize: '.8rem' }}>Demo: el envío a la DIAN y el correo son simulados. La factura queda guardada en Facturación.</span>
          </div>
        )}
        <button className="primary" disabled={sum !== total || !feOk} onClick={submit}>Confirmar pago</button>
      </div>
    </Modal>
  )
}
