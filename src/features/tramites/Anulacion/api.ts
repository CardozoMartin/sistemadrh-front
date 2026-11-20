// Peticiones de la Anulación de Concesión al BACKEND REAL (NestJS + PostgreSQL).
// Solo hablan con la API; el cacheo lo hacen los hooks (./hooks.ts).
//
// El backend valida todo (concesión vigente o ya anulada, sin otro trámite en curso, número de
// expediente libre, checklist completo, motivo, etapa y expediente tomado) y devuelve el mensaje listo.
// La búsqueda de concesiones vigentes es la misma del cambio de titularidad (BuscadorVigentes).
import { backend } from '@/services/api/backend'
import type { AnulacionBackend, AnulacionEnLista, DocumentoChecklist } from './backend.types'

const ANULACION = '/tramites/anulacion'

export interface IniciarAnulacionDto {
  concesionId: string
  expediente: { numero: string; reparticion: string; anio: number }
  /** Ids de los papeles del checklist que trae el expediente. */
  documentacionPresentada: number[]
  motivo: string
}

const datos = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data)

export const anulacionApi = {
  // --- Consultas -------------------------------------------------------------------
  /** Papeles del checklist del inicio (caso de uso, paso 5). */
  checklist: () => datos(backend.get<DocumentoChecklist[]>('/catalogos/documentos/ANULACION')),
  /** Anulaciones en trámite (con `todos`, también las terminadas). */
  listar: (todos = false) => datos(backend.get<AnulacionEnLista[]>(ANULACION, { params: todos ? { todos: true } : undefined })),
  obtener: (expedienteId: string) => datos(backend.get<AnulacionBackend>(`${ANULACION}/${expedienteId}`)),

  // --- Catastro --------------------------------------------------------------------
  iniciar: (dto: IniciarAnulacionDto) => datos(backend.post<AnulacionBackend>(ANULACION, dto)),
  /** Iniciada por error: queda anulada (motivo obligatorio, 10 caracteres o más). */
  cancelar: (expedienteId: string, observaciones: string) => datos(backend.post<AnulacionBackend>(`${ANULACION}/${expedienteId}/cancelar`, { observaciones })),
  /** «Iniciar anulación»: la envía a Recaudación. */
  enviar: (expedienteId: string) => datos(backend.post<AnulacionBackend>(`${ANULACION}/${expedienteId}/enviar`, {})),
}
