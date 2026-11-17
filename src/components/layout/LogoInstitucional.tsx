import { cn } from '@/lib/cn'

/**
 * Logo oficial (Ministerio de Economía y Producción · Dirección de Recursos Hídricos · Gobierno de
 * Tucumán), con sus colores sobre la barra blanca. En modo oscuro se muestra en blanco: el logo es
 * azul y sobre fondo oscuro no se lee.
 * En pantallas chicas no entra: ahí se muestra el nombre corto en texto (ver `NombreCorto`).
 */
export function LogoInstitucional({ className }: { className?: string }) {
  return (
    // El PNG trae margen transparente (sobre todo abajo): se recorta con el alto fijo y overflow,
    // así el logo ocupa casi todo el alto de la barra (64 px) sin agrandarla.
    <span className={cn('hidden h-14 shrink-0 items-start overflow-hidden sm:flex', className)}>
      <img
        src="/logo1.png"
        alt="Ministerio de Economía y Producción · Dirección de Recursos Hídricos · Gobierno de Tucumán"
        className="-mt-0.5 h-17 w-auto max-w-none dark:brightness-0 dark:invert"
      />
    </span>
  )
}

/** Nombre de la Dirección en texto, para pantallas donde el logo no entra. */
export function NombreCorto() {
  return (
    <span className="flex min-w-0 flex-col leading-tight sm:hidden">
      <span className="truncate text-xs font-medium tracking-wider text-slate-500 uppercase dark:text-white/75">Gob. de Tucumán</span>
      <span className="truncate text-base font-semibold text-institucional dark:text-white">Recursos Hídricos</span>
    </span>
  )
}
