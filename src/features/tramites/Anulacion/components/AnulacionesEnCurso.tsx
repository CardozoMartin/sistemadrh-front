import { useNavigate } from 'react-router'
import { ROUTES } from '@/config/routes'
import { formatearFecha } from '@/config/expedientes'
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useDominio } from '@/hooks/useDominio'
import { numeroConcesion } from '../../CambioDeTitularidad/formato'
import { estaEnCarga } from '../formato'
import { useAnulacionesEnCurso } from '../hooks'

/** Anulaciones en trámite (backend real): las que siguen en la carga de Catastro se pueden continuar. */
export function AnulacionesEnCurso() {
  const navigate = useNavigate()
  const { nombreOficina } = useDominio()
  const anulaciones = useAnulacionesEnCurso()

  function contenido() {
    if (anulaciones.isPending) return <LoadingState mensaje="Cargando anulaciones en trámite…" className="py-8" />
    if (anulaciones.isError) return <ErrorState error={anulaciones.error} onRetry={() => void anulaciones.refetch()} reintentando={anulaciones.isFetching} className="py-8" />
    if (anulaciones.data.length === 0) {
      return <EmptyState icon="task_alt" titulo="No hay anulaciones en trámite" descripcion="Las anulaciones iniciadas aparecerán acá hasta que finalicen." className="py-8" />
    }
    return (
      <ul className="divide-y divide-slate-200 dark:divide-slate-700">
        {anulaciones.data.map((a) => (
          <li key={a.expedienteId} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 dark:text-white">
                Expediente {a.expediente} · Concesión {numeroConcesion(a.concesion)}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {a.titular ?? 'Sin titular'} · En {nombreOficina(a.oficinaActual)} · Iniciada {formatearFecha(a.creadoEn)}
              </p>
            </div>
            {estaEnCarga(a.estado, a.etapa) ? (
              <Button size="sm" iconRight="arrow_forward" onClick={() => navigate(ROUTES.tramites.anulacion.verificacion(a.expedienteId))}>
                Continuar
              </Button>
            ) : (
              <Button size="sm" variant="secondary" iconRight="visibility" onClick={() => navigate(ROUTES.tramites.anulacion.circuito(a.expedienteId))}>
                Ver expediente
              </Button>
            )}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <Card className="p-6 md:p-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Anulaciones en trámite</h2>
        {anulaciones.isFetching && !anulaciones.isPending && <span className="text-xs text-slate-400">Actualizando…</span>}
      </div>
      {contenido()}
    </Card>
  )
}
