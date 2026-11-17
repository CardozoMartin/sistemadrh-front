import type { ReactNode } from 'react'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

interface FormSectionProps {
  title: string
  icon?: string
  description?: string
  /** Botones a la derecha del título (ej: eliminar bloque). */
  actions?: ReactNode
  /** 'plain' = solo título; 'boxed' = bloque con borde (para elementos repetibles). */
  variant?: 'plain' | 'boxed'
  className?: string
  children: ReactNode
}

export function FormSection({ title, icon, description, actions, variant = 'plain', className, children }: FormSectionProps) {
  return (
    <section
      className={cn(
        variant === 'boxed' && 'rounded-xl border border-slate-200 bg-slate-50 p-4 md:p-6 dark:border-slate-700 dark:bg-slate-800/40',
        className,
      )}
    >
      <div className={cn('mb-5 flex items-start justify-between gap-3', variant === 'plain' && 'border-b border-slate-200 pb-2 dark:border-slate-700')}>
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
            {icon && <Icon name={icon} className="text-primary" />}
            {title}
          </h3>
          {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  )
}
