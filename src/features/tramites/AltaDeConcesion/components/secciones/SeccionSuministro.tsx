import { useFormContext, useWatch } from 'react-hook-form'
import { SuministroFields } from '../../../shared'
import type { PreCargaForm } from '../../schemas'

/** Sección 6: suministro. Las opciones dependen de la ubicación cargada en la sección 2. */
export function SeccionSuministro() {
  const { control } = useFormContext<PreCargaForm>()
  const [departamento, localidad, distrito] = useWatch({
    control,
    name: ['ubicacion.departamento', 'ubicacion.localidad', 'ubicacion.distrito'],
  })
  return <SuministroFields prefix="suministro" ubicacion={{ departamento, localidad, distrito }} />
}
