// Peticiones de la Anulación de Concesión al BACKEND REAL (NestJS + PostgreSQL).
// Solo hablan con la API; el cacheo lo hacen los hooks (./hooks.ts).
//
// El backend valida todo (concesión vigente o ya anulada, sin otro trámite en curso, número de
// expediente libre, checklist completo, motivo, etapa y expediente tomado) y devuelve el mensaje listo.
// La búsqueda de concesiones vigentes es la misma del cambio de titularidad (BuscadorVigentes).
import { backend } from '@/services/api/backend'
import type { AntecedentesDeuda, BorradorAvisoDeuda, NotificarDeudaDto, ResultadoAvisoDeuda } from '../AltaDeConcesion/backend.types'
import type { Dictamen, OficinaDictamen } from '../shared/circuito/PanelDictamen'
import type { VerificacionDeuda } from '../shared/circuito/recaudacion'
import { OPCIONES_MULTIPART, resolucionAFormData, type CargaResolucion } from '../shared/circuito/resolucion'
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

  // --- Circuito: común a todos los trámites -----------------------------------------
  /** La oficina que lo tiene lo toma para trabajarlo (antes de actuar). */
  tomar: (expedienteId: string) => datos(backend.post(`/expedientes/${expedienteId}/tomar`)),

  // --- Recaudación (caso de uso, pasos 8-10) ------------------------------------------
  /** Titulares actuales, sus concesiones otorgadas (incluida la que se anula) y si tienen deuda. */
  antecedentesDeuda: (expedienteId: string) => datos(backend.get<AntecedentesDeuda>(`${ANULACION}/${expedienteId}/recaudacion`)),
  /** Apto: pasa a Distrito. No apto: queda en espera en Recaudación. */
  verificarDeuda: (expedienteId: string, dto: VerificacionDeuda) => datos(backend.post<AnulacionBackend>(`${ANULACION}/${expedienteId}/recaudacion`, dto)),
  /** En espera por deuda y no se pudo cobrar: pasa igual a Distrito con la nota de por qué. */
  cursoConDeuda: (expedienteId: string, observaciones: string) => datos(backend.post<AnulacionBackend>(`${ANULACION}/${expedienteId}/recaudacion/curso-con-deuda`, { observaciones })),
  /** El correo de cada titular con deuda (texto base), para revisarlo antes de enviarlo. */
  borradorAvisoDeuda: (expedienteId: string) => datos(backend.get<BorradorAvisoDeuda>(`${ANULACION}/${expedienteId}/recaudacion/aviso-deuda`)),
  notificarDeuda: (expedienteId: string, dto: NotificarDeudaDto) => datos(backend.post<ResultadoAvisoDeuda>(`${ANULACION}/${expedienteId}/recaudacion/notificar-deuda`, dto)),

  // --- Distrito (pasos 11-13) y Jurídico: apto / no apto ---------------------------------
  dictaminar: (expedienteId: string, oficina: OficinaDictamen, dto: Dictamen) => datos(backend.post<AnulacionBackend>(`${ANULACION}/${expedienteId}/${oficina}`, dto)),

  // --- Secretaría General (pasos 17-20) ------------------------------------------------
  /** La resolución (número, año, fecha de firma, observaciones) con el PDF escaneado. Pasa a Catastro. */
  resolucion: (expedienteId: string, dto: CargaResolucion) =>
    datos(backend.post<AnulacionBackend>(`${ANULACION}/${expedienteId}/resolucion`, resolucionAFormData(dto), OPCIONES_MULTIPART)),
  /** El PDF de la resolución (con la sesión: por eso no alcanza con un link). */
  archivoResolucion: (expedienteId: string) => datos(backend.get<Blob>(`${ANULACION}/${expedienteId}/resolucion/archivo`, { responseType: 'blob' })),

  // --- Catastro: baja (visto bueno final) ---------------------------------------------
  /** Con la resolución cargada: la anulación finaliza y la concesión queda ANULADA. */
  verificacionFinal: (expedienteId: string, observaciones?: string) => datos(backend.post<AnulacionBackend>(`${ANULACION}/${expedienteId}/verificacion-final`, { observaciones })),
}
