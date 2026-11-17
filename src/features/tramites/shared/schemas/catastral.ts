import { z } from 'zod'

/** Datos catastrales del inmueble. Circunscripción y sección son ids de sus colecciones en la API. */
export const catastralSchema = z.object({
  /** No editable en esta etapa (en el prototipo aparece deshabilitado). */
  padron: z.string(),
  matricula: z.string().trim().min(1, 'Ingrese la matrícula catastral.'),
  circunscripcion: z.string(), // id de /circunscripciones
  seccion: z.string(), // id de /seccionesCatastrales
  parcela: z.string().trim().min(1, 'Ingrese la parcela.'),
  lamina: z.string().trim(),
  orden: z.string().trim(),
})

export type CatastralForm = z.infer<typeof catastralSchema>

export const catastralVacio = (): CatastralForm => ({
  padron: '',
  matricula: '',
  circunscripcion: '',
  seccion: '',
  parcela: '',
  lamina: '',
  orden: '',
})
