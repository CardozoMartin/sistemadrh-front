import { z } from 'zod'
import { coordenadaVacia, leerCoordenada, type CoordenadaForm } from '@/lib/coordenadas'
import { fechaCorta, finDePeriodo } from '@/lib/fechas'

/** Coordenada de un punto: X/Y POSGAR 2007 faja 3 o latitud/longitud (ver lib/coordenadas.ts). */
const coordenadaSchema = z.object({
  sistema: z.enum(['posgar', 'grados']),
  x: z.string().trim(),
  y: z.string().trim(),
  latitud: z.string().trim(),
  longitud: z.string().trim(),
})

const usoItemSchema = z.object({
  uso: z.string(), // id de /usos
  magnitud: z.string(),
})

/**
 * Usos y magnitudes de la concesión (carácter, período, desagüe, usos, punto de entrega).
 * Es una fábrica porque qué usos exigen punto de entrega lo define la API
 * (/usos → requierePuntoEntrega).
 */
export function crearUsosSchema(usosConPuntoEntrega: string[]) {
  return z
    .object({
      caracter: z.string(), // id de /caracteres
      codigoServicio: z.string(), // id de /codigosServicio
      periodoInicio: z.string(),
      periodoFin: z.string(),
      /** En X/Y POSGAR 2007 faja 3 o en latitud/longitud. */
      desague: coordenadaSchema,
      items: z.array(usoItemSchema),
      /** Punto de entrega de agua; solo se exige si algún uso lo requiere. */
      pecuario: coordenadaSchema.extend({ referencia: z.string().trim() }),
    })
    .superRefine((u, ctx) => {
      const issue = (path: (string | number)[], message: string | null) => {
        if (message) ctx.addIssue({ code: 'custom', path, message })
      }

      const coordenada = (campo: 'desague' | 'pecuario', c: CoordenadaForm, contexto: string) => {
        for (const [eje, msj] of Object.entries(leerCoordenada(c, contexto).errores)) issue([campo, eje], msj ?? null)
      }

      // El desagüe va solo en X/Y POSGAR faja 3 (regla compartida con el backend, lib/posgar-faja3.ts).
      coordenada('desague', { ...u.desague, sistema: 'posgar' }, 'del desagüe')

      // El período dura al menos 1 año (misma regla que el backend).
      if (u.periodoInicio && u.periodoFin) {
        const minimo = finDePeriodo(u.periodoInicio, 1)
        if (u.periodoFin < u.periodoInicio) issue(['periodoFin'], 'El fin del período no puede ser anterior al inicio.')
        else if (u.periodoFin < minimo) issue(['periodoFin'], `El período tiene que ser de al menos 1 año: el fin tiene que ser el ${fechaCorta(minimo)} o posterior.`)
      }

      if (!u.items.some((i) => i.uso)) issue(['items', 0, 'uso'], 'Seleccione al menos un uso.')
      const vistos = new Set<string>()
      u.items.forEach((item, i) => {
        if (!item.uso) {
          if (item.magnitud) issue(['items', i, 'uso'], 'Seleccione el uso.')
          return
        }
        if (vistos.has(item.uso)) issue(['items', i, 'uso'], 'Este uso ya está cargado.')
        vistos.add(item.uso)
        if (!(Number(item.magnitud) > 0)) issue(['items', i, 'magnitud'], 'Ingrese una magnitud mayor a 0.')
      })

      if (u.items.some((i) => usosConPuntoEntrega.includes(i.uso))) {
        coordenada('pecuario', u.pecuario, 'del punto de entrega')
      }
    })
}

export type UsosForm = z.infer<ReturnType<typeof crearUsosSchema>>

export const usoItemVacio = () => ({ uso: '', magnitud: '' })

export const usosVacio = (): UsosForm => ({
  caracter: '',
  codigoServicio: '',
  periodoInicio: '',
  periodoFin: '',
  desague: coordenadaVacia(),
  items: [usoItemVacio()],
  pecuario: { ...coordenadaVacia(), referencia: '' },
})
