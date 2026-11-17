import { FormNumericField, FormTextField } from '@/components/form'

/** Datos de inscripción en el Registro Inmobiliario. */
export function DatosRegistralesFields({ prefix }: { prefix: string }) {
  const n = (campo: string) => `${prefix}.${campo}`
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <FormTextField name={n('libro')} label="Libro" placeholder="Ej: 124" />
      <FormTextField name={n('folio')} label="Folio" placeholder="Ej: 450" />
      <FormNumericField name={n('anio')} label="Año" maxLength={4} placeholder="Ej: 2023" />
      <FormTextField name={n('matricula')} label="Matrícula" placeholder="Número de matrícula" />
      <FormTextField name={n('serie')} label="Serie" placeholder="Ej: A-123456" />
    </div>
  )
}
