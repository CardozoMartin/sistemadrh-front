// Estados estándar de una consulta: cargando, error y vacío. Usarlos siempre para que
// todas las pantallas se comporten igual.
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Spinner } from '@/components/ui/Spinner'
import { mensajeDeError } from '@/services/api/errors'
import { cn } from '@/lib/cn'

const contenedor = 'flex flex-col items-center justify-center gap-3 rounded-xl px-6 py-14 text-center'

export function LoadingState({ mensaje = 'Cargando…', className }: { mensaje?: string; className?: string }) {
  return (
    <div className={cn(contenedor, 'text-slate-500 dark:text-slate-400', className)}>
      <Spinner className="size-8 text-primary" />
      <p className="text-sm">{mensaje}</p>
    </div>
  )
}

interface ErrorStateProps {
  error: unknown
  titulo?: string
  /** Si se pasa, muestra el botón «Reintentar» (ej: refetch de la query). */
  onRetry?: () => void
  reintentando?: boolean
  children?: ReactNode
  className?: string
}

export function ErrorState({ error, titulo = 'No se pudieron cargar los datos', onRetry, reintentando, children, className }: ErrorStateProps) {
  return (
    <div className={cn(contenedor, 'border border-red-200 bg-red-50/60 dark:border-red-500/30 dark:bg-red-500/5', className)}>
      <Icon name="cloud_off" className="text-4xl! text-red-500" />
      <p className="font-semibold text-slate-800 dark:text-slate-100">{titulo}</p>
      <p className="max-w-md text-sm text-slate-600 dark:text-slate-400">{mensajeDeError(error)}</p>
      <div className="flex flex-wrap justify-center gap-3">
        {onRetry && (
          <Button size="sm" variant="secondary" iconLeft="refresh" loading={reintentando} onClick={onRetry}>
            Reintentar
          </Button>
        )}
        {children}
      </div>
    </div>
  )
}

interface EmptyStateProps {
  icon?: string
  titulo: string
  descripcion?: string
  children?: ReactNode
  className?: string
}

export function EmptyState({ icon = 'inbox', titulo, descripcion, children, className }: EmptyStateProps) {
  return (
    <div className={cn(contenedor, 'border-2 border-dashed border-slate-200 dark:border-slate-700', className)}>
      <Icon name={icon} className="text-4xl! text-slate-400" />
      <p className="font-semibold text-slate-700 dark:text-slate-200">{titulo}</p>
      {descripcion && <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">{descripcion}</p>}
      {children}
    </div>
  )
}

/** Mensaje en línea (errores de una mutación, avisos). */
export function Alert({ tone = 'error', children, className }: { tone?: 'error' | 'info'; children: ReactNode; className?: string }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-3 rounded-lg border p-4 text-sm',
        tone === 'error'
          ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200'
          : 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200',
        className,
      )}
    >
      <Icon name={tone === 'error' ? 'error' : 'info'} className="shrink-0" />
      <div className="flex-1">{children}</div>
    </div>
  )
}
