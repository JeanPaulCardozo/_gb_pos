import { CakeSlice, Coffee, CupSoda, Martini, Sandwich, Sparkles, UtensilsCrossed, type LucideIcon } from 'lucide-react'
import type { Role } from './types.ts'

// El nombre de la app va a cambiar: se cambia solo aquí (y el <title> de index.html).
export const APP_NAME = 'Maldita Conducta'

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin / dueño',
  lider: 'Líder',
  barra: 'Barra',
  cajero: 'Cajero',
  mesero: 'Mesero',
}

const ALL: Role[] = ['admin', 'lider', 'barra', 'cajero', 'mesero']

// Permisos por defecto. El admin los cambia en la sección Permisos (se guardan en settings.perms).
export const DEFAULT_PERMS = {
  'mesas.ver': ALL,
  'mesas.editar': ['admin'],
  'pedido.tomar': ALL,
  'cuentas': ALL,
  'cobrar': ['admin', 'cajero', 'mesero'],
  'anular': ['admin'], // sin este permiso se pide autorización con PIN
  'caja': ['admin', 'cajero'],
  'menu.ver': ALL,
  'menu.editar': ['admin'],
  'menu.bloquear': ['admin', 'lider', 'barra'],
  'menu.conteo': ['admin', 'lider', 'barra'],
  'inventario.ver': ['admin', 'lider', 'barra'],
  'inventario.ajustar': ['admin', 'lider'],
  'compras': ['admin'],
  'facturacion': ['admin', 'cajero'],
  'reportes': ['admin'],
  'personal': ['admin'],
  'convenios': ['admin'],
  'ajustes': ['admin'], // fijo: solo el admin, no se puede otorgar (ver ADMIN_ONLY)
} satisfies Record<string, Role[]>

export type Perm = keyof typeof DEFAULT_PERMS

// Permisos que ningún otro rol puede recibir, aunque el admin lo intente.
export const ADMIN_ONLY: Perm[] = ['ajustes']

export const PERM_LABEL: Record<Perm, string> = {
  'mesas.ver': 'Ver el salón',
  'mesas.editar': 'Editar el plano de mesas',
  'pedido.tomar': 'Tomar pedidos',
  'cuentas': 'Ver la sección Cuentas',
  'cobrar': 'Cobrar y cerrar cuentas',
  'anular': 'Anular pedidos, cuentas y facturas sin pedir PIN',
  'caja': 'Abrir y cerrar caja',
  'menu.ver': 'Ver menú y recetas',
  'menu.editar': 'Crear y editar productos y recetas',
  'menu.bloquear': 'Bloquear productos agotados',
  'menu.conteo': 'Poner productos en conteo',
  'inventario.ver': 'Ver inventario',
  'inventario.ajustar': 'Ajustar cantidades del inventario',
  'compras': 'Subir facturas de proveedor',
  'facturacion': 'Ver facturación',
  'reportes': 'Ver reportes',
  'personal': 'Gestionar personal',
  'convenios': 'Gestionar convenios',
  'ajustes': 'Ajustes generales (NIT, impuesto, numeración, permisos)',
}

// Íconos por categoría (https://lucide.dev/icons/): reconocer antes de leer agiliza la toma de pedidos.
// Una categoría nueva sin ícono usa los cubiertos.
export const CATEGORY_ICON: Record<string, LucideIcon> = {
  'Bebidas calientes': Coffee, 'Bebidas frías': CupSoda, 'Cócteles': Martini, 'Comidas': Sandwich, 'Postres': CakeSlice, 'Promociones': Sparkles,
}
export const catIcon = (c: string) => CATEGORY_ICON[c] ?? UtensilsCrossed
