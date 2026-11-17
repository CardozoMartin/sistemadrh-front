// Campos conectados a react-hook-form. Se usan dentro de un <FormProvider>:
//   <FormTextField name="titulares.0.apellido" label="Apellido" />
// Se encargan solos del registro, el estado de error y la accesibilidad.
import { useEffect, type ComponentProps } from 'react'
import { get, useController, useFormContext, useFormState } from 'react-hook-form'
import { soloDigitos } from '@/lib/mascaras'
import { describedBy, Field } from './Field'
import { controlClass } from './styles'
import { Input } from './Input'
import { RadioCardGroup } from './RadioCardGroup'
import { Select, type Option } from './Select'

interface BaseFieldProps {
  name: string
  label: string
  required?: boolean
  hint?: string
  hideLabel?: boolean
  /** Clases del contenedor (ej: 'md:col-span-2'). */
  className?: string
}

/** Mensaje de error de un campo (soporta paths anidados como 'titulares.0.documento'). */
export function useFieldError(name: string): string | undefined {
  const { errors } = useFormState({ name })
  return get(errors, name)?.message as string | undefined
}

// ---------------------------------------------------------------------------

type TextFieldProps = BaseFieldProps & Omit<ComponentProps<'input'>, 'name' | 'className' | 'required'> & { icon?: string }

export function FormTextField({ name, label, required, hint, hideLabel, className, id = name, ...inputProps }: TextFieldProps) {
  const { register } = useFormContext()
  const error = useFieldError(name)
  return (
    <Field id={id} label={label} required={required} hint={hint} hideLabel={hideLabel} error={error} className={className}>
      <Input id={id} invalid={!!error} aria-describedby={describedBy(id, error, hint)} {...inputProps} {...register(name)} />
    </Field>
  )
}

// ---------------------------------------------------------------------------

type MaskedFieldProps = BaseFieldProps &
  Omit<ComponentProps<'input'>, 'name' | 'className' | 'required' | 'value' | 'onChange'> & {
    /** Limpia el texto en cada tecla (ver lib/mascaras.ts). */
    /** Limpia lo tipeado; recibe también el valor anterior (ej: para ignorar una tecla de más). */
    mask: (valor: string, anterior: string) => string
    icon?: string
  }

/** Input de texto que filtra lo que se escribe con una máscara (dígitos, coordenadas, decimales…). */
export function FormMaskedField({ name, label, required, hint, hideLabel, className, mask, maxLength, id = name, ...inputProps }: MaskedFieldProps) {
  const { field } = useController({ name })
  const error = useFieldError(name)
  return (
    <Field id={id} label={label} required={required} hint={hint} hideLabel={hideLabel} error={error} className={className}>
      <Input
        id={id}
        type="text"
        autoComplete="off"
        maxLength={maxLength}
        invalid={!!error}
        aria-describedby={describedBy(id, error, hint)}
        {...inputProps}
        ref={field.ref}
        name={field.name}
        value={(field.value as string | undefined) ?? ''}
        onBlur={field.onBlur}
        onChange={(e) => {
          const limpio = mask(e.target.value, (field.value as string | undefined) ?? '')
          field.onChange(maxLength ? limpio.slice(0, maxLength) : limpio)
        }}
      />
    </Field>
  )
}

type NumericFieldProps = Omit<MaskedFieldProps, 'mask' | 'maxLength'> & { maxLength: number }

/** Input que solo acepta dígitos y corta en `maxLength` mientras se escribe. */
export function FormNumericField(props: NumericFieldProps) {
  return <FormMaskedField inputMode="numeric" mask={soloDigitos} {...props} />
}

// ---------------------------------------------------------------------------

type TextareaFieldProps = BaseFieldProps & Omit<ComponentProps<'textarea'>, 'name' | 'className' | 'required'>

export function FormTextareaField({ name, label, required, hint, hideLabel, className, id = name, rows = 3, ...props }: TextareaFieldProps) {
  const { register } = useFormContext()
  const error = useFieldError(name)
  return (
    <Field id={id} label={label} required={required} hint={hint} hideLabel={hideLabel} error={error} className={className}>
      <textarea
        id={id}
        rows={rows}
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={controlClass({ invalid: !!error, className: 'resize-y' })}
        {...props}
        {...register(name)}
      />
    </Field>
  )
}

// ---------------------------------------------------------------------------

type SelectFieldProps = BaseFieldProps &
  Omit<ComponentProps<'select'>, 'name' | 'className' | 'required'> & {
    options: readonly Option[]
    placeholder?: string
    /** Se llama después de actualizar el valor (útil para selects en cascada). */
    onValueChange?: (value: string) => void
  }

export function FormSelectField({
  name,
  label,
  required,
  hint,
  hideLabel,
  className,
  options,
  placeholder,
  onValueChange,
  id = name,
  ...selectProps
}: SelectFieldProps) {
  const { register, getValues, setValue } = useFormContext()
  const error = useFieldError(name)
  // Si las opciones llegan después que el valor (catálogos asíncronos en un formulario
  // precargado), el <select> queda mostrando el placeholder: se vuelve a aplicar el valor.
  const claves = options.map((o) => o.value).join('|')
  useEffect(() => {
    const actual = getValues(name)
    if (actual) setValue(name, actual)
  }, [claves, name, getValues, setValue])
  return (
    <Field id={id} label={label} required={required} hint={hint} hideLabel={hideLabel} error={error} className={className}>
      <Select
        id={id}
        options={options}
        placeholder={placeholder}
        invalid={!!error}
        aria-describedby={describedBy(id, error, hint)}
        {...selectProps}
        {...register(name, { onChange: (e) => onValueChange?.(e.target.value) })}
      />
    </Field>
  )
}

// ---------------------------------------------------------------------------

type RadioCardFieldProps = Omit<BaseFieldProps, 'label'> & {
  options: readonly Option[]
  onValueChange?: (value: string) => void
}

export function FormRadioCardGroup({ name, options, onValueChange, className }: RadioCardFieldProps) {
  const { field } = useController({ name })
  const error = useFieldError(name)
  return (
    <div className={className}>
      <RadioCardGroup
        ref={field.ref}
        name={field.name}
        options={options}
        value={field.value as string | undefined}
        onBlur={field.onBlur}
        onChange={(v) => {
          field.onChange(v)
          onValueChange?.(v)
        }}
        invalid={!!error}
      />
      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
