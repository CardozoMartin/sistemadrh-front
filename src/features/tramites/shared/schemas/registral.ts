import { z } from 'zod'

const ANIO_MIN = 1900

/** Datos del Registro Inmobiliario (dominio). Todos opcionales. */
export const registralSchema = z.object({
  libro: z.string().trim(),
  folio: z.string().trim(),
  anio: z
    .string()
    .trim()
    .refine((v) => {
      if (!v) return true
      const n = Number(v)
      return /^\d{4}$/.test(v) && n >= ANIO_MIN && n <= new Date().getFullYear()
    }, `Ingrese un año entre ${ANIO_MIN} y el año actual.`),
  matricula: z.string().trim(),
  serie: z.string().trim(),
})

export type RegistralForm = z.infer<typeof registralSchema>

export const registralVacio = (): RegistralForm => ({ libro: '', folio: '', anio: '', matricula: '', serie: '' })
