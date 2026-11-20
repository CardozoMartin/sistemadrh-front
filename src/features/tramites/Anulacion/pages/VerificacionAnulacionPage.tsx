import { useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ROUTES } from '@/config/routes'
import { formatearFecha } from '@/config/expedientes'
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Field } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { useFichaConcesion, type FichaConcesion } from '@/features/catastro/consultaConcesiones'
import { esNoEncontrado, mensajeDeError } from '@/services/api/errors'
import { nombres, numeroConcesion } from '../../CambioDeTitularidad/formato'
import { errorMotivoCancelacion, MIN_MOTIVO_CANCELACION, motivoCancelacionValido } from '../../shared/circuito/motivo'
import { PasosTramite } from '../../shared/components/PasosTramite'
import type { AnulacionBackend } from '../backend.types'
import { dondeQuedo, estaEnCarga } from '../formato'
import { useAnulacion, useCancelarAnulacion, useEnviarAnulacion } from '../hooks'

type Dialogo = 'cancelar' | 'enviar' | 'enviada' | null

const TITULO = 'Verificación de Datos'

/**
 * Paso 2 (Catastro), caso de uso pasos 7-8: los datos de la concesión (titular, ubicación, vigencia,
 * resolución, uso autorizado y superficie) y el motivo. «Iniciar anulación» la envía a Recaudación.
 * La concesión sigue vigente hasta que la anulación termine.
 */
export default function VerificacionAnulacionPage() {
  const navigate = useNavigate()
  const { expedienteId } = useParams()
  const anulacion = useAnulacion(expedienteId)

  if (anulacion.isPending) {
    return (
      <>
        <PageHeader title={TITULO} />
        <LoadingState mensaje="Cargando el trámite…" />
      </>
    )
  }

  if (anulacion.isError) {
    return (
      <>
        <PageHeader title={TITULO} />
        {esNoEncontrado(anulacion.error) ? (
          <EmptyState icon="search_off" titulo="No se encontró la anulación">
            <Button size="sm" onClick={() => navigate(ROUTES.tramites.anulacion.inicio)}>
              Ir al inicio del trámite
            </Button>
          </EmptyState>
        ) : (
          <ErrorState error={anulacion.error} onRetry={() => void anulacion.refetch()} reintentando={anulacion.isFetching} />
        )}
      </>
    )
  }

  const { expediente } = anulacion.data
  const { estado } = anulacion.data.anulacion
  if (!estaEnCarga(estado, expediente.etapa)) {
    return (
      <>
        <PageHeader title={TITULO} />
        <EmptyState
          icon="lock"
          titulo="Esta anulación ya no está en Catastro"
          descripcion={dondeQuedo(estado, expediente)}
        >
          <Button size="sm" onClick={() => navigate(ROUTES.tramites.anulacion.inicio)}>
            Ir al inicio del trámite
          </Button>
        </EmptyState>
      </>
    )
  }

  return <Verificacion datos={anulacion.data} />
}

function Verificacion({ datos }: { datos: AnulacionBackend }) {
  const navigate = useNavigate()
  const id = datos.expediente.id
  const { anulacion, expediente } = datos
  const ficha = useFichaConcesion(anulacion.concesion.id)
  const enviar = useEnviarAnulacion(id)
  const cancelar = useCancelarAnulacion(id)
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const [motivoCancelacion, setMotivoCancelacion] = useState('')
  const motivoValido = motivoCancelacionValido(motivoCancelacion)

  const ocupado = enviar.isPending || cancelar.isPending
  const errorMutacion = enviar.error ?? cancelar.error
  const concesion = numeroConcesion(anulacion.concesion)

  function confirmarEnvio() {
    enviar.mutate(undefined, { onSuccess: () => setDialogo('enviada'), onError: () => setDialogo(null) })
  }

  function confirmarCancelacion() {
    cancelar.mutate(motivoCancelacion.trim(), {
      onSuccess: () => {
        setDialogo(null)
        navigate(ROUTES.tramites.anulacion.inicio)
      },
    })
  }

  return (
    <>
      <PageHeader title={TITULO} description="Revise los detalles de la concesión antes de iniciar la anulación." />

      <div className="flex flex-col gap-6">
        <PasosTramite previos={['Búsqueda']} actual={1} titulo="Verificación de datos" />

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon name="folder_shared" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white">Expediente N° {expediente.numero}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Anulación de la concesión {concesion}</p>
              </div>
            </div>
            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 dark:bg-green-500/15 dark:text-green-300">
              Estado: {ficha.data?.estadoNombre ?? 'Vigente'}
            </span>
          </div>

          <div className="flex flex-col gap-6 p-6">
            {ficha.isPending ? (
              <LoadingState mensaje="Cargando los datos de la concesión…" className="py-6" />
            ) : ficha.isError ? (
              <ErrorState error={ficha.error} onRetry={() => void ficha.refetch()} reintentando={ficha.isFetching} />
            ) : (
              <DatosConcesion ficha={ficha.data} titulares={nombres(anulacion.titulares)} />
            )}

            <Seccion titulo="Motivo de la anulación">
              <p className="text-sm whitespace-pre-line text-slate-700 dark:text-slate-200">{anulacion.motivo}</p>
            </Seccion>

            <Seccion titulo={`Documentación presentada (${anulacion.documentacionPresentada.length})`}>
              <ul className="grid gap-1 text-sm text-slate-700 sm:grid-cols-2 dark:text-slate-200">
                {anulacion.documentacionPresentada.map((d) => (
                  <li key={d.id} className="flex items-center gap-2">
                    <Icon name="check_circle" className="text-[18px]! text-green-600" />
                    {d.descripcion}
                  </li>
                ))}
              </ul>
            </Seccion>

            <div className="flex gap-3 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm dark:border-sky-500/30 dark:bg-sky-500/10">
              <Icon name="info" className="text-sky-600" />
              <p className="text-sky-700 dark:text-sky-300">
                La concesión {concesion} sigue vigente hasta que la anulación termine con la resolución de Secretaría General y la baja en Catastro.
              </p>
            </div>

            {errorMutacion && <Alert>{mensajeDeError(errorMutacion)}</Alert>}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-800/40">
            <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => setDialogo('cancelar')}>
              Cancelar trámite
            </Button>
            <div className="flex gap-3">
              <Button variant="secondary" size="sm" iconLeft="arrow_back" disabled={ocupado} onClick={() => navigate(ROUTES.tramites.anulacion.inicio)}>
                Volver
              </Button>
              <Button size="sm" variant="danger" iconRight="block" loading={enviar.isPending} disabled={ocupado} onClick={() => setDialogo('enviar')}>
                Iniciar anulación
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={dialogo === 'cancelar'}
        tone="danger"
        title="¿Cancelar el trámite?"
        message="La anulación queda cancelada (no se borra: queda en el historial con el motivo) y la concesión sigue vigente."
        confirmLabel="Sí, cancelar trámite"
        cancelLabel="Volver"
        loading={cancelar.isPending}
        onConfirm={() => {
          if (motivoValido) confirmarCancelacion()
        }}
        onCancel={() => setDialogo(null)}
      >
        <Field
          id="motivo-cancelacion"
          label="Motivo"
          required
          hint={`Al menos ${MIN_MOTIVO_CANCELACION} caracteres.`}
          error={errorMotivoCancelacion(motivoCancelacion)}
        >
          <textarea
            id="motivo-cancelacion"
            rows={3}
            value={motivoCancelacion}
            onChange={(e) => setMotivoCancelacion(e.target.value)}
            className="rounded-lg border border-slate-300 p-3 text-sm dark:border-slate-600 dark:bg-slate-900"
          />
        </Field>
      </ConfirmDialog>
      <ConfirmDialog
        open={dialogo === 'enviar'}
        tone="danger"
        title="¿Desea iniciar la anulación?"
        message={`El expediente ${expediente.numero} se derivará a Recaudación. La concesión ${concesion} sigue vigente hasta que la anulación termine.`}
        confirmLabel="Sí, iniciar"
        cancelLabel="Cancelar"
        loading={enviar.isPending}
        onConfirm={confirmarEnvio}
        onCancel={() => setDialogo(null)}
      />
      <ConfirmDialog
        open={dialogo === 'enviada'}
        tone="success"
        title="Anulación iniciada"
        message={`El trámite de anulación se inició correctamente. El expediente ${expediente.numero} fue derivado a Recaudación.`}
        confirmLabel="Volver al inicio"
        onConfirm={() => navigate(ROUTES.tramites.anulacion.inicio)}
      />
    </>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{titulo}</h3>
      {children}
    </section>
  )
}

function Dato({ label, valor }: { label: string; valor: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-900 dark:text-white">{valor || <span className="text-slate-400">—</span>}</dd>
    </div>
  )
}

/** Caso de uso, paso 7: titular, ubicación, vigencia, resolución (decreto), uso autorizado y superficie total. */
function DatosConcesion({ ficha, titulares }: { ficha: FichaConcesion; titulares: string }) {
  const { ubicacion, resolucion, poligono } = ficha
  const otorgada = ficha.fechaOtorgamiento ? formatearFecha(ficha.fechaOtorgamiento) : ficha.anioOtorgamiento
  return (
    <Seccion titulo="Datos de la concesión">
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        <Dato label="Titular" valor={titulares} />
        <Dato label="Ubicación" valor={[ubicacion.localidad, ubicacion.departamento, ubicacion.distrito && `Distrito ${ubicacion.distrito}`].filter(Boolean).join(' · ')} />
        <Dato label="Vigencia" valor={`${ficha.estadoNombre}${otorgada ? ` · otorgada ${ficha.fechaOtorgamiento ? 'el' : 'en'} ${otorgada}` : ''}`} />
        <Dato label="Resolución / decreto" valor={resolucion && `${resolucion.numero}/${resolucion.anio}${resolucion.fecha ? ` del ${formatearFecha(resolucion.fecha)}` : ''}`} />
        <Dato label="Uso autorizado" valor={ficha.usos.map((u) => u.nombre).join(', ')} />
        <Dato label="Superficie total" valor={poligono && `${poligono.superficieHa.toLocaleString('es-AR')} ha`} />
      </dl>
    </Seccion>
  )
}
