import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { formatearFecha } from '@/config/expedientes'
import { RUTA_GESTION } from '@/config/tramites'
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { IconButton } from '@/components/ui/IconButton'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { controlClass } from '@/components/form/styles'
import { useNotificaciones } from '@/features/notificaciones/context'
import { IndicadorConexion } from '@/features/notificaciones/components/IndicadorConexion'
import { useDominio } from '@/hooks/useDominio'
import { haceCuanto } from '@/lib/fechas'
import { cn } from '@/lib/cn'
import { mensajeDeError } from '@/services/api/errors'
import { USA_JSON_SERVER } from '@/services/demo/modo'
import type { Expediente, Oficina } from '@/types/domain'
import { etapaActual, faltaTomar, pasoSiguiente, recepcionVigente } from '../circuito'
import { useExpedientes, useRegistrarRevision, useTomarExpediente } from '../hooks'
import { EstadoBadge } from './EstadoBadge'
import { HistorialExpediente } from './HistorialExpediente'

interface BandejaOficinaProps {
  oficina: Oficina
  /** Contenido propio de la oficina entre el encabezado y la lista (ej: pedidos pendientes). */
  children?: ReactNode
}

/**
 * Bandeja de entrada de una oficina. En el modo real muestra solo lo que viene del backend
 * (children: altas, bajas…); la lista de los trámites viejos lee de json-server y solo se
 * muestra con json-server (modo demo o `npm run dev:mock`).
 */
export function BandejaOficina(props: BandejaOficinaProps) {
  return USA_JSON_SERVER ? <BandejaJsonServer {...props} /> : <BandejaBackend {...props} />
}

function BandejaBackend({ oficina, children }: BandejaOficinaProps) {
  const info = useDominio().oficina(oficina)
  return (
    <>
      <PageHeader title={`Bandeja de ${info?.nombre ?? oficina}`} description={info?.descripcionBandeja} />
      {children}
    </>
  )
}

/**
 * Bandeja de los trámites que todavía usan json-server: expedientes pendientes que están en la oficina.
 * Se actualiza sola cuando llega un expediente (evento en vivo) y marca los nuevos.
 * Los trámites con pantalla propia se abren con «Revisar»; el resto se deriva directo.
 */
function BandejaJsonServer({ oficina, children }: BandejaOficinaProps) {
  const navigate = useNavigate()
  const dominio = useDominio()
  const { vistos, marcarBandejaVista, estadoConexion } = useNotificaciones()
  const expedientes = useExpedientes(
    { oficinaId: oficina },
    { pendientes: true, refetchInterval: estadoConexion === 'en_vivo' ? false : 30_000 },
  )
  const derivar = useRegistrarRevision()
  const tomar = useTomarExpediente()
  const [abierto, setAbierto] = useState<string | null>(null)
  const [aDerivar, setADerivar] = useState<Expediente | null>(null)
  const [observaciones, setObservaciones] = useState('')

  const info = dominio.oficina(oficina)
  // TODO(login): usuario autenticado. Mientras tanto, el primer usuario de la oficina (/usuarios).
  const usuario = dominio.usuarios.find((u) => u.oficinaId === oficina)

  // Lo visto ANTES de entrar define qué se resalta como "Nuevo" durante esta visita.
  const vistoAlEntrar = useRef(vistos[oficina])
  const esNuevo = (e: Expediente) => e.fechaActualizacion > vistoAlEntrar.current

  // Mientras la bandeja está abierta, todo lo que llega se da por visto (apaga el aviso del sidebar).
  useEffect(() => {
    marcarBandejaVista(oficina)
  }, [oficina, expedientes.data, marcarBandejaVista])

  const paso = aDerivar ? pasoSiguiente(aDerivar, dominio) : null

  /** Toma el expediente (queda en su historial) y lo abre para revisarlo. */
  function tomarYAbrir(e: Expediente) {
    const etapa = etapaActual(e, dominio)
    const ruta = RUTA_GESTION[e.tramiteId]
    if (!etapa || !usuario || !ruta) return
    tomar.mutate({ expediente: e, etapaId: etapa.id, usuarioId: usuario.id }, { onSuccess: () => navigate(ruta(e.id)) })
  }

  function confirmarDerivacion() {
    if (!aDerivar || !paso || !usuario) return
    derivar.mutate(
      { expediente: aDerivar, paso, resultado: 'aprobado', usuarioId: usuario.id, observaciones: observaciones.trim() || undefined },
      {
        onSuccess: () => {
          setADerivar(null)
          setObservaciones('')
        },
      },
    )
  }

  const cantidad = expedientes.data?.length ?? 0
  const nuevos = expedientes.data?.filter(esNuevo).length ?? 0

  function contenido() {
    if (expedientes.isPending) return <LoadingState mensaje="Cargando bandeja…" />
    if (expedientes.isError) {
      return <ErrorState error={expedientes.error} onRetry={() => void expedientes.refetch()} reintentando={expedientes.isFetching} className="m-6" />
    }
    if (cantidad === 0) {
      return (
        <EmptyState
          icon="inbox"
          titulo="La bandeja está vacía"
          descripcion="Cuando un expediente llegue a esta oficina aparecerá acá y se avisará con una notificación."
          className="m-6"
        />
      )
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Expediente</th>
              <th className="px-4 py-3">Trámite</th>
              <th className="px-4 py-3">Titular</th>
              <th className="px-4 py-3">Ubicación</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Llegó</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {expedientes.data.map((e) => {
              const nuevo = esNuevo(e)
              const siguiente = pasoSiguiente(e, dominio)
              const expandido = abierto === e.id
              const recepcion = recepcionVigente(e, dominio)
              return (
                <Fragment key={e.id}>
                  <tr className={cn('transition-colors', nuevo ? 'bg-primary/5' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40')}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {nuevo && <span className="size-2 animate-pulse rounded-full bg-primary" aria-hidden="true" />}
                        <span className="font-semibold tabular-nums">{e.numero}</span>
                        {nuevo && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white uppercase">Nuevo</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">{dominio.nombreTramite(e.tramiteId)}</td>
                    <td className="px-4 py-3">{e.titular}</td>
                    <td className="px-4 py-3">
                      <span className="block">{e.ubicacion.localidad}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{e.ubicacion.departamento}</span>
                    </td>
                    <td className="px-4 py-3">
                      <EstadoBadge estadoId={e.estadoId} />
                      {recepcion && (
                        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                          Tomado por {dominio.usuario(recepcion.usuarioId)?.nombre ?? recepcion.usuarioId}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" title={formatearFecha(e.fechaActualizacion)}>
                      {haceCuanto(e.fechaActualizacion)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <IconButton
                          icon={expandido ? 'expand_less' : 'history'}
                          label={expandido ? 'Ocultar historial' : 'Ver historial'}
                          onClick={() => setAbierto(expandido ? null : e.id)}
                        />
                        {RUTA_GESTION[e.tramiteId] ? (
                          faltaTomar(e, dominio) ? (
                            <Button
                              size="sm"
                              iconLeft="pan_tool"
                              loading={tomar.isPending && tomar.variables?.expediente.id === e.id}
                              disabled={tomar.isPending}
                              title="Queda registrado en el historial del expediente"
                              onClick={() => tomarYAbrir(e)}
                            >
                              Tomar
                            </Button>
                          ) : (
                            <Button size="sm" iconRight="arrow_forward" onClick={() => navigate(RUTA_GESTION[e.tramiteId]!(e.id))}>
                              Revisar
                            </Button>
                          )
                        ) : (
                          siguiente && (
                            <Button size="sm" iconRight={siguiente.accion === 'finalizar' ? 'task_alt' : 'send'} onClick={() => setADerivar(e)}>
                              {siguiente.etiqueta}
                            </Button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandido && (
                    <tr className="bg-slate-50/60 dark:bg-slate-800/30">
                      <td colSpan={7} className="px-6 py-4">
                        <HistorialExpediente expediente={e} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title={`Bandeja de ${info?.nombre ?? oficina}`}
        description={info?.descripcionBandeja}
        actions={<IndicadorConexion className="rounded-full border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-surface-dark" />}
      />

      {children}

      <Card>
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 md:px-6 dark:border-slate-700">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            <strong>{cantidad}</strong> pendiente{cantidad === 1 ? '' : 's'}
            {nuevos > 0 && <span className="ml-2 font-semibold text-primary">· {nuevos} nuevo{nuevos === 1 ? '' : 's'}</span>}
          </p>
          {expedientes.isFetching && !expedientes.isPending && <Spinner className="size-4 text-primary" />}
        </div>
        {tomar.isError && <Alert className="m-4">{mensajeDeError(tomar.error)}</Alert>}
        {contenido()}
      </Card>

      <ConfirmDialog
        open={!!aDerivar}
        title={paso?.accion === 'finalizar' ? '¿Finalizar el trámite?' : `¿${paso?.etiqueta ?? 'Derivar'}?`}
        message={
          paso?.accion === 'finalizar'
            ? `El expediente ${aDerivar?.numero ?? ''} se dará por finalizado.`
            : `El expediente ${aDerivar?.numero ?? ''} pasará a la bandeja de ${paso?.destino ? dominio.nombreOficina(paso.destino) : ''}, que recibirá un aviso.`
        }
        confirmLabel={paso?.accion === 'finalizar' ? 'Finalizar' : 'Derivar'}
        cancelLabel="Cancelar"
        loading={derivar.isPending}
        onCancel={() => {
          setADerivar(null)
          derivar.reset()
        }}
        onConfirm={confirmarDerivacion}
      >
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Observaciones (opcional)
          <textarea
            rows={3}
            value={observaciones}
            onChange={(ev) => setObservaciones(ev.target.value)}
            placeholder="Ej: Deuda verificada, sin observaciones."
            className={controlClass({ className: 'resize-y' })}
          />
        </label>
        {usuario && (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Queda registrado a nombre de {usuario.nombre} ({info?.nombre}).
          </p>
        )}
        {derivar.isError && <Alert className="mt-3">{mensajeDeError(derivar.error)}</Alert>}
      </ConfirmDialog>
    </>
  )
}
