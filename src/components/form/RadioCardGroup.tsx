import type { Ref } from 'react'
import { cn } from '@/lib/cn'
import type { Option } from './Select'

export interface RadioCardGroupProps {
  name: string
  options: readonly Option[]
  value: string | undefined
  onChange: (value: string) => void
  onBlur?: () => void
  invalid?: boolean
  /** Se asigna al primer radio para que react-hook-form pueda hacerle foco ante un error. */
  ref?: Ref<HTMLInputElement>
  className?: string
}

/** Grupo de opciones excluyentes mostradas como tarjetas. */
export function RadioCardGroup({ name, options, value, onChange, onBlur, invalid, ref, className }: RadioCardGroupProps) {
  return (
    <div role="radiogroup" aria-invalid={invalid || undefined} className={cn('grid grid-cols-1 gap-4 sm:grid-cols-3', className)}>
      {options.map((op, i) => {
        const checked = value === op.value
        return (
          <label
            key={op.value}
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition hover:border-primary',
              checked
                ? 'border-primary bg-primary/5 dark:bg-primary/10'
                : invalid
                  ? 'border-red-300 bg-slate-50 dark:border-red-500/50 dark:bg-slate-800'
                  : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800',
            )}
          >
            <input
              ref={i === 0 ? ref : undefined}
              type="radio"
              name={name}
              value={op.value}
              checked={checked}
              onChange={() => onChange(op.value)}
              onBlur={onBlur}
              className="size-4 accent-primary"
            />
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{op.label}</span>
          </label>
        )
      })}
    </div>
  )
}
