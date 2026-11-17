// Formularios de cada oficina en el circuito (reglas tomadas del prototipo). Los usan
// todos los trámites; el cierre en Catastro es propio de cada uno.
import { z } from 'zod'
import { esFechaFutura } from '@/lib/validaciones'

export const adjuntoSchema = z.object({ nombre: z.string(), tamanioBytes: z.number(), tipo: z.string(), url: z.string().optional() })

// --- Recaudación: verificación de deuda -------------------------------------------

/** `variasPersonas`: el expediente tiene más de una persona y hay que indicar quién debe. */
export function crearRecaudacionSchema(variasPersonas: boolean) {
  return z
    .object({
      deuda: z.enum(['sin_deuda', 'con_deuda']),
      /** Claves de las personas que registran deuda (ver ConfigTramite.personas). */
      personasConDeuda: z.array(z.string()),
      observaciones: z.string().trim().max(500, 'Máximo 500 caracteres.'),
      emailNotificado: z.boolean(),
    })
    .superRefine((v, ctx) => {
      if (v.deuda !== 'con_deuda') return
      if (!v.observaciones) ctx.addIssue({ code: 'custom', path: ['observaciones'], message: 'Detalle la deuda (monto, períodos).' })
      if (variasPersonas && v.personasConDeuda.length === 0) {
        ctx.addIssue({ code: 'custom', path: ['personasConDeuda'], message: 'Indique quién registra la deuda.' })
      }
    })
}
export type RecaudacionForm = z.infer<ReturnType<typeof crearRecaudacionSchema>>

// --- Distrito: informe técnico ---------------------------------------------------------

export const distritoSchema = z
  .object({
    resultado: z.enum(['apto', 'no_apto']),
    motivoNoApto: z.string().trim(),
    informes: z.array(adjuntoSchema),
    observaciones: z.string().trim().min(1, 'Ingrese el detalle técnico de la verificación.').max(500, 'Máximo 500 caracteres.'),
  })
  .superRefine((v, ctx) => {
    if (v.resultado === 'no_apto' && !v.motivoNoApto) {
      ctx.addIssue({ code: 'custom', path: ['motivoNoApto'], message: 'Indique por qué no es posible proporcionar agua.' })
    }
  })
export type DistritoForm = z.infer<typeof distritoSchema>

// --- Jurídico: dictamen -----------------------------------------------------------------

export const juridicoSchema = z
  .object({
    resultado: z.enum(['apto', 'no_apto']),
    /** Nombres de los documentos faltantes (del catálogo /documentosJuridicos o agregados a mano). */
    documentosFaltantes: z.array(z.string()),
    adjuntosRespaldo: z.array(adjuntoSchema),
    informe: z.array(adjuntoSchema),
    dictamen: z.string().trim().min(1, 'Ingrese el texto del dictamen.').max(2000, 'Máximo 2000 caracteres.'),
  })
  .superRefine((v, ctx) => {
    if (v.resultado === 'no_apto' && v.documentosFaltantes.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['documentosFaltantes'], message: 'Seleccione al menos un documento faltante.' })
    }
  })
export type JuridicoForm = z.infer<typeof juridicoSchema>

// --- Secretaría General: resolución -----------------------------------------------------

export const secretariaSchema = z.object({
  numeroResolucion: z.string().trim().min(1, 'Ingrese el número de resolución.'),
  fechaFirma: z
    .string()
    .min(1, 'Ingrese la fecha de firma.')
    .refine((f) => !esFechaFutura(f), 'La fecha de firma no puede ser futura.'),
  resolucion: z.array(adjuntoSchema),
  observaciones: z.string().trim().max(1000, 'Máximo 1000 caracteres.'),
})
export type SecretariaForm = z.infer<typeof secretariaSchema>
