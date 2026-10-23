import { useState } from 'react'
import { money } from '../logic.ts'
import { can, invoiceTicket, print, toast, useStore, useUi, voidInvoice } from '../store.ts'
import { AuthPrompt } from '../ui.tsx'

export default function Facturacion() {
  const s = useStore()
  const { user } = useUi()
  const [kind, setKind] = useState<'' | 'POS' | 'FE'>('')
  const [q, setQ] = useState('')
  const [voiding, setVoiding] = useState<string>()
  const list = [...s.invoices].reverse().filter((i) => (!kind || i.kind === kind) && (!q || `${i.number} ${i.customer?.name ?? ''} ${i.customer?.doc ?? ''}`.toLowerCase().includes(q.toLowerCase()))).slice(0, 200)

  return (
    <div className="stack">
      <h1>Facturación</h1>
      <div className="card muted">
        Cada venta genera su documento electrónico: <b>tiquete POS</b> para consumidor final o <b>factura electrónica</b> cuando el cliente da NIT/cédula y correo.
        En el demo el envío a la DIAN y el correo son simulados; quedan guardados aquí como constancia. Resolución, prefijo y NIT en Ajustes.
      </div>
      <div className="row">
        <input className="grow" placeholder="Buscar número, cliente o documento…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}><option value="">Todos</option><option value="POS">Tiquete POS</option><option value="FE">Factura electrónica</option></select>
      </div>
      <div className="card scroll">
        <table>
          <thead><tr><th>Número</th><th>Fecha</th><th>Tipo</th><th>Cliente</th><th>Mesa</th><th className="num">Total</th><th /></tr></thead>
          <tbody>
            {list.map((i) => (
              <tr key={i.id} style={{ opacity: i.voided ? 0.5 : 1 }}>
                <td>{i.number} {i.voided && <span className="pill bad">anulada</span>}</td>
                <td>{new Date(i.at).toLocaleString('es-CO')}</td>
                <td><span className={`pill ${i.kind === 'FE' ? 'gold' : ''}`}>{i.kind === 'FE' ? 'Electrónica' : 'POS'}</span></td>
                <td>{i.customer ? <>{i.customer.name}<br /><span className="muted">{i.customer.docType} {i.customer.doc} · {i.customer.email}</span></> : <span className="muted">Consumidor final</span>}</td>
                <td>{i.tableName}</td>
                <td className="num">{money(i.total)}</td>
                <td className="row">
                  <button className="sm" onClick={() => print(invoiceTicket(i))}>Ver / imprimir</button>
                  {i.customer && <button className="sm" onClick={() => toast(`Reenviada a ${i.customer!.email} (simulado)`)}>Reenviar</button>}
                  {!i.voided && can(user?.role, 'anular') && <button className="sm danger" onClick={() => setVoiding(i.id)}>Anular</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {voiding && <AuthPrompt title="Anular factura (nota crédito)" onClose={() => setVoiding(undefined)} onOk={(auth, reason) => { voidInvoice(voiding, reason, auth); toast('Factura anulada') }} />}
    </div>
  )
}

