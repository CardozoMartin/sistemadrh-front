import { useFormContext, useWatch } from 'react-hook-form'
import { Alert } from '@/components/feedback/States'
import { usePuede } from '@/features/auth/components/RutaDeOficina'
import { CascadaUbicacionFields, KmlUploadField, suministroVacio } from '../../../shared'
import type { PreCargaForm } from '../../schemas'

/** Sección 2: ubicación del inmueble y KML de la concesión. */
export function SeccionUbicacion() {
  const { getValues, setValue, control } = useFormContext<PreCargaForm>()
  // El polígono cambia lo que se ve en el visor: subirlo es un permiso aparte.
  const puedeKml = usePuede()('KML_CARGAR')
  const tienePoligono = !!useWatch({ control, name: 'ubicacion.poligono' })

  // Las opciones de suministro dependen de la ubicación: si cambia, se reinicia
  // esa sección (conservando el caudal, que sale de los usos).
  function reiniciarSuministro() {
    setValue('suministro', suministroVacio(getValues('suministro.caudalAsignado')))
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <CascadaUbicacionFields prefix="ubicacion" required onUbicacionChange={reiniciarSuministro} />
      </div>
      <div className="border-t border-slate-200 pt-6 dark:border-slate-700">
        {puedeKml ? (
          <KmlUploadField name="ubicacion.poligono" />
        ) : (
          <Alert tone="info">
            {tienePoligono ? 'El polígono ya está cargado. ' : 'Todavía no hay polígono. '}
            Cargar o reemplazar el KML es un permiso aparte (cambia lo que se ve en el visor): lo hace un usuario autorizado.
          </Alert>
        )}
      </div>
    </div>
  )
}
