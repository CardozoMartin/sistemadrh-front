import { z } from 'zod'
import { expedienteSchema } from '../shared/schemas/expediente'

/**
 * RN-A09: todo motivo obligatorio tiene al menos 10 caracteres y no puede ser texto de
 * relleno ("—", "s/d", "xxxxxxxxxx"): tiene que tener palabras.
 */
export const motivoSchema = z
  .string()
  .trim()
  .min(10, 'El motivo debe tener al menos 10 caracteres.')
  .max(1000, 'Máximo 1000 caracteres.')
  .refine((m) => /[a-záéíóúñ]{3,}/i.test(m) && new Set(m.toLowerCase().replace(/\s/g, '')).size > 3, 'Describa el motivo de la anulación.')

// --- Paso 1: concesión elegida + expediente en papel + checklist + motivo ------------------

export const inicioAnulacionSchema = z.object({
  /** Id de la concesión vigente (de la búsqueda del backend). */
  concesionId: z.string().min(1, 'Seleccione la concesión.'),
  expediente: expedienteSchema,
  /** Ids de los papeles del checklist que trae el expediente. */
  documentacionPresentada: z.array(z.number()),
  motivo: motivoSchema,
})

export type InicioAnulacionForm = z.infer<typeof inicioAnulacionSchema>

// --- Cierre en Catastro: baja lógica (prototipo FinalizarAnulacion.html) ------------------

export const cierreAnulacionSchema = z.object({
  confirmaIrreversible: z.boolean().refine(Boolean, 'Confirme que todo está completo: la anulación no se puede revertir.'),
})

export type CierreAnulacionForm = z.infer<typeof cierreAnulacionSchema>
