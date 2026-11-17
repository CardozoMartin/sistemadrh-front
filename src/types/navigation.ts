import type { Oficina, Rol } from './domain'

export interface NavItem {
  /** Identificador único (se usa como key y para permisos). */
  key: string
  label: string
  /** Nombre del ícono de Material Symbols. */
  icon: string
  path: string
  /** Roles que ven el ítem. Sin definir = visible para todos. Se aplicará con el login. */
  roles?: Rol[]
  /** Oficina dueña del ítem (si no se indica, sale de `roles`): solo la ven sus usuarios. */
  oficina?: string
  /** Solo lo ven los administradores (ej: Informática). */
  soloAdministrador?: boolean
  /** Solo lo ven quienes tienen ese permiso (y los administradores). */
  permiso?: string
  /** Si el ítem es la bandeja de una oficina, muestra el contador de pendientes y el aviso de nuevos. */
  bandejaDe?: Oficina
  children?: NavItem[]
}

export interface NavSection {
  key: string
  /** Título de la sección. Sin título = ítems sueltos arriba del menú. */
  title?: string
  items: NavItem[]
}

/** Datos que cada ruta expone vía `handle` para armar breadcrumbs y el <title>. */
export interface RouteHandle {
  crumb?: string
}
