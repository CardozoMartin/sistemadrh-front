import { cn } from '@/lib/cn'

interface IconProps {
  /** Nombre del ícono de Material Symbols Outlined. */
  name: string
  filled?: boolean
  className?: string
}

export function Icon({ name, filled, className }: IconProps) {
  return (
    <span aria-hidden="true" className={cn('material-symbols-outlined', filled && 'icon-fill', className)}>
      {name}
    </span>
  )
}
