// Peticiones del Cambio de Titularidad al BACKEND REAL (NestJS + PostgreSQL).
// Solo hablan con la API; el cacheo lo hacen los hooks (./hooks.ts).
//
// El backend valida todo (concesión vigente, sin otro trámite en curso, número de expediente
// libre, checklist completo, etapa y expediente tomado) y devuelve el mensaje listo para mostrar.
import { backend } from '@/services/api/backend'
import type { FiltrosConcesiones, ResultadoConcesiones } from '@/features/catastro/consultaConcesiones'
import type { titularesADto } from '../AltaDeConcesion/adaptadores'
import type { CambioBackend, CambioEnLista, DocumentoChecklist } from './backend.types'

/** Cuerpo de PUT …/titulares: el mismo que arma el alta. */
type TitularesDto = ReturnType<typeof titularesADto>

const CAMBIO = '/tramites/cambio-titularidad'

export interface IniciarCambioDto {
  concesionId: string
  expediente: { numero: string; reparticion: string; anio: number }
  /** Ids de los papeles del checklist que trae el expediente. */
  documentacionPresentada: number[]
}

/** "Titular actual → Nuevo titular", para los listados y las bandejas. */
export const descripcionCambio = (actual: string, nuevo: string) => `${actual} → ${nuevo}`

const datos = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data)

export const cambioTitularidadApi = {
  // --- Consultas -------------------------------------------------------------------
  /** Búsqueda de concesiones VIGENTES (la misma consulta de Catastro, filtrada por estado). */
  buscarVigentes: (filtros: FiltrosConcesiones, pagina: number, porPagina: number) => {
    const params = Object.fromEntries(Object.entries({ ...filtros, estado: 'VIGENTE', pagina, porPagina }).filter(([, v]) => v !== undefined && v !== ''))
    return datos(backend.get<ResultadoConcesiones>('/concesiones/buscar', { params }))
  },
  /** Papeles del checklist del inicio (caso de uso, pasos 4-5). */
  checklist: () => datos(backend.get<DocumentoChecklist[]>('/catalogos/documentos/CAMBIO_TITULARIDAD')),
  /** Cambios en trámite (con `todos`, también los terminados). */
  listar: (todos = false) => datos(backend.get<CambioEnLista[]>(CAMBIO, { params: todos ? { todos: true } : undefined })),
  obtener: (expedienteId: string) => datos(backend.get<CambioBackend>(`${CAMBIO}/${expedienteId}`)),

  // --- Catastro: inicio y carga -------------------------------------------------------
  iniciar: (dto: IniciarCambioDto) => datos(backend.post<CambioBackend>(CAMBIO, dto)),
  /** Nuevos titulares y domicilios (lista completa, mismo cuerpo que el alta). Es una propuesta. */
  guardarTitulares: (expedienteId: string, dto: TitularesDto) => datos(backend.put<CambioBackend>(`${CAMBIO}/${expedienteId}/titulares`, dto)),
  /** Iniciado por error: queda anulado (motivo obligatorio, 10 caracteres o más). */
  cancelar: (expedienteId: string, observaciones: string) => datos(backend.post<CambioBackend>(`${CAMBIO}/${expedienteId}/cancelar`, { observaciones })),
  /** Termina la carga y lo envía a Recaudación. */
  enviar: (expedienteId: string, observaciones?: string) => datos(backend.post<CambioBackend>(`${CAMBIO}/${expedienteId}/enviar`, { observaciones })),
}
