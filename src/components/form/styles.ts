import { cn } from '@/lib/cn'

interface ControlOptions {
  invalid?: boolean
  /** Deja lugar a la izquierda para un ícono. */
  iconLeft?: boolean
  /** Deja lugar a la derecha para un ícono (ej: flecha del select). */
  iconRight?: boolean
  className?: string
}

/** Clases comunes a <input> y <select> para que todos los controles se vean iguales. */
export function controlClass({ invalid, iconLeft, iconRight, className }: ControlOptions) {
  return cn(
    'w-full rounded-lg border bg-white py-3 text-sm text-slate-900 transition-all outline-none placeholder:text-slate-400 focus:ring-2',
    iconLeft ? 'pl-11' : 'pl-4',
    iconRight ? 'pr-10' : 'pr-4',
    'disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500',
    // Solo lectura (ej: datos que vienen del padrón de personas): se ve como deshabilitado pero se envía.
    '[&[readonly]]:bg-slate-100 [&[readonly]]:text-slate-600 dark:[&[readonly]]:bg-slate-900 dark:[&[readonly]]:text-slate-400',
    'dark:bg-slate-800 dark:text-white dark:disabled:bg-slate-900 dark:disabled:text-slate-500',
    invalid
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
      : 'border-slate-300 focus:border-primary focus:ring-primary/30 dark:border-slate-600',
    className,
  )
}
