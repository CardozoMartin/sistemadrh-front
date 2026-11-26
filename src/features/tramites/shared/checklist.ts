// El checklist de documentación que trae el expediente en papel (inicio de cada trámite).

/** GET /catalogos/documentos/:tipoTramite: un papel del checklist (solo los activos). */
export interface DocumentoChecklist {
  id: number
  tipoTramite: 'CAMBIO_TITULARIDAD' | 'AMPLIACION_REDUCCION' | 'ANULACION' | 'REUBICACION'
  descripcion: string
  obligatorio: boolean
  orden: number
  activo: boolean
}

/** Papeles obligatorios sin marcar (el backend controla lo mismo). */
export function faltantesDelChecklist<T extends Pick<DocumentoChecklist, 'id' | 'obligatorio'>>(checklist: T[], marcados: number[]): T[] {
  return checklist.filter((d) => d.obligatorio && !marcados.includes(d.id))
}
