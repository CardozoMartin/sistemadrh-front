// Reglas de la reducción / ampliación (prototipo reducionampliacion.html) y recálculo del
// caudal con los módulos de dotación (/usos). Funciones puras, sin API.
import { calcularHectareas, poligonosSeSuperponen, puntoEnPoligono, type LatLng } from '@/lib/geo'
import type { UsoInfo } from '@/types/domain'
import { caudalTotal, redondear2 } from '../shared/dotacion'
import type { TipoModificacion } from './types'

export const NOMBRE_TIPO: Record<TipoModificacion, string> = { reduccion: 'Reducción', ampliacion: 'Ampliación' }

/** Diferencia mínima para considerar que la superficie cambió (ha). */
const TOLERANCIA_HA = 0.01

export interface EstadoGeometria {
  valido: boolean
  hectareas: number
  /** Nueva − actual (ha). */
  diferencia: number
  /** «Máx. 150.00 ha» / «Mín. 150.00 ha». */
  limite: string
  mensaje: string
}

const mismoPunto = (a: LatLng, b: LatLng) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6

/**
 * Reducción: la propuesta queda dentro del polígono original y es más chica.
 * Ampliación: es más grande y no se superpone con concesiones vecinas.
 */
export function evaluarPropuesta(tipo: TipoModificacion, original: LatLng[], propuesta: LatLng[], hectareasActual: number, vecinos: LatLng[][]): EstadoGeometria {
  const hectareas = propuesta.length >= 3 ? redondear2(calcularHectareas(propuesta)) : 0
  const diferencia = redondear2(hectareas - hectareasActual)
  const actual = hectareasActual.toFixed(2)
  const r = (valido: boolean, mensaje: string, limite: string): EstadoGeometria => ({ valido, hectareas, diferencia, limite, mensaje })

  if (propuesta.length < 3) return r(false, 'El polígono necesita al menos 3 vértices.', '—')

  if (tipo === 'reduccion') {
    const limite = `Máx. ${actual} ha`
    const dentro = propuesta.every((p) => puntoEnPoligono(p, original) || original.some((o) => mismoPunto(o, p)))
    if (!dentro) return r(false, 'En una reducción, todos los vértices deben quedar dentro del polígono original.', limite)
    if (hectareas > hectareasActual - TOLERANCIA_HA) return r(false, `La reducción tiene que quedar por debajo de la superficie actual de ${actual} ha.`, limite)
    return r(true, 'La geometría propuesta respeta la reducción y se mantiene dentro de la concesión original.', limite)
  }

  const limite = `Mín. ${actual} ha`
  if (hectareas < hectareasActual + TOLERANCIA_HA) return r(false, `La ampliación no puede quedar por debajo de la superficie actual de ${actual} ha.`, limite)
  if (vecinos.some((v) => poligonosSeSuperponen(propuesta, v))) return r(false, 'La ampliación se superpone con una concesión vecina.', limite)
  return r(true, 'La geometría propuesta es válida para una ampliación y no se superpone con concesiones vecinas.', limite)
}

/**
 * Recalcula el caudal para la nueva superficie: los usos que se miden por superficie
 * (unidad «ha…») escalan su magnitud en la misma proporción y el resto no cambia; el
 * caudal asignado se ajusta en la misma medida que la dotación total. Sin usos
 * cargados, escala proporcional a la superficie.
 */
export function recalcularCaudal(
  usos: { uso: string; magnitud: string }[],
  caudalActual: number | null,
  hectareasActual: number,
  hectareasNueva: number,
  buscarUso: (id: string) => UsoInfo | undefined,
): { caudal: number | null; usos: { uso: string; magnitud: string }[] } {
  const proporcion = hectareasActual > 0 ? hectareasNueva / hectareasActual : 1
  if (usos.length === 0) return { caudal: caudalActual == null ? null : redondear2(caudalActual * proporcion), usos }
  const nuevos = usos.map((i) =>
    buscarUso(i.uso)?.unidad.startsWith('ha') ? { ...i, magnitud: String(redondear2(Number(i.magnitud) * proporcion)) } : i,
  )
  // Se parte del caudal asignado vigente y se lo ajusta según cuánto cambia la dotación.
  const antes = caudalTotal(usos, buscarUso)
  const despues = caudalTotal(nuevos, buscarUso)
  if (caudalActual == null) return { caudal: despues, usos: nuevos }
  return { caudal: redondear2(antes > 0 ? caudalActual * (despues / antes) : caudalActual * proporcion), usos: nuevos }
}
