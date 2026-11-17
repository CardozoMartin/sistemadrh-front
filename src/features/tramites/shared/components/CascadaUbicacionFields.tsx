import { useFormContext, useWatch } from 'react-hook-form'
import { FormSelectField, toOptions } from '@/components/form'
import { useCatalogoLocalidades } from '@/hooks/useCatalogos'

interface Props {
  /** Path del objeto que contiene departamento/localidad/distrito (ej: 'domicilios.0'). */
  prefix: string
  required?: boolean
  /** Se llama cuando cambia cualquiera de los tres niveles (ej: para resetear el suministro). */
  onUbicacionChange?: () => void
}

/** Selects dependientes Departamento → Localidad → Distrito con el catálogo de Tucumán. */
export function CascadaUbicacionFields({ prefix, required, onUbicacionChange }: Props) {
  const { control, setValue } = useFormContext()
  const { catalogo, cargando, error } = useCatalogoLocalidades()

  const names = {
    departamento: `${prefix}.departamento`,
    localidad: `${prefix}.localidad`,
    distrito: `${prefix}.distrito`,
  }
  const [departamento, localidad] = useWatch({ control, name: [names.departamento, names.localidad] }) as [string, string]

  const departamentos = catalogo ? Object.keys(catalogo) : []
  const localidades = catalogo && departamento ? Object.keys(catalogo[departamento] ?? {}) : []
  const distritos = catalogo && departamento && localidad ? (catalogo[departamento]?.[localidad] ?? []) : []

  if (error) {
    return (
      <p className="text-sm text-red-600 md:col-span-2 dark:text-red-400">
        No se pudo cargar el catálogo de departamentos, localidades y distritos.
      </p>
    )
  }

  const setOpts = { shouldDirty: true }

  return (
    <>
      <FormSelectField
        name={names.departamento}
        label="Departamento"
        required={required}
        placeholder={cargando ? 'Cargando…' : 'Seleccione un departamento'}
        options={toOptions(departamentos)}
        disabled={cargando}
        onValueChange={() => {
          setValue(names.localidad, '', setOpts)
          setValue(names.distrito, '', setOpts)
          onUbicacionChange?.()
        }}
      />
      <FormSelectField
        name={names.localidad}
        label="Localidad"
        required={required}
        placeholder={departamento ? 'Seleccione una localidad' : 'Seleccione primero un departamento'}
        options={toOptions(localidades)}
        disabled={localidades.length === 0}
        onValueChange={(loc) => {
          // Si la localidad tiene un único distrito se selecciona solo.
          const lista = catalogo?.[departamento]?.[loc] ?? []
          setValue(names.distrito, lista.length === 1 ? lista[0] : '', { ...setOpts, shouldValidate: lista.length === 1 })
          onUbicacionChange?.()
        }}
      />
      <FormSelectField
        name={names.distrito}
        label="Distrito"
        required={required}
        placeholder={localidad ? 'Seleccione un distrito' : 'Seleccione primero una localidad'}
        options={toOptions(distritos)}
        disabled={distritos.length === 0}
        onValueChange={onUbicacionChange}
      />
    </>
  )
}
