import { useState } from 'react'
import { FormProvider, useController, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router'
import { Alert, ErrorState, LoadingState } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { AvisoObligatorios, EncabezadoTarjeta } from '@/components/ui/EncabezadoTarjeta'
import { PageHeader } from '@/components/ui/PageHeader'
import { ROUTES } from '@/config/routes'
import type { ConcesionEncontrada } from '@/features/catastro/consultaConcesiones'
import { toApiError } from '@/services/api/errors'
import { Opciones } from '../../shared/circuito/campos'
import { BuscadorVigentes } from '../../shared/components/BuscadorVigentes'
import { ChecklistDocumentacion, type DocumentoChecklist } from '../../shared/components/ChecklistDocumentacion'
import { NumeroExpedienteFields } from '../../shared/components/NumeroExpedienteFields'
import { PasosTramite } from '../../shared/components/PasosTramite'
import { useChecklist } from '../../shared/circuitoBackend/componentes'
import { numeroConcesion } from '../../shared/circuitoBackend/reglas'
import { expedienteVacio } from '../../shared/schemas/expediente'
import { esNumeroOcupado } from '../../shared/errores'
import type { TipoModificacionBackend } from '../backend.types'
import { ModificacionesEnCurso } from '../components/ModificacionesEnCurso'
import { useIniciarModificacion } from '../hooks'
import { faltantesDelChecklist, inicioModificacionSchema, type InicioModificacionForm } from '../schemas'

const TIPOS: { valor: TipoModificacionBackend; texto: string; icono: string; color: string }[] = [
  { valor: 'AMPLIACION', texto: 'Ampliación (más superficie)', icono: 'open_in_full', color: 'border-primary bg-primary/5 text-primary' },
  { valor: 'REDUCCION', texto: 'Reducción (menos superficie)', icono: 'close_fullscreen', color: 'border-primary bg-primary/5 text-primary' },
]

/**
 * Catastro, inicio (caso de uso, pasos 1-8): búsqueda de la concesión vigente, ampliación o
 * reducción, número del expediente en papel y checklist de la documentación. «Iniciar trámite» lo
 * registra en el backend (que vuelve a validar todo) y sigue con la carga del plano.
 */
export default function InicioReduccionAmpliacionPage() {
  const navigate = useNavigate()
  const checklist = useChecklist('AMPLIACION_REDUCCION')
  const iniciar = useIniciarModificacion()
  const [seleccionada, setSeleccionada] = useState<ConcesionEncontrada | null>(null)
  const [faltantes, setFaltantes] = useState<DocumentoChecklist[]>([])
  const form = useForm<InicioModificacionForm>({
    resolver: zodResolver(inicioModificacionSchema),
    defaultValues: { concesionId: '', tipo: undefined, expediente: expedienteVacio(), documentacionPresentada: [] },
    mode: 'onTouched',
  })
  const documentacion = useController({ control: form.control, name: 'documentacionPresentada' })
  const tipo = useController({ control: form.control, name: 'tipo' })

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

  async function onSubmit(values: InicioModificacionForm) {
    // Flujo alterno 4.1: sin los papeles obligatorios no se inicia (el backend controla lo mismo).
    const faltan = faltantesDelChecklist(checklist.data ?? [], values.documentacionPresentada)
    setFaltantes(faltan)
    if (faltan.length) return

    const { numero, reparticion, anio } = values.expediente
    try {
      const m = await iniciar.mutateAsync({
        concesionId: values.concesionId,
        tipo: values.tipo,
        expediente: { numero, reparticion, anio: Number(anio) },
        documentacionPresentada: values.documentacionPresentada,
      })
      navigate(ROUTES.tramites.reduccionAmpliacion.datos(m.expediente.id))
    } catch (e) {
      // Solo «número ya registrado» va junto al campo. Los demás 409 (la concesión tiene otro
      // trámite en curso, no tiene superficie registrada…) son de la concesión y van en el aviso general.
      if (esNumeroOcupado(e)) form.setError('expediente.numero', { message: toApiError(e).message }, { shouldFocus: true })
    }
  }

  const errorGeneral = iniciar.error && !esNumeroOcupado(iniciar.error) ? iniciar.error : null

  return (
    <>
      <PageHeader
        title="Ampliación / Reducción de Concesión - Inicio de Trámite"
        description="Modifique la superficie de una concesión vigente. Busque la concesión, indique si es una ampliación o una reducción, registre el expediente en papel y verifique la documentación."
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
              icono="aspect_ratio"
              extra={<AvisoObligatorios />}
            />
            {checklist.isPending ? (
              <LoadingState mensaje="Cargando el checklist…" />
            ) : checklist.isError ? (
              <ErrorState error={checklist.error} onRetry={() => void checklist.refetch()} reintentando={checklist.isFetching} className="m-6" />
            ) : (
              <FormProvider {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-7 p-6 md:p-10">
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      ¿Qué se solicita? <span className="text-red-600">*</span>
                    </p>
                    <Opciones valor={tipo.field.value ?? ''} onChange={(v) => tipo.field.onChange(v)} opciones={TIPOS} />
                    {tipo.fieldState.error && <p className="text-xs font-medium text-red-600 dark:text-red-400">{tipo.fieldState.error.message}</p>}
                  </div>

                  <NumeroExpedienteFields />

                  <ChecklistDocumentacion checklist={checklist.data} marcados={documentacion.field.value} onToggle={togglePapel} faltantes={faltantes.map((d) => d.id)} />

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

        <ModificacionesEnCurso />
      </div>
    </>
  )
}
