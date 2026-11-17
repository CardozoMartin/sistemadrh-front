import type { ReactNode } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { Field, FormMaskedField, FormSection, FormTextField, Input } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { decimalConSigno, decimalPositivo } from '@/lib/mascaras'
import { aNumero, caudalEspecifico, depresion, formatear, m3hALps } from '../calculos'
import type { AltaPozoForm } from '../schemas'

/** Valor calculado (no se edita: sale de los que carga el operador). */
function Derivado({ id, label, valor, unidad, ayuda }: { id: string; label: string; valor: number | null; unidad: string; ayuda: string }) {
  return (
    <Field id={id} label={label} hint={ayuda}>
      <div className="flex items-center gap-2">
        <Input id={id} value={formatear(valor, 3)} placeholder="—" readOnly tabIndex={-1} className="bg-slate-50 font-semibold tabular-nums dark:bg-slate-800/60" />
        <span className="shrink-0 text-xs text-slate-500">{unidad}</span>
      </div>
    </Field>
  )
}

function Paso({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-8 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{n}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/**
 * Pestaña «Hidráulicos»: el monitoreo hidráulico (con su fecha: queda en el historial del pozo,
 * no se pisa con los siguientes), el ensayo de bombeo y el equipo.
 *   RN-08: l/s = m³/h ÷ 3,6.   RN-09: caudal específico = caudal de bombeo ÷ depresión.
 */
export function PestanaHidraulicos() {
  const { control, setValue } = useFormContext<AltaPozoForm>()
  const h = useWatch({ control, name: 'hidraulico' }) as AltaPozoForm['hidraulico']
  const caudal = aNumero(h.caudalM3h)
  const s = depresion(aNumero(h.nivelEstatico), aNumero(h.nivelDinamico))
  const regimen = h.regimenEditado ? aNumero(h.regimenM3h) : caudal

  function modificarRegimen(editar: boolean) {
    setValue('hidraulico.regimenEditado', editar, { shouldDirty: true })
    setValue('hidraulico.regimenM3h', editar ? h.caudalM3h : '', { shouldDirty: true })
  }

  return (
    <div className="flex flex-col gap-8">
      <FormSection title="Monitoreo hidráulico" icon="water" description="Cada monitoreo se guarda con su fecha: los próximos no pisan a este, quedan en el historial del pozo.">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <FormTextField name="hidraulico.fecha" label="Fecha del monitoreo" type="date" />
        </div>
      </FormSection>

      <FormSection title="Ensayo de bombeo" icon="speed" description="Los niveles van negativos bajo la boca del pozo (positivos solo si es surgente). Depresión, l/s y caudal específico se calculan solos.">
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
          <Paso n={1}>
            <FormMaskedField name="hidraulico.nivelEstatico" label="Nivel estático [m]" mask={decimalConSigno} inputMode="decimal" placeholder="Ej: -68,6" />
          </Paso>
          <Paso n={2}>
            <FormMaskedField name="hidraulico.nivelDinamico" label="Nivel dinámico [m]" mask={decimalConSigno} inputMode="decimal" placeholder="Ej: -88" />
          </Paso>
          <Paso n={3}>
            <Derivado id="hid-depresion" label="Depresión (s)" valor={s} unidad="m" ayuda="Separación entre los dos niveles." />
          </Paso>
          <Paso n={4}>
            <div className="grid grid-cols-2 gap-3">
              <FormMaskedField name="hidraulico.caudalM3h" label="Caudal de bombeo" mask={decimalPositivo} inputMode="decimal" hint="m³/h (unidad de campo)" />
              <Derivado id="hid-lps" label="En l/s" valor={m3hALps(caudal)} unidad="l/s" ayuda="m³/h ÷ 3,6 (RN-08)" />
            </div>
          </Paso>
          <Paso n={5}>
            <Derivado id="hid-especifico" label="Caudal específico (Q)" valor={caudalEspecifico(caudal, s)} unidad="m³/h/m" ayuda="Caudal de bombeo ÷ depresión (RN-09)." />
          </Paso>
        </div>
      </FormSection>

      <FormSection title="Equipo de bombeo" icon="settings_input_component">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <FormMaskedField name="hidraulico.profundidadBomba" label="Profundidad de la bomba [m]" mask={decimalPositivo} inputMode="decimal" />
          <FormMaskedField name="hidraulico.nivelCementacion" label="Nivel de cementación [m]" mask={decimalPositivo} inputMode="decimal" />
          <FormTextField name="hidraulico.tipoBomba" label="Tipo de bomba" placeholder="Ej: sumergible" />
        </div>
        <div className="mt-6 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-[1fr_1fr_auto]">
            {h.regimenEditado ? (
              <FormMaskedField name="hidraulico.regimenM3h" label="Régimen de bombeo diario [m³/h]" mask={decimalPositivo} inputMode="decimal" />
            ) : (
              <Derivado id="hid-regimen" label="Régimen de bombeo diario" valor={regimen} unidad="m³/h" ayuda="Toma el caudal de bombeo." />
            )}
            <Derivado id="hid-regimen-lps" label="Régimen en l/s" valor={m3hALps(regimen)} unidad="l/s" ayuda="m³/h ÷ 3,6" />
            {h.regimenEditado ? (
              <Button size="sm" variant="secondary" iconLeft="undo" onClick={() => modificarRegimen(false)}>
                Volver al caudal de bombeo
              </Button>
            ) : (
              <Button size="sm" variant="secondary" iconLeft="edit" onClick={() => modificarRegimen(true)}>
                Modificar
              </Button>
            )}
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Icon name={h.regimenEditado ? 'edit' : 'function'} className="text-[16px]!" />
            {h.regimenEditado ? 'Régimen declarado a mano: ya no sigue al caudal de bombeo.' : 'Por defecto el pozo se explota al caudal aforado. Use «Modificar» solo si el régimen declarado es otro (menos horas, equipo limitado).'}
          </p>
        </div>
      </FormSection>
    </div>
  )
}
