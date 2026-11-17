import { Link } from 'react-router'
import { itemVisible, NAVIGATION, NAVIGATION_FOOTER } from '@/config/navigation'
import { ROUTES } from '@/config/routes'
import { Icon } from '@/components/ui/Icon'
import { useSesion } from '@/features/auth/context'
import { useResumenBandejas } from '@/features/notificaciones/useResumenBandejas'
import { cn } from '@/lib/cn'
import type { NavItem } from '@/types/navigation'
import { SidebarItem, type BadgeItem } from './SidebarItem'

interface SidebarProps {
  /** En pantallas chicas, o siempre si es `flotante` (en desktop normal el sidebar está fijo). */
  open: boolean
  onClose: () => void
  /**
   * Menú desplegable en todos los tamaños de pantalla: está escondido y se abre encima del
   * contenido. Lo usan las pantallas completas (ej: el visor), para dejar todo el ancho al mapa.
   */
  flotante?: boolean
}

export function Sidebar({ open, onClose, flotante = false }: SidebarProps) {
  // Cada usuario ve su oficina y lo general (el administrador, todo); las secciones vacías no se muestran.
  const { usuario } = useSesion()
  const secciones = NAVIGATION.map((s) => ({
    ...s,
    items: s.items.filter((i) => itemVisible(i, usuario)).map((i) => (i.children ? { ...i, children: i.children.filter((c) => itemVisible(c, usuario)) } : i)),
  })).filter((s) => s.items.length)
  const resumen = useResumenBandejas()
  const getBadge = (item: NavItem): BadgeItem | undefined => {
    if (!item.bandejaDe) return undefined
    const r = resumen[item.bandejaDe]
    return { cantidad: r?.pendientes ?? 0, nuevo: (r?.nuevos ?? 0) > 0 }
  }

  return (
    <>
      {/* Fondo oscuro en mobile */}
      <div
        onClick={onClose}
        className={cn('fixed inset-0 z-30 bg-slate-900/40', !flotante && 'lg:hidden', open ? 'block' : 'hidden')}
        aria-hidden="true"
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white transition-transform dark:border-slate-800 dark:bg-surface-dark',
          !flotante && 'lg:static lg:translate-x-0',
          flotante && open && 'shadow-2xl',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Nombre del sistema (la Dirección y el Gobierno están en la barra superior). */}
        <Link to={ROUTES.dashboard} className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <Icon name="water_drop" filled className="text-xl! text-primary" />
          <span className="text-sm font-bold tracking-wide text-slate-800 uppercase dark:text-white">Sistema DRH</span>
        </Link>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3">
          {secciones.map((section) => (
            <div key={section.key} className="flex flex-col gap-1">
              {section.title && (
                <p className="mx-3 mt-4 mb-1 border-b border-slate-200 pb-1.5 text-xs font-bold tracking-wider text-slate-500 uppercase dark:border-slate-700 dark:text-slate-400">
                  {section.title}
                </p>
              )}
              {section.items.map((item) => (
                <SidebarItem key={item.key} item={item} getBadge={getBadge} />
              ))}
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-slate-200 p-4 dark:border-slate-800">
          {NAVIGATION_FOOTER.map((item) => (
            <SidebarItem key={item.key} item={item} />
          ))}
        </div>
      </aside>
    </>
  )
}
