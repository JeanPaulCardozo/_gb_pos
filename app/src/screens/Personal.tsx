import { useState } from 'react'
import { ROLE_LABEL } from '../config.ts'
import { uid } from '../logic.ts'
import { toast, upsert, useStore } from '../store.ts'
import type { Role, User } from '../types.ts'
import { Modal } from '../ui.tsx'

const hours = (a: { in: string; out?: string }) => ((a.out ? +new Date(a.out) : Date.now()) - +new Date(a.in)) / 36e5

export default function Personal() {
  const s = useStore()
  const [edit, setEdit] = useState<User>()
  const since = Date.now() - 7 * 864e5
  const onShift = s.attendance.filter((a) => !a.out)

  return (
    <div className="stack">
      <h1>Personal</h1>
      <div className="card">
        <h3>En turno ahora</h3>
        {onShift.length ? <div className="row">{onShift.map((a) => <span key={a.id} className="pill ok">{s.users.find((u) => u.id === a.userId)?.name} · desde {new Date(a.in).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>)}</div>
          : <p className="muted">Nadie ha marcado entrada. Se marca en la pantalla de ingreso → "Marcar turno".</p>}
      </div>

      <div className="card scroll">
        <div className="row spread"><h3>Equipo</h3><button className="sm" onClick={() => setEdit({ id: uid(), name: '', role: 'mesero', pin: '', active: true })}>+ Nuevo</button></div>
        <table>
          <thead><tr><th>Nombre</th><th>Rol</th><th className="num">Horas (7 días)</th><th>Estado</th><th /></tr></thead>
          <tbody>{s.users.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td><td>{ROLE_LABEL[u.role]}</td>
              <td className="num">{s.attendance.filter((a) => a.userId === u.id && +new Date(a.in) > since).reduce((x, a) => x + hours(a), 0).toFixed(1)}</td>
              <td><span className={`pill ${u.active ? 'ok' : ''}`}>{u.active ? 'Activo' : 'Inactivo'}</span></td>
              <td><button className="sm" onClick={() => setEdit(u)}>Editar</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <div className="card scroll">
        <h3>Registro de ingresos</h3>
        <table>
          <thead><tr><th>Empleado</th><th>Entrada</th><th>Salida</th><th className="num">Horas</th></tr></thead>
          <tbody>{[...s.attendance].reverse().slice(0, 100).map((a) => (
            <tr key={a.id}><td>{s.users.find((u) => u.id === a.userId)?.name}</td><td>{new Date(a.in).toLocaleString('es-CO')}</td><td>{a.out ? new Date(a.out).toLocaleString('es-CO') : <span className="pill ok">en turno</span>}</td><td className="num">{hours(a).toFixed(2)}</td></tr>
          ))}</tbody>
        </table>
        {!s.attendance.length && <p className="muted">Sin registros todavía.</p>}
      </div>
      {edit && <UserForm initial={edit} onClose={() => setEdit(undefined)} />}
    </div>
  )
}

function UserForm({ initial, onClose }: { initial: User; onClose: () => void }) {
  const { users } = useStore()
  const [u, setU] = useState(initial)
  const save = () => {
    if (!/^\d{4}$/.test(u.pin)) return toast('El PIN debe tener 4 dígitos', 'error')
    if (users.some((x) => x.pin === u.pin && x.id !== u.id)) return toast('Ese PIN ya lo usa otra persona', 'error')
    if (u.role !== 'admin' && users.filter((x) => x.role === 'admin' && x.active && x.id !== u.id).length === 0) return toast('Debe quedar al menos un admin activo', 'error')
    upsert('users', u); onClose()
  }
  return (
    <Modal title={u.name || 'Nuevo empleado'} onClose={onClose}>
      <div className="stack">
        <label className="stack">Nombre<input value={u.name} onChange={(e) => setU({ ...u, name: e.target.value })} /></label>
        <label className="stack">Rol<select value={u.role} onChange={(e) => setU({ ...u, role: e.target.value as Role })}>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="stack">PIN de 4 dígitos<input inputMode="numeric" maxLength={4} value={u.pin} onChange={(e) => setU({ ...u, pin: e.target.value.replace(/\D/g, '') })} /></label>
        <label className="row"><input type="checkbox" checked={u.active} onChange={(e) => setU({ ...u, active: e.target.checked })} /> Activo</label>
        <button className="primary" disabled={!u.name.trim()} onClick={save}>Guardar</button>
      </div>
    </Modal>
  )
}
