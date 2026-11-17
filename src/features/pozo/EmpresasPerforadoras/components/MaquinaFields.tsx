import { FormTextareaField, FormTextField } from '@/components/form'
import { FotoMaquinaField } from './FotoMaquinaField'

/**
 * Campos de una máquina con el orden del prototipo AgregarEmpresa.html («Máquinas de la
 * empresa»): vista previa de la foto, Código de referencia · Nombre de la máquina, Foto y
 * Observación.
 */
export function MaquinaFields({ prefix }: { prefix: string }) {
  const n = (campo: string) => (prefix ? `${prefix}.${campo}` : campo)
  return (
    <div className="flex flex-col gap-4">
      <FotoMaquinaField name={n('foto')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormTextField name={n('codigo')} label="Codigo de referencia" required placeholder="EQP-001-A" hint="Patente de identificación asignada por la DRH." />
          <FormTextField name={n('modelo')} label="Nombre de la maquina" required placeholder="Perforadora Atlas Copco" />
        </div>
      </FotoMaquinaField>
      <FormTextareaField name={n('observacion')} label="Observacion" rows={4} placeholder="Estado, capacidad, uso previsto o cualquier referencia tecnica" />
    </div>
  )
}
