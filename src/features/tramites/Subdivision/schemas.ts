import { z } from 'zod'

const mismaResolucion = (a: string, b: string) => a.replace(/\s/g, '').toUpperCase() === b.replace(/\s/g, '').toUpperCase()

/**
 * Cierre en Catastro (prototipo resumenFinalizacion.html): se transcribe el N° de
 * resolución (tiene que coincidir con el que registró Secretaría General) y se confirma
 * que la acción es irreversible.
 */
export function crearCierreSubdivisionSchema(resolucionRegistrada: string | null) {
  return z
    .object({
      numeroResolucion: z.string().trim().min(1, 'Ingrese el número de resolución.'),
      observaciones: z.string().trim().max(500, 'Máximo 500 caracteres.'),
      confirmaIrreversible: z.boolean().refine((v) => v, 'Confirme que revisó todos los datos.'),
    })
    .superRefine((v, ctx) => {
      if (resolucionRegistrada && v.numeroResolucion && !mismaResolucion(v.numeroResolucion, resolucionRegistrada)) {
        ctx.addIssue({ code: 'custom', path: ['numeroResolucion'], message: `No coincide con la resolución registrada por Secretaría General (${resolucionRegistrada}).` })
      }
    })
}

export type CierreSubdivisionForm = z.infer<ReturnType<typeof crearCierreSubdivisionSchema>>
