import { useMemo, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useParams } from 'react-router'
import { ROUTES } from '@/config/routes'
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Field } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { esNoEncontrado, mensajeDeError } from '@/services/api/errors'
import { TitularesDomiciliosFields } from '../../shared'
import { PasosTramite } from '../../shared/components/PasosTramite'
import { propuestaAFormulario } from '../adaptadores'
import { estaEnCarga, type CambioBackend } from '../backend.types'
import { useCambio, useCancelarCambio, useEnviarCambio, useGuardarTitularesCambio } from '../hooks'
import { crearNuevoTitularSchema, type NuevoTitularForm } from '../schemas'

type Dialogo = 'cancelar' | 'enviar' | 'enviado' | null

const TITULO = 'Pre-carga Nuevo Titular'

/** Largo mínimo del motivo para cancelar (lo mismo exige el backend). */
const MIN_MOTIVO = 10

const papeles = (n: number) => `${n} papel${n === 1 ? '' : 'es'} presentado${n === 1 ? '' : 's'}`

/**
 * Paso 2 (Catastro), caso de uso pasos 6-10: datos del o los nuevos titulares y su domicilio.
 * Es una PROPUESTA: la concesión sigue a nombre del titular actual hasta que el trámite finaliza.
 * Al confirmar, se guarda y el expediente pasa a Recaudación.
 */
export default function NuevoTitularPage() {
  const navigate = useNavigate()
  const { expedienteId } = useParams()
  const cambio = useCambio(expedienteId)

  if (cambio.isPending) {
    return (
      <>
        <PageHeader title={TITULO} />
        <LoadingState mensaje="Cargando el trámite…" />
      </>
    )
  }

  if (cambio.isError) {
    return (
      <>
        <PageHeader title={TITULO} />
        {esNoEncontrado(cambio.error) ? (
          <EmptyState icon="search_off" titulo="No se encontró el cambio de titularidad">
            <Button size="sm" onClick={() => navigate(ROUTES.tramites.cambioTitularidad.inicio)}>
              Ir al inicio del trámite
            </Button>
          </EmptyState>
        ) : (
          <ErrorState error={cambio.error} onRetry={() => void cambio.refetch()} reintentando={cambio.isFetching} />
        )}
      </>
    )
  }

  const { expediente } = cambio.data
  if (!estaEnCarga(cambio.data.cambio.estado, expediente.etapa)) {
    return (
      <>
        <PageHeader title={TITULO} />
        <EmptyState
          icon="lock"
          titulo="Este cambio ya no está en carga"
          descripcion={`Expediente ${expediente.numero}: ${cambio.data.cambio.estado === 'EN_TRAMITE' ? `está en ${expediente.oficinaNombre} (${expediente.etapaNombre})` : `quedó ${cambio.data.cambio.estado.toLowerCase()}`}.`}
        >
          <Button size="sm" onClick={() => navigate(ROUTES.tramites.cambioTitularidad.inicio)}>
            Ir al inicio del trámite
          </Button>
        </EmptyState>
      </>
    )
  }

  // key: si cambia el expediente se crea un formulario nuevo con sus datos.
  return <NuevoTitular key={expediente.id} datos={cambio.data} />
}

function NuevoTitular({ datos }: { datos: CambioBackend }) {
  const navigate = useNavigate()
  const id = datos.expediente.id
  const { cambio, expediente } = datos
  const guardar = useGuardarTitularesCambio(id)
  const enviar = useEnviarCambio(id)
  const cancelar = useCancelarCambio(id)
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const [motivo, setMotivo] = useState('')
  const motivoValido = motivo.trim().length >= MIN_MOTIVO
  const schema = useMemo(() => crearNuevoTitularSchema(cambio.titularesActuales.map((t) => t.documento ?? '')), [cambio.titularesActuales])

  const form = useForm<NuevoTitularForm>({
    resolver: zodResolver(schema),
    defaultValues: propuestaAFormulario(datos),
    mode: 'onTouched',
  })

  const ocupado = guardar.isPending || enviar.isPending || cancelar.isPending
  const errorMutacion = guardar.error ?? enviar.error ?? cancelar.error
  const pedirConfirmacion = form.handleSubmit(() => setDialogo('enviar'))

  /** «Anterior»: guarda lo cargado (si está completo) y vuelve a la búsqueda; queda en «Cambios en trámite». */
  async function anterior() {
    if (!(await form.trigger())) return navigate(ROUTES.tramites.cambioTitularidad.inicio)
    guardar.mutate(form.getValues(), { onSuccess: () => navigate(ROUTES.tramites.cambioTitularidad.inicio) })
  }

  function confirmarEnvio() {
    setDialogo(null)
    enviar.mutate(form.getValues(), { onSuccess: () => setDialogo('enviado') })
  }

  function confirmarCancelacion() {
    cancelar.mutate(motivo.trim(), {
      onSuccess: () => {
        setDialogo(null)
        navigate(ROUTES.tramites.cambioTitularidad.inicio)
      },
    })
  }

  const titularActual = cambio.titularesActuales.map((t) => t.nombreCompleto).join(', ') || '—'
  const resumen = [
    ['Expediente', expediente.numero],
    ['Concesión', cambio.concesion.numero ?? cambio.concesion.id],
    ['Titular actual', titularActual],
    ['Documentación', papeles(cambio.documentacionPresentada.length)],
  ]

  return (
    <FormProvider {...form}>
      <PageHeader
        title={TITULO}
        description="Ingrese los datos personales o jurídicos del nuevo titular. La información será validada en la siguiente etapa por el área de Recaudación."
      />

      <div className="flex flex-col gap-6">
        <PasosTramite previos={['Búsqueda']} actual={1} titulo={TITULO} />

        <Card className="flex flex-wrap gap-x-8 gap-y-2 p-4 text-sm">
          {resumen.map(([label, valor]) => (
            <span key={label}>
              <span className="text-slate-500 dark:text-slate-400">{label}: </span>
              <strong className="text-slate-900 dark:text-white">{valor}</strong>
            </span>
          ))}
        </Card>

        <Card>
          <form noValidate onSubmit={pedirConfirmacion} className="flex flex-col gap-8 p-6 md:p-8">
            <TitularesDomiciliosFields tituloTitular="Datos del Titular" />

            <div className="flex gap-3 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm dark:border-sky-500/30 dark:bg-sky-500/10">
              <Icon name="info" className="text-sky-600" />
              <div>
                <p className="mb-1 font-semibold text-sky-800 dark:text-sky-200">Información importante</p>
                <p className="text-sky-700 dark:text-sky-300">
                  El nuevo titular queda como propuesta: la concesión sigue a nombre de {titularActual} hasta que el trámite finalice con la resolución.
                </p>
              </div>
            </div>
          </form>

          {errorMutacion && (
            <div className="px-6 pb-4 md:px-8">
              <Alert>{mensajeDeError(errorMutacion)}</Alert>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 md:px-8 dark:border-slate-700 dark:bg-slate-800/40">
            <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => setDialogo('cancelar')}>
              Cancelar trámite
            </Button>
            <div className="flex gap-3">
              <Button variant="secondary" size="sm" iconLeft="arrow_back" loading={guardar.isPending} disabled={ocupado} onClick={() => void anterior()}>
                Anterior
              </Button>
              <Button size="sm" iconRight="arrow_forward" loading={enviar.isPending} disabled={ocupado} onClick={() => void pedirConfirmacion()}>
                {enviar.isPending ? 'Enviando…' : 'Siguiente'}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={dialogo === 'cancelar'}
        tone="danger"
        title="¿Cancelar el trámite?"
        message="El cambio de titularidad queda anulado (no se borra: queda en el historial con el motivo) y la concesión sigue igual."
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
          hint={`Al menos ${MIN_MOTIVO} caracteres.`}
          error={motivo && !motivoValido ? `Explique el motivo (al menos ${MIN_MOTIVO} caracteres).` : undefined}
        >
          <textarea
            id="motivo-cancelacion"
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="rounded-lg border border-slate-300 p-3 text-sm dark:border-slate-600 dark:bg-slate-900"
          />
        </Field>
      </ConfirmDialog>
      <ConfirmDialog
        open={dialogo === 'enviar'}
        title="¿Desea crear el trámite?"
        message={`Se enviará el cambio de titularidad de la concesión ${cambio.concesion.numero ?? cambio.concesion.id} (expediente ${expediente.numero}) a Recaudación.`}
        confirmLabel="Sí, enviar"
        cancelLabel="Cancelar"
        onConfirm={confirmarEnvio}
        onCancel={() => setDialogo(null)}
      />
      <ConfirmDialog
        open={dialogo === 'enviado'}
        tone="success"
        title="Trámite enviado"
        message={`El expediente ${expediente.numero} fue derivado a Recaudación.`}
        confirmLabel="Volver al inicio"
        onConfirm={() => navigate(ROUTES.tramites.cambioTitularidad.inicio)}
      />
    </FormProvider>
  )
}
