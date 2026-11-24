import { z } from 'zod'
import { leerCoordenada, type CoordenadaForm } from '@/lib/coordenadas'
import { expedienteSchema } from '../shared/schemas/expediente'
import { suministroSchema } from '../shared/schemas/suministro'
import type { MotivoReubicacion } from './backend.types'

// --- Paso 1: concesión elegida + expediente en papel + checklist + motivo ------------------

/** Motivo de la reubicación (caso de uso, paso 7): lista cerrada, igual que el backend. */
export const MOTIVOS_REUBICACION: { value: MotivoReubicacion; label: string }[] = [
  { value: 'DIVISION_INMUEBLE', label: 'División del inmueble' },
  { value: 'ALTERACION_TERRENO', label: 'Alteración del terreno' },
  { value: 'OTRO', label: 'Otro' },
]

// Devuelve boolean (no un type guard): el formulario arranca con motivo vacío.
const esMotivo = (m: string): boolean => MOTIVOS_REUBICACION.some((o) => o.value === m)

/** Con «Otro», el detalle tiene al menos 10 caracteres y palabras (no «—», «s/d», «xxxxxxxxxx»). Lo mismo exige el backend. */
export const detalleValido = (detalle: string) => {
  const t = detalle.trim()
  return t.length >= 10 && /[a-záéíóúñ]{3,}/i.test(t) && new Set(t.toLowerCase().replace(/\s/g, '')).size > 3
}

export const inicioReubicacionSchema = z
  .object({
    /** Id de la concesión vigente (de la búsqueda del backend). */
    concesionId: z.string().min(1, 'Seleccione la concesión.'),
    expediente: expedienteSchema,
    /** Ids de los papeles del checklist que trae el expediente. */
    documentacionPresentada: z.array(z.number()),
    motivo: z.string().refine(esMotivo, 'Seleccione el motivo de la reubicación.'),
    /** Obligatorio con «Otro»; optativo con los demás. */
    motivoDetalle: z.string().trim().max(1000, 'Máximo 1000 caracteres.'),
  })
  .superRefine((v, ctx) => {
    if (v.motivo === 'OTRO' && !detalleValido(v.motivoDetalle)) {
      ctx.addIssue({ code: 'custom', path: ['motivoDetalle'], message: 'Describa el motivo de la reubicación (al menos 10 caracteres).' })
    }
  })

export type InicioReubicacionForm = z.infer<typeof inicioReubicacionSchema>

// --- Paso 2: forma de servicio (suministro + punto de entrega) ---------------------------

const coordenadaSchema = z.object({
  sistema: z.enum(['posgar', 'grados']),
  x: z.string().trim(),
  y: z.string().trim(),
  latitud: z.string().trim(),
  longitud: z.string().trim(),
})

/**
 * La forma de servicio nueva: el camino del árbol de suministro (el caudal no se edita: la
 * magnitud no cambia) y, si se marca, un punto de entrega nuevo (ej: la estación de bombeo).
 */
export const servicioReubicacionSchema = z
  .object({
    suministro: suministroSchema,
    /** Si no se cambia, queda el punto de entrega vigente. */
    cambiaPuntoEntrega: z.boolean(),
    puntoEntrega: coordenadaSchema.extend({ referencia: z.string().trim().max(255, 'Máximo 255 caracteres.') }),
  })
  .superRefine((s, ctx) => {
    if (!s.cambiaPuntoEntrega) return
    for (const [eje, message] of Object.entries(leerCoordenada(s.puntoEntrega as CoordenadaForm, 'del punto de entrega').errores)) {
      if (message) ctx.addIssue({ code: 'custom', path: ['puntoEntrega', eje], message })
    }
  })

export type ServicioReubicacionForm = z.infer<typeof servicioReubicacionSchema>
