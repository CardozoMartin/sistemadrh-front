// Cierre del alta en Catastro: otorgamiento + los datos de la pre carga, revisables.
import { z } from 'zod'
import type { UsoInfo } from '@/types/domain'
import { crearPreCargaSchema } from '../schemas'

export const otorgamientoSchema = z.object({
  numeroConcesion: z.string().trim().min(1, 'Ingrese el número de concesión.'),
  subconcesion: z.string().trim(),
  tipoConcesionId: z.string().min(1, 'Seleccione el tipo de concesión.'), // id de /tiposConcesion
  resolucion: z.string().trim(),
})

export function crearFinalizacionSchema(dominio: { usos: UsoInfo[] }) {
  return crearPreCargaSchema(dominio).extend({ otorgamiento: otorgamientoSchema })
}
export type FinalizacionForm = z.infer<ReturnType<typeof crearFinalizacionSchema>>
