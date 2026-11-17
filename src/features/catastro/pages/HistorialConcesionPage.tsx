import { useMemo, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatearFecha } from '@/config/expedientes'
import { ROUTES } from '@/config/routes'
import { FichaConcesion } from '@/features/concesiones/components/FichaConcesion'
import { cadenaTitularidad, datosConcesion, titularPrincipal } from '@/features/concesiones/datos'
import { useTramitesDeConcesion } from '@/features/concesiones/hooks'
import { EstadoBadge } from '@/features/expedientes/components/EstadoBadge'
import { LineaDeTiempo } from '@/features/expedientes/components/LineaDeTiempo'
import { useExpediente } from '@/features/expedientes/hooks'
import { movimientosDe } from '@/features/expedientes/movimientos'
import { documentoConFormato, nombreTitular } from '@/features/tramites/shared/schemas/titular'
import { useDominio } from '@/hooks/useDominio'
import { cn } from '@/lib/cn'
import { esNoEncontrado } from '@/services/api/errors'
import type { Expediente } from '@/types/domain'

function Seccion({ titulo, icono, children, className }: { titulo: string; icono: string; children: ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <h3 className="flex items-center gap-2 border-b border-slate-200 px-5 py-3 text-sm font-bold text-slate-900 dark:border-slate-700 dark:text-white">
        <Icon name={icono} className="text-primary" /> {titulo}
      </h3>
      <div className="p-5">{children}</div>
    </Card>
  )
}

/**
 * Historial completo de una concesión: todos sus titulares (con desde/hasta y el
 * expediente que los cambió) y todos los trámites que tuvo a lo largo de los años, con
 * cada movimiento (quién inició, quién tomó el expediente en cada oficina, quién derivó…).
 */
export default function HistorialConcesionPage() {
  const navigate = useNavigate()
  const { concesionId } = useParams()
  const d = useDominio()
  const concesion = useExpediente(concesionId)
  const tramites = useTramitesDeConcesion(concesionId)

  // El alta + los trámites posteriores; movimientos de todos, el más reciente primero.
  const expedientes = useMemo<Expediente[]>(() => (concesion.data ? [concesion.data, ...(tramites.data ?? [])] : []), [concesion.data, tramites.data])
  const movimientos = useMemo(() => expedientes.flatMap((e) => movimientosDe(e, d)).sort((a, b) => b.fecha.localeCompare(a.fecha)), [expedientes, d])
  const porId = useMemo(() => new Map(expedientes.map((e) => [e.id, e])), [expedientes])

  if (concesion.isPending) return <LoadingState mensaje="Cargando la concesión…" />
  if (concesion.isError || !concesion.data.numeroConcesion) {
    return concesion.isError && !esNoEncontrado(concesion.error) ? (
      <ErrorState error={concesion.error} onRetry={() => void concesion.refetch()} reintentando={concesion.isFetching} />
    ) : (
      <EmptyState icon="search_off" titulo="No se encontró la concesión" descripcion="El expediente no existe o todavía no tiene número de concesión.">
        <Button size="sm" onClick={() => navigate(ROUTES.busqueda)}>
          Volver a la búsqueda
        </Button>
      </EmptyState>
    )
  }

  const c = concesion.data
  const periodos = cadenaTitularidad(c)
  const enCurso = tramites.data?.find((e) => d.estadosPendientes.includes(e.estadoId))
  const baja = c.bajaConcesion
  const subdivision = c.subdivisionConcesion
  const origen = datosConcesion(c)?.origen
  const superficies = [...(datosConcesion(c)?.superficiesAnteriores ?? [])].reverse()
  const caudal = (n: number | null) => (n == null ? '—' : `${n.toFixed(2)} l/s`)

  return (
    <>
      <PageHeader
        title={`Concesión N° ${c.numeroConcesion}`}
        description={`${titularPrincipal(c)} · ${c.ubicacion.localidad}, ${c.ubicacion.departamento} · Distrito ${c.ubicacion.distrito}`}
        actions={
          <span
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold',
              baja
                ? 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                : subdivision
                  ? 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                  : 'bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300',
            )}
          >
            {baja ? 'Anulada' : subdivision ? 'Subdividida' : 'Vigente'}
          </span>
        }
      />

      <div className="flex flex-col gap-6">
        {baja && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm dark:border-red-500/30 dark:bg-red-500/10">
            <Icon name="block" className="text-red-600" />
            <div className="text-red-800 dark:text-red-200">
              <p>
                <strong>Concesión anulada</strong> el {formatearFecha(baja.fecha)} por el expediente{' '}
                <Link to={ROUTES.expediente(baja.expedienteId)} className="font-semibold underline">
                  {baja.numeroExpediente}
                </Link>
                {baja.resolucion && ` (resolución ${baja.resolucion.numero} del ${formatearFecha(baja.resolucion.fecha)})`}. Baja lógica: los datos se
                conservan.
              </p>
              <p className="mt-1">Motivo: “{baja.motivo}”</p>
            </div>
          </div>
        )}
        {subdivision && (
          <div className="flex items-start gap-3 rounded-lg border border-slate-300 bg-slate-50 p-4 text-sm dark:border-slate-600 dark:bg-slate-800/60">
            <Icon name="call_split" className="text-slate-600 dark:text-slate-300" />
            <div className="text-slate-800 dark:text-slate-200">
              <p>
                <strong>Concesión subdividida</strong> el {formatearFecha(subdivision.fecha)} por el expediente{' '}
                <Link to={ROUTES.expediente(subdivision.expedienteId)} className="font-semibold underline">
                  {subdivision.numeroExpediente}
                </Link>
                {subdivision.resolucion && ` (resolución ${subdivision.resolucion.numero} del ${formatearFecha(subdivision.resolucion.fecha)})`}. Dejó de estar
                vigente; sus datos se conservan.
              </p>
              <p className="mt-2 flex flex-wrap gap-2">
                Concesiones nuevas:
                {subdivision.concesiones.map((n) => (
                  <Link
                    key={n.id}
                    to={ROUTES.concesion(n.id)}
                    className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-primary shadow-sm hover:underline dark:bg-slate-900"
                  >
                    N° {n.numeroConcesion} · {n.fraccion} · {n.hectareas.toFixed(2)} ha
                  </Link>
                ))}
              </p>
            </div>
          </div>
        )}
        {origen && (
          <div className="flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm dark:border-sky-500/30 dark:bg-sky-500/10">
            <Icon name="call_split" className="text-sky-600" />
            <p className="text-sky-800 dark:text-sky-200">
              Concesión otorgada por <strong>subdivisión</strong> ({origen.fraccion}) de la concesión{' '}
              <Link to={ROUTES.concesion(origen.concesionMadreId)} className="font-semibold underline">
                N° {origen.numeroConcesionMadre}
              </Link>
              , expediente{' '}
              <Link to={ROUTES.expediente(origen.expedienteId)} className="font-semibold underline">
                {origen.numeroExpediente}
              </Link>
              .
            </p>
          </div>
        )}
        {enCurso && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
            <Icon name="pending_actions" className="text-amber-600" />
            <p className="text-amber-800 dark:text-amber-200">
              <strong>{d.nombreTramite(enCurso.tramiteId)} en curso</strong> — expediente{' '}
              <Link to={ROUTES.expediente(enCurso.id)} className="font-semibold underline">
                {enCurso.numero}
              </Link>
              , en {d.nombreOficina(enCurso.oficinaId)}. La concesión sigue a nombre de {titularPrincipal(c)} hasta que el trámite termine con
              resolución y la carga final en Catastro.
            </p>
          </div>
        )}
        <Seccion titulo="Ficha de la concesión" icono="description">
          <FichaConcesion concesion={c} enlaceHistorial={false} />
        </Seccion>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="flex flex-col gap-6">
            <Seccion titulo={`Titulares a lo largo del tiempo (${periodos.length})`} icono="groups">
              <ol className="flex flex-col gap-3">
                {periodos.map((p, i) => (
                  <li
                    key={`${p.desde}-${i}`}
                    className={cn(
                      'rounded-lg border p-3',
                      p.hasta ? 'border-slate-200 dark:border-slate-700' : 'border-green-300 bg-green-50/60 dark:border-green-500/40 dark:bg-green-500/5',
                    )}
                  >
                    <p className="mb-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 uppercase dark:text-slate-400">
                      {!p.hasta ? 'Titular vigente' : i === 0 && baja ? 'Último titular (hasta la anulación)' : i === 0 && subdivision ? 'Último titular (hasta la subdivisión)' : 'Titular anterior'}
                      <span className="font-normal normal-case">
                        {formatearFecha(p.desde)} — {p.hasta ? formatearFecha(p.hasta) : 'actualidad'}
                      </span>
                    </p>
                    {p.titulares.map((t, k) => (
                      <p key={k} className="text-sm">
                        <strong className="text-slate-900 dark:text-white">{nombreTitular(t)}</strong>{' '}
                        <span className="text-slate-500 dark:text-slate-400">· {documentoConFormato(t)}</span>
                      </p>
                    ))}
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Por expediente{' '}
                      <Link to={ROUTES.expediente(p.expedienteId)} className="font-semibold text-primary hover:underline">
                        {p.numeroExpediente}
                      </Link>{' '}
                      ({d.nombreTramite(porId.get(p.expedienteId)?.tramiteId ?? (i === periodos.length - 1 ? 'alta_concesion' : 'cambio_titularidad'))})
                    </p>
                  </li>
                ))}
              </ol>
            </Seccion>

            {superficies.length > 0 && (
              <Seccion titulo={`Cambios de superficie (${superficies.length})`} icono="polyline">
                <ol className="flex flex-col gap-3">
                  {superficies.map((m) => (
                    <li key={m.expedienteId} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
                      <p className="mb-1 text-xs font-semibold text-slate-500 uppercase dark:text-slate-400">
                        {m.tipo === 'reduccion' ? 'Reducción' : 'Ampliación'} · {formatearFecha(m.fecha)}
                      </p>
                      <p>
                        <strong className="text-slate-900 dark:text-white">
                          {m.hectareas.toFixed(2)} → {m.hectareasNueva.toFixed(2)} ha
                        </strong>{' '}
                        <span className="text-slate-500 dark:text-slate-400">
                          · caudal {caudal(m.caudal)} → {caudal(m.caudalNuevo)}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Por expediente{' '}
                        <Link to={ROUTES.expediente(m.expedienteId)} className="font-semibold text-primary hover:underline">
                          {m.numeroExpediente}
                        </Link>
                        {m.resolucion && ` (resolución ${m.resolucion.numero})`}
                      </p>
                    </li>
                  ))}
                </ol>
              </Seccion>
            )}

            <Seccion titulo={`Trámites de la concesión (${expedientes.length})`} icono="folder_open">
              {tramites.isError && <ErrorState error={tramites.error} onRetry={() => void tramites.refetch()} reintentando={tramites.isFetching} />}
              <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                {expedientes.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <Link to={ROUTES.expediente(e.id)} className="text-sm font-semibold text-primary hover:underline">
                        Expediente {e.numero}
                      </Link>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {d.nombreTramite(e.tramiteId)} · {formatearFecha(e.fechaInicio)}
                        {d.estadosPendientes.includes(e.estadoId) && ` · en ${d.nombreOficina(e.oficinaId)}`}
                      </p>
                    </div>
                    <EstadoBadge estadoId={e.estadoId} />
                  </li>
                ))}
              </ul>
              {tramites.isPending && <LoadingState mensaje="Cargando trámites…" className="py-4" />}
            </Seccion>
          </div>

          <Seccion titulo="Historial completo (más reciente primero)" icono="history">
            <LineaDeTiempo
              movimientos={movimientos}
              etiqueta={(m) => (
                <Link
                  to={ROUTES.expediente(m.expedienteId)}
                  className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 hover:text-primary dark:bg-slate-800 dark:text-slate-300"
                >
                  {d.nombreTramite(porId.get(m.expedienteId)?.tramiteId ?? 'alta_concesion')} · Exp. {m.numeroExpediente}
                </Link>
              )}
            />
          </Seccion>
        </div>
      </div>
    </>
  )
}
