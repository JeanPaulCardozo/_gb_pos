import { useState } from 'react'
import { accountTotals, money } from '../logic.ts'
import { can, useStore, useUi } from '../store.ts'
import type { Go } from '../App.tsx'
import { hhmm, minutes } from './Cuenta.tsx'

export default function Cuentas({ go }: { go: Go }) {
  const s = useStore()
  const { user } = useUi()
  const [tab, setTab] = useState<'abiertas' | 'cerradas'>('abiertas')
  const [day, setDay] = useState(new Date().toLocaleDateString('en-CA'))
  const name = (id?: string) => s.users.find((u) => u.id === id)?.name ?? '—'
  const sameDay = (iso?: string) => !!iso && new Date(iso).toLocaleDateString('en-CA') === day

  const open = s.accounts.filter((a) => a.status === 'open' && a.lines.length)
  const closed = s.accounts.filter((a) => a.status !== 'open' && sameDay(a.closedAt)).sort((x, y) => (y.closedAt ?? '').localeCompare(x.closedAt ?? ''))
  const list = tab === 'abiertas' ? open : closed
  const total = list.reduce((x, a) => x + (a.status === 'void' ? 0 : accountTotals(a, s.convenios, s.settings.taxRate).total), 0)

  return (
    <div className="stack">
      <div className="row spread">
        <div><h1>Cuentas</h1><p className="muted" style={{ margin: 0 }}>Seguimiento de cada cuenta: cuándo se abrió, cuándo se envió y cuándo se cerró.</p></div>
        <div className="row">
          <button className={tab === 'abiertas' ? 'primary' : ''} onClick={() => setTab('abiertas')}>Abiertas ({open.length})</button>
          <button className={tab === 'cerradas' ? 'primary' : ''} onClick={() => setTab('cerradas')}>Cerradas</button>
          {tab === 'cerradas' && <input type="date" value={day} onChange={(e) => setDay(e.target.value)} aria-label="Día" />}
        </div>
      </div>

      <div className="grid" style={{ '--min': '170px' } as React.CSSProperties}>
        <div className="card"><div className="muted">{tab === 'abiertas' ? 'Por cobrar' : 'Cobrado'}</div><div className="kpi">{money(total)}</div></div>
        <div className="card"><div className="muted">Cuentas</div><div className="kpi">{list.length}</div></div>
        {tab === 'cerradas' && <div className="card"><div className="muted">Tiempo promedio en mesa</div><div className="kpi">{closed.length ? Math.round(closed.reduce((x, a) => x + minutes(a.openedAt, a.closedAt), 0) / closed.length) : 0} min</div></div>}
      </div>

      <div className="card scroll">
        <table>
          <thead><tr><th>Mesa</th><th>Cuenta</th><th>Estado</th><th>Abierta</th><th>Último envío</th><th>Cerrada</th><th className="num">Duración</th><th className="num">Total</th><th /></tr></thead>
          <tbody>
            {list.map((a) => {
              const t = accountTotals(a, s.convenios, s.settings.taxRate)
              const lastSent = a.lines.map((l) => l.sentAt).filter(Boolean).sort().at(-1)
              return (
                <tr key={a.id}>
                  <td><b>{s.tables.find((x) => x.id === a.tableId)?.name}</b></td>
                  <td>{a.label}</td>
                  <td>
                    {a.status === 'open' && (t.pending ? <span className="pill warn">{t.pending} sin enviar</span> : <span className="pill gold">abierta</span>)}
                    {a.status === 'paid' && <span className="pill ok">pagada</span>}
                    {a.status === 'void' && <span className="pill bad">anulada</span>}
                  </td>
                  <td>{hhmm(a.openedAt)} <span className="muted">· {name(a.openedBy)}</span></td>
                  <td>{hhmm(lastSent)}</td>
                  <td>{a.closedAt ? <>{hhmm(a.closedAt)} <span className="muted">· {name(a.closedBy)}</span></> : '—'}</td>
                  <td className="num">{minutes(a.openedAt, a.closedAt)} min</td>
                  <td className="num">{money(t.total)}</td>
                  <td>
                    <button className={`sm ${a.status === 'open' && !t.pending && can(user?.role, 'cobrar') ? 'primary' : ''}`} onClick={() => go('cuenta', a.id)}>
                      {a.status === 'open' ? (can(user?.role, 'cobrar') ? 'Cobrar' : 'Abrir') : 'Ver'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!list.length && <p className="muted">{tab === 'abiertas' ? 'No hay cuentas abiertas. Se abren tocando una mesa en el Salón.' : 'No hay cuentas cerradas ese día.'}</p>}
      </div>
    </div>
  )
}
