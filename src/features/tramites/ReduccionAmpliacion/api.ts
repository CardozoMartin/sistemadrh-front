// Peticiones de la Ampliación / Reducción al BACKEND REAL (NestJS + PostgreSQL / PostGIS).
// Solo hablan con la API; el cacheo lo hacen los hooks (./hooks.ts). El backend valida todo
// (concesión vigente, sin otro trámite en curso, checklist, el plano con PostGIS…) y devuelve el
// mensaje listo para mostrar. Las oficinas (Recaudación…Secretaría) usan los paneles comunes de
// shared/circuito con estos endpoints.
import { backend } from '@/services/api/backend'
import type { titularesADto } from '../AltaDeConcesion/adaptadores'
import type { DocumentoChecklist } from '../shared/checklist'
import type { AntecedentesDeuda, BorradorAvisoDeuda, NotificarDeudaDto, ResultadoAvisoDeuda } from '../shared/circuito/deuda.types'
import { expedienteApi } from '../shared/circuito/expediente'
import type { Dictamen, OficinaDictamen } from '../shared/circuito/PanelDictamen'
import type { VerificacionDeuda } from '../shared/circuito/recaudacion'
import { OPCIONES_MULTIPART, resolucionAFormData, type CargaResolucion } from '../shared/circuito/resolucion'
import type { ModificacionBackend, ModificacionConAvisos, ModificacionEnLista, TipoModificacionBackend } from './backend.types'

export const RUTA_MODIFICACION = '/tramites/ampliacion-reduccion'

export interface IniciarModificacionDto {
  concesionId: string
  tipo: TipoModificacionBackend
  expediente: { numero: string; reparticion: string; anio: number }
  /** Ids de los papeles del checklist que trae el expediente. */
  documentacionPresentada: number[]
}

/** POST …/verificacion-final: Catastro cierra con el caudal asignado que fijó la resolución. */
export interface VerificacionFinalModificacionDto {
  observaciones?: string
  caudalAsignadoLps?: number
}

const datos = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data)
const de = (id: string, sub = '') => `${RUTA_MODIFICACION}/${id}${sub}`

export const modificacionApi = {
  // --- Consultas -------------------------------------------------------------------
  checklist: () => datos(backend.get<DocumentoChecklist[]>('/catalogos/documentos/AMPLIACION_REDUCCION')),
  /** Trámites en curso (con `todos`, también los terminados). */
  listar: (todos = false) => datos(backend.get<ModificacionEnLista[]>(RUTA_MODIFICACION, { params: todos ? { todos: true } : undefined })),
  obtener: (expedienteId: string) => datos(backend.get<ModificacionBackend>(de(expedienteId))),

  // --- Catastro: inicio y carga -------------------------------------------------------
  iniciar: (dto: IniciarModificacionDto) => datos(backend.post<ModificacionBackend>(RUTA_MODIFICACION, dto)),
  /** El plano de la nueva superficie (KML o GeoJSON): el backend lo valida, lo mide y recalcula usos y caudal. */
  subirPlano: (expedienteId: string, archivo: File) => {
    const form = new FormData()
    form.append('archivo', archivo)
    return datos(backend.put<ModificacionConAvisos>(de(expedienteId, '/superficie'), form, OPCIONES_MULTIPART))
  },
  /** El plano tal como se presentó (para descargarlo). */
  archivoPlano: (expedienteId: string) => datos(backend.get<Blob>(de(expedienteId, '/superficie/archivo'), { responseType: 'blob' })),
  /** Optativo: nuevos titulares (mismo cuerpo que el alta) / quitarlos. */
  guardarTitulares: (expedienteId: string, dto: ReturnType<typeof titularesADto>) => datos(backend.put<ModificacionBackend>(de(expedienteId, '/titulares'), dto)),
  quitarTitulares: (expedienteId: string) => datos(backend.delete<ModificacionBackend>(de(expedienteId, '/titulares'))),
  /** Iniciado por error: queda anulado (motivo obligatorio, 10 caracteres o más). */
  cancelar: (expedienteId: string, observaciones: string) => datos(backend.post<ModificacionBackend>(de(expedienteId, '/cancelar'), { observaciones })),
  /** Termina la carga y la envía a Recaudación. */
  enviar: (expedienteId: string, observaciones?: string) => datos(backend.post<ModificacionBackend>(de(expedienteId, '/enviar'), { observaciones })),
  /** Corrigió lo observado: vuelve a la oficina que lo observó. */
  reenviar: (expedienteId: string, observaciones?: string) => datos(backend.post<ModificacionBackend>(de(expedienteId, '/reenviar'), { observaciones })),

  // --- Circuito: común a todos los trámites -----------------------------------------
  /** La oficina que lo tiene lo toma para trabajarlo (antes de actuar). */
  tomar: expedienteApi.tomar,

  // --- Recaudación (sin «dar curso con deuda»: con deuda este trámite no avanza) ------------
  antecedentesDeuda: (expedienteId: string) => datos(backend.get<AntecedentesDeuda>(de(expedienteId, '/recaudacion'))),
  verificarDeuda: (expedienteId: string, dto: VerificacionDeuda) => datos(backend.post<unknown>(de(expedienteId, '/recaudacion'), dto)),
  borradorAvisoDeuda: (expedienteId: string) => datos(backend.get<BorradorAvisoDeuda>(de(expedienteId, '/recaudacion/aviso-deuda'))),
  notificarDeuda: (expedienteId: string, dto: NotificarDeudaDto) => datos(backend.post<ResultadoAvisoDeuda>(de(expedienteId, '/recaudacion/notificar-deuda'), dto)),

  // --- Distrito y Jurídico (apto / observado / no apto) --------------------------------
  dictaminar: (expedienteId: string, oficina: OficinaDictamen, dto: Dictamen) => datos(backend.post<unknown>(de(expedienteId, `/${oficina}`), dto)),

  // --- Secretaría General ----------------------------------------------------------------
  /** La resolución (número, año, fecha de firma, observaciones) con el PDF escaneado. Pasa a Catastro. */
  resolucion: (expedienteId: string, dto: CargaResolucion) => datos(backend.post<unknown>(de(expedienteId, '/resolucion'), resolucionAFormData(dto), OPCIONES_MULTIPART)),
  /** El PDF de la resolución (con la sesión: por eso no alcanza con un link). */
  archivoResolucion: (expedienteId: string) => datos(backend.get<Blob>(de(expedienteId, '/resolucion/archivo'), { responseType: 'blob' })),

  // --- Catastro: verificación final ----------------------------------------------------
  /** Con la resolución cargada: la concesión queda con la nueva superficie y el caudal asignado. */
  verificacionFinal: (expedienteId: string, dto: VerificacionFinalModificacionDto) => datos(backend.post<unknown>(de(expedienteId, '/verificacion-final'), dto)),
}
