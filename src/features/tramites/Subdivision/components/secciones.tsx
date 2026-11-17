import { lazy, Suspense } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { Icon } from '@/components/ui/Icon'
import { Spinner } from '@/components/ui/Spinner'
import { SECCIONES_CON_COMPONENTE } from '../../AltaDeConcesion/components/secciones'
import type { PreCargaForm } from '../../AltaDeConcesion/schemas'
import { CascadaUbicacionFields, suministroVacio } from '../../shared'

const PolygonPreviewMap = lazy(() => import('@/components/map/PolygonPreviewMap').then((m) => ({ default: m.PolygonPreviewMap })))

/**
 * Sección 2 de una fracción: ubicación del inmueble. A diferencia del Alta no se sube
 * un KML: el polígono es el que se dibujó en el editor de fracciones (solo lectura).
 */
function SeccionUbicacionFraccion() {
  const { control, getValues, setValue } = useFormContext<PreCargaForm>()
  const poligono = useWatch({ control, name: 'ubicacion.poligono' })

  // Las opciones de suministro dependen de la ubicación: si cambia, se reinicia esa sección.
  function reiniciarSuministro() {
    setValue('suministro', suministroVacio(getValues('suministro.caudalAsignado')))
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <CascadaUbicacionFields prefix="ubicacion" required onUbicacionChange={reiniciarSuministro} />
      </div>
      <div className="flex flex-col gap-3 border-t border-slate-200 pt-6 dark:border-slate-700">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <Icon name="polyline" className="text-primary" /> Polígono de la fracción
          {poligono && <span className="font-normal text-slate-500 dark:text-slate-400">· {poligono.hectareas.toFixed(2)} ha · {poligono.coordenadas.length} vértices</span>}
        </p>
        {poligono ? (
          <Suspense fallback={<div className="flex h-60 items-center justify-center"><Spinner className="size-5 text-primary" /></div>}>
            <PolygonPreviewMap coordenadas={poligono.coordenadas} className="h-60" />
          </Suspense>
        ) : (
          <p className="text-sm text-amber-700 dark:text-amber-300">La fracción no tiene polígono: vuelva al editor de fracciones.</p>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400">El polígono se define en el editor de fracciones (paso anterior).</p>
      </div>
    </div>
  )
}

/** Las seis secciones del Alta, con la ubicación propia de la subdivisión. */
export const SECCIONES_FRACCION = SECCIONES_CON_COMPONENTE.map((s) => (s.key === 'ubicacion' ? { ...s, Component: SeccionUbicacionFraccion } : s))
