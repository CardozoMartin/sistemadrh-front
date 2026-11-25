import { useState } from 'react'
import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { Alert } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { mensajeDeError } from '@/services/api/errors'
import { KmlUploadField } from '../../../shared/components/KmlUploadField'
import type { PoligonoForm } from '../../../shared/schemas/poligono'
import type { ReubicacionBackend } from '../../backend.types'
import { useGuardarPoligonoReubicacion } from '../../hooks'
import { ListaAvisos } from '../Avisos'
import { ComparacionPoligono } from '../ComparacionReubicacion'
import { EncabezadoSeccion } from './EncabezadoSeccion'

/** El nuevo lugar al que llega el agua: el KML / GeoJSON del plano, comparado con el polígono vigente. */
export function SeccionPoligono({ datos }: { datos: ReubicacionBackend }) {
  const { reubicacion } = datos
  const { vigente, propuesta } = reubicacion
  const guardar = useGuardarPoligonoReubicacion(datos.expediente.id)
  const [avisosArchivo, setAvisosArchivo] = useState<string[]>([])
  const form = useForm<{ poligono: PoligonoForm | null }>({ defaultValues: { poligono: null } })
  const elegido = useWatch({ control: form.control, name: 'poligono' })

  function onGuardar() {
    if (!elegido?.contenido) return
    guardar.mutate(
      { nombre: elegido.nombreArchivo, contenido: elegido.contenido },
      {
        onSuccess: (r) => {
          setAvisosArchivo(r.avisosArchivo)
          form.reset({ poligono: null })
        },
      },
    )
  }

  return (
    <Card>
      <EncabezadoSeccion icono="polyline" titulo="Nuevo lugar al que llega el agua" descripcion="El KML / GeoJSON del plano de reubicación." />
      <div className="flex flex-col gap-5 p-6">
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <Icon name="warning" className="shrink-0" />
          <p>
            El nuevo polígono tiene que quedar <strong>dentro de la propiedad del solicitante</strong>
            {reubicacion.concesion.padron ? ` (padrón ${reubicacion.concesion.padron})` : ''}: verifíquelo con el plano de reubicación. La magnitud no cambia, así que la superficie debería ser la misma.
          </p>
        </div>

        <FormProvider {...form}>
          <KmlUploadField name="poligono" titulo={propuesta.poligono ? 'Reemplazar el KML propuesto' : 'KML del nuevo lugar'} />
        </FormProvider>
        {elegido?.contenido && (
          <div className="flex justify-end">
            <Button size="sm" iconLeft="save" loading={guardar.isPending} onClick={onGuardar}>
              Guardar polígono
            </Button>
          </div>
        )}
        {guardar.error && <Alert>{mensajeDeError(guardar.error)}</Alert>}
        <ListaAvisos titulo="Lectura del archivo" avisos={avisosArchivo} tono="info" />

        {propuesta.poligono && <ComparacionPoligono vigente={vigente.poligono} propuesto={propuesta.poligono} />}
        <ListaAvisos titulo="Revise antes de enviar" avisos={reubicacion.avisos} />
      </div>
    </Card>
  )
}
