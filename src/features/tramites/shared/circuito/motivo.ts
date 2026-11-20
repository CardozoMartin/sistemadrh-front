// Motivo para cancelar un trámite iniciado por error (en la carga de Catastro). Lo mismo exige el backend.

/** Largo mínimo del motivo de cancelación. */
export const MIN_MOTIVO_CANCELACION = 10

export const motivoCancelacionValido = (motivo: string) => motivo.trim().length >= MIN_MOTIVO_CANCELACION

/** El error a mostrar junto al campo (undefined: nada todavía, o está bien). */
export const errorMotivoCancelacion = (motivo: string): string | undefined =>
  motivo && !motivoCancelacionValido(motivo) ? `Explique el motivo (al menos ${MIN_MOTIVO_CANCELACION} caracteres).` : undefined
