import { z } from 'zod'

/** String obligatorio con el mismo mensaje si está vacío o si no llegó valor. */
const requerido = (mensaje: string) => z.string({ error: mensaje }).min(1, mensaje)

/** Departamento → localidad → distrito. Se usa en domicilios y en la ubicación del inmueble. */
export const ubicacionSchema = z.object({
  departamento: requerido('Seleccione un departamento.'),
  localidad: requerido('Seleccione una localidad.'),
  distrito: requerido('Seleccione un distrito.'),
})

export const domicilioSchema = ubicacionSchema.extend({
  calle: z.string().trim().min(1, 'Ingrese la calle o ruta.'),
  numero: z.string().trim(),
})

export type DomicilioForm = z.infer<typeof domicilioSchema>

export const domicilioVacio = (): DomicilioForm => ({
  calle: '',
  numero: '',
  departamento: '',
  localidad: '',
  distrito: '',
})
