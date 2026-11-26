import { useNavigate } from 'react-router'
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { formatearFecha } from '@/config/expedientes'
import { ROUTES } from '@/config/routes'
import { useDominio } from '@/hooks/useDominio'
import { hectareas, numeroConcesion } from '../../shared/formato'
import { estaEnCarga, NOMBRE_TIPO } from '../backend.types'
import { useModificacionesEnCurso } from '../hooks'

/** Ampliaciones y reducciones en trámite (backend real): las que están en carga se pueden continuar. */
export function ModificacionesEnCurso() {
  const navigate = useNavigate()
  const { nombreOficina } = useDominio()
  const lista = useModificacionesEnCurso()

  function contenido() {
    if (lista.isPending) return <LoadingState mensaje="Cargando trámites en curso…" className="py-8" />
    if (lista.isError) return <ErrorState error={lista.error} onRetry={() => void lista.refetch()} reintentando={lista.isFetching} className="py-8" />
    if (lista.data.length === 0) {
      return <EmptyState icon="task_alt" titulo="No hay ampliaciones ni reducciones en trámite" descripcion="Los trámites iniciados aparecerán acá hasta que finalicen." className="py-8" />
    }
    return (
      <ul className="divide-y divide-slate-200 dark:divide-slate-700">
        {lista.data.map((m) => {
          const enCarga = estaEnCarga(m.estado, m.etapa)
          return (
            <li key={m.expedienteId} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 dark:text-white">
                  {NOMBRE_TIPO[m.tipo]} · Expediente {m.expediente} · Concesión {numeroConcesion(m.concesion)}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {hectareas(m.superficieActualHa)} → {m.superficieNuevaHa === null ? 'falta el plano' : hectareas(m.superficieNuevaHa)} · En {nombreOficina(m.oficinaActual)} · Iniciado{' '}
                  {formatearFecha(m.creadoEn)}
                </p>
              </div>
              {enCarga ? (
                <Button size="sm" iconRight="arrow_forward" onClick={() => navigate(ROUTES.tramites.reduccionAmpliacion.datos(m.expedienteId))}>
                  {m.etapa === 'CORRECCION' ? 'Corregir' : 'Continuar'}
                </Button>
              ) : (
                <Button size="sm" variant="secondary" iconRight="visibility" onClick={() => navigate(ROUTES.tramites.reduccionAmpliacion.circuito(m.expedienteId))}>
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
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Ampliaciones y reducciones en trámite</h2>
        {lista.isFetching && !lista.isPending && <span className="text-xs text-slate-400">Actualizando…</span>}
      </div>
      {contenido()}
    </Card>
  )
}
