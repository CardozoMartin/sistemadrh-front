import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { Icon } from './Icon'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string
  /** Texto accesible (también se muestra como tooltip). */
  label: string
  tone?: 'neutral' | 'danger'
}

export function IconButton({ icon, label, tone = 'neutral', className, type = 'button', ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg p-2 transition-colors disabled:opacity-50',
        tone === 'danger'
          ? 'text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10'
          : 'text-slate-500 hover:bg-slate-100 hover:text-primary dark:text-slate-400 dark:hover:bg-slate-700/50',
        className,
      )}
      {...props}
    >
      <Icon name={icon} />
    </button>
  )
}
