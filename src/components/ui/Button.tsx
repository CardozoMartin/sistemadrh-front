import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'
import { Icon } from './Icon'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'md' | 'sm'

interface ButtonProps extends ComponentProps<'button'> {
  variant?: Variant
  size?: Size
  /** Ícono de Material Symbols a la derecha del texto. */
  iconRight?: string
  iconLeft?: string
  /** Muestra un spinner y deshabilita el botón (ej: mientras corre una mutación). */
  loading?: boolean
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-white shadow-md hover:bg-primary-oscuro hover:shadow-lg focus-visible:ring-primary/30',
  secondary:
    'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-400/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
  ghost: 'text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-400/30 dark:text-slate-300 dark:hover:bg-slate-700/50',
  danger: 'bg-red-600 text-white shadow-md hover:bg-red-700 focus-visible:ring-red-500/30',
}

const SIZES: Record<Size, string> = {
  md: 'h-12 px-8 font-bold',
  sm: 'h-9 px-4 text-sm font-semibold',
}

export function Button({
  variant = 'primary',
  size = 'md',
  iconLeft,
  iconRight,
  loading,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'group inline-flex items-center justify-center gap-2 rounded-lg transition-all focus-visible:ring-4 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60',
        SIZES[size],
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {loading ? <Spinner className="size-4" /> : iconLeft && <Icon name={iconLeft} className="text-xl!" />}
      {children}
      {!loading && iconRight && <Icon name={iconRight} className="text-xl! transition-transform group-hover:translate-x-1" />}
    </button>
  )
}
