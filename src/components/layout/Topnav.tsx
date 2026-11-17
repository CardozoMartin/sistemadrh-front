import { Link } from 'react-router'
import { ROUTES } from '@/config/routes'
import { useBreadcrumbs } from '@/hooks/useBreadcrumbs'
import { useTheme } from '@/hooks/useTheme'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import { CampanaNotificaciones } from '@/features/notificaciones/components/CampanaNotificaciones'
import { IndicadorDemo } from './IndicadorDemo'
import { LogoInstitucional, NombreCorto } from './LogoInstitucional'
import { MenuUsuario } from '@/features/auth/components/MenuUsuario'
import { MODO_DEMO } from '@/services/demo/modo'
import { SelectorUsuario } from './SelectorUsuario'

interface TopnavProps {
  onOpenSidebar: () => void
  /** Mostrar el botón de menú también en desktop (cuando el menú lateral es desplegable). */
  menuSiempre?: boolean
}

/**
 * Barra institucional (todo el ancho, arriba de todo): logo oficial de la Dirección,
 * con la línea celeste del portal tucuman.gob.ar. A la derecha, notificaciones, tema y usuario.
 */
export function Topnav({ onOpenSidebar, menuSiempre = false }: TopnavProps) {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="shrink-0 border-b-[3px] border-celeste bg-white text-slate-700 shadow-sm dark:bg-surface-dark dark:text-white">
      <div className="flex h-16 items-center justify-between gap-4 px-3 md:px-6">
        <div className="flex min-w-0 items-center gap-2 md:gap-3">
          <button
            type="button"
            onClick={onOpenSidebar}
            className={cn('rounded p-2 text-slate-600 hover:bg-slate-100 dark:text-white/90 dark:hover:bg-white/10', !menuSiempre && 'lg:hidden')}
            aria-label="Abrir menú"
          >
            <Icon name="menu" />
          </button>

          <Link to={ROUTES.dashboard} className="flex min-w-0 items-center" aria-label="Inicio">
            <LogoInstitucional />
            {/* En pantallas chicas el logo no entra al lado de los botones: el nombre corto. */}
            <NombreCorto />
          </Link>
        </div>

        <div className="flex items-center gap-1 md:gap-3">
          <IndicadorDemo />
          <CampanaNotificaciones />
          <button
            type="button"
            onClick={toggleTheme}
            className="hidden rounded p-2 text-slate-600 hover:bg-slate-100 dark:text-white/90 dark:hover:bg-white/10 sm:inline-flex"
            aria-label={theme === 'dark' ? 'Usar modo claro' : 'Usar modo oscuro'}
          >
            <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} />
          </button>

          {/* Modo demo: sin login, se elige con qué usuario actuar. */}
          {MODO_DEMO ? <SelectorUsuario /> : <MenuUsuario />}
        </div>
      </div>
    </header>
  )
}

/** Franja blanca con la ruta de navegación (arriba del contenido de cada pantalla). */
export function BarraRuta() {
  const crumbs = useBreadcrumbs()

  return (
    <nav
      aria-label="Ruta de navegación"
      className="flex h-11 shrink-0 items-center gap-1.5 border-b border-slate-200 bg-white px-4 text-sm text-slate-500 md:px-8 dark:border-slate-800 dark:bg-surface-dark dark:text-slate-400"
    >
      <Icon name="home" className="text-lg! text-slate-400" />
      {crumbs.map((crumb, i) =>
        i === crumbs.length - 1 ? (
          <span key={crumb.path} className="truncate font-semibold text-slate-800 dark:text-white">
            {crumb.label}
          </span>
        ) : (
          <span key={crumb.path} className="flex min-w-0 items-center gap-1.5">
            <Link to={crumb.path} className="truncate transition-colors hover:text-primary hover:underline">
              {crumb.label}
            </Link>
            <Icon name="chevron_right" className="text-base! text-slate-400" />
          </span>
        ),
      )}
    </nav>
  )
}
