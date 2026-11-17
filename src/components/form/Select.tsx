import type { ComponentProps } from 'react'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import { controlClass } from './styles'

export interface Option {
  value: string
  label: string
}

export interface SelectProps extends ComponentProps<'select'> {
  options: readonly Option[]
  /** Texto de la opción vacía inicial. Sin placeholder no se agrega opción vacía. */
  placeholder?: string
  invalid?: boolean
}

export function Select({ options, placeholder, invalid, className, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select aria-invalid={invalid || undefined} className={controlClass({ invalid, iconRight: true, className: cn('appearance-none', className) })} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon name="expand_more" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xl! text-slate-400" />
    </div>
  )
}

/** Convierte una lista de textos en opciones { value, label } iguales. */
export const toOptions = (values: readonly string[]): Option[] => values.map((v) => ({ value: v, label: v }))
