import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { cashSummary, money } from '../logic.ts'
import { closeCashSession, openCash, openCashSession, print, useStore, useUi } from '../store.ts'
import { Modal } from '../ui.tsx'

export default function Caja() {
  const s = useStore()
  const { user } = useUi()
  const cash = openCash()
  const [base, setBase] = useState('')
  const [counted, setCounted] = useState('')
  const [note, setNote] = useState('')
  const [confirming, setConfirming] = useState(false)
  const name = (id?: string) => s.users.find((u) => u.id === id)?.name ?? '–'

  const history = [...s.cashSessions].filter((c) => c.closedAt).reverse().slice(0, 15)

  if (!cash) return (
    <div className="stack" style={{ maxWidth: 800 }}>
      <h1>Abrir caja</h1>
      <div className="card stack">
        <label className="stack">Base de apertura (COP)<input type="number" min={0} autoFocus value={base} onChange={(e) => setBase(e.target.value)} placeholder="200000" /></label>
        <button className="primary" disabled={base === '' || +base < 0} onClick={() => openCashSession(Math.round(+base))}>Abrir caja con {money(+base || 0)}</button>
      </div>
      <History />
    </div>
  )

  const sum = cashSummary(cash.id, cash.base, s.invoices)
  const c = counted === '' ? undefined : Math.round(+counted)
  const diff = c === undefined ? 0 : c - sum.expectedCash
  const baseMissing = c !== undefined && c < cash.base
  const openAccounts = s.accounts.filter((a) => a.status === 'open' && a.lines.length)

  const close = () => {
    closeCashSession(c!, note)
    print({
      title: 'CIERRE DE CAJA',
      subtitle: `${s.settings.businessName}\n${new Date().toLocaleString('es-CO')}`,
      lines: [
        { left: 'Apertura', right: new Date(cash.openedAt).toLocaleTimeString('es-CO') },
        { left: 'Base', right: money(cash.base), bold: true },
        { left: `Ventas (${sum.count} facturas)`, right: money(sum.sales) },
        ...Object.entries(sum.byMethod).map(([m, v]) => ({ left: `  ${m}`, right: money(v) })),
        { left: 'Efectivo esperado', right: money(sum.expectedCash) },
        { left: 'Efectivo contado', right: money(c!), bold: true },
        { left: diff === 0 ? 'Cuadre exacto' : diff < 0 ? 'FALTANTE' : 'SOBRANTE', right: money(Math.abs(diff)), bold: true },
        ...(baseMissing ? [{ left: '*** BASE INCOMPLETA ***', bold: true }] : []),
      ],
      footer: [`Abrió: ${name(cash.openedBy)}`, `Cerró: ${user?.name ?? ''}`, ...(note ? [`Nota: ${note}`] : [])],
    })
    setConfirming(false); setCounted(''); setNote('')
  }

  return (
    <div className="stack" style={{ maxWidth: 900 }}>
      <h1>Caja</h1>
      <div className="grid" style={{ '--min': '180px' } as React.CSSProperties}>
        <div className="card"><div className="muted">Base</div><div className="kpi">{money(cash.base)}</div></div>
        <div className="card"><div className="muted">Ventas del turno</div><div className="kpi">{money(sum.sales)}</div><div className="muted">{sum.count} facturas</div></div>
        <div className="card"><div className="muted">Efectivo esperado</div><div className="kpi">{money(sum.expectedCash)}</div><div className="muted">base + ventas en efectivo</div></div>
      </div>
      <div className="card">
        <h3>Por método de pago</h3>
        <table><tbody>{Object.entries(sum.byMethod).map(([m, v]) => <tr key={m}><td>{m}</td><td className="num">{money(v)}</td></tr>)}</tbody></table>
        {!Object.keys(sum.byMethod).length && <p className="muted">Aún no hay ventas en este turno.</p>}
      </div>
      <div className="card muted"><h3>Cierre de datáfonos</h3>Pendiente. Por ahora se cuadra el total de tarjetas contra el voucher de cierre del datáfono.</div>

      <div className="card stack">
        <h2>Cerrar caja</h2>
        <p className="muted">Abierta por {name(cash.openedBy)} a las {new Date(cash.openedAt).toLocaleTimeString('es-CO')}. Recuerda: la base de {money(cash.base)} debe quedar en la caja.</p>
        {openAccounts.length > 0 && <div className="alert"><strong>Hay {openAccounts.length} cuenta(s) abiertas.</strong> Cóbralas o anúlalas antes de cerrar.</div>}
        <label className="stack">Efectivo contado en caja (incluye la base)<input type="number" min={0} value={counted} onChange={(e) => setCounted(e.target.value)} /></label>
        {baseMissing && <div className="alert danger" role="alert"><strong><TriangleAlert size={20} style={{ verticalAlign: '-3px' }} /> ¡LA BASE NO ESTÁ COMPLETA!</strong><br />Contaste {money(c!)} y la base es {money(cash.base)}. Algo está mal: revisa antes de cerrar.</div>}
        {c !== undefined && !baseMissing && diff !== 0 && <div className="alert"><strong>{diff < 0 ? 'Faltante' : 'Sobrante'} de {money(Math.abs(diff))}</strong> frente al efectivo esperado.</div>}
        {c !== undefined && diff === 0 && <span className="pill ok">Cuadre exacto</span>}
        <input placeholder="Nota del cierre (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="primary" disabled={c === undefined || openAccounts.length > 0} onClick={() => setConfirming(true)}>Cerrar caja e imprimir</button>
      </div>
      {confirming && (
        <Modal title="Confirmar cierre" onClose={() => setConfirming(false)}>
          <div className="stack">
            {(baseMissing || diff !== 0) && <div className="alert"><strong>El cierre tiene diferencias.</strong> Quedará registrado en los reportes.</div>}
            <button className="primary" onClick={close}>Sí, cerrar caja</button>
          </div>
        </Modal>
      )}
      <History />
    </div>
  )

  function History() {
    return (
      <div className="card scroll">
        <h3>Cierres anteriores</h3>
        <table>
          <thead><tr><th>Fecha</th><th className="num">Base</th><th className="num">Ventas</th><th className="num">Esperado</th><th className="num">Contado</th><th className="num">Diferencia</th></tr></thead>
          <tbody>
            {history.map((h) => {
              const x = cashSummary(h.id, h.base, s.invoices)
              const d = (h.countedCash ?? 0) - x.expectedCash
              return <tr key={h.id}><td>{new Date(h.openedAt).toLocaleDateString('es-CO')}</td><td className="num">{money(h.base)}</td><td className="num">{money(x.sales)}</td><td className="num">{money(x.expectedCash)}</td><td className="num">{money(h.countedCash ?? 0)}</td><td className={`num ${d < 0 ? 'neon' : ''}`}>{money(d)}</td></tr>
            })}
          </tbody>
        </table>
      </div>
    )
  }
}
