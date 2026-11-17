// Regla común al cierre en Catastro de los trámites sobre una concesión (cambio de
// titularidad, anulación…): el cambio sobre la concesión se aplica recién al final.
import type { DominioContextValue } from '@/hooks/useDominio'
import { esAprobado } from '@/features/expedientes/circuito'
import type { Expediente } from '@/types/domain'

/**
 * Por qué no se puede cerrar todavía (null = se puede): tienen que haber aprobado todas
 * las oficinas, tiene que haber resolución y el expediente tiene que estar vinculado a la concesión.
 */
export function bloqueoDeCierre(e: Expediente, d: DominioContextValue): string | null {
  const aprobadas = new Set(e.historial.filter(esAprobado).map((p) => p.etapaId))
  const faltan = d.etapas.slice(0, -1).filter((et) => !aprobadas.has(et.id))
  if (faltan.length) return `Falta la aprobación de: ${faltan.map((et) => d.nombreOficina(et.oficinaId)).join(', ')}.`
  if (!e.resolucion) return 'Falta el número de resolución de Secretaría General.'
  if (!e.concesionOrigenId) return 'El expediente no está vinculado a una concesión.'
  return null
}
