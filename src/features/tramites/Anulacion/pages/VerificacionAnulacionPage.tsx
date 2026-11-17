import { useState } from 'react'
import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { ROUTES } from '@/config/routes'
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { FormTextareaField } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { FichaConcesion } from '@/features/concesiones/components/FichaConcesion'
import type { Concesion } from '@/features/concesiones/datos'
import { useConcesion } from '@/features/concesiones/hooks'
import { useDominio } from '@/hooks/useDominio'
import { esNoEncontrado, mensajeDeError } from '@/services/api/errors'
import { PasosTramite } from '../../shared/components/PasosTramite'
import { esNumeroExpediente } from '../../shared/schemas/expediente'
import { useIniciarAnulacion } from '../hooks'
import { verificacionAnulacionSchema, type VerificacionAnulacionForm } from '../schemas'

const TITULO = 'Verificación de Datos'

/** Paso 2 (Catastro), prototipo tramiteAnulacion.html: revisar la concesión y confirmar antes de iniciar la anulación. */
export default function VerificacionAnulacionPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const concesionId = params.get('concesion') ?? ''
  const numeroExpediente = params.get('expediente') ?? ''
  const concesion = useConcesion(concesionId || undefined)

  // Sin concesión o sin expediente asignado, se vuelve a la búsqueda.
  if (!concesionId || !esNumeroExpediente(numeroExpediente)) return <Navigate to={ROUTES.tramites.anulacion.inicio} replace />

  if (concesion.isPending) {
    return (
      <>
        <PageHeader title={TITULO} />
        <LoadingState mensaje="Cargando la concesión…" />
      </>
    )
  }
  if (concesion.isError) {
    return (
      <>
        <PageHeader title={TITULO} />
        {esNoEncontrado(concesion.error) ? (
          <EmptyState icon="search_off" titulo="La concesión no está vigente" descripcion="Puede que ya se haya anulado. Vuelva a buscarla.">
            <Button size="sm" onClick={() => navigate(ROUTES.tramites.anulacion.inicio)}>
              Volver a la búsqueda
            </Button>
          </EmptyState>
        ) : (
          <ErrorState error={concesion.error} onRetry={() => void concesion.refetch()} reintentando={concesion.isFetching} />
        )}
      </>
    )
  }

  return <Verificacion concesion={concesion.data} numeroExpediente={numeroExpediente} />
}

type Dialogo = 'confirmar' | 'iniciada' | null

function Verificacion({ concesion, numeroExpediente }: { concesion: Concesion; numeroExpediente: string }) {
  const navigate = useNavigate()
  const d = useDominio()
  const iniciar = useIniciarAnulacion()
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const form = useForm<VerificacionAnulacionForm>({
    resolver: zodResolver(verificacionAnulacionSchema),
    defaultValues: { motivo: '', documentacionConfirmada: false },
    mode: 'onTouched',
  })
  const [motivo, confirmada] = useWatch({ control: form.control, name: ['motivo', 'documentacionConfirmada'] })
  const oficinaDestino = d.nombreOficina(d.etapas[1]?.oficinaId ?? 'recaudacion')

  const pedirConfirmacion = form.handleSubmit(() => setDialogo('confirmar'))

  function confirmar() {
    iniciar.mutate(
      { inicio: { concesionId: concesion.id, numeroExpediente }, verificacion: form.getValues() },
      { onSuccess: () => setDialogo('iniciada'), onError: () => setDialogo(null) },
    )
  }

  return (
    <FormProvider {...form}>
      <PageHeader title={TITULO} description="Revise los detalles del expediente seleccionado antes de iniciar la anulación." />

      <div className="flex flex-col gap-6">
        <PasosTramite previos={['Búsqueda']} actual={1} titulo="Verificación de datos" />

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon name="folder_shared" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white">Expediente N° {numeroExpediente}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Anulación de la concesión N° {concesion.numeroConcesion}</p>
              </div>
            </div>
            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 dark:bg-green-500/15 dark:text-green-300">
              Estado: Vigente
            </span>
          </div>

          <form noValidate onSubmit={pedirConfirmacion} className="flex flex-col gap-6 p-6">
            <FichaConcesion concesion={concesion} />

            <FormTextareaField
              name="motivo"
              label="Motivo de la anulación"
              required
              rows={3}
              placeholder="Ej: renuncia del titular a la concesión, abandono del uso del agua, resolución judicial…"
              hint={`${motivo.length} / 1000 caracteres · Mínimo 10. Queda en el historial de la concesión.`}
            />

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
              <input type="checkbox" {...form.register('documentacionConfirmada')} className="mt-0.5 size-4 shrink-0 accent-primary" />
              <span className="text-sm">
                <span className="block font-semibold text-slate-900 dark:text-white">Confirmar que toda la documentación necesaria está completa</span>
                <span className="text-slate-500 dark:text-slate-400">
                  Al marcar esta casilla, certifico que he revisado visualmente los documentos físicos o digitales del expediente y confirmo que cumplen con los
                  requisitos para proceder con la anulación.
                </span>
              </span>
            </label>
            {form.formState.errors.documentacionConfirmada && (
              <p className="-mt-4 text-xs font-medium text-red-600 dark:text-red-400">{form.formState.errors.documentacionConfirmada.message}</p>
            )}

            {iniciar.isError && <Alert>{mensajeDeError(iniciar.error)}</Alert>}
          </form>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-800/40">
            <Button variant="secondary" size="sm" iconLeft="arrow_back" onClick={() => navigate(ROUTES.tramites.anulacion.inicio)}>
              Volver
            </Button>
            <Button size="sm" variant="danger" iconRight="block" disabled={!confirmada} loading={iniciar.isPending} onClick={() => void pedirConfirmacion()}>
              Iniciar anulación
            </Button>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={dialogo === 'confirmar'}
        tone="danger"
        title="¿Desea iniciar la anulación?"
        message={`Esta acción no se puede deshacer. El expediente ${numeroExpediente} se derivará a ${oficinaDestino}. La concesión N° ${concesion.numeroConcesion} sigue vigente hasta que la anulación termine con resolución y la baja en Catastro.`}
        confirmLabel="Sí, iniciar"
        cancelLabel="Cancelar"
        loading={iniciar.isPending}
        onConfirm={confirmar}
        onCancel={() => setDialogo(null)}
      />
      <ConfirmDialog
        open={dialogo === 'iniciada'}
        tone="success"
        title="Anulación iniciada"
        message={`El trámite de anulación ha sido iniciado correctamente. El expediente ${numeroExpediente} fue derivado a ${oficinaDestino}.`}
        confirmLabel="Aceptar"
        onConfirm={() => navigate(ROUTES.catastro.pendientes)}
      />
    </FormProvider>
  )
}
