// Peticiones de la Reubicación al BACKEND REAL (NestJS + PostgreSQL).
// Solo hablan con la API; el cacheo lo hacen los hooks (./hooks.ts).
//
// El backend valida todo (concesión vigente, sin otro trámite en curso, número de expediente
// libre, checklist, motivo, KML, árbol de suministro, etapa y expediente tomado) y devuelve el mensaje listo.
import { backend } from '@/services/api/backend'
import { OPCIONES_MULTIPART } from '../shared/circuito/resolucion'
import type { DocumentoChecklist, MotivoReubicacion, ReubicacionBackend, ReubicacionConAvisosArchivo, ReubicacionEnLista } from './backend.types'

const REUBICACION = '/tramites/reubicacion'

export interface IniciarReubicacionDto {
  concesionId: string
  expediente: { numero: string; reparticion: string; anio: number }
  /** Ids de los papeles del checklist que trae el expediente. */
  documentacionPresentada: number[]
  motivo: MotivoReubicacion
  /** Obligatorio con «Otro». */
  motivoDetalle?: string
}

/** Lo que recibe PUT …/forma-servicio: el camino del árbol (sin caudal) y el punto de entrega, si se cargó. */
export interface FormaServicioDto {
  fuentes: string[]
  sistemaDistribucion?: string
  canalPrincipal?: string
  canalSecundario?: string
  canalTerciario?: string
  canalCuarto?: string
  canalQuinto?: string
  desague?: string
  observacion?: string
  puntoEntrega?: ({ x: number; y: number } | { latitud: number; longitud: number }) & { referencia?: string }
}

/** El KML / GeoJSON original, tal como lo eligió el usuario (el servidor lo guarda como respaldo). */
export interface ArchivoPoligono {
  nombre: string
  contenido: string
}

const datos = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data)

function poligonoAFormData({ nombre, contenido }: ArchivoPoligono): FormData {
  const form = new FormData()
  const tipo = /\.(geo)?json$/i.test(nombre) ? 'application/geo+json' : 'application/vnd.google-earth.kml+xml'
  form.append('archivo', new Blob([contenido], { type: tipo }), nombre)
  return form
}

export const reubicacionApi = {
  // --- Consultas -------------------------------------------------------------------
  checklist: () => datos(backend.get<DocumentoChecklist[]>('/catalogos/documentos/REUBICACION')),
  /** Reubicaciones en trámite (con `todos`, también las terminadas). */
  listar: (todos = false) => datos(backend.get<ReubicacionEnLista[]>(REUBICACION, { params: todos ? { todos: true } : undefined })),
  obtener: (expedienteId: string) => datos(backend.get<ReubicacionBackend>(`${REUBICACION}/${expedienteId}`)),

  // --- Catastro --------------------------------------------------------------------
  iniciar: (dto: IniciarReubicacionDto) => datos(backend.post<ReubicacionBackend>(REUBICACION, dto)),
  /** El polígono del nuevo lugar (multipart con el archivo original). */
  guardarPoligono: (expedienteId: string, archivo: ArchivoPoligono) =>
    datos(backend.put<ReubicacionConAvisosArchivo>(`${REUBICACION}/${expedienteId}/poligono`, poligonoAFormData(archivo), OPCIONES_MULTIPART)),
  /** La forma de servicio nueva: suministro y punto de entrega. */
  guardarServicio: (expedienteId: string, dto: FormaServicioDto) => datos(backend.put<ReubicacionBackend>(`${REUBICACION}/${expedienteId}/forma-servicio`, dto)),
  /** Iniciada por error: queda anulada (motivo obligatorio, 10 caracteres o más). */
  cancelar: (expedienteId: string, observaciones: string) => datos(backend.post<ReubicacionBackend>(`${REUBICACION}/${expedienteId}/cancelar`, { observaciones })),
  /** La envía a Recaudación (con el polígono y la forma de servicio cargados). */
  enviar: (expedienteId: string) => datos(backend.post<ReubicacionBackend>(`${REUBICACION}/${expedienteId}/enviar`, {})),
}
