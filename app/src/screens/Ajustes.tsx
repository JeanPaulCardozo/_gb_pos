import { useState } from 'react'
import { uid } from '../logic.ts'
import { getState, importData, resetDemo, resetPerms, rolesFor, setPerm, toast, updateSettings, upsert, useStore } from '../store.ts'
import { ADMIN_ONLY, DEFAULT_PERMS, PERM_LABEL, ROLE_LABEL, type Perm } from '../config.ts'
import { Lock } from 'lucide-react'
import type { Role } from '../types.ts'
import type { Settings } from '../types.ts'

const ROLES = Object.keys(ROLE_LABEL) as Role[]

/** El admin da y quita permisos por rol. El admin siempre los tiene todos. */
export function Permisos() {
  useStore()
  const perms = Object.keys(DEFAULT_PERMS) as Perm[]
  return (
    <div className="stack" style={{ maxWidth: 1000 }}>
      <div className="row spread">
        <div><h1>Permisos</h1><p className="muted" style={{ margin: 0 }}>Marca lo que cada rol puede hacer. Los cambios aplican de inmediato, incluso a quien ya está dentro.</p></div>
        <button onClick={() => confirm('¿Volver a los permisos por defecto?') && resetPerms()}>Restablecer por defecto</button>
      </div>
      <div className="card scroll">
        <table>
          <thead><tr><th>Permiso</th>{ROLES.map((r) => <th key={r} style={{ textAlign: 'center' }}>{ROLE_LABEL[r]}</th>)}</tr></thead>
          <tbody>{perms.map((p) => {
            const roles = rolesFor(p)
            const locked = ADMIN_ONLY.includes(p)
            return (
              <tr key={p}>
                <td>{PERM_LABEL[p]} {locked && <span className="pill gold"><Lock size={11} /> solo admin</span>}</td>
                {ROLES.map((r) => (
                  <td key={r} style={{ textAlign: 'center' }}>
                    <label className="switch" title={r === 'admin' ? 'El admin siempre tiene todos los permisos' : ''}>
                      <input type="checkbox" checked={r === 'admin' || (!locked && roles.includes(r))} disabled={r === 'admin' || locked} onChange={(e) => setPerm(p, r, e.target.checked)} aria-label={`${PERM_LABEL[p]}: ${ROLE_LABEL[r]}`} />
                      <span />
                    </label>
                  </td>
                ))}
              </tr>
            )
          })}</tbody>
        </table>
      </div>
    </div>
  )
}

export function Convenios() {
  const { convenios } = useStore()
  return (
    <div className="stack" style={{ maxWidth: 700 }}>
      <h1>Convenios <span className="pill gold">prueba</span></h1>
      <p className="muted">Descuentos por acuerdo (empresas vecinas, empleados, aliados). Se eligen al cobrar una cuenta.</p>
      {convenios.map((c) => (
        <div key={c.id} className="card row">
          <input className="grow" value={c.name} onChange={(e) => upsert('convenios', { ...c, name: e.target.value })} aria-label="Nombre" />
          <label className="row"><input type="number" min={0} max={100} value={c.discountPct} onChange={(e) => upsert('convenios', { ...c, discountPct: Math.min(100, Math.max(0, +e.target.value)) })} style={{ width: 80 }} />%</label>
          <label className="row"><input type="checkbox" checked={c.active} onChange={(e) => upsert('convenios', { ...c, active: e.target.checked })} />Activo</label>
        </div>
      ))}
      <button style={{ justifySelf: 'start' }} onClick={() => upsert('convenios', { id: uid(), name: 'Nuevo convenio', discountPct: 10, active: true })}>+ Convenio</button>
    </div>
  )
}

export function Ajustes() {
  const { settings } = useStore()
  const [lists, setLists] = useState({ categories: settings.categories.join('\n'), paymentMethods: settings.paymentMethods.join('\n') })
  const field = (k: keyof Settings, label: string, type = 'text') => (
    <label className="stack">{label}<input type={type} value={String(settings[k])} onChange={(e) => updateSettings({ [k]: type === 'number' ? +e.target.value : e.target.value })} /></label>
  )
  const saveList = (k: 'categories' | 'paymentMethods') => {
    const v = lists[k].split('\n').map((x) => x.trim()).filter(Boolean)
    if (!v.length) return toast('La lista no puede quedar vacía', 'error')
    if (k === 'paymentMethods' && !v.includes('Efectivo')) return toast('"Efectivo" es necesario para el cuadre de caja', 'error')
    updateSettings({ [k]: v }); toast('Guardado')
  }
  const download = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(getState(), null, 2)], { type: 'application/json' }))
    a.download = `respaldo-pos-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }
  const upload = async (f?: File) => {
    if (!f) return
    try { importData(await f.text()); toast('Datos restaurados') } catch { toast('Archivo inválido', 'error') }
  }

  return (
    <div className="stack" style={{ maxWidth: 800 }}>
      <h1>Ajustes</h1>
      <div className="card stack">
        <h3>Empresa y facturación</h3>
        {field('businessName', 'Razón social')}
        <div className="row">{field('nit', 'NIT')}{field('address', 'Dirección')}</div>
        <div className="row">{field('taxName', 'Impuesto')}{field('taxRate', 'Tarifa % (incluida en precios)', 'number')}</div>
        <div className="row">{field('invoicePrefix', 'Prefijo de numeración')}{field('nextInvoice', 'Siguiente consecutivo', 'number')}</div>
        <span className="muted" style={{ fontSize: '.8rem' }}>Confirma con el contador si el negocio cobra INC 8% o IVA. El prefijo y el rango salen de la resolución DIAN.</span>
      </div>
      <div className="grid" style={{ '--min': '280px' } as React.CSSProperties}>
        <div className="card stack">
          <h3>Categorías del menú</h3>
          <textarea rows={7} value={lists.categories} onChange={(e) => setLists({ ...lists, categories: e.target.value })} aria-label="Una categoría por línea" />
          <button onClick={() => saveList('categories')}>Guardar categorías</button>
        </div>
        <div className="card stack">
          <h3>Métodos de pago</h3>
          <textarea rows={7} value={lists.paymentMethods} onChange={(e) => setLists({ ...lists, paymentMethods: e.target.value })} aria-label="Un método por línea" />
          <button onClick={() => saveList('paymentMethods')}>Guardar métodos</button>
        </div>
      </div>
      <div className="card stack">
        <h3>Impresión</h3>
        <label className="row"><input type="checkbox" checked={settings.autoPrint} onChange={(e) => updateSettings({ autoPrint: e.target.checked })} /> Abrir el diálogo de impresión automáticamente (comandas, facturas y cierres)</label>
      </div>
      <div className="card stack">
        <h3>Datos del demo</h3>
        <div className="row">
          <button onClick={download}>Descargar respaldo (JSON)</button>
          <label className="row"><span>Restaurar respaldo</span><input type="file" accept=".json" onChange={(e) => upload(e.target.files?.[0])} /></label>
          <button className="danger" onClick={() => confirm('Se borran todos los datos y se cargan los de prueba. ¿Seguir?') && resetDemo()}>Restablecer demo</button>
        </div>
      </div>
    </div>
  )
}
