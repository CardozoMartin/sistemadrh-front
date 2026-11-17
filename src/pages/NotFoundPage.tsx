import { Link } from 'react-router'
import { ROUTES } from '@/config/routes'
import { Icon } from '@/components/ui/Icon'

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <Icon name="travel_explore" className="text-6xl! text-slate-400" />
      <h1 className="text-2xl font-bold">Página no encontrada</h1>
      <p className="text-slate-500 dark:text-slate-400">La dirección que buscás no existe o fue movida.</p>
      <Link to={ROUTES.dashboard} className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90">
        Volver al inicio
      </Link>
    </div>
  )
}
