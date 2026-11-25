import { useNavigate } from 'react-router'
import { ROUTES } from '@/config/routes'
import { formatearFecha } from '@/config/expedientes'
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useDominio } from '@/hooks/useDominio'
import { numeroConcesion } from '../../shared/formato'
import { ETAPA_CORRECCION, seEditaEnCatastro } from '../formato'
import { useReubicacionesEnCurso } from '../hooks'

/** Reubicaciones en trámite (backend real): las que siguen en la carga de Catastro se pueden continuar. */
export function ReubicacionesEnCurso() {
  const navigate = useNavigate()
  const { nombreOficina } = useDominio()
  const reubicaciones = useReubicacionesEnCurso()

  function contenido() {
    if (reubicaciones.isPending) return <LoadingState mensaje="Cargando reubicaciones en trámite…" className="py-8" />
    if (reubicaciones.isError) return <ErrorState error={reubicaciones.error} onRetry={() => void reubicaciones.refetch()} reintentando={reubicaciones.isFetching} className="py-8" />
    if (reubicaciones.data.length === 0) {
      return <EmptyState icon="task_alt" titulo="No hay reubicaciones en trámite" descripcion="Las reubicaciones iniciadas aparecerán acá hasta que finalicen." className="py-8" />
    }
    return (
      <ul className="divide-y divide-slate-200 dark:divide-slate-700">
        {reubicaciones.data.map((r) => (
          <li key={r.expedienteId} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 dark:text-white">
                Expediente {r.expediente} · Concesión {numeroConcesion(r.concesion)}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {r.titular ?? 'Sin titular'} · {r.motivo} · En {nombreOficina(r.oficinaActual)} · Iniciada {formatearFecha(r.creadoEn)}
              </p>
            </div>
            {seEditaEnCatastro(r.estado, r.etapa) ? (
              <Button size="sm" iconRight="arrow_forward" onClick={() => navigate(ROUTES.tramites.reubicacion.propuesta(r.expedienteId))}>
                {r.etapa === ETAPA_CORRECCION ? 'Corregir' : 'Continuar'}
              </Button>
            ) : (
              <Button size="sm" variant="secondary" iconRight="visibility" onClick={() => navigate(ROUTES.tramites.reubicacion.circuito(r.expedienteId))}>
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
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Reubicaciones en trámite</h2>
        {reubicaciones.isFetching && !reubicaciones.isPending && <span className="text-xs text-slate-400">Actualizando…</span>}
      </div>
      {contenido()}
    </Card>
  )
}
