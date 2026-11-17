import { z } from 'zod'

/** Código de repartición de la DRH. Se precarga, pero queda editable (el expediente puede venir de otra). */
export const REPARTICION_DRH = '332'

/** El año del expediente es siempre el año en curso (no se edita). */
export const anioActual = (): string => String(new Date().getFullYear())

/** Número de expediente físico en sus tres partes: número / repartición / año. */
export const expedienteSchema = z.object({
  numero: z.string().regex(/^\d{1,6}$/, 'Ingrese el número (hasta 6 dígitos).'),
  reparticion: z.string().regex(/^\d{1,4}$/, 'Ingrese la repartición (hasta 4 dígitos).'),
  anio: z.string().refine((v) => v === anioActual(), 'El expediente tiene que ser del año en curso.'),
})

export type ExpedienteForm = z.infer<typeof expedienteSchema>

export const expedienteVacio = (): ExpedienteForm => ({ numero: '', reparticion: REPARTICION_DRH, anio: anioActual() })

/**
 * Número completo tal como se guarda y se muestra: "123/332-2026". Sin ceros a la
 * izquierda, para que 0123 y 123 sean el mismo expediente.
 */
export const formatearExpediente = ({ numero, reparticion, anio }: ExpedienteForm): string =>
  `${Number(numero)}/${Number(reparticion)}-${anio}`

/** El texto tiene el formato de un número de expediente completo (ej: en un parámetro de la URL). */
export const esNumeroExpediente = (valor: string): boolean => /^\d{1,6}\/\d{1,4}-\d{4}$/.test(valor)
