// Peticiones de la Ampliación / Reducción al BACKEND REAL (NestJS + PostgreSQL / PostGIS).
// Solo hablan con la API; el cacheo lo hacen los hooks (./hooks.ts). El backend valida todo
// (concesión vigente, sin otro trámite en curso, checklist, el plano con PostGIS…) y devuelve el
// mensaje listo para mostrar. Lo de las oficinas (Recaudación…Secretaría) es común: circuito.
import { backend } from '@/services/api/backend'
import type { titularesADto } from '../AltaDeConcesion/adaptadores'
import { crearApiCircuito } from '../shared/circuitoBackend/api'
import type { ModificacionBackend, ModificacionConAvisos, ModificacionEnLista, TipoModificacionBackend } from './backend.types'

export const RUTA_MODIFICACION = '/tramites/ampliacion-reduccion'

export interface IniciarModificacionDto {
  concesionId: string
  tipo: TipoModificacionBackend
  expediente: { numero: string; reparticion: string; anio: number }
  /** Ids de los papeles del checklist que trae el expediente. */
  documentacionPresentada: number[]
}

const datos = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data)

export const modificacionApi = {
  /** Trámites en curso (con `todos`, también los terminados). */
  listar: (todos = false) => datos(backend.get<ModificacionEnLista[]>(RUTA_MODIFICACION, { params: todos ? { todos: true } : undefined })),
  obtener: (expedienteId: string) => datos(backend.get<ModificacionBackend>(`${RUTA_MODIFICACION}/${expedienteId}`)),

  // --- Catastro: inicio y carga -------------------------------------------------------
  iniciar: (dto: IniciarModificacionDto) => datos(backend.post<ModificacionBackend>(RUTA_MODIFICACION, dto)),
  /** El plano de la nueva superficie (KML o GeoJSON): el backend lo valida, lo mide y recalcula usos y caudal. */
  subirPlano: (expedienteId: string, archivo: File) => {
    const form = new FormData()
    form.append('archivo', archivo)
    return datos(backend.put<ModificacionConAvisos>(`${RUTA_MODIFICACION}/${expedienteId}/superficie`, form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 }))
  },
  /** El plano tal como se presentó (para descargarlo). */
  archivoPlano: (expedienteId: string) => datos(backend.get<Blob>(`${RUTA_MODIFICACION}/${expedienteId}/superficie/archivo`, { responseType: 'blob' })),
  /** Optativo: nuevos titulares (mismo cuerpo que el alta) / quitarlos. */
  guardarTitulares: (expedienteId: string, dto: ReturnType<typeof titularesADto>) => datos(backend.put<ModificacionBackend>(`${RUTA_MODIFICACION}/${expedienteId}/titulares`, dto)),
  quitarTitulares: (expedienteId: string) => datos(backend.delete<ModificacionBackend>(`${RUTA_MODIFICACION}/${expedienteId}/titulares`)),
}

/** Las acciones de las oficinas (comunes a los trámites sobre una concesión), sobre la ruta de este trámite. */
export const circuitoModificacionApi = crearApiCircuito(RUTA_MODIFICACION)
