import { Link } from 'react-router'
import { Icon } from './Icon'

interface ActionCardProps {
  to: string
  icon: string
  title: string
  description: string
  cta?: string
}

/** Tarjeta de acceso rápido (menús de trámites, módulos, dashboard). */
export function ActionCard({ to, icon, title, description, cta = 'Ingresar' }: ActionCardProps) {
  return (
    <Link
      to={to}
      className="group flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md dark:border-slate-700/60 dark:bg-surface-dark"
    >
      <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon name={icon} className="text-[28px]!" />
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <div className="flex items-center gap-1 text-sm font-semibold text-primary">
        <span>{cta}</span>
        <Icon name="arrow_forward" className="text-lg! transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  )
}
