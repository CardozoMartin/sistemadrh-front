// Peticiones de la Reubicación al BACKEND REAL (NestJS + PostgreSQL).
// Solo hablan con la API; el cacheo lo hacen los hooks (./hooks.ts).
//
// El backend valida todo (concesión vigente, sin otro trámite en curso, número de expediente
// libre, checklist, motivo, KML, árbol de suministro, etapa y expediente tomado) y devuelve el mensaje listo.
import { backend } from '@/services/api/backend'
import type { AntecedentesDeuda, BorradorAvisoDeuda, NotificarDeudaDto, ResultadoAvisoDeuda } from '../shared/circuito/deuda.types'
import { expedienteApi } from '../shared/circuito/expediente'
import type { Dictamen, OficinaDictamen } from '../shared/circuito/PanelDictamen'
import type { VerificacionDeuda } from '../shared/circuito/recaudacion'
import { OPCIONES_MULTIPART, resolucionAFormData, type CargaResolucion } from '../shared/circuito/resolucion'
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
  /** Corrigió lo que observó Jurídico: vuelve a Jurídico. */
  reenviar: (expedienteId: string) => datos(backend.post<ReubicacionBackend>(`${REUBICACION}/${expedienteId}/reenviar`, {})),

  // --- Circuito: común a todos los trámites -----------------------------------------
  /** La oficina que lo tiene lo toma para trabajarlo (antes de actuar). */
  tomar: expedienteApi.tomar,

  // --- Recaudación ---------------------------------------------------------------------
  /** Titulares actuales, sus concesiones otorgadas (incluida la que se reubica) y si tienen deuda. */
  antecedentesDeuda: (expedienteId: string) => datos(backend.get<AntecedentesDeuda>(`${REUBICACION}/${expedienteId}/recaudacion`)),
  /** Apto: pasa a Distrito. No apto: queda en espera en Recaudación. */
  verificarDeuda: (expedienteId: string, dto: VerificacionDeuda) => datos(backend.post<ReubicacionBackend>(`${REUBICACION}/${expedienteId}/recaudacion`, dto)),
  /** En espera por deuda y no se pudo cobrar: pasa igual a Distrito con la nota de por qué. */
  cursoConDeuda: (expedienteId: string, observaciones: string) => datos(backend.post<ReubicacionBackend>(`${REUBICACION}/${expedienteId}/recaudacion/curso-con-deuda`, { observaciones })),
  /** El correo de cada titular con deuda (texto base), para revisarlo antes de enviarlo. */
  borradorAvisoDeuda: (expedienteId: string) => datos(backend.get<BorradorAvisoDeuda>(`${REUBICACION}/${expedienteId}/recaudacion/aviso-deuda`)),
  notificarDeuda: (expedienteId: string, dto: NotificarDeudaDto) => datos(backend.post<ResultadoAvisoDeuda>(`${REUBICACION}/${expedienteId}/recaudacion/notificar-deuda`, dto)),

  // --- Distrito (apto / no apto) y Jurídico (apto / observado / no apto) ---------------------
  dictaminar: (expedienteId: string, oficina: OficinaDictamen, dto: Dictamen) => datos(backend.post<ReubicacionBackend>(`${REUBICACION}/${expedienteId}/${oficina}`, dto)),

  // --- Secretaría General ----------------------------------------------------------------
  /** La resolución (número, año, fecha de firma, observaciones) con el PDF escaneado. Pasa a Catastro. */
  resolucion: (expedienteId: string, dto: CargaResolucion) =>
    datos(backend.post<ReubicacionBackend>(`${REUBICACION}/${expedienteId}/resolucion`, resolucionAFormData(dto), OPCIONES_MULTIPART)),
  /** El PDF de la resolución (con la sesión: por eso no alcanza con un link). */
  archivoResolucion: (expedienteId: string) => datos(backend.get<Blob>(`${REUBICACION}/${expedienteId}/resolucion/archivo`, { responseType: 'blob' })),

  // --- Catastro: cierre (visto bueno final) -------------------------------------------
  /** Con la resolución cargada: la reubicación finaliza y lo propuesto rige en la concesión. */
  verificacionFinal: (expedienteId: string, observaciones?: string) => datos(backend.post<ReubicacionBackend>(`${REUBICACION}/${expedienteId}/verificacion-final`, { observaciones })),
}
