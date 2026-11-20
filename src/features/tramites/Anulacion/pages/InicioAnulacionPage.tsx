import { useState } from 'react'
import { FormProvider, useController, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router'
import { ROUTES } from '@/config/routes'
import { Alert, ErrorState, LoadingState } from '@/components/feedback/States'
import { FormTextareaField } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { AvisoObligatorios, EncabezadoTarjeta } from '@/components/ui/EncabezadoTarjeta'
import { PageHeader } from '@/components/ui/PageHeader'
import type { ConcesionEncontrada } from '@/features/catastro/consultaConcesiones'
import { toApiError } from '@/services/api/errors'
import { BuscadorVigentes } from '../../CambioDeTitularidad/components/BuscadorVigentes'
import { ChecklistDocumentacion } from '../../CambioDeTitularidad/components/ChecklistDocumentacion'
import { esNumeroOcupado } from '../../CambioDeTitularidad/errores'
import { numeroConcesion } from '../../CambioDeTitularidad/formato'
import { faltantesDelChecklist } from '../../CambioDeTitularidad/schemas'
import { NumeroExpedienteFields } from '../../shared/components/NumeroExpedienteFields'
import { PasosTramite } from '../../shared/components/PasosTramite'
import { expedienteVacio } from '../../shared/schemas/expediente'
import type { DocumentoChecklist } from '../backend.types'
import { AnulacionesEnCurso } from '../components/AnulacionesEnCurso'
import { useChecklistAnulacion, useIniciarAnulacion } from '../hooks'
import { inicioAnulacionSchema, type InicioAnulacionForm } from '../schemas'

/**
 * Paso 1 (Catastro), caso de uso pasos 1-6: búsqueda de la concesión vigente, número del
 * expediente en papel, checklist de la documentación y motivo. «Iniciar trámite» lo registra en
 * el backend (que vuelve a validar todo) y sigue con la verificación de datos.
 */
export default function InicioAnulacionPage() {
  const navigate = useNavigate()
  const checklist = useChecklistAnulacion()
  const iniciar = useIniciarAnulacion()
  const [seleccionada, setSeleccionada] = useState<ConcesionEncontrada | null>(null)
  const [faltantes, setFaltantes] = useState<DocumentoChecklist[]>([])
  const form = useForm<InicioAnulacionForm>({
    resolver: zodResolver(inicioAnulacionSchema),
    defaultValues: { concesionId: '', expediente: expedienteVacio(), documentacionPresentada: [], motivo: '' },
    mode: 'onTouched',
  })
  const documentacion = useController({ control: form.control, name: 'documentacionPresentada' })
  const motivo = useWatch({ control: form.control, name: 'motivo' })

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

  async function onSubmit(values: InicioAnulacionForm) {
    // Sin los papeles obligatorios no se inicia (el backend controla lo mismo).
    const faltan = faltantesDelChecklist(checklist.data ?? [], values.documentacionPresentada)
    setFaltantes(faltan)
    if (faltan.length) return

    const { numero, reparticion, anio } = values.expediente
    try {
      const anulacion = await iniciar.mutateAsync({
        concesionId: values.concesionId,
        expediente: { numero, reparticion, anio: Number(anio) },
        documentacionPresentada: values.documentacionPresentada,
        motivo: values.motivo,
      })
      navigate(ROUTES.tramites.anulacion.verificacion(anulacion.expediente.id))
    } catch (e) {
      // Solo «número ya registrado» va junto al campo. Los demás 409 (ya anulada, otro trámite en
      // curso…) son de la concesión y van en el aviso general.
      if (esNumeroOcupado(e)) form.setError('expediente.numero', { message: toApiError(e).message }, { shouldFocus: true })
    }
  }

  const errorGeneral = iniciar.error && !esNumeroOcupado(iniciar.error) ? iniciar.error : null

  return (
    <>
      <PageHeader
        title="Anulación de Concesión - Inicio de Trámite"
        description="Gestione la baja definitiva de una concesión. Busque la concesión, registre el expediente en papel, verifique la documentación e indique el motivo antes de iniciar el circuito."
      />

      <div className="flex flex-col gap-6">
        <PasosTramite previos={['Búsqueda']} actual={0} titulo="Búsqueda de la concesión" />

        <BuscadorVigentes seleccionada={seleccionada} onSeleccionar={seleccionar} />

        {seleccionada && (
          <Card>
            <EncabezadoTarjeta
              antetitulo="Catastro · Inicio del trámite"
              titulo={`Concesión ${numeroConcesion(seleccionada)}`}
              descripcion={`Titular actual: ${seleccionada.titular ?? '—'}${seleccionada.distrito ? ` · Distrito ${seleccionada.distrito}` : ''}`}
              icono="block"
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

                  <FormTextareaField
                    name="motivo"
                    label="Motivo de la anulación"
                    required
                    rows={3}
                    placeholder="Ej: renuncia del titular a la concesión, abandono del uso del agua, resolución judicial…"
                    hint={`${motivo.length} / 1000 caracteres · Mínimo 10. Queda en el expediente y en el historial.`}
                  />

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

        <AnulacionesEnCurso />
      </div>
    </>
  )
}
