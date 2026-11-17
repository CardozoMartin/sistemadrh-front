import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { FormMaskedField, FormSection, FormSelectField, FormTextField, toOptions } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { decimalPositivo } from '@/lib/mascaras'
import { aNumero, formatear } from '../calculos'
import { TIPOS_LITOLOGIA } from '../catalogos'
import type { AltaPozoForm } from '../schemas'
import { PerfilPozo } from './PerfilPozo'

type Capa = AltaPozoForm['litologia'][number]

/**
 * Pestaña «Litología»: las capas atravesadas, de la superficie hacia abajo. Tienen que ser
 * CONTINUAS: cada capa arranca donde terminó la anterior («Agregar capa» ya lo completa).
 */
export function PestanaLitologia() {
  const { control } = useFormContext<AltaPozoForm>()
  const { fields, append, remove } = useFieldArray({ control, name: 'litologia' })
  const capas = (useWatch({ control, name: 'litologia' }) ?? []) as Capa[]
  const profundidad = aNumero(useWatch({ control, name: 'construccion.profundidad' }))
  const ultimoHasta = aNumero(capas.at(-1)?.hasta) ?? (capas.length ? null : 0)

  const agregar = (hasta = '') => append({ desde: ultimoHasta === null ? '' : String(ultimoHasta), hasta, tipo: '', observacion: '' })
  const leidas = capas.flatMap((c) => {
    const desde = aNumero(c.desde)
    const hasta = aNumero(c.hasta)
    return desde !== null && hasta !== null && hasta > desde ? [{ desde, hasta, tipo: c.tipo }] : []
  })
  const fondo = Math.max(profundidad ?? 0, ...leidas.map((c) => c.hasta))

  return (
    <FormSection
      title="Litología"
      icon="layers"
      description="Capas del terreno atravesadas por la perforación, desde la superficie (0 m)."
      actions={
        <div className="flex flex-wrap gap-2">
          {profundidad !== null && ultimoHasta !== null && ultimoHasta < profundidad && (
            <Button size="sm" variant="secondary" iconLeft="auto_fix_high" onClick={() => agregar(String(profundidad))}>
              Completar hasta {formatear(profundidad)} m
            </Button>
          )}
          <Button size="sm" iconLeft="add" onClick={() => agregar()}>
            Agregar capa
          </Button>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th className="w-6" />
                <th className="px-2 py-2">Desde [m]</th>
                <th className="px-2 py-2">Hasta [m]</th>
                <th className="px-2 py-2">Tipo de capa</th>
                <th className="px-2 py-2">Obs. de geología</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {fields.map((f, i) => (
                <tr key={f.id} className="align-top">
                  <td className="pt-5 pl-2">
                    <span className="block size-3 rounded-sm" style={{ backgroundColor: TIPOS_LITOLOGIA[capas[i]?.tipo] ?? 'transparent' }} />
                  </td>
                  <td className="p-2">
                    <FormMaskedField name={`litologia.${i}.desde`} label={`Desde, capa ${i + 1}`} hideLabel mask={decimalPositivo} inputMode="decimal" />
                  </td>
                  <td className="p-2">
                    <FormMaskedField name={`litologia.${i}.hasta`} label={`Hasta, capa ${i + 1}`} hideLabel mask={decimalPositivo} inputMode="decimal" />
                  </td>
                  <td className="p-2">
                    <FormSelectField name={`litologia.${i}.tipo`} label={`Tipo, capa ${i + 1}`} hideLabel placeholder="Seleccione" options={toOptions(Object.keys(TIPOS_LITOLOGIA))} />
                  </td>
                  <td className="p-2">
                    <FormTextField name={`litologia.${i}.observacion`} label={`Observación, capa ${i + 1}`} hideLabel />
                  </td>
                  <td className="p-2 pt-3">
                    <IconButton icon="delete" label="Quitar capa" tone="danger" onClick={() => remove(i)} />
                  </td>
                </tr>
              ))}
              {!fields.length && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">
                    Sin capas cargadas. Es optativo: se completa si hay perfil litológico (planilla del perforista o del relevamiento).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <PerfilPozo profundidad={fondo} capas={leidas} />
      </div>
    </FormSection>
  )
}
