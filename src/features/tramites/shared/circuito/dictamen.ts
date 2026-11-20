// Reglas del dictamen de Distrito y Jurídico (caso de uso: apto / no apto). Las mismas que valida
// el backend (exigirMotivoSiNoEsApto y, en Distrito, exigirObservacionesTecnicas).

import type { AptoNoApto } from './opciones'

export type ResultadoDictamen = AptoNoApto

/** Largo mínimo de las observaciones técnicas de Distrito (igual que el backend). */
export const MINIMO_OBSERVACIONES_TECNICAS = 10

/**
 * Qué falta para poder dictaminar (null: se puede).
 *   - Distrito (`observacionesTecnicas`): las observaciones técnicas son obligatorias siempre.
 *   - En cualquier oficina, «No apto» exige el motivo.
 */
export function faltaEnDictamen(resultado: ResultadoDictamen | '', observaciones: string, observacionesTecnicas = false): string | null {
  if (!resultado) return null
  if (observacionesTecnicas && observaciones.trim().length < MINIMO_OBSERVACIONES_TECNICAS) {
    return `Ingrese las observaciones técnicas (al menos ${MINIMO_OBSERVACIONES_TECNICAS} caracteres).`
  }
  if (resultado === 'NO_APTO' && !observaciones.trim()) return 'Indique el motivo del «No apto»: el trámite se rechaza y queda en el historial.'
  return null
}
