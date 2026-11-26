import { useState } from 'react'
import { FormProvider, useController, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router'
import { ROUTES } from '@/config/routes'
import { Alert, ErrorState, LoadingState } from '@/components/feedback/States'
import { FormSelectField, FormTextareaField } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { AvisoObligatorios, EncabezadoTarjeta } from '@/components/ui/EncabezadoTarjeta'
import { PageHeader } from '@/components/ui/PageHeader'
import type { ConcesionEncontrada } from '@/features/catastro/consultaConcesiones'
import { toApiError } from '@/services/api/errors'
import { BuscadorVigentes } from '../../shared/components/BuscadorVigentes'
import { ChecklistDocumentacion } from '../../shared/components/ChecklistDocumentacion'
import { esNumeroOcupado } from '../../shared/errores'
import { numeroConcesion } from '../../shared/formato'
import { faltantesDelChecklist } from '../../shared/checklist'
import { NumeroExpedienteFields } from '../../shared/components/NumeroExpedienteFields'
import { PasosTramite } from '../../shared/components/PasosTramite'
import { expedienteVacio } from '../../shared/schemas/expediente'
import type { DocumentoChecklist, MotivoReubicacion } from '../backend.types'
import { NotaInfo } from '../components/Avisos'
import { ReubicacionesEnCurso } from '../components/ReubicacionesEnCurso'
import { useChecklistReubicacion, useIniciarReubicacion } from '../hooks'
import { inicioReubicacionSchema, MOTIVOS_REUBICACION, type InicioReubicacionForm } from '../schemas'

/**
 * Paso 1 (Catastro), caso de uso pasos 1-9: búsqueda de la concesión vigente, número del expediente
 * en papel, checklist de la documentación y motivo. «Iniciar trámite» lo registra en el backend (que
 * vuelve a validar todo) y sigue con la propuesta (nuevo polígono y forma de servicio).
 */
export default function InicioReubicacionPage() {
  const navigate = useNavigate()
  const checklist = useChecklistReubicacion()
  const iniciar = useIniciarReubicacion()
  const [seleccionada, setSeleccionada] = useState<ConcesionEncontrada | null>(null)
  const [faltantes, setFaltantes] = useState<DocumentoChecklist[]>([])
  const form = useForm<InicioReubicacionForm>({
    resolver: zodResolver(inicioReubicacionSchema),
    defaultValues: { concesionId: '', expediente: expedienteVacio(), documentacionPresentada: [], motivo: '', motivoDetalle: '' },
    mode: 'onTouched',
  })
  const documentacion = useController({ control: form.control, name: 'documentacionPresentada' })
  const [motivo, detalle] = useWatch({ control: form.control, name: ['motivo', 'motivoDetalle'] })
  const esOtro = motivo === 'OTRO'

  function seleccionar(c: ConcesionEncontrada) {
    setSeleccionada(c)
    form.setValue('concesionId', c.id)
    // Lo que falló con la concesión anterior no vale para esta.
    iniciar.reset()
    form.clearErrors('expediente.numero')
  }

  function togglePapel(id: number) {
    const actuales = documentacion.field.value
    const nuevos = actuales.includes(id) ? actuales.filter((p) => p !== id) : [...actuales, id]
    documentacion.field.onChange(nuevos)
    if (faltantes.length) setFaltantes(faltantesDelChecklist(checklist.data ?? [], nuevos))
  }

  async function onSubmit(values: InicioReubicacionForm) {
    // Sin los papeles obligatorios no se inicia (el backend controla lo mismo).
    const faltan = faltantesDelChecklist(checklist.data ?? [], values.documentacionPresentada)
    setFaltantes(faltan)
    if (faltan.length) return

    const { numero, reparticion, anio } = values.expediente
    try {
      const reubicacion = await iniciar.mutateAsync({
        concesionId: values.concesionId,
        expediente: { numero, reparticion, anio: Number(anio) },
        documentacionPresentada: values.documentacionPresentada,
        motivo: values.motivo as MotivoReubicacion,
        ...(values.motivoDetalle ? { motivoDetalle: values.motivoDetalle } : {}),
      })
      navigate(ROUTES.tramites.reubicacion.propuesta(reubicacion.expediente.id))
    } catch (e) {
      // Solo «número ya registrado» va junto al campo. Los demás 409 (otro trámite en curso…) van en el aviso general.
      if (esNumeroOcupado(e)) form.setError('expediente.numero', { message: toApiError(e).message }, { shouldFocus: true })
    }
  }

  const errorGeneral = iniciar.error && !esNumeroOcupado(iniciar.error) ? iniciar.error : null

  return (
    <>
      <PageHeader
        title="Reubicación - Inicio de Trámite"
        description="Cambie, dentro de la misma concesión, el lugar al que llega el agua y su forma de servicio. Busque la concesión, registre el expediente en papel, verifique la documentación e indique el motivo."
      />

      <div className="flex flex-col gap-6">
        <PasosTramite previos={['Búsqueda']} actual={0} titulo="Búsqueda de la concesión" carga="Propuesta" />

        <NotaInfo>La concesión no se mueve: conserva su número, magnitud, titular y padrón. Lo que cambia es el lugar, dentro de la propiedad, al que llega el agua.</NotaInfo>

        <BuscadorVigentes seleccionada={seleccionada} onSeleccionar={seleccionar} />

        {seleccionada && (
          <Card>
            <EncabezadoTarjeta
              antetitulo="Catastro · Inicio del trámite"
              titulo={`Concesión ${numeroConcesion(seleccionada)}`}
              descripcion={`Titular actual: ${seleccionada.titular ?? '—'}${seleccionada.distrito ? ` · Distrito ${seleccionada.distrito}` : ''}`}
              icono="move_location"
              extra={<AvisoObligatorios />}
            />
            {checklist.isPending ? (
              <LoadingState mensaje="Cargando el checklist…" />
            ) : checklist.isError ? (
              <ErrorState error={checklist.error} onRetry={() => void checklist.refetch()} reintentando={checklist.isFetching} className="m-6" />
            ) : (
              <FormProvider {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-7 p-6 md:p-10">
                  <NumeroExpedienteFields autoFocus />

                  <ChecklistDocumentacion checklist={checklist.data} marcados={documentacion.field.value} onToggle={togglePapel} faltantes={faltantes.map((d) => d.id)} />

                  <div className="grid gap-6 md:grid-cols-2">
                    <FormSelectField name="motivo" label="Motivo de la reubicación" required placeholder="Seleccione el motivo" options={MOTIVOS_REUBICACION} />
                    <FormTextareaField
                      name="motivoDetalle"
                      label={esOtro ? 'Describa el motivo' : 'Detalle (optativo)'}
                      required={esOtro}
                      rows={3}
                      className="md:col-span-2"
                      placeholder="Ej: venta de una fracción del inmueble, cambio del sistema de riego…"
                      hint={`${detalle.length} / 1000 caracteres${esOtro ? ' · Mínimo 10' : ''}. Queda en el expediente y en el historial.`}
                    />
                  </div>

                  {faltantes.length > 0 && <Alert>Falta la documentación obligatoria: {faltantes.map((d) => d.descripcion).join(', ')}.</Alert>}
                  {errorGeneral && <Alert>{toApiError(errorGeneral).message}</Alert>}

                  <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-6 dark:border-slate-700">
                    <Button variant="ghost" onClick={() => setSeleccionada(null)} disabled={iniciar.isPending}>
                      Elegir otra concesión
                    </Button>
                    <Button type="submit" iconRight="arrow_forward" loading={iniciar.isPending}>
                      Iniciar trámite
                    </Button>
                  </div>
                </form>
              </FormProvider>
            )}
          </Card>
        )}

        <ReubicacionesEnCurso />
      </div>
    </>
  )
}
