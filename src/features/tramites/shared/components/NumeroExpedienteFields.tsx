import { FormNumericField, FormTextField } from '@/components/form'

interface Props {
  /** Path del objeto { numero, reparticion, anio } en el formulario. */
  name?: string
  autoFocus?: boolean
}

/**
 * Número de expediente físico en tres campos: número, repartición (precargada con la de
 * la DRH) y año, que es el año en curso y no se edita. Ver schemas/expediente.ts.
 */
export function NumeroExpedienteFields({ name = 'expediente', autoFocus }: Props) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-3 w-full border-b border-slate-200 pb-2 text-base font-bold text-slate-900 dark:border-slate-700 dark:text-white">
        Número de expediente
      </legend>
      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3">
        <FormNumericField name={`${name}.numero`} label="Número" required icon="tag" maxLength={6} placeholder="Ej: 1234" autoFocus={autoFocus} />
        <FormNumericField name={`${name}.reparticion`} label="Repartición" required maxLength={4} placeholder="Ej: 332" />
        <FormTextField name={`${name}.anio`} label="Año" icon="lock" readOnly tabIndex={-1} title="El expediente es del año en curso" />
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">Expediente físico del trámite. El año es el año en curso.</p>
    </fieldset>
  )
}
