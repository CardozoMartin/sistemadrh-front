// Verificación final en Catastro (paso 40 y caso de uso «Trámites pendientes»): antes de
// finalizar, Catastro coteja la resolución con los datos del nuevo titular. El backend vuelve a
// validar todo (vistos buenos, resolución, propuesta completa) y recién ahí cambia el titular.
import { faltaEnVerificacionFinal, type EstadoCierre } from '../shared/circuito/cierre'

/** Qué falta para poder finalizar (null: se puede). */
export const faltaEnCierre = (estado: EstadoCierre): string | null => faltaEnVerificacionFinal(estado, 'los datos del nuevo titular')
