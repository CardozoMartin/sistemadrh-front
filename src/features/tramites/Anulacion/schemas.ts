import { z } from 'zod'

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

// --- Paso 2: verificación de datos (prototipo tramiteAnulacion.html) ----------------------

export const verificacionAnulacionSchema = z.object({
  motivo: motivoSchema,
  documentacionConfirmada: z.boolean().refine(Boolean, 'Confirme que la documentación necesaria está completa.'),
})

export type VerificacionAnulacionForm = z.infer<typeof verificacionAnulacionSchema>

// --- Cierre en Catastro: baja lógica (prototipo FinalizarAnulacion.html) ------------------

export const cierreAnulacionSchema = z.object({
  confirmaIrreversible: z.boolean().refine(Boolean, 'Confirme que todo está completo: la anulación no se puede revertir.'),
})

export type CierreAnulacionForm = z.infer<typeof cierreAnulacionSchema>
