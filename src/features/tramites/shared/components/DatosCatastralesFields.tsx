import { FormSelectField, FormTextField } from '@/components/form'
import { useDominio } from '@/hooks/useDominio'
import { opcionesDe } from '../opciones'

/** Datos catastrales del inmueble (padrón, matrícula, nomenclatura). */
export function DatosCatastralesFields({ prefix }: { prefix: string }) {
  const { circunscripciones, seccionesCatastrales } = useDominio()
  const n = (campo: string) => `${prefix}.${campo}`
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <FormTextField
        name={n('padron')}
        label="Padrón"
        placeholder="Ej: 123456"
        readOnly
        className="[&_input]:bg-slate-100 [&_input]:text-slate-500 dark:[&_input]:bg-slate-900"
        hint="No editable en esta etapa."
      />
      <FormTextField name={n('matricula')} label="Matrícula" required placeholder="Ej: 001-20394" />
      <FormSelectField name={n('circunscripcion')} label="Circunscripción" placeholder="Seleccione…" options={opcionesDe(circunscripciones)} />
      <FormSelectField name={n('seccion')} label="Sección" placeholder="Seleccione una sección" options={opcionesDe(seccionesCatastrales)} />
      <FormTextField name={n('parcela')} label="Parcela" required placeholder="Ej: 14b" />
      <FormTextField name={n('lamina')} label="Lámina" placeholder="Ej: L-402" />
      <FormTextField name={n('orden')} label="Orden" placeholder="Ej: 12" />
    </div>
  )
}
