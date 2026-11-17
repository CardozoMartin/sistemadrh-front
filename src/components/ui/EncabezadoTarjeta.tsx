import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Icon } from './Icon'

interface EncabezadoTarjetaProps {
  titulo: string
  /** Texto chico arriba del título (ej: «Paso 2 de 6»). */
  antetitulo?: string
  descripcion?: string
  icono?: string
  /** Contenido a la derecha (ej: «* Campos obligatorios»). */
  extra?: ReactNode
  className?: string
}

/**
 * Franja de título de una tarjeta, como el encabezado de un formulario oficial: ícono,
 * antetítulo, título y descripción sobre fondo gris, separada del contenido por una línea.
 * Va como primer hijo de <Card>.
 */
export function EncabezadoTarjeta({ titulo, antetitulo, descripcion, icono, extra, className }: EncabezadoTarjetaProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-x-6 gap-y-2 border-b border-slate-200 bg-slate-50 px-6 py-4 md:px-8 dark:border-slate-700 dark:bg-slate-800/40',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icono && (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon name={icono} />
          </span>
        )}
        <div className="min-w-0">
          {antetitulo && <p className="text-xs font-semibold tracking-wider text-celeste uppercase">{antetitulo}</p>}
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{titulo}</h2>
          {descripcion && <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{descripcion}</p>}
        </div>
      </div>
      {extra && <div className="shrink-0 self-center text-sm text-slate-500 dark:text-slate-400">{extra}</div>}
    </div>
  )
}

/** Aclaración estándar de los campos obligatorios (para el `extra` del encabezado). */
export function AvisoObligatorios() {
  return (
    <span>
      Los campos con <span className="font-bold text-red-600">*</span> son obligatorios
    </span>
  )
}
