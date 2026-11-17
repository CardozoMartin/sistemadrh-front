// Peticiones de la Baja de Pozo al BACKEND REAL. Quién actúa viaja en X-Usuario-Id (lo
// agrega el cliente `backend`); el backend valida etapa, oficina y que el expediente esté tomado.
import { backend } from '@/services/api/backend'
import type {
  AvisoDistrito,
  BajaBackend,
  BajaDeOficioDto,
  BajaEnLista,
  DatosBajaDto,
  DictamenJuridicoDto,
  DocumentoBaja,
  EvaluacionTecnicaDto,
  IniciarBajaDto,
  PozoBackend,
  ResolucionBajaDto,
} from './types'

const BAJA = '/tramites/baja-pozo'
const datos = async <T>(p: Promise<{ data: T }>) => (await p).data
const post = (id: string, accion: string, dto: unknown = {}) => datos(backend.post<BajaBackend>(`${BAJA}/${id}/${accion}`, dto))

export const bajaPozoApi = {
  // --- Consultas ---
  /** Pozos por concesión, expediente, titular, documento, ID interno, alias o ubicación. */
  buscarPozos: (q: string) => datos(backend.get<PozoBackend[]>('/pozos', { params: q ? { q } : undefined })),
  obtenerPozo: (id: string) => datos(backend.get<PozoBackend>(`/pozos/${id}`)),
  listar: (todas: boolean) => datos(backend.get<BajaEnLista[]>(BAJA, { params: todas ? { todas: true } : undefined })),
  obtener: (id: string) => datos(backend.get<BajaBackend>(`${BAJA}/${id}`)),
  documentos: () => datos(backend.get<DocumentoBaja[]>(`${BAJA}/documentos`)),

  // --- Baja de oficio ---
  /** El pozo queda dado de baja en el acto. Devuelve la ficha del pozo. */
  darDeBajaDeOficio: (pozoId: string, dto: BajaDeOficioDto) => datos(backend.post<PozoBackend>(`${BAJA}/de-oficio/${pozoId}`, dto)),

  // --- Baja a solicitud: Pozos ---
  iniciar: (dto: IniciarBajaDto) => datos(backend.post<BajaBackend>(BAJA, dto)),
  actualizar: (id: string, dto: DatosBajaDto) => datos(backend.put<BajaBackend>(`${BAJA}/${id}`, dto)),
  documentacion: (id: string, dto: { resultado: 'COMPLETA' | 'PENDIENTE'; observaciones?: string }) => post(id, 'documentacion', dto),
  antecedentes: (id: string, observaciones?: string) => post(id, 'antecedentes', { observaciones }),
  evaluacionTecnica: (id: string, dto: EvaluacionTecnicaDto) => post(id, 'evaluacion-tecnica', dto),
  reenviar: (id: string, observaciones?: string) => post(id, 'reenviar', { observaciones }),
  clausura: (id: string, dto: { fecha: string; acta: string; observaciones?: string }) => post(id, 'clausura', dto),

  // --- Jurídico y Secretaría ---
  juridico: (id: string, dto: DictamenJuridicoDto) => post(id, 'juridico', dto),
  resolucion: (id: string, dto: ResolucionBajaDto) => post(id, 'resolucion', dto),

  // --- Comunes ---
  tomar: (id: string) => datos(backend.post(`/expedientes/${id}/tomar`)),

  // --- Distrito: toma de conocimiento ---
  avisosDistrito: (todos: boolean) => datos(backend.get<AvisoDistrito[]>(`${BAJA}/avisos-distrito`, { params: todos ? { todos: true } : undefined })),
  tomarConocimiento: (bajaId: string) => datos(backend.post(`${BAJA}/avisos-distrito/${bajaId}/visto`)),
}
