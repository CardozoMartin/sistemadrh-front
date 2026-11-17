// Datos de un titular (persona física o jurídica). Lo reutilizan todos los trámites
// que cargan titulares: alta, cambio de titularidad, permisos, etc.
import { z } from 'zod'
import { esCuitValido, esFechaFutura, esTelefonoValido } from '@/lib/validaciones'

export const TIPOS_PERSONA = [
  { value: 'fisica', label: 'Persona Física' },
  { value: 'juridica', label: 'Persona Jurídica' },
] as const

export const TIPOS_DOCUMENTO = [
  { value: 'dni', label: 'DNI' },
  { value: 'cuil', label: 'CUIL' },
  { value: 'cuit', label: 'CUIT' },
] as const

export type TipoPersona = (typeof TIPOS_PERSONA)[number]['value']
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number]['value']

export interface ReglaDocumento {
  label: 'DNI' | 'CUIL' | 'CUIT'
  min: number
  max: number
  placeholder: string
}

/** Persona jurídica siempre usa CUIT; persona física elige DNI, CUIL o CUIT. */
export function getReglaDocumento(tipoPersona: TipoPersona, tipoDocumento: TipoDocumento): ReglaDocumento {
  if (tipoPersona === 'juridica') return { label: 'CUIT', min: 11, max: 11, placeholder: 'Ej: 30123456789' }
  if (tipoDocumento === 'cuil') return { label: 'CUIL', min: 11, max: 11, placeholder: 'Ej: 20123456789' }
  if (tipoDocumento === 'cuit') return { label: 'CUIT', min: 11, max: 11, placeholder: 'Ej: 20123456789' }
  return { label: 'DNI', min: 7, max: 8, placeholder: 'Ej: 30123456' }
}

export function validarDocumento(valor: string, regla: ReglaDocumento): string | null {
  const { label, min, max } = regla
  if (!valor) return `Ingrese un ${label}.`
  if (!/^\d+$/.test(valor)) return `El campo ${label} solo permite números.`
  if (valor.length < min || valor.length > max) {
    return min === max ? `El ${label} debe tener ${max} números.` : `El ${label} debe tener entre ${min} y ${max} números.`
  }
  if (label !== 'DNI' && !esCuitValido(valor)) return `El ${label} no es válido (dígito verificador incorrecto).`
  return null
}

export const titularSchema = z
  .object({
    tipoPersona: z.enum(['fisica', 'juridica']),
    tipoDocumento: z.enum(['dni', 'cuil', 'cuit']),
    documento: z.string().trim(),
    // Contacto: obligatorio siempre (por ahí llegan los avisos del trámite).
    correo: z.string().trim().min(1, 'Ingrese el correo electrónico.').pipe(z.email('Ingrese un correo electrónico válido.')),
    telefono: z.string().trim().min(1, 'Ingrese el teléfono de contacto.').refine(esTelefonoValido, 'Ingrese un teléfono válido (entre 7 y 15 números, con código de área).'),
    // Persona física
    apellido: z.string().trim(),
    nombre: z.string().trim(),
    fechaNacimiento: z.string(),
    // Persona jurídica
    razonSocial: z.string().trim(),
    fechaConstitucion: z.string(),
  })
  .superRefine((t, ctx) => {
    const issue = (path: keyof typeof t, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })

    const errorDoc = validarDocumento(t.documento, getReglaDocumento(t.tipoPersona, t.tipoDocumento))
    if (errorDoc) issue('documento', errorDoc)

    if (t.tipoPersona === 'fisica') {
      if (!t.apellido) issue('apellido', 'Ingrese el apellido.')
      if (!t.nombre) issue('nombre', 'Ingrese el nombre.')
      if (!t.fechaNacimiento) issue('fechaNacimiento', 'Ingrese la fecha de nacimiento.')
      else if (esFechaFutura(t.fechaNacimiento)) issue('fechaNacimiento', 'La fecha no puede ser futura.')
    } else {
      if (!t.razonSocial) issue('razonSocial', 'Ingrese la razón social.')
      if (!t.fechaConstitucion) issue('fechaConstitucion', 'Ingrese la fecha de constitución.')
      else if (esFechaFutura(t.fechaConstitucion)) issue('fechaConstitucion', 'La fecha no puede ser futura.')
    }
  })

export type TitularForm = z.infer<typeof titularSchema>

/** "DNI: 12.345.678" o "CUIT: 30-71008239-8", como en los listados del prototipo. */
export function documentoConFormato(t: Pick<TitularForm, 'tipoPersona' | 'tipoDocumento' | 'documento'>): string {
  const tipo = t.tipoPersona === 'juridica' ? 'CUIT' : t.tipoDocumento.toUpperCase()
  const d = t.documento
  if (/^\d{11}$/.test(d)) return `${tipo}: ${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`
  if (/^\d{7,8}$/.test(d)) return `${tipo}: ${Number(d).toLocaleString('es-AR')}`
  return `${tipo}: ${d || '—'}`
}

/** Nombre para mostrar en listados: "Apellido, Nombre" o la razón social. */
export function nombreTitular(t: Pick<TitularForm, 'tipoPersona' | 'apellido' | 'nombre' | 'razonSocial'>): string {
  return t.tipoPersona === 'juridica' ? t.razonSocial : [t.apellido, t.nombre].filter(Boolean).join(', ')
}

export const titularVacio = (): TitularForm => ({
  tipoPersona: 'fisica',
  tipoDocumento: 'dni',
  documento: '',
  correo: '',
  telefono: '',
  apellido: '',
  nombre: '',
  fechaNacimiento: '',
  razonSocial: '',
  fechaConstitucion: '',
})
