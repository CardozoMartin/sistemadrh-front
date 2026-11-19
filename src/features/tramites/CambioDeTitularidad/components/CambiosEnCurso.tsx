import { useNavigate } from 'react-router'
import { ROUTES } from '@/config/routes'
import { formatearFecha } from '@/config/expedientes'
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useDominio } from '@/hooks/useDominio'
import { estaEnCarga } from '../backend.types'
import { useCambiosEnCurso } from '../hooks'

/** Cambios de titularidad en trámite (backend real): los que están en carga se pueden continuar. */
export function CambiosEnCurso() {
  const navigate = useNavigate()
  const { nombreOficina } = useDominio()
  const cambios = useCambiosEnCurso()

  function contenido() {
    if (cambios.isPending) return <LoadingState mensaje="Cargando cambios en trámite…" className="py-8" />
    if (cambios.isError) return <ErrorState error={cambios.error} onRetry={() => void cambios.refetch()} reintentando={cambios.isFetching} className="py-8" />
    if (cambios.data.length === 0) {
      return <EmptyState icon="task_alt" titulo="No hay cambios en trámite" descripcion="Los cambios iniciados aparecerán acá hasta que finalicen." className="py-8" />
    }
    return (
      <ul className="divide-y divide-slate-200 dark:divide-slate-700">
        {cambios.data.map((c) => {
          const enCarga = estaEnCarga(c.estado, c.etapa)
          return (
            <li key={c.expedienteId} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 dark:text-white">
                  Expediente {c.expediente} · Concesión {c.concesion.numero ?? c.concesion.id}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {c.nuevoTitular ? `Nuevo titular: ${c.nuevoTitular}` : 'Falta cargar el nuevo titular'} · En {nombreOficina(c.oficinaActual)} · Iniciado{' '}
                  {formatearFecha(c.creadoEn)}
                </p>
              </div>
              {enCarga ? (
                <Button size="sm" iconRight="arrow_forward" onClick={() => navigate(ROUTES.tramites.cambioTitularidad.datos(c.expedienteId))}>
                  Continuar
                </Button>
              ) : (
                <Button size="sm" variant="secondary" iconRight="visibility" onClick={() => navigate(ROUTES.tramites.cambioTitularidad.circuito(c.expedienteId))}>
                  Ver expediente
                </Button>
              )}
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <Card className="p-6 md:p-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Cambios en trámite</h2>
        {cambios.isFetching && !cambios.isPending && <span className="text-xs text-slate-400">Actualizando…</span>}
      </div>
      {contenido()}
    </Card>
  )
}
