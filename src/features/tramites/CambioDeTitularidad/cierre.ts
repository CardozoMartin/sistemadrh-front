// Verificación final en Catastro (paso 40 y caso de uso «Trámites pendientes»): antes de
// finalizar, Catastro coteja la resolución con los datos del nuevo titular. El backend vuelve a
// validar todo (vistos buenos, resolución, propuesta completa) y recién ahí cambia el titular.

/** Qué falta para poder finalizar (null: se puede). */
export function faltaEnCierre({ conResolucion, cotejado }: { conResolucion: boolean; cotejado: boolean }): string | null {
  if (!conResolucion) return 'Falta la resolución de Secretaría General.'
  if (!cotejado) return 'Confirme que cotejó la resolución con los datos del nuevo titular.'
  return null
}
