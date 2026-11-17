// Definición del menú lateral. Para agregar, quitar o reordenar opciones se edita SOLO este archivo.
import type { NavItem, NavSection } from '@/types/navigation'
import { ROUTES } from './routes'

export const NAVIGATION: NavSection[] = [
  {
    key: 'principal',
    items: [{ key: 'dashboard', label: 'Dashboard', icon: 'dashboard', path: ROUTES.dashboard }],
  },
  {
    key: 'oficinas',
    title: 'Oficinas',
    items: [
      {
        key: 'catastro',
        label: 'Catastro',
        icon: 'domain',
        path: ROUTES.catastro.root,
        roles: ['catastro', 'administrador'],
        children: [
          { key: 'catastro-bandeja', label: 'Bandeja', icon: 'inbox', path: ROUTES.catastro.bandeja, bandejaDe: 'catastro' },
          { key: 'catastro-tramites', label: 'Trámites', icon: 'post_add', path: ROUTES.catastro.tramites },
          // Seguimiento (ROUTES.catastro.pendientes) oculto por ahora: la ruta sigue activa.
          { key: 'catastro-concesiones', label: 'Consulta de concesiones', icon: 'manage_search', path: ROUTES.catastro.concesiones },
          { key: 'catastro-publicacion-mapa', label: 'Publicación en el mapa', icon: 'public', path: ROUTES.catastro.publicacionMapa },
          { key: 'catastro-suministro', label: 'Catálogo de suministro', icon: 'account_tree', path: ROUTES.catastro.suministro, permiso: 'CATALOGOS_ADMINISTRAR' },
        ],
      },
      {
        key: 'recaudacion',
        label: 'Recaudación',
        icon: 'payments',
        path: ROUTES.recaudacion,
        roles: ['recaudacion', 'administrador'],
        bandejaDe: 'recaudacion',
      },
      {
        key: 'distrito',
        label: 'Distrito',
        icon: 'location_city',
        path: ROUTES.distrito,
        roles: ['distrito', 'administrador'],
        bandejaDe: 'distrito',
      },
      {
        key: 'juridico',
        label: 'Jurídico',
        icon: 'gavel',
        path: ROUTES.juridico,
        roles: ['juridico', 'administrador'],
        bandejaDe: 'juridico',
      },
      {
        key: 'secretaria-general',
        label: 'Secretaría General',
        icon: 'approval',
        path: ROUTES.secretariaGeneral,
        roles: ['secretaria_general', 'administrador'],
        bandejaDe: 'secretaria_general',
      },
    ],
  },
  {
    key: 'modulos',
    title: 'Módulos',
    items: [
      {
        key: 'pozo',
        label: 'Pozos',
        icon: 'water_pump',
        path: ROUTES.pozo.root,
        oficina: 'pozos',
        children: [
          { key: 'pozo-autorizacion', label: 'Autorización de pozo', icon: 'domain_verification', path: ROUTES.pozo.autorizacion },
          { key: 'pozo-registro', label: 'Registro de pozo', icon: 'water_drop', path: ROUTES.pozo.registro },
          { key: 'pozo-empresas', label: 'Empresas perforadoras', icon: 'engineering', path: ROUTES.pozo.empresas },
          { key: 'pozo-autorizaciones', label: 'Autorizaciones', icon: 'verified_user', path: ROUTES.pozo.autorizaciones },
          { key: 'pozo-registrados', label: 'Consulta de pozos', icon: 'manage_search', path: ROUTES.pozo.registrados },
          { key: 'pozo-consulta', label: 'Consulta general', icon: 'travel_explore', path: ROUTES.pozo.consulta },
          { key: 'pozo-bajas', label: 'Baja de pozo', icon: 'do_not_disturb_on', path: ROUTES.pozo.bajas },
        ],
      },
    ],
  },
  {
    key: 'informatica',
    title: 'Informática',
    items: [
      {
        key: 'informatica',
        label: 'Informática',
        icon: 'computer',
        path: ROUTES.informatica.root,
        soloAdministrador: true,
        children: [
          { key: 'informatica-panel', label: 'Panel', icon: 'monitoring', path: ROUTES.informatica.root },
          { key: 'informatica-usuarios', label: 'Usuarios', icon: 'group', path: ROUTES.informatica.usuarios },
          { key: 'informatica-permisos', label: 'Plantillas por rol', icon: 'admin_panel_settings', path: ROUTES.informatica.permisos },
        ],
      },
    ],
  },
  {
    key: 'herramientas',
    title: 'Herramientas',
    items: [
      { key: 'busqueda', label: 'Búsqueda general', icon: 'manage_search', path: ROUTES.busqueda },
      { key: 'visor', label: 'Visor cartográfico', icon: 'map', path: ROUTES.visor },
    ],
  },
]

/** Ítems fijos al pie del sidebar. */
export const NAVIGATION_FOOTER: NavItem[] = [
  { key: 'configuracion', label: 'Configuración', icon: 'settings', path: ROUTES.configuracion },
]

/**
 * Quién ve cada ítem: lo de una oficina, solo sus usuarios; lo de administración, solo los
 * administradores (que ven todo); lo que pide un permiso, solo quien lo tiene. Lo general
 * (búsqueda, visor), todos. El backend controla igual.
 */
export function itemVisible(
  item: NavItem,
  usuario: { esAdministrador: boolean; oficina: { codigo: string } | null; permisos?: string[] } | null,
): boolean {
  if (usuario?.esAdministrador) return true
  if (item.soloAdministrador) return false
  if (item.permiso && !usuario?.permisos?.includes(item.permiso)) return false
  const oficina = item.oficina ?? item.roles?.find((r) => r !== 'administrador')
  return !oficina || usuario?.oficina?.codigo === oficina
}
