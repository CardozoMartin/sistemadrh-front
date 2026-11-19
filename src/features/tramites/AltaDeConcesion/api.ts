// Peticiones del Alta de Concesión al BACKEND REAL (NestJS + PostgreSQL/PostGIS).
// Solo hablan con la API; el cacheo lo hacen los hooks (./hooks.ts).
//
// Quién actúa viaja en el encabezado X-Usuario-Id (lo agrega el cliente `backend`).
// El backend valida todo (etapa, oficina, que el expediente esté tomado, duplicados…) y
// devuelve el mensaje de error listo para mostrar.
import { backend } from '@/services/api/backend'
import type { BorradorAvisoDeuda, NotificarDeudaDto, UsuarioReasignable } from './backend.types'
import type { AltaBackend, AntecedentesDeuda, AuditoriaExpediente, DeudaBackend, DisponibilidadExpediente, EmailExpediente, EntradaHistorial, ExpedienteEnBandeja, OficinaBackend, ResultadoAvisoDeuda, SituacionLegalBackend } from './backend.types'

const ALTA = '/tramites/alta-concesion'

export interface IniciarAltaDto {
  expediente: { numero: string; reparticion: string; anio: number }
  situacionLegal: string
  documentacionPresentada: number[]
}

export type ResultadoDictamen = 'APTO' | 'OBSERVADO' | 'NO_APTO'

const datos = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data)

export const altaConcesionApi = {
  // --- Catálogos y consultas ---------------------------------------------------
  situacionesLegales: () => datos(backend.get<SituacionLegalBackend[]>('/catalogos/situaciones-legales')),
  obtener: (id: string) => datos(backend.get<AltaBackend>(`${ALTA}/${id}`)),
  /** ¿El número de expediente está libre? Se consulta antes de cargar el resto del inicio. */
  disponibilidad: (expediente: { numero: string; reparticion: string; anio: number }) =>
    datos(backend.get<DisponibilidadExpediente>('/expedientes/disponibilidad', { params: expediente })),

  // --- Catastro: carga (una sección por PUT) -------------------------------------
  iniciar: (dto: IniciarAltaDto) => datos(backend.post<AltaBackend>(ALTA, dto)),
  guardarTitulares: (id: string, dto: unknown) => datos(backend.put<AltaBackend>(`${ALTA}/${id}/titulares`, dto)),
  guardarUbicacion: (id: string, formulario: FormData) =>
    datos(backend.put<AltaBackend & { avisos: string[] }>(`${ALTA}/${id}/ubicacion`, formulario, { headers: { 'Content-Type': 'multipart/form-data' } })),
  guardarInmueble: (id: string, dto: unknown) => datos(backend.put<AltaBackend>(`${ALTA}/${id}/inmueble`, dto)),
  guardarUsos: (id: string, dto: unknown) => datos(backend.put<AltaBackend>(`${ALTA}/${id}/usos`, dto)),
  guardarSuministro: (id: string, dto: unknown) => datos(backend.put<AltaBackend>(`${ALTA}/${id}/suministro`, dto)),

  // --- Corrección de errores materiales (con motivo; queda en historial y auditoría) ----
  corregirTitulares: (id: string, dto: object, motivo: string) => datos(backend.put<AltaBackend>(`${ALTA}/${id}/correccion/titulares`, { ...dto, motivo })),
  /** El motivo va como campo más del formulario (multipart, con el KML corregido si lo hay). */
  corregirUbicacion: (id: string, formulario: FormData, motivo: string) => {
    formulario.append('motivo', motivo)
    return datos(backend.put<AltaBackend & { avisos: string[] }>(`${ALTA}/${id}/correccion/ubicacion`, formulario, { headers: { 'Content-Type': 'multipart/form-data' } }))
  },
  corregirInmueble: (id: string, dto: object, motivo: string) => datos(backend.put<AltaBackend>(`${ALTA}/${id}/correccion/inmueble`, { ...dto, motivo })),
  corregirSuministro: (id: string, dto: object, motivo: string) => datos(backend.put<AltaBackend>(`${ALTA}/${id}/correccion/suministro`, { ...dto, motivo })),

  // --- Circuito ------------------------------------------------------------------
  /** Catastro cancela un alta iniciada por error (antes de enviarla): queda anulada y el número se libera. */
  cancelar: (id: string, observaciones: string) => datos(backend.post<AltaBackend>(`${ALTA}/${id}/cancelar`, { observaciones })),
  /** Suelta el alta tomada: vuelve a «sin revisar» de la oficina (quien la tiene, o el Jefe de Catastro). */
  liberar: (id: string) => datos(backend.post<AltaBackend>(`${ALTA}/${id}/liberar`)),
  /** Jefe de Catastro: usuarios de Catastro a los que se puede pasar el alta. */
  reasignables: (id: string) => datos(backend.get<UsuarioReasignable[]>(`${ALTA}/${id}/reasignables`)),
  /** Jefe de Catastro: pasa el alta a otro usuario, con el motivo (queda en el historial). */
  reasignar: (id: string, usuarioId: string, observaciones: string) => datos(backend.post<AltaBackend>(`${ALTA}/${id}/reasignar`, { usuarioId, observaciones })),
  enviar: (id: string, observaciones?: string) => datos(backend.post<AltaBackend>(`${ALTA}/${id}/enviar`, { observaciones })),
  reenviar: (id: string, observaciones?: string) => datos(backend.post<AltaBackend>(`${ALTA}/${id}/reenviar`, { observaciones })),
  /** Concesiones otorgadas de los titulares y si tienen deuda (lo que verifica Recaudación). */
  antecedentesDeuda: (id: string) => datos(backend.get<AntecedentesDeuda>(`${ALTA}/${id}/recaudacion`)),
  /** Por cada concesión otorgada de los titulares, si tiene deuda. Ninguna: pasa a Distrito; alguna: queda en espera. */
  /** Apto: pasa a la oficina siguiente. No apto: queda en espera en Recaudación (con la concesión que debe marcada). */
  recaudacion: (id: string, dto: { resultado: 'APTO' | 'NO_APTO'; concesiones: { concesionId: string; tieneDeuda: boolean }[]; observaciones?: string }) =>
    datos(backend.post<AltaBackend>(`${ALTA}/${id}/recaudacion`, dto)),
  /** En espera por deuda y no se pudo cobrar: pasa igual con la nota de por qué (la deuda sigue pendiente). */
  cursoConDeuda: (id: string, observaciones: string) => datos(backend.post<AltaBackend>(`${ALTA}/${id}/recaudacion/curso-con-deuda`, { observaciones })),
  dictaminar: (id: string, oficina: 'distrito' | 'juridico', dto: { resultado: ResultadoDictamen; observaciones?: string }) =>
    datos(backend.post<AltaBackend>(`${ALTA}/${id}/${oficina}`, dto)),
  numeroConcesion: (id: string) => datos(backend.post<AltaBackend>(`${ALTA}/${id}/numero-concesion`)),
  resolucion: (id: string, dto: { numero: string; anio: number; fecha: string; observaciones?: string }) =>
    datos(backend.post<AltaBackend>(`${ALTA}/${id}/resolucion`, dto)),
  verificacionFinal: (id: string, observaciones?: string) => datos(backend.post<AltaBackend>(`${ALTA}/${id}/verificacion-final`, { observaciones })),
  padron: (id: string, dto: { padron: string; observaciones?: string }) => datos(backend.post<AltaBackend>(`${ALTA}/${id}/padron`, dto)),

  // --- Expediente (común a todos los trámites) ---------------------------------------
  tomar: (id: string) => datos(backend.post(`/expedientes/${id}/tomar`)),
  historial: (id: string) => datos(backend.get<EntradaHistorial[]>(`/expedientes/${id}/historial`)),
  auditoria: (id: string) => datos(backend.get<AuditoriaExpediente>(`/expedientes/${id}/auditoria`)),
  emails: (id: string) => datos(backend.get<EmailExpediente[]>(`/expedientes/${id}/emails`)),
  /** Recaudación: un correo a cada titular con deuda (solo informa en qué concesión, sin montos). */
  /** El correo de cada titular con deuda (texto base), para revisarlo y editarlo antes de enviarlo. */
  borradorAvisoDeuda: (id: string) => datos(backend.get<BorradorAvisoDeuda>(`${ALTA}/${id}/recaudacion/aviso-deuda`)),
  notificarDeuda: (id: string, dto: NotificarDeudaDto) => datos(backend.post<ResultadoAvisoDeuda>(`${ALTA}/${id}/recaudacion/notificar-deuda`, dto)),
  bandeja: (oficina: OficinaBackend) => datos(backend.get<ExpedienteEnBandeja[]>(`/expedientes/bandeja/${oficina}`)),

  // --- Deudas (Recaudación) -----------------------------------------------------------
  deudas: (personaId: string) => datos(backend.get<DeudaBackend[]>('/deudas', { params: { personaId } })),
  cancelarDeuda: (deudaId: string, comprobante?: string) => datos(backend.post(`/deudas/${deudaId}/cancelar`, { comprobante })),
}
