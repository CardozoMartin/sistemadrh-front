import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { ROUTES } from '@/config/routes'

/** Se muestra si una página lanza un error al cargar o renderizar. */
export default function RouteErrorPage() {
  const error = useRouteError()
  const detalle = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Error desconocido'

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-2xl font-bold">Ocurrió un error</h1>
      <p className="text-slate-500 dark:text-slate-400">{detalle}</p>
      <Link to={ROUTES.dashboard} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90">
        Volver al inicio
      </Link>
    </div>
  )
}
