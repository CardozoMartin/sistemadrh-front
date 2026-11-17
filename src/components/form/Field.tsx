import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface FieldProps {
  /** id del control; se usa para asociar label, ayuda y error. */
  id: string
  label: string
  required?: boolean
  hint?: string
  error?: string
  /** Oculta el label visualmente (queda para lectores de pantalla). Útil en tablas. */
  hideLabel?: boolean
  className?: string
  children: ReactNode
}

export const hintId = (id: string) => `${id}-hint`
export const errorId = (id: string) => `${id}-error`

/** Envoltorio de un control: label + control + texto de ayuda + mensaje de error. */
export function Field({ id, label, required, hint, error, hideLabel, className, children }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className={cn('text-sm font-semibold text-slate-800 dark:text-slate-200', hideLabel && 'sr-only')}>
        {label}
        {required && <span className="ml-0.5 text-red-600" title="Obligatorio">*</span>}
      </label>
      {children}
      {error ? (
        <p id={errorId(id)} role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId(id)} className="text-xs text-slate-500 dark:text-slate-400">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

/** aria-describedby correcto según haya error o ayuda. */
export function describedBy(id: string, error?: string, hint?: string) {
  if (error) return errorId(id)
  if (hint) return hintId(id)
  return undefined
}
