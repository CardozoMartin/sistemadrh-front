import { z } from 'zod'
import { esCuitValido, esFechaFutura } from '@/lib/validaciones'
import { normalizarCodigo } from './reglas'

const adjuntoSchema = z.object({ nombre: z.string(), tamanioBytes: z.number(), tipo: z.string(), url: z.string().optional() })
const requerido = (mensaje: string) => z.string().trim().min(1, mensaje)

const jurisdiccionSchema = z.object({
  jurisdiccion: requerido('Ingrese la jurisdicción.'),
  numero: requerido('Ingrese el número de inscripción.'),
  condicion: z.string().trim(),
})

const direccionTecnicaSchema = z.object({
  nombre: requerido('Ingrese el nombre del director técnico.'),
  apellido: requerido('Ingrese el apellido del director técnico.'),
  profesion: z.string().trim(),
  matricula: z.string().trim(),
  email: z.union([z.literal(''), z.email('Ingrese un email válido.')]),
  domicilio: z.string().trim(),
})

/** Datos de la empresa (alta y modificación). RF07 y RF08 del DRF; flujos 5.1, 6.1 y 7.1 del CU. */
export const datosEmpresaSchema = z
  .object({
    tipoPersona: z.enum(['juridica', 'fisica'], { error: 'Debe seleccionar el tipo de persona para continuar.' }),
    cuit: z
      .string()
      .regex(/^\d{11}$/, 'El CUIT/CUIL debe tener 11 dígitos.')
      .refine(esCuitValido, 'El CUIT/CUIL ingresado no es válido.'),
    razonSocial: z.string().trim(),
    nombre: z.string().trim(),
    apellido: z.string().trim(),
    documento: z.string().trim(),
    ingresosBrutos: z.string().trim(),
    convenioMultilateral: z.boolean(),
    // Las filas de «Ingresos multilaterales» que quedaron vacías no cuentan.
    jurisdicciones: z.preprocess(
      (v) => (Array.isArray(v) ? v.filter((j) => [j?.jurisdiccion, j?.numero, j?.condicion].some((x) => String(x ?? '').trim())) : v),
      z.array(jurisdiccionSchema),
    ),
    registroComercio: z.string().trim(),
    domicilio: requerido('Ingrese el domicilio fiscal.'),
    telefono: requerido('Ingrese un teléfono de contacto.'),
    provincia: requerido('Seleccione la provincia.'),
    departamento: requerido('Ingrese el departamento.'),
    localidad: requerido('Ingrese la localidad.'),
    resolucion: z.object({ numero: z.string().trim(), anio: z.string().trim() }),
    observaciones: z.string().trim().max(1000, 'Máximo 1000 caracteres.'),
    direccionTecnica: direccionTecnicaSchema,
    notaSolicitud: z.array(adjuntoSchema),
    documentacionLegal: z.array(adjuntoSchema),
  })
  .superRefine((v, ctx) => {
    const error = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message })
    if (v.tipoPersona === 'juridica' && !v.razonSocial) error(['razonSocial'], 'Ingrese el nombre o razón social.')
    if (v.tipoPersona === 'fisica') {
      if (!v.nombre) error(['nombre'], 'Ingrese el nombre.')
      if (!v.apellido) error(['apellido'], 'Ingrese el apellido.')
    }
    if (v.resolucion.numero && !/^\d{4}$/.test(v.resolucion.anio)) error(['resolucion', 'anio'], 'Ingrese el año de la resolución (4 dígitos).')
    if (!v.resolucion.numero && v.resolucion.anio) error(['resolucion', 'numero'], 'Ingrese el número de resolución o deje ambos vacíos.')
  })

/** Lo que se edita en pantalla (antes de descartar las filas vacías de ingresos multilaterales). */
export type DatosEmpresaCampos = z.input<typeof datosEmpresaSchema>

const fotoSchema = adjuntoSchema.extend({ dataUrl: z.string().min(1) })

/** Una máquina: código de identificación de la DRH, datos técnicos y foto (RN-07, RN-10). */
export const maquinaSchema = z.object({
  codigo: z
    .string()
    .transform(normalizarCodigo)
    .pipe(
      z
        .string()
        .min(1, 'Asigne el código de la máquina (ej: EQP-001-A).')
        .regex(/^[A-Z0-9]+(-[A-Z0-9]+)*$/, 'Solo letras, números y guiones (ej: EQP-001-A).')
        .max(20, 'Máximo 20 caracteres.'),
    ),
  modelo: requerido('Ingrese el nombre de la máquina.'),
  capacidadDiametro: z.string().trim(),
  capacidadProfundidad: z.string().trim().regex(/^(\d+(\.\d+)?)?$/, 'Solo números (metros).'),
  alturaTorre: z.string().trim().regex(/^(\d+(\.\d+)?)?$/, 'Solo números (metros).'),
  vehiculoPatente: z.string().trim().toUpperCase(),
  vehiculoModelo: z.string().trim(),
  observacion: z.string().trim().max(500, 'Máximo 500 caracteres.'),
  foto: fotoSchema.nullable().refine((f) => f !== null, 'Cargue una foto de referencia de la máquina.'),
})

export type MaquinaForm = z.input<typeof maquinaSchema>

/** Alta: datos + parque de máquinas. RN-11: al menos una máquina con código y foto. */
export const altaEmpresaSchema = z.object({
  datos: datosEmpresaSchema,
  maquinas: z
    .array(maquinaSchema)
    .min(1, 'Registre al menos una máquina con su código y foto (RN-11).')
    .superRefine((ms, ctx) => {
      const vistos = new Map<string, number>()
      ms.forEach((m, i) => {
        const previo = vistos.get(m.codigo)
        if (previo !== undefined) ctx.addIssue({ code: 'custom', path: [i, 'codigo'], message: `Código repetido (igual a la máquina ${previo + 1}).` })
        else vistos.set(m.codigo, i)
      })
    }),
})

export type AltaEmpresaCampos = z.input<typeof altaEmpresaSchema>
export type AltaEmpresaForm = z.output<typeof altaEmpresaSchema>

// --- Circuito: Jurídico y Secretaría General ---------------------------------------

const controlesCompletos = (lista: readonly string[]) =>
  z.array(z.string()).refine((v) => lista.every((c) => v.includes(c)), 'Verifique todos los puntos del control antes de aprobar.')

/** Jurídico: control legal completo + dictamen (prototipo pozo/Circuito/juridicoPozo.html). */
export const crearDictamenSchema = (controles: readonly string[]) =>
  z.object({
    controles: controlesCompletos(controles),
    texto: z.string().trim().min(10, 'Redacte el dictamen (al menos 10 caracteres).').max(2000, 'Máximo 2000 caracteres.'),
    informe: z.array(adjuntoSchema),
  })

export type DictamenForm = z.infer<ReturnType<typeof crearDictamenSchema>>

/** Secretaría General: resolución que habilita a la empresa (CU, pasos 15-16). */
export const crearResolucionSchema = (controles: readonly string[]) =>
  z.object({
    controles: controlesCompletos(controles),
    numero: z.string().trim().min(1, 'Ingrese el número de resolución.'),
    anio: z.string().regex(/^\d{4}$/, 'Ingrese el año (4 dígitos).'),
    fecha: z
      .string()
      .min(1, 'Ingrese la fecha de firma.')
      .refine((f) => !esFechaFutura(f), 'La fecha de firma no puede ser futura.'),
    archivo: z.array(adjuntoSchema).min(1, 'Adjunte la resolución firmada.'),
    observaciones: z.string().trim().max(500, 'Máximo 500 caracteres.'),
  })

export type ResolucionForm = z.infer<ReturnType<typeof crearResolucionSchema>>
