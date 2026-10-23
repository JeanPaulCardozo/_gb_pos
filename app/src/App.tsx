import { useState } from 'react'
import { APP_NAME, ROLE_LABEL, type Perm } from './config.ts'
import { can, logout, openCash, useStore, useUi } from './store.ts'
import { Armchair, ChartLine, ChefHat, FileDown, FileText, Handshake, KeyRound, LogOut, Package, ReceiptText, Settings, Users, Wallet, type LucideIcon } from 'lucide-react'
import { PrintHost, Toast } from './ui.tsx'
import type { User } from './types.ts'
import Login from './screens/Login.tsx'
import Mesas from './screens/Mesas.tsx'
import Cuenta from './screens/Cuenta.tsx'
import Cuentas from './screens/Cuentas.tsx'
import Caja from './screens/Caja.tsx'
import Menu from './screens/Menu.tsx'
import Inventario from './screens/Inventario.tsx'
import Compras from './screens/Compras.tsx'
import Facturacion from './screens/Facturacion.tsx'
import Reportes from './screens/Reportes.tsx'
import Personal from './screens/Personal.tsx'
import { Ajustes, Convenios, Permisos } from './screens/Ajustes.tsx'

// Menú lateral: agregar una sección = una línea aquí.
const NAV: { id: string; label: string; icon: LucideIcon; perm: Perm }[] = [
  { id: 'mesas', label: 'Salón', icon: Armchair, perm: 'mesas.ver' },
  { id: 'cuentas', label: 'Cuentas', icon: ReceiptText, perm: 'cuentas' },
  { id: 'caja', label: 'Caja', icon: Wallet, perm: 'caja' },
  { id: 'menu', label: 'Menú y recetas', icon: ChefHat, perm: 'menu.ver' },
  { id: 'inventario', label: 'Inventario', icon: Package, perm: 'inventario.ver' },
  { id: 'compras', label: 'Compras', icon: FileDown, perm: 'compras' },
  { id: 'facturacion', label: 'Facturación', icon: FileText, perm: 'facturacion' },
  { id: 'reportes', label: 'Reportes', icon: ChartLine, perm: 'reportes' },
  { id: 'personal', label: 'Personal', icon: Users, perm: 'personal' },
  { id: 'permisos', label: 'Permisos', icon: KeyRound, perm: 'ajustes' },
  { id: 'convenios', label: 'Convenios', icon: Handshake, perm: 'convenios' },
  { id: 'ajustes', label: 'Ajustes', icon: Settings, perm: 'ajustes' },
]

export type Go = (view: string, accountId?: string) => void

export default function App() {
  const { user } = useUi()
  // key: cada ingreso empieza en el Salón, sin heredar la pantalla del usuario anterior
  return user ? <Shell key={user.id} user={user} /> : <><Login /><Toast /></>
}

function Shell({ user }: { user: User }) {
  const s = useStore()
  const [nav, setNav] = useState<{ view: string; accountId?: string }>({ view: 'mesas' })
  const go: Go = (view, accountId) => setNav({ view, accountId })
  const role = user.role
  const allowed = NAV.filter((n) => (n.id === 'permisos' ? role === 'admin' : can(role, n.perm)))
  const view = nav.view === 'cuenta' || allowed.some((n) => n.id === nav.view) ? nav.view : 'mesas'
  const cash = openCash()
  const openCount = s.accounts.filter((a) => a.status === 'open' && a.lines.length).length

  return (
    <div className="app">
      <nav className="side" aria-label="Secciones">
        <div className="brand neon">{APP_NAME}</div>
        {allowed.map((n) => (
          <button key={n.id} className={view === n.id || (n.id === 'mesas' && view === 'cuenta') ? 'active' : ''} onClick={() => go(n.id)}>
            <n.icon className="nav-ico" size={20} aria-hidden /><span className="nav-label">{n.label}</span>
            {n.id === 'cuentas' && openCount > 0 && <span className="badge">{openCount}</span>}
          </button>
        ))}
        <div className="who">
          <span className="avatar" aria-hidden>{user.name[0]}</span>
          <span className="who-text"><b>{user.name}</b><small>{ROLE_LABEL[role]}</small></span>
          <span className={`dot ${cash ? 'ok' : ''}`} title={cash ? 'Caja abierta' : 'Caja cerrada'} />
          <button className="sm ghost" onClick={logout} aria-label="Salir" title="Salir"><LogOut size={18} /></button>
        </div>
      </nav>
      <main key={view + (nav.accountId ?? '')} className="page">
        {view === 'mesas' && <Mesas go={go} />}
        {view === 'cuenta' && nav.accountId && <Cuenta accountId={nav.accountId} go={go} />}
        {view === 'cuentas' && <Cuentas go={go} />}
        {view === 'caja' && <Caja />}
        {view === 'menu' && <Menu />}
        {view === 'inventario' && <Inventario />}
        {view === 'compras' && <Compras />}
        {view === 'facturacion' && <Facturacion />}
        {view === 'reportes' && <Reportes />}
        {view === 'personal' && <Personal />}
        {view === 'permisos' && <Permisos />}
        {view === 'convenios' && <Convenios />}
        {view === 'ajustes' && <Ajustes />}
      </main>
      <PrintHost />
      <Toast />
    </div>
  )
}
