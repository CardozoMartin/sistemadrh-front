import { useCallback } from 'react'
import { useFormContext } from 'react-hook-form'
import { UsosFields } from '../../../shared'
import type { PreCargaForm } from '../../schemas'

/** Sección 5: usos y magnitudes. El caudal total se vuelca al suministro. */
export function SeccionUsos() {
  const { setValue } = useFormContext<PreCargaForm>()
  const volcarCaudal = useCallback(
    (total: number) => setValue('suministro.caudalAsignado', total > 0 ? String(total) : '', { shouldDirty: true }),
    [setValue],
  )
  return <UsosFields prefix="usos" onCaudalTotalChange={volcarCaudal} />
}
