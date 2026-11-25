import { useParams } from 'react-router'
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { RegistroExpediente } from '@/features/tramites/AltaDeConcesion/components/circuito/RegistroExpediente'
import { DondeEsta } from '@/features/tramites/shared/circuito/DondeEsta'
import { cn } from '@/lib/cn'
import { esNoEncontrado } from '@/services/api/errors'
import { AccionesBaja } from '../components/AccionesBaja'
import { BarraEtapasBaja } from '../components/BarraEtapasBaja'
import { ChecklistDocumentacion } from '../components/DatosBajaForm'
import { FichaPozo } from '../components/FichaPozo'
import { ESTADO_BAJA, formatoFecha, NOMBRE_ORIGEN } from '../estilos'
import { useBajaPozo } from '../hooks'

const TITULO = 'Baja de pozo'

function Dato({ etiqueta, valor, ancho }: { etiqueta: string; valor: string | null | undefined; ancho?: boolean }) {
  return (
    <div className={ancho ? 'sm:col-span-2' : undefined}>
      <dt className="text-xs font-semibold tracking-wide text-slate-400 uppercase">{etiqueta}</dt>
      <dd className="text-sm whitespace-pre-line text-slate-800 dark:text-slate-100">{valor || '—'}</dd>
    </div>
  )
}

/** Una baja en el circuito: dónde está, qué tiene que hacer la oficina, el pozo y el historial. */
export default function CircuitoBajaPage() {
  return <ExpedienteBaja consulta={false} />
}

/**
 * Desde la búsqueda general: datos, auditoría e historial, sin el panel de trabajo de la oficina
 * ni lo que hizo cada oficina (inspección e informe técnico).
 */
export function ConsultaBajaPage() {
  return <ExpedienteBaja consulta />
}

function ExpedienteBaja({ consulta }: { consulta: boolean }) {
  const { expedienteId } = useParams()
  const pedido = useBajaPozo(expedienteId)

  if (pedido.isPending) {
    return (
      <>
        <PageHeader title={TITULO} />
        <LoadingState mensaje="Cargando el expediente…" />
      </>
    )
  }
  if (pedido.isError) {
    return (
      <>
        <PageHeader title={TITULO} />
        {esNoEncontrado(pedido.error) ? (
          <EmptyState icon="search_off" titulo="No se encontró la baja" />
        ) : (
          <ErrorState error={pedido.error} onRetry={() => void pedido.refetch()} reintentando={pedido.isFetching} />
        )}
      </>
    )
  }

  const b = pedido.data
  const e = b.expediente
  return (
    <>
      <PageHeader title={`Expediente ${e.numero}`} description={`Baja del pozo ${b.pozo.idInterno}${b.pozo.alias ? ` (${b.pozo.alias})` : ''} · ${NOMBRE_ORIGEN[b.baja.origen]}`} />

      <div className="flex flex-col gap-6">
        <Card className="p-5">
          <BarraEtapasBaja b={b} />
        </Card>


        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-6">
            {consulta ? (
              <Card className="p-6">
                <DondeEsta
                  oficina={e.oficinaNombre}
                  etapa={e.etapaNombre}
                  tomadoPor={e.tomadoPor?.nombre ?? null}
                  tomadoEn={e.tomadoEn}
                  terminado={e.estado === 'FINALIZADO' || e.estado === 'RECHAZADO' ? ESTADO_BAJA[b.baja.estado].texto : null}
                />
              </Card>
            ) : (
              <Card className="p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {e.estado === 'FINALIZADO' || e.estado === 'RECHAZADO' ? 'Resultado' : `${e.oficinaNombre} · ${e.etapaNombre}`}
                  </h2>
                  {e.tomadoPor && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Lo tiene {e.tomadoPor.nombre} desde {new Date(e.tomadoEn!).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  )}
                </div>
                <AccionesBaja b={b} />
              </Card>
            )}

            <Card className="p-6">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Datos de la baja</h2>
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', ESTADO_BAJA[b.baja.estado].color)}>{ESTADO_BAJA[b.baja.estado].texto}</span>
              </div>
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <Dato etiqueta="Solicitante" valor={[b.baja.solicitanteNombre, b.baja.solicitanteDocumento].filter(Boolean).join(' · ')} />
                <Dato etiqueta="Iniciada" valor={formatoFecha(b.baja.creadoEn)} />
                <Dato ancho etiqueta="Motivo" valor={b.baja.motivo} />
              </dl>
              <div className="mt-4">
                <p className="mb-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">Documentación presentada</p>
                <ChecklistDocumentacion soloLectura valor={b.baja.documentacion.filter((d) => d.presentado).map((d) => d.codigo)} />
              </div>
              {!consulta && b.baja.informeTecnico && (
                <dl className="mt-4 grid gap-x-6 gap-y-3 border-t border-slate-100 pt-4 sm:grid-cols-2 dark:border-slate-700">
                  <Dato etiqueta="Inspección de campo" valor={b.baja.inspeccionRealizada ? `Sí, el ${formatoFecha(b.baja.fechaInspeccion!)}` : 'No'} />
                  <Dato etiqueta="Clausura física" valor={b.baja.requiereClausura === null ? null : b.baja.requiereClausura ? (b.baja.clausura ? `Hecha el ${formatoFecha(b.baja.clausura.fecha)} · acta ${b.baja.clausura.acta}` : 'Corresponde (pendiente)') : 'No corresponde'} />
                  {b.baja.observacionesInspeccion && <Dato ancho etiqueta="Qué se constató" valor={b.baja.observacionesInspeccion} />}
                  <Dato ancho etiqueta="Informe técnico" valor={b.baja.informeTecnico} />
                </dl>
              )}
              {(b.baja.anularConcesion !== null || b.baja.resolucion) && (
                <dl className="mt-4 grid gap-x-6 gap-y-3 border-t border-slate-100 pt-4 sm:grid-cols-2 dark:border-slate-700">
                  {b.baja.concesionAnterior && (
                    <Dato etiqueta="Concesión" valor={`${b.baja.concesionAnterior}: ${b.baja.anularConcesion === null ? 'sin decidir' : b.baja.anularConcesion ? 'se anula' : 'sigue vigente'}`} />
                  )}
                  <Dato etiqueta="Resolución" valor={b.baja.resolucion && `${b.baja.resolucion}${b.baja.fechaBaja ? ` del ${formatoFecha(b.baja.fechaBaja)}` : ''}`} />
                  {b.baja.avisoDistrito && (
                    <Dato etiqueta="Aviso a Distrito" valor={b.baja.avisoDistrito.visto ? `Tomó conocimiento el ${formatoFecha(b.baja.avisoDistrito.visto)}` : 'Enviado, pendiente de lectura'} />
                  )}
                </dl>
              )}
            </Card>

            <Card className="p-6">
              <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">Pozo</h2>
              <FichaPozo pozo={b.pozo} />
            </Card>
          </div>

          {/* Historial y auditoría a pedido: no ocupan la pantalla hasta que se abren. */}
          <RegistroExpediente expedienteId={e.id} />
        </div>
      </div>
    </>
  )
}
