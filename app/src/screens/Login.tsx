import { useState } from 'react'
import { APP_NAME, ROLE_LABEL } from '../config.ts'
import { clock, login, toast, useStore } from '../store.ts'
import { Keypad } from '../ui.tsx'

// La puerta del speakeasy: se entra con contraseña (PIN). shortcut: sin QR todavía, el backend puede emitir QR rotativos.
export default function Login() {
  const { users } = useStore()
  const [pin, setPin] = useState('')
  const [mode, setMode] = useState<'entrar' | 'turno'>('entrar')

  const done = (p: string) => {
    setPin('')
    if (mode === 'entrar') return login(p) || toast('Contraseña incorrecta', 'error')
    const r = clock(p)
    if (!r) return toast('Contraseña incorrecta', 'error')
    toast(`${r.user.name}: ${r.action} registrada ${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`)
  }

  return (
    <div className="door">
      <div className="stack" style={{ justifyItems: 'center', gap: '1.5rem' }}>
        <div className="sign">{APP_NAME.split(' ').map((w) => <div key={w}>{w.toUpperCase()}</div>)}</div>
        <p className="muted" style={{ margin: 0 }}>{mode === 'entrar' ? '¿Cuál es la contraseña?' : 'Marca tu entrada o salida'}</p>
        <Keypad value={pin} onChange={setPin} onDone={done} />
        <div className="row">
          <button className={mode === 'entrar' ? 'primary' : ''} onClick={() => setMode('entrar')}>Entrar</button>
          <button className={mode === 'turno' ? 'primary' : ''} onClick={() => setMode('turno')}>Marcar turno</button>
        </div>
        <details className="muted" style={{ fontSize: '.8rem' }}>
          <summary>PINs del demo</summary>
          {users.map((u) => <div key={u.id}>{u.pin} · {u.name} ({ROLE_LABEL[u.role]})</div>)}
        </details>
      </div>
    </div>
  )
}
