import { useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import type { NavItem } from '@/types/navigation'
import { ROUTES } from '@/config/routes'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

const itemBase = 'flex w-full items-center gap-3 rounded px-3 py-2.5 text-sm font-medium transition-colors'
const itemIdle = 'text-slate-700 hover:bg-slate-100 hover:text-primary dark:text-slate-300 dark:hover:bg-slate-700/50'
// Activo: fondo azul suave, negrita y la barra celeste a la izquierda (como el portal de la Provincia).
const itemActive = 'bg-primary/10 font-semibold text-primary shadow-[inset_3px_0_0_var(--color-celeste)]'

export interface BadgeItem {
  /** Cantidad a mostrar (ej: expedientes pendientes). */
  cantidad: number
  /** Hay novedades sin ver: el contador se resalta y late. */
  nuevo: boolean
}

function isWithin(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`)
}

function Badge({ badge }: { badge?: BadgeItem }) {
  if (!badge || (badge.cantidad === 0 && !badge.nuevo)) return null
  return (
    <span className="relative ml-auto flex items-center">
      {badge.nuevo && <span className="absolute inset-0 animate-ping rounded-full bg-primary/60" aria-hidden="true" />}
      <span
        className={cn(
          'relative min-w-5 rounded-full px-1.5 text-center text-[11px] leading-5 font-bold',
          badge.nuevo ? 'bg-primary text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
        )}
        title={badge.nuevo ? 'Hay expedientes nuevos' : undefined}
      >
        {badge.cantidad}
      </span>
    </span>
  )
}

interface SidebarItemProps {
  item: NavItem
  /** Contador opcional por ítem (bandejas de oficinas). */
  getBadge?: (item: NavItem) => BadgeItem | undefined
}

export function SidebarItem({ item, getBadge }: SidebarItemProps) {
  const { pathname } = useLocation()
  const hasChildren = !!item.children?.length
  const activeBranch = hasChildren && isWithin(pathname, item.path)
  const [open, setOpen] = useState(activeBranch)
  const expanded = open || activeBranch

  if (!hasChildren) {
    return (
      <NavLink
        to={item.path}
        end={item.path === ROUTES.dashboard}
        className={({ isActive }) => cn(itemBase, isActive ? itemActive : itemIdle)}
      >
        {({ isActive }) => (
          <>
            <Icon name={item.icon} filled={isActive} />
            <span>{item.label}</span>
            <Badge badge={getBadge?.(item)} />
          </>
        )}
      </NavLink>
    )
  }

  // Si el grupo está cerrado y algún hijo tiene novedades, se avisa en el grupo.
  const hijoConNovedades = item.children!.some((c) => getBadge?.(c)?.nuevo)

  return (
    <div>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setOpen(!expanded)}
        className={cn(itemBase, activeBranch ? 'text-primary' : itemIdle)}
      >
        <Icon name={item.icon} filled={activeBranch} />
        <span className="flex-1 text-left">{item.label}</span>
        {!expanded && hijoConNovedades && <span className="size-2 animate-pulse rounded-full bg-primary" aria-label="Hay expedientes nuevos" />}
        <Icon name="expand_more" className={cn('text-xl! transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <div className="mt-1 ml-5 flex flex-col gap-0.5 border-l border-slate-200 pl-3 dark:border-slate-700">
          {item.children!.map((child) => (
            <NavLink
              key={child.key}
              to={child.path}
              className={({ isActive }) =>
                cn('flex items-center gap-2 rounded px-3 py-2 text-sm transition-colors', isActive ? itemActive : itemIdle)
              }
            >
              <Icon name={child.icon} className="text-lg!" />
              <span>{child.label}</span>
              <Badge badge={getBadge?.(child)} />
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}
