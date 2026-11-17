import { FormTextField } from '@/components/form'
import { CascadaUbicacionFields } from './CascadaUbicacionFields'

interface Props {
  /** Path del domicilio dentro del formulario (ej: 'domicilios.0'). */
  prefix: string
}

export function DomicilioFields({ prefix }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <FormTextField name={`${prefix}.calle`} label="Calle / Ruta" required placeholder="Calle o ruta" />
      <FormTextField name={`${prefix}.numero`} label="Nro / Km" placeholder="Número o kilómetro" />
      <CascadaUbicacionFields prefix={prefix} required />
    </div>
  )
}
