import { useFieldArray, useFormContext } from 'react-hook-form'
import { FormMaskedField, FormSection, FormSelectField, toOptions } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { decimalPositivo } from '@/lib/mascaras'
import { UNIDADES_USO, USOS_AGUA } from '../catalogos'
import type { AltaPozoForm } from '../schemas'

/** Pestaña «Uso del agua»: para qué se usa el agua del pozo y cuánto. */
export function PestanaUsos() {
  const { control } = useFormContext<AltaPozoForm>()
  const { fields, append, remove } = useFieldArray({ control, name: 'usos' })
  return (
    <FormSection
      title="Uso del agua"
      icon="water_drop"
      description="Un renglón por uso. El uso define después el caudal tributario que liquida Catastro."
      actions={
        <Button size="sm" iconLeft="add" disabled={fields.length >= USOS_AGUA.length} onClick={() => append({ uso: '', cantidad: '', unidad: 'M3/H' })}>
          Agregar uso
        </Button>
      }
    >
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-2 py-2">Uso del agua</th>
              <th className="px-2 py-2">Cantidad</th>
              <th className="px-2 py-2">Unidad</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {fields.map((f, i) => (
              <tr key={f.id} className="align-top">
                <td className="p-2">
                  <FormSelectField name={`usos.${i}.uso`} label={`Uso ${i + 1}`} hideLabel placeholder="Seleccione" options={toOptions(USOS_AGUA)} />
                </td>
                <td className="p-2">
                  <FormMaskedField name={`usos.${i}.cantidad`} label={`Cantidad, uso ${i + 1}`} hideLabel mask={decimalPositivo} inputMode="decimal" />
                </td>
                <td className="p-2">
                  <FormSelectField name={`usos.${i}.unidad`} label={`Unidad, uso ${i + 1}`} hideLabel options={toOptions(UNIDADES_USO)} />
                </td>
                <td className="p-2 pt-3">
                  <IconButton icon="delete" label="Quitar uso" tone="danger" onClick={() => remove(i)} />
                </td>
              </tr>
            ))}
            {!fields.length && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-sm text-slate-500">
                  Sin usos cargados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </FormSection>
  )
}
