import type { ComponentProps } from 'react'
import { Icon } from '@/components/ui/Icon'
import { controlClass } from './styles'

export interface InputProps extends ComponentProps<'input'> {
  invalid?: boolean
  /** Ícono de Material Symbols dentro del input, a la izquierda. */
  icon?: string
}

export function Input({ invalid, icon, className, ...props }: InputProps) {
  const input = (
    <input aria-invalid={invalid || undefined} className={controlClass({ invalid, iconLeft: !!icon, className })} {...props} />
  )
  if (!icon) return input

  return (
    <div className="relative">
      <Icon name={icon} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-xl! text-slate-400" />
      {input}
    </div>
  )
}
