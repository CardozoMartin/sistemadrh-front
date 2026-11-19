// Peticiones del Cambio de Titularidad al BACKEND REAL (NestJS + PostgreSQL).
// Solo hablan con la API; el cacheo lo hacen los hooks (./hooks.ts).
//
// El backend valida todo (concesión vigente, sin otro trámite en curso, número de expediente
// libre, checklist completo, etapa y expediente tomado) y devuelve el mensaje listo para mostrar.
import { backend } from '@/services/api/backend'
import type { FiltrosConcesiones, ResultadoConcesiones } from '@/features/catastro/consultaConcesiones'
import type { titularesADto } from '../AltaDeConcesion/adaptadores'
import type {
  AntecedentesDeuda,
  BorradorAvisoDeuda,
  CambioBackend,
  CambioEnLista,
  DictamenDto,
  DocumentoChecklist,
  NotificarDeudaDto,
  ResolucionDto,
  ResultadoAvisoDeuda,
  VerificacionDeudaDto,
} from './backend.types'

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

  // --- Circuito: común a todos los trámites -----------------------------------------
  /** La oficina que lo tiene lo toma para trabajarlo (antes de actuar). */
  tomar: (expedienteId: string) => datos(backend.post(`/expedientes/${expedienteId}/tomar`)),

  // --- Recaudación (caso de uso, pasos 11-17) -----------------------------------------
  /** Titulares actuales y nuevos, sus concesiones otorgadas y si tienen deuda. */
  antecedentesDeuda: (expedienteId: string) => datos(backend.get<AntecedentesDeuda>(`${CAMBIO}/${expedienteId}/recaudacion`)),
  /** Apto: pasa a Distrito. No apto: queda en espera en Recaudación (con las concesiones con deuda marcadas). */
  verificarDeuda: (expedienteId: string, dto: VerificacionDeudaDto) => datos(backend.post<CambioBackend>(`${CAMBIO}/${expedienteId}/recaudacion`, dto)),
  /** En espera por deuda y no se pudo cobrar: pasa igual a Distrito con la nota de por qué. */
  cursoConDeuda: (expedienteId: string, observaciones: string) => datos(backend.post<CambioBackend>(`${CAMBIO}/${expedienteId}/recaudacion/curso-con-deuda`, { observaciones })),
  /** El correo de cada titular con deuda (texto base), para revisarlo antes de enviarlo. */
  borradorAvisoDeuda: (expedienteId: string) => datos(backend.get<BorradorAvisoDeuda>(`${CAMBIO}/${expedienteId}/recaudacion/aviso-deuda`)),
  notificarDeuda: (expedienteId: string, dto: NotificarDeudaDto) => datos(backend.post<ResultadoAvisoDeuda>(`${CAMBIO}/${expedienteId}/recaudacion/notificar-deuda`, dto)),

  // --- Distrito y Jurídico: apto / no apto (caso de uso, pasos 18-31) ---------------------
  dictaminar: (expedienteId: string, oficina: 'distrito' | 'juridico', dto: DictamenDto) => datos(backend.post<CambioBackend>(`${CAMBIO}/${expedienteId}/${oficina}`, dto)),

  /** Secretaría General: la resolución (número, año, fecha de firma, observaciones) con el PDF escaneado. */
  resolucion: (expedienteId: string, dto: ResolucionDto) => {
    const form = new FormData()
    form.append('numero', dto.numero)
    form.append('anio', String(dto.anio))
    form.append('fecha', dto.fecha)
    if (dto.observaciones) form.append('observaciones', dto.observaciones)
    form.append('archivo', dto.archivo)
    // El cliente manda JSON por defecto: con multipart, axios arma el boundary solo.
    return datos(backend.post<CambioBackend>(`${CAMBIO}/${expedienteId}/resolucion`, form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 }))
  },
  /** Catastro: verificación final. El cambio finaliza y la concesión pasa a los nuevos titulares. */
  verificacionFinal: (expedienteId: string, observaciones?: string) => datos(backend.post<CambioBackend>(`${CAMBIO}/${expedienteId}/verificacion-final`, { observaciones })),
  /** El PDF de la resolución (con la sesión: por eso no alcanza con un link). */
  archivoResolucion: (expedienteId: string) => datos(backend.get<Blob>(`${CAMBIO}/${expedienteId}/resolucion/archivo`, { responseType: 'blob' })),
}
