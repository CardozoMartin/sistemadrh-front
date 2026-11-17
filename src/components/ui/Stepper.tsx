import { useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'
import { Icon } from './Icon'

export interface Step {
  key: string
  label: string
}

interface StepperProps {
  steps: readonly Step[]
  /** Índice del paso actual. */
  current: number
  /** Último paso al que se llegó; se puede volver a cualquiera hasta ese. */
  maxReached: number
  onSelect: (index: number) => void
}

/**
 * Pasos de un formulario largo: círculos numerados unidos por una línea (como los
 * formularios de trámites del Estado). Completo = tilde verde; actual = azul; el resto, gris.
 * Se puede volver a cualquier paso ya alcanzado.
 */
export function Stepper({ steps, current, maxReached, onSelect }: StepperProps) {
  // En pantallas angostas los pasos se desplazan: se muestra siempre el actual.
  const actual = useRef<HTMLLIElement>(null)
  useEffect(() => {
    actual.current?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [current])

  return (
    <nav aria-label="Pasos del formulario" className="overflow-x-auto">
      <ol className="flex min-w-max items-start">
        {steps.map((step, i) => {
          const activo = i === current
          const completo = i < maxReached && !activo
          const habilitado = i <= maxReached
          return (
            <li key={step.key} ref={activo ? actual : undefined} className="relative flex flex-1 flex-col items-center px-2">
              {/* Línea hacia el paso anterior (azul si ya se pasó por acá). */}
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className={cn('absolute top-5 right-1/2 z-0 h-0.5 w-full -translate-y-1/2', i <= maxReached ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600')}
                />
              )}
              <button
                type="button"
                disabled={!habilitado}
                onClick={() => onSelect(i)}
                aria-current={activo ? 'step' : undefined}
                className="group relative z-10 flex min-w-24 flex-col items-center gap-2 disabled:cursor-not-allowed"
              >
                <span
                  className={cn(
                    'flex size-10 items-center justify-center rounded-full border-2 text-base font-bold transition-colors',
                    activo && 'border-primary bg-primary text-white ring-4 ring-primary/15',
                    completo && 'border-green-600 bg-green-600 text-white group-hover:bg-green-700',
                    !activo && !completo && habilitado && 'border-primary bg-white text-primary group-hover:bg-primary/10 dark:bg-surface-dark',
                    !habilitado && 'border-slate-300 bg-white text-slate-400 dark:border-slate-600 dark:bg-surface-dark',
                  )}
                >
                  {completo ? <Icon name="check" className="text-xl!" /> : i + 1}
                </span>
                <span
                  className={cn(
                    'text-center text-sm whitespace-nowrap',
                    activo ? 'font-bold text-primary' : habilitado ? 'font-medium text-slate-700 group-hover:text-primary dark:text-slate-300' : 'text-slate-400',
                  )}
                >
                  {step.label}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
