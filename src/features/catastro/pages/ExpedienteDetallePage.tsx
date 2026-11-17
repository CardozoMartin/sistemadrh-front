import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatearFecha } from '@/config/expedientes'
import { ROUTES } from '@/config/routes'
import { RUTA_GESTION } from '@/config/tramites'
import { CircuitoProgreso } from '@/features/expedientes/components/CircuitoProgreso'
import { EstadoBadge } from '@/features/expedientes/components/EstadoBadge'
import { HistorialExpediente } from '@/features/expedientes/components/HistorialExpediente'
import { useExpediente } from '@/features/expedientes/hooks'
import { configDeTramite } from '@/features/tramites/configs'
import { useDominio } from '@/hooks/useDominio'
import { esNoEncontrado } from '@/services/api/errors'
import { concesionDeExpediente } from '../busqueda'

function Dato({ label, children, ancho }: { label: string; children: ReactNode; ancho?: boolean }) {
  return (
    <div className={ancho ? 'col-span-2' : undefined}>
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-900 dark:text-white">{children}</p>
    </div>
  )
}

/** Consulta de un expediente desde la búsqueda: datos, dónde está y su historial completo. */
export default function ExpedienteDetallePage() {
  const navigate = useNavigate()
  const { expedienteId } = useParams()
  const d = useDominio()
  const query = useExpediente(expedienteId)

  if (query.isPending) return <LoadingState mensaje="Cargando expediente…" />
  if (query.isError) {
    return esNoEncontrado(query.error) ? (
      <EmptyState icon="search_off" titulo="No se encontró el expediente">
        <Button size="sm" onClick={() => navigate(ROUTES.busqueda)}>
          Volver a la búsqueda
        </Button>
      </EmptyState>
    ) : (
      <ErrorState error={query.error} onRetry={() => void query.refetch()} reintentando={query.isFetching} />
    )
  }

  const e = query.data
  const config = configDeTramite(e.tramiteId)
  const propios = config.datosResumen?.(e, d) ?? [{ label: 'Titular', valor: e.titular, ancho: true }]
  const Detalle = config.Detalle
  const concesionId = concesionDeExpediente(e)
  const pendiente = d.estadosPendientes.includes(e.estadoId)
  const gestion = RUTA_GESTION[e.tramiteId]

  return (
    <>
      <PageHeader
        title={`Expediente ${e.numero}`}
        description={`${d.nombreTramite(e.tramiteId)} · ${e.titular}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <EstadoBadge estadoId={e.estadoId} />
            {concesionId && (
              <Button size="sm" variant="secondary" iconLeft="history" onClick={() => navigate(ROUTES.concesion(concesionId))}>
                Historial de la concesión
              </Button>
            )}
            {pendiente && gestion && (
              <Button size="sm" iconRight="arrow_forward" onClick={() => navigate(gestion(e.id))}>
                Abrir en {d.nombreOficina(e.oficinaId)}
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-col gap-6">
        <CircuitoProgreso expediente={e} />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="flex h-fit flex-col gap-6">
            <Card>
              <h3 className="flex items-center gap-2 border-b border-slate-200 px-5 py-3 text-sm font-bold dark:border-slate-700">
                <Icon name="info" className="text-primary" /> Datos del expediente
              </h3>
              <div className="grid grid-cols-2 gap-4 p-5">
                <Dato label="Expediente">{e.numero}</Dato>
                <Dato label="N° de concesión">{e.numeroConcesion ?? '—'}</Dato>
                <Dato label="Trámite" ancho>
                  {d.nombreTramite(e.tramiteId)}
                </Dato>
                {propios.map((p) => (
                  <Dato key={p.label} label={p.label} ancho={p.ancho}>
                    {p.valor}
                  </Dato>
                ))}
                <Dato label="Ubicación" ancho>
                  {e.ubicacion.localidad}, {e.ubicacion.departamento} · Distrito {e.ubicacion.distrito}
                </Dato>
                <Dato label="Oficina actual">{d.nombreOficina(e.oficinaId)}</Dato>
                <Dato label="Resolución">{e.resolucion ? `${e.resolucion.numero} (${formatearFecha(e.resolucion.fecha)})` : '—'}</Dato>
                <Dato label="Inicio">{formatearFecha(e.fechaInicio)}</Dato>
                <Dato label="Última actualización">{formatearFecha(e.fechaActualizacion)}</Dato>
              </div>
            </Card>
            {Detalle && <Detalle expediente={e} />}
          </div>

          <Card>
            <h3 className="flex items-center gap-2 border-b border-slate-200 px-5 py-3 text-sm font-bold dark:border-slate-700">
              <Icon name="history" className="text-primary" /> Historial del expediente
            </h3>
            <div className="p-5">
              <HistorialExpediente expediente={e} />
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
