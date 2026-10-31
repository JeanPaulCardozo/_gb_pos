import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Delete, Moon, Sun, X } from 'lucide-react'
import { catIcon } from './config.ts'
import { can, clearPrint, findByPin, getState, useUi, type Ticket } from './store.ts'
import type { User } from './types.ts'
import { money } from './logic.ts'

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="row spread"><h2>{title}</h2><button className="ghost sm" onClick={onClose} aria-label="Cerrar"><X size={18} /></button></div>
        {children}
      </div>
    </div>
  )
}

/** Teclado numérico táctil para PIN o montos. */
export function Keypad({ value, onChange, max = 4, onDone }: { value: string; onChange: (v: string) => void; max?: number; onDone?: (v: string) => void }) {
  const press = (k: string) => {
    if (k === '⌫') return onChange(value.slice(0, -1))
    if (k === 'OK') return onDone?.(value)
    if (value.length >= max) return
    const v = value + k
    onChange(v)
    if (v.length === max) onDone?.(v)
  }
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      // lo que se escribe en un campo (ej. el motivo de una anulación) no es parte del PIN
      if (e.target instanceof HTMLElement && e.target.matches('input, textarea, select')) return
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') press('⌫')
      else if (e.key === 'Enter') press('OK')
    }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  })
  return (
    <div className="stack">
      <div className="dots" aria-label={`${value.length} dígitos`}>{Array.from({ length: max }, (_, i) => <span key={i} className={i < value.length ? 'on' : ''} />)}</div>
      <div className="keypad">
        {/* sin botón OK: el PIN entra solo al marcar el último dígito (Enter sigue funcionando con teclado) */}
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => <button key={k} onClick={() => press(k)}>{k}</button>)}
        <span />
        <button onClick={() => press('0')}>0</button>
        <button className="erase" onClick={() => press('⌫')} aria-label="Borrar" disabled={!value}><Delete size={28} strokeWidth={1.75} aria-hidden /></button>
      </div>
    </div>
  )
}

/** Pide PIN de alguien con permiso de anulación y un motivo. Si el usuario actual ya puede, solo pide motivo. */
export function AuthPrompt({ title, onClose, onOk }: { title: string; onClose: () => void; onOk: (authorizer: User, reason: string) => void }) {
  const { user } = useUi()
  const [reason, setReason] = useState('')
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const self = can(user?.role, 'anular')
  const submit = (p = pin) => {
    if (!reason.trim()) return setErr('Escribe el motivo')
    const auth = self ? user : findByPin(p)
    if (!auth || !can(auth.role, 'anular')) { setPin(''); return setErr('PIN sin permiso de anulación') }
    onOk(auth, reason.trim()); onClose()
  }
  return (
    <Modal title={title} onClose={onClose}>
      <div className="stack">
        <label className="stack">Motivo<input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. error de digitación" /></label>
        {self ? <button className="danger" onClick={() => submit()}>Anular</button> : <>
          <p className="muted">Requiere autorización de un administrador.</p>
          <Keypad value={pin} onChange={setPin} onDone={submit} />
        </>}
        {err && <p className="neon">{err}</p>}
      </div>
    </Modal>
  )
}

export function TicketView({ t }: { t: Ticket }) {
  return (
    <div className="ticket">
      <h4>{t.title}</h4>
      {t.subtitle && <div className="c">{t.subtitle}</div>}
      <hr />
      {t.lines.map((l, i) => (
        <div key={i}>
          <div className="r" style={{ fontWeight: l.bold ? 700 : 400 }}><span>{l.left}</span>{l.right && <span>{l.right}</span>}</div>
          {l.note && <div>  » {l.note}</div>}
        </div>
      ))}
      {t.footer && <><hr />{t.footer.map((f, i) => <div key={i} className="c">{f}</div>)}</>}
    </div>
  )
}

/** Cola de impresión. shortcut: usa window.print() del navegador; la impresión directa ESC/POS va por el backend (ver docs/INTEGRACIONES.md). */
export function PrintHost() {
  const { print } = useUi()
  useEffect(() => {
    // window.print() bloquea hasta cerrar el diálogo; después no hace falta dejar la vista previa abierta
    if (print.length && getState().settings.autoPrint) setTimeout(() => { window.print(); clearPrint() }, 50)
  }, [print])
  if (!print.length) return null
  return <>
    {createPortal(print.map((t, i) => <div key={i} style={{ breakAfter: 'page' }}><TicketView t={t} /></div>), document.getElementById('print-root')!)}
    <Modal title={print.length > 1 ? `Impresión (${print.length} tickets)` : 'Impresión'} onClose={clearPrint}>
      <div className="stack">
        {print.map((t, i) => <TicketView key={i} t={t} />)}
        <div className="row"><button className="primary grow" onClick={() => window.print()}>Imprimir</button><button onClick={clearPrint}>Cerrar</button></div>
      </div>
    </Modal>
  </>
}

export function Toast() {
  const { toast } = useUi()
  return toast ? <div className={`toast ${toast.kind}`} role="status">{toast.msg}</div> : null
}

/** Barras horizontales de una sola serie, con valor siempre visible. */
export function Bars({ data, format = money }: { data: [string, number][]; format?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d[1]))
  if (!data.length) return <p className="muted">Sin datos en el rango.</p>
  return (
    <div className="bars">
      {data.map(([k, v]) => (
        <div className="bar" key={k} title={`${k}: ${format(v)}`}>
          <span>{k}</span>
          <div className="track"><div className="fill" style={{ width: `${(v / max) * 100}%` }} /></div>
          <span className="val">{format(v)}</span>
        </div>
      ))}
    </div>
  )
}

export function CatIcon({ c, size = 18 }: { c: string; size?: number }) {
  const I = catIcon(c)
  return <I size={size} aria-hidden />
}

const THEME_KEY = 'mc-theme'
const isDark = () => {
  const t = document.documentElement.dataset.theme
  return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
}

/** Día / noche. La elección queda en este navegador; sin elección se sigue el tema del sistema (ver index.html). */
export function ThemeToggle({ className = 'ghost' }: { className?: string }) {
  const [dark, setDark] = useState(isDark)
  const toggle = () => {
    const next = dark ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try { localStorage.setItem(THEME_KEY, next) } catch { /* sin almacenamiento: dura hasta recargar */ }
    setDark(!dark)
  }
  const label = dark ? 'Cambiar a modo día' : 'Cambiar a modo noche'
  return <button className={`theme ${className}`} onClick={toggle} aria-label={label} title={label}>{dark ? <Sun size={20} aria-hidden /> : <Moon size={20} aria-hidden />}</button>
}

export const Money =({ v }: { v: number }) => <>{money(v)}</>
