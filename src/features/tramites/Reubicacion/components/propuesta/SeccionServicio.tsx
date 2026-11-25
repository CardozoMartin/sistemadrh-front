import { useState } from 'react'
import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Alert } from '@/components/feedback/States'
import { FormTextField } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { mensajeDeError } from '@/services/api/errors'
import { CoordenadaFields } from '../../../shared/components/CoordenadaFields'
import { SuministroFields } from '../../../shared/components/SuministroFields'
import type { ReubicacionBackend } from '../../backend.types'
import { caminoSuministro, servicioADto, servicioInicial, textoPunto } from '../../formato'
import { useGuardarServicioReubicacion } from '../../hooks'
import { servicioReubicacionSchema, type ServicioReubicacionForm } from '../../schemas'
import { EncabezadoSeccion } from './EncabezadoSeccion'

/** La forma de servicio nueva (suministro y, si cambia, el punto de entrega). Se precarga con lo vigente. */
export function SeccionServicio({ datos }: { datos: ReubicacionBackend }) {
  const { reubicacion } = datos
  const { vigente } = reubicacion
  const { ubicacion } = reubicacion.concesion
  const guardar = useGuardarServicioReubicacion(datos.expediente.id)
  const [guardado, setGuardado] = useState(false)
  const form = useForm<ServicioReubicacionForm>({ resolver: zodResolver(servicioReubicacionSchema), defaultValues: servicioInicial(reubicacion), mode: 'onTouched' })
  const cambiaPunto = useWatch({ control: form.control, name: 'cambiaPuntoEntrega' })

  function onSubmit(values: ServicioReubicacionForm) {
    setGuardado(false)
    guardar.mutate(servicioADto(values), {
      onSuccess: () => {
        // Lo guardado pasa a ser el punto de partida del formulario (deja de estar «modificado»).
        form.reset(values)
        setGuardado(true)
      },
    })
  }

  return (
    <Card>
      <EncabezadoSeccion icono="water" titulo="Forma de servicio" descripcion="Por dónde llega el agua al nuevo lugar. Se precarga con lo vigente: cambie solo lo que cambia." />
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6 p-6">
          <div className="rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-700">
            <p className="mb-1 text-xs font-semibold text-slate-500 uppercase dark:text-slate-400">Vigente</p>
            <p className="text-slate-700 dark:text-slate-200">{caminoSuministro(vigente.suministro)}</p>
            <p className="text-slate-500 dark:text-slate-400">Punto de entrega: {textoPunto(vigente.puntoEntrega)}</p>
          </div>

          <SuministroFields prefix="suministro" ubicacion={{ departamento: ubicacion.departamento ?? '', localidad: ubicacion.localidad ?? '', distrito: ubicacion.distrito ?? '' }} sinCaudal />
          <p className="-mt-3 text-xs text-slate-500 dark:text-slate-400">Indique en la observación el sistema de riego (goteo, aspersión, gravedad…).</p>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <input type="checkbox" className="size-4" {...form.register('cambiaPuntoEntrega')} />
            Cambia el punto de entrega del agua (ej: la estación de bombeo)
          </label>
          {cambiaPunto && (
            <div className="grid gap-6 md:grid-cols-2">
              <CoordenadaFields name="puntoEntrega" titulo="Punto de entrega" required className="md:col-span-2" />
              <FormTextField name="puntoEntrega.referencia" label="Referencia del lugar" placeholder="Ej: estación de bombeo sobre el río Salí" className="md:col-span-2" />
            </div>
          )}

          {guardar.error && <Alert>{mensajeDeError(guardar.error)}</Alert>}
          <div className="flex items-center justify-end gap-3">
            {guardado && !form.formState.isDirty && (
              <span className="flex items-center gap-1 text-sm text-green-700 dark:text-green-300">
                <Icon name="check_circle" className="text-[18px]!" /> Guardada
              </span>
            )}
            <Button type="submit" size="sm" iconLeft="save" loading={guardar.isPending}>
              Guardar forma de servicio
            </Button>
          </div>
        </form>
      </FormProvider>
    </Card>
  )
}
