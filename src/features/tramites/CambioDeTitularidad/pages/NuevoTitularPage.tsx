import { useMemo, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useParams } from 'react-router'
import { ROUTES } from '@/config/routes'
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { titularesDe, titularPrincipal, type Concesion } from '@/features/concesiones/datos'
import { useConcesion } from '@/features/concesiones/hooks'
import { useDominio } from '@/hooks/useDominio'
import { esNoEncontrado, mensajeDeError } from '@/services/api/errors'
import { TitularesDomiciliosFields } from '../../shared'
import { PasosTramite } from '../../shared/components/PasosTramite'
import { useBorradorCambio, useEliminarBorradorCambio, useEnviarCambio, useGuardarDatosCambio } from '../hooks'
import { crearNuevoTitularSchema, nuevoTitularVacio, type NuevoTitularForm } from '../schemas'
import type { BorradorCambioTitularidad } from '../types'

type Dialogo = 'cancelar' | 'enviar' | 'enviado' | null

const TITULO = 'Pre-carga Nuevo Titular'

/** Paso 2 (Catastro), prototipo preCargaTitular.html: datos del nuevo titular. Al seguir, el expediente pasa a Recaudación. */
export default function NuevoTitularPage() {
  const navigate = useNavigate()
  const { borradorId } = useParams()
  const borrador = useBorradorCambio(borradorId)
  const concesion = useConcesion(borrador.data?.concesionId)

  if (borrador.isPending || (borrador.isSuccess && concesion.isPending)) {
    return (
      <>
        <PageHeader title={TITULO} />
        <LoadingState mensaje="Cargando el trámite…" />
      </>
    )
  }

  const error = borrador.error ?? concesion.error
  if (error) {
    return (
      <>
        <PageHeader title={TITULO} />
        {esNoEncontrado(error) ? (
          <EmptyState
            icon="search_off"
            titulo={borrador.isError ? 'No se encontró la carga' : 'La concesión ya no está vigente'}
            descripcion={
              borrador.isError
                ? 'Puede que ya se haya enviado a la siguiente oficina o que haya sido descartada.'
                : 'Descarte esta carga e inicie el trámite sobre una concesión vigente.'
            }
          >
            <Button size="sm" onClick={() => navigate(ROUTES.tramites.cambioTitularidad.inicio)}>
              Ir al inicio del trámite
            </Button>
          </EmptyState>
        ) : (
          <ErrorState
            error={error}
            onRetry={() => void (borrador.isError ? borrador.refetch() : concesion.refetch())}
            reintentando={borrador.isFetching || concesion.isFetching}
          />
        )}
      </>
    )
  }

  // key: si cambia el borrador se crea un formulario nuevo con sus datos.
  return <NuevoTitular key={borrador.data!.id} borrador={borrador.data!} concesion={concesion.data!} />
}

function NuevoTitular({ borrador, concesion }: { borrador: BorradorCambioTitularidad; concesion: Concesion }) {
  const navigate = useNavigate()
  const dominio = useDominio()
  const guardar = useGuardarDatosCambio(borrador.id)
  const enviar = useEnviarCambio()
  const eliminar = useEliminarBorradorCambio()
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  // Oficina que recibe el trámite: la segunda etapa del circuito (/etapas).
  const oficinaDestino = dominio.nombreOficina(dominio.etapas[1]?.oficinaId ?? 'recaudacion')
  const titularesActuales = useMemo(() => titularesDe(concesion), [concesion])
  const schema = useMemo(() => crearNuevoTitularSchema(titularesActuales.map((t) => t.documento)), [titularesActuales])

  const form = useForm<NuevoTitularForm>({
    resolver: zodResolver(schema),
    defaultValues: borrador.datos ?? nuevoTitularVacio(),
    mode: 'onTouched',
  })

  const ocupado = guardar.isPending || enviar.isPending || eliminar.isPending
  const errorMutacion = guardar.error ?? enviar.error ?? eliminar.error

  const pedirConfirmacion = form.handleSubmit(() => setDialogo('enviar'))

  /** «Anterior»: guarda lo cargado y vuelve a la búsqueda (la carga queda en «Cambios en carga»). */
  function anterior() {
    guardar.mutate(form.getValues(), { onSuccess: () => navigate(ROUTES.tramites.cambioTitularidad.inicio) })
  }

  function confirmarEnvio() {
    setDialogo(null)
    enviar.mutate({ borrador, datos: form.getValues(), concesion }, { onSuccess: () => setDialogo('enviado') })
  }

  function descartar() {
    setDialogo(null)
    eliminar.mutate(borrador.id, { onSuccess: () => navigate(ROUTES.tramites.cambioTitularidad.inicio) })
  }

  const resumen = [
    ['Expediente', borrador.numeroExpediente],
    ['Concesión', concesion.numeroConcesion ?? borrador.numeroConcesion],
    ['Titular actual', titularPrincipal(concesion)],
    ['Ubicación', `${concesion.ubicacion.localidad}, ${concesion.ubicacion.departamento} · Distrito ${concesion.ubicacion.distrito}`],
  ]

  return (
    <FormProvider {...form}>
      <PageHeader
        title={TITULO}
        description={`Ingrese los datos personales o jurídicos del nuevo titular. La información será validada en la siguiente etapa por el área de ${oficinaDestino}.`}
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
                <p className="text-sky-700 dark:text-sky-300">Recuerde que para continuar, deberá tener toda la documentación respaldatoria.</p>
              </div>
            </div>
          </form>

          {errorMutacion && (
            <div className="px-6 pb-4 md:px-8">
              <Alert>{mensajeDeError(errorMutacion)}</Alert>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 md:px-8 dark:border-slate-700 dark:bg-slate-800/40">
            <Button variant="ghost" size="sm" disabled={ocupado} loading={eliminar.isPending} onClick={() => setDialogo('cancelar')}>
              Cancelar trámite
            </Button>
            <div className="flex gap-3">
              <Button variant="secondary" size="sm" iconLeft="arrow_back" loading={guardar.isPending} disabled={ocupado} onClick={anterior}>
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
        message="Se descartará el cambio de titularidad en curso y se perderán los datos cargados."
        confirmLabel="Sí, descartar"
        cancelLabel="Volver"
        onConfirm={descartar}
        onCancel={() => setDialogo(null)}
      />
      <ConfirmDialog
        open={dialogo === 'enviar'}
        title="¿Desea crear el trámite?"
        message={`Se iniciará el cambio de titularidad de la concesión ${concesion.numeroConcesion} (expediente ${borrador.numeroExpediente}). El expediente se derivará a ${oficinaDestino}.`}
        confirmLabel="Sí, crear trámite"
        cancelLabel="Cancelar"
        onConfirm={confirmarEnvio}
        onCancel={() => setDialogo(null)}
      />
      <ConfirmDialog
        open={dialogo === 'enviado'}
        tone="success"
        title="Trámite creado"
        message={`El expediente ${borrador.numeroExpediente} se registró y fue derivado a ${oficinaDestino}.`}
        confirmLabel="Ver seguimiento"
        onConfirm={() => navigate(ROUTES.catastro.pendientes)}
      />
    </FormProvider>
  )
}
