import { FormMaskedField, FormSection, FormSelectField, FormTextField, toOptions } from '@/components/form'
import { decimalConSigno } from '@/lib/mascaras'
import { CascadaUbicacionFields } from '@/features/tramites/shared/components/CascadaUbicacionFields'
import { CoordenadaFields } from '@/features/tramites/shared/components/CoordenadaFields'
import { CUENCAS_SUBTERRANEAS, CUENCAS_SUPERFICIALES } from '../catalogos'

/**
 * Pestaña «Ubicación»: cuencas, lugar y georreferenciación. La coordenada sigue el criterio
 * único del sistema (X/Y POSGAR 2007 faja 3 o latitud/longitud), así el pozo se dibuja en el
 * mismo mapa que las concesiones y los desagües.
 */
export function PestanaUbicacion() {
  return (
    <div className="flex flex-col gap-8">
      <FormSection title="Ubicación del pozo" icon="location_on">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <FormSelectField name="ubicacion.cuencaSuperficial" label="Cuenca superficial" placeholder="(Sin cuenca)" options={toOptions(CUENCAS_SUPERFICIALES)} />
          <FormSelectField name="ubicacion.cuencaSubterranea" label="Cuenca subterránea" placeholder="(Sin cuenca)" options={toOptions(CUENCAS_SUBTERRANEAS)} />
          <FormTextField name="ubicacion.paraje" label="Paraje" />
          <FormTextField name="ubicacion.comuna" label="Comuna" />
          <FormTextField name="ubicacion.zona" label="Zona" />
        </div>
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
          <CascadaUbicacionFields prefix="ubicacion" required />
        </div>
      </FormSection>

      <FormSection title="Georreferenciación" icon="my_location" description="Coordenadas de la boca del pozo. No puede haber dos pozos en la misma coordenada.">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <CoordenadaFields name="ubicacion.coordenada" titulo="Pozo" required className="md:col-span-2" />
          <FormMaskedField name="ubicacion.cota" label="Cota (m s. n. m.)" mask={decimalConSigno} inputMode="decimal" placeholder="Ej: 452" />
        </div>
      </FormSection>
    </div>
  )
}
