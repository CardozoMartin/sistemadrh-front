import { FormSection, FormTextareaField, FormTextField } from '@/components/form'

/** Pestaña «Otras características»: cómo se identifica el pozo en el campo. */
export function PestanaOtras() {
  return (
    <FormSection title="Otras características del pozo" icon="info">
      <div className="grid grid-cols-1 gap-6">
        <FormTextField name="otras.nombrePozo" label="Número o nombre del pozo (asignado por el dueño)" placeholder="Ej: Pozo 2 - Lote norte" />
        <FormTextareaField
          name="otras.caracteristicas"
          label="Otras características identificatorias"
          rows={4}
          placeholder="Referencias de campo, señalización, acceso, particularidades de identificación o notas útiles"
        />
      </div>
    </FormSection>
  )
}
