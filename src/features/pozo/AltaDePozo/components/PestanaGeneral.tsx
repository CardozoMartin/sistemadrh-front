import { Field, FormMaskedField, FormSection, FormSelectField, FormTextField, Input, toOptions } from '@/components/form'
import { soloDigitos } from '@/lib/mascaras'
import { ESTADOS_POZO_ALTA, MOTIVOS_OFICIO } from '../catalogos'

/** Dato que no se carga acá (lo pone el sistema u otra oficina): se muestra fijo. */
function CampoFijo({ id, label, valor, hint }: { id: string; label: string; valor: string; hint: string }) {
  return (
    <Field id={id} label={label} hint={hint}>
      <Input id={id} value={valor} readOnly disabled />
    </Field>
  )
}

/**
 * Pestaña «General»: datos del registro de oficio (sin autorización previa, todo se carga acá)
 * y del solicitante del servicio. El número de registro lo pone el sistema al guardar.
 */
export function PestanaGeneral() {
  return (
    <div className="flex flex-col gap-8">
      <FormSection title="Datos del registro" icon="gavel" description="Registro de oficio: sin autorización de perforación previa, todos los datos se cargan en esta ficha.">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <CampoFijo id="registro-numero" label="N.° de registro" valor="Lo asigna el sistema al guardar" hint="De oficio el número lo genera el sistema (OF-0001/año)." />
          <FormSelectField name="general.motivo" label="Motivo del registro" required placeholder="Seleccione…" options={toOptions(MOTIVOS_OFICIO)} />
          <FormTextField name="general.fechaIngreso" label="Fecha de ingreso" type="date" required />
          <FormSelectField name="general.estado" label="Estado del pozo" options={[...ESTADOS_POZO_ALTA]} />
          <FormSelectField
            name="general.jurisdiccionDrh"
            label="Jurisdicción DRH"
            options={[
              { value: 'si', label: 'Sí' },
              { value: 'no', label: 'No (escuelas, freatímetros, consumo humano)' },
            ]}
            hint="Los pozos fuera de la jurisdicción se registran pero no generan concesión."
          />
          <CampoFijo id="registro-concesion" label="N.° de concesión" valor="Lo asigna Catastro" hint="Solo Catastro puede asignar o modificar este número." />
        </div>
      </FormSection>

      <FormSection title="Causante" icon="person" description="Titular o responsable del pozo.">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <FormTextField name="general.causante" label="Causante" required placeholder="Apellido y nombre o razón social" />
          <FormMaskedField name="general.documento" label="CUIT / DNI del causante" mask={soloDigitos} maxLength={11} inputMode="numeric" placeholder="20123456789" hint="Sin guiones: 7 u 8 dígitos (DNI) u 11 (CUIT)." />
          <FormTextField name="general.domicilio" label="Domicilio del causante" />
          <FormTextField name="general.telefono" label="Teléfono de contacto" placeholder="0381-000000" />
          <FormTextField name="general.empresa" label="Empresa perforadora (si se conoce)" />
          <FormTextField name="general.asunto" label="Asunto" placeholder="Descripción breve del asunto" />
        </div>
      </FormSection>

      <FormSection title="Datos del solicitante del servicio" icon="badge">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <FormTextField name="general.alias" label="Alias" placeholder="Nombre, razón social o alias operativo" />
          <FormTextField name="general.telefonoServicio" label="Teléfono" placeholder="0381-000000" />
        </div>
      </FormSection>
    </div>
  )
}
