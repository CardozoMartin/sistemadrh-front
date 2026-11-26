// Verificación final en Catastro (común a los trámites sobre una concesión existente): antes de
// finalizar, Catastro coteja la resolución de Secretaría General con los datos del trámite. El
// backend vuelve a validar todo (vistos buenos y resolución) y recién ahí se aplica el cambio.

export interface EstadoCierre {
  conResolucion: boolean
  cotejado: boolean
}

/**
 * Qué falta para poder finalizar (null: se puede).
 * @param cotejo con qué se coteja la resolución, para el mensaje (ej: «los datos del nuevo titular»).
 */
export function faltaEnVerificacionFinal({ conResolucion, cotejado }: EstadoCierre, cotejo: string): string | null {
  if (!conResolucion) return 'Falta la resolución de Secretaría General.'
  if (!cotejado) return `Confirme que cotejó la resolución con ${cotejo}.`
  return null
}
