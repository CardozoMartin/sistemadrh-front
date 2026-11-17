import { useController, useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { FormNumericField, FormSection, FormSelectField, FormTextareaField, FormTextField, toOptions, useFieldError } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { useCatalogoLocalidades } from '@/hooks/useCatalogos'

const PROVINCIAS = [
  'BUENOS AIRES', 'CATAMARCA', 'CHACO', 'CHUBUT', 'CIUDAD AUTÓNOMA DE BUENOS AIRES', 'CÓRDOBA', 'CORRIENTES', 'ENTRE RÍOS', 'FORMOSA', 'JUJUY',
  'LA PAMPA', 'LA RIOJA', 'MENDOZA', 'MISIONES', 'NEUQUÉN', 'RÍO NEGRO', 'SALTA', 'SAN JUAN', 'SAN LUIS', 'SANTA CRUZ', 'SANTA FE',
  'SANTIAGO DEL ESTERO', 'TIERRA DEL FUEGO', 'TUCUMÁN',
]
const TUCUMAN = 'TUCUMÁN'

/** Casilla «Persona jurídica» del prototipo (guarda tipoPersona 'juridica' / 'fisica'). */
function PersonaJuridicaCheckbox({ name }: { name: string }) {
  const { field } = useController({ name })
  return (
    <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
      <input
        type="checkbox"
        ref={field.ref}
        checked={field.value === 'juridica'}
        onChange={(e) => field.onChange(e.target.checked ? 'juridica' : 'fisica')}
        className="size-4 rounded accent-primary"
      />
      Persona jurídica
    </label>
  )
}

interface Props {
  prefix?: string
  /** Resolución vinculada (la registra Secretaría General al final del circuito). */
  resolucionVinculada?: string
}

/**
 * Datos de la empresa con los campos y el orden del prototipo
 * pozo/AgregarEmpresa/AgregarEmpresa.html: Datos generales de la empresa, Ingresos
 * multilaterales y Dirección técnica. Lo usan el alta (paso 1) y la modificación.
 */
export function EmpresaFields({ prefix = '', resolucionVinculada }: Props) {
  const n = (campo: string) => (prefix ? `${prefix}.${campo}` : campo)
  const { control, setValue } = useFormContext()
  const { catalogo, cargando, error } = useCatalogoLocalidades()
  const [tipoPersona, provincia, departamento] = useWatch({ control, name: [n('tipoPersona'), n('provincia'), n('departamento')] }) as [string, string, string]
  const ingresos = useFieldArray({ control, name: n('jurisdicciones') })
  const errorIngresos = useFieldError(n('jurisdicciones'))
  const juridica = tipoPersona === 'juridica'
  // Tucumán usa el catálogo oficial (sin provincia elegida, los desplegables esperan, como en el
  // prototipo); otras provincias (o si el catálogo no carga), texto libre.
  const sinProvincia = !provincia
  const enTucuman = (provincia === TUCUMAN || sinProvincia) && !error

  return (
    <div className="flex flex-col gap-8">
      <FormSection title="Datos generales de la empresa" icon="apartment" variant="boxed">
        <div className="flex flex-col gap-5">
          <div className="grid gap-5 md:grid-cols-[1fr_1fr_2fr]">
            <FormNumericField name={n('cuit')} label="CUIL/CUIT" required maxLength={11} placeholder="20123456789" />
            <FormNumericField name={n('documento')} label="Num. documento" maxLength={8} placeholder="37483853" />
            <FormTextField name={n('ingresosBrutos')} label="Ingresos Brutos" placeholder="Numero de inscripcion" />
          </div>

          <PersonaJuridicaCheckbox name={n('tipoPersona')} />

          {/* Persona jurídica: «Nombre» es la razón social y el apellido comercial es opcional. */}
          <div className="grid gap-5 md:grid-cols-2">
            {juridica ? (
              <FormTextField key="razonSocial" name={n('razonSocial')} label="Nombre" required placeholder="Nombre o razon social" />
            ) : (
              <FormTextField key="nombre" name={n('nombre')} label="Nombre" required placeholder="Nombre o razon social" />
            )}
            <FormTextField name={n('apellido')} label="Apellido" required={!juridica} placeholder="Apellido comercial" />
          </div>

          <div className="grid gap-5 md:grid-cols-[2fr_1fr]">
            <FormTextField name={n('domicilio')} label="Domicilio fiscal" required placeholder="Calle, numero, piso, oficina" />
            <FormTextField name={n('telefono')} label="Telefono fiscal" required type="tel" placeholder="0381-000000" />
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <FormSelectField
              name={n('provincia')}
              label="Provincia"
              required
              options={toOptions(PROVINCIAS)}
              placeholder="(SIN PROVINCIA)"
              onValueChange={() => {
                setValue(n('departamento'), '', { shouldDirty: true })
                setValue(n('localidad'), '', { shouldDirty: true })
              }}
            />
            {enTucuman ? (
              <>
                <FormSelectField
                  name={n('departamento')}
                  label="Departamento"
                  required
                  options={toOptions(Object.keys(catalogo ?? {}))}
                  placeholder={cargando ? 'Cargando…' : 'Seleccione departamento'}
                  disabled={cargando || sinProvincia}
                  onValueChange={() => setValue(n('localidad'), '', { shouldDirty: true })}
                />
                <FormSelectField
                  name={n('localidad')}
                  label="Localidad"
                  required
                  options={toOptions(Object.keys(catalogo?.[departamento] ?? {}))}
                  placeholder="Seleccione localidad"
                  disabled={!departamento || sinProvincia}
                />
              </>
            ) : (
              <>
                <FormTextField name={n('departamento')} label="Departamento" required />
                <FormTextField name={n('localidad')} label="Localidad" required />
              </>
            )}
          </div>

          {/* Resolución: la emite y la vincula Secretaría General al final del circuito (CU, pasos 15-16). */}
          <div className="grid items-end gap-4 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-4 md:grid-cols-[1fr_1fr_2fr_auto] dark:border-slate-600 dark:bg-slate-800/30">
            <FormTextField name={n('resolucion.numero')} label="Resolucion" placeholder="Numero" readOnly tabIndex={-1} />
            <FormTextField name={n('resolucion.anio')} label="Año" placeholder={String(new Date().getFullYear())} readOnly tabIndex={-1} />
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-900 dark:text-slate-200">Resolucion vinculada</span>
              <span className="flex h-11 items-center rounded-lg border border-dashed border-slate-300 px-3 text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">
                {resolucionVinculada ?? 'Ninguna seleccionada'}
              </span>
            </div>
            <Button size="sm" iconLeft="search" className="h-11" disabled title="La resolución la emite y vincula Secretaría General al final del circuito">
              Buscar Resolucion
            </Button>
            <p className="text-xs text-slate-500 md:col-span-4 dark:text-slate-400">
              {resolucionVinculada
                ? 'Resolución registrada por Secretaría General.'
                : 'Pendiente: la resolución la emite y vincula Secretaría General, después del dictamen de Jurídico.'}
            </p>
          </div>

          <FormTextField name={n('registroComercio')} label="Registro de comercio" placeholder="Matricula, folio o referencia" />
          <FormTextareaField
            name={n('observaciones')}
            label="Observaciones"
            rows={4}
            placeholder="Notas generales de habilitacion, alcance de la empresa u observaciones administrativas"
          />
        </div>
      </FormSection>

      <FormSection
        title="Ingresos multilaterales"
        icon="schema"
        variant="boxed"
        description="Agrega jurisdicciones o inscripciones multilaterales de la empresa."
        actions={
          <Button size="sm" variant="secondary" iconLeft="add" onClick={() => ingresos.append({ jurisdiccion: '', numero: '', condicion: '' })}>
            Agregar ingreso
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          {ingresos.fields.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">Sin ingresos multilaterales.</p>}
          {ingresos.fields.map((f, i) => (
            <div key={f.id} className="grid items-start gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <FormTextField name={n(`jurisdicciones.${i}.jurisdiccion`)} label="Jurisdiccion" hideLabel placeholder="Jurisdiccion" />
              <FormTextField name={n(`jurisdicciones.${i}.numero`)} label="Numero de ingreso" hideLabel placeholder="Numero de ingreso" />
              <FormTextField name={n(`jurisdicciones.${i}.condicion`)} label="Condicion o categoria" hideLabel placeholder="Condicion o categoria" />
              <Button size="sm" variant="secondary" iconLeft="delete" className="h-11 text-red-600" onClick={() => ingresos.remove(i)}>
                Quitar
              </Button>
            </div>
          ))}
          {errorIngresos && <p className="text-xs text-red-600 dark:text-red-400">{errorIngresos}</p>}
        </div>
      </FormSection>

      <FormSection title="Direccion tecnica" icon="engineering" variant="boxed">
        <div className="flex flex-col gap-5">
          <div className="grid gap-5 md:grid-cols-2">
            <FormTextField name={n('direccionTecnica.nombre')} label="Nombre" required placeholder="Nombre del director tecnico" />
            <FormTextField name={n('direccionTecnica.apellido')} label="Apellido" required placeholder="Apellido del director tecnico" />
          </div>
          <FormTextField name={n('direccionTecnica.domicilio')} label="Direccion" placeholder="Domicilio profesional o administrativo" />
          <FormTextField name={n('direccionTecnica.email')} label="Email" type="email" placeholder="direccion.tecnica@empresa.com" />
        </div>
      </FormSection>
    </div>
  )
}
