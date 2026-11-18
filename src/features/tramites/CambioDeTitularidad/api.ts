// Peticiones del Cambio de Titularidad. Solo hablan con la API (sin estado ni caché):
// eso lo resuelven los hooks de ./hooks.ts con TanStack Query.
import { api } from '@/services/api/client'
import { backend } from '@/services/api/backend'
import { domiciliosDe, titularesDe, titularPrincipal, type Concesion } from '@/features/concesiones/datos'
import type { Expediente, Oficina } from '@/types/domain'
import { expedientesApi } from '../../expedientes/api'
import { nombreTitular } from '../shared/schemas/titular'
import type { InicioCambioForm, NuevoTitularForm } from './schemas'
import type { BorradorCambioTitularidad, DatosExpedienteCambioTitularidad } from './types'

const BORRADORES = '/borradoresCambioTitularidad'
/** Backend real (NestJS): ver backend/src/tramites/cambio-titularidad/README.md. */
const CAMBIO = '/tramites/cambio-titularidad'

/** Un cambio en trámite (GET /tramites/cambio-titularidad). */
export interface CambioEnTramite {
  expedienteId: string
  /** N° completo: "123/332-2026". */
  expediente: string
  concesion: { id: string; numero: string | null }
  estado: string
  /** Etapa del circuito (CARGA, CORRECCION, RECAUDACION…). */
  etapa: string
  oficinaActual: string
  nuevoTitular: string | null
  creadoEn: string
}

/** Respuesta de POST /tramites/cambio-titularidad (solo lo que usa el inicio). */
export interface CambioIniciado {
  expediente: { id: string }
}

export interface EnviarCambioInput {
  borrador: BorradorCambioTitularidad
  datos: NuevoTitularForm
  concesion: Concesion
  /** Etapa que completa Catastro (primera etapa del circuito, de /etapas). */
  etapaId: string
  oficinaOrigen: Oficina
  oficinaDestino: Oficina
  usuarioId: string
}

/** "Titular actual → Nuevo titular", para los listados y las bandejas. */
export const descripcionCambio = (actual: string, nuevo: string) => `${actual} → ${nuevo}`

export const cambioTitularidadApi = {
  async obtenerBorrador(id: string): Promise<BorradorCambioTitularidad> {
    const { data } = await api.get<BorradorCambioTitularidad>(`${BORRADORES}/${id}`)
    return data
  },

  /** Cambios en trámite (backend real), del más nuevo al más viejo. */
  async listarEnTramite(): Promise<CambioEnTramite[]> {
    const { data } = await backend.get<CambioEnTramite[]>(CAMBIO)
    return data
  },

  /**
   * Paso 1 (backend real). El servidor valida que el N° de expediente esté libre y sea del año,
   * y que la concesión esté vigente y sin otro trámite en curso (409 con el mensaje).
   */
  async iniciar(form: InicioCambioForm): Promise<CambioIniciado> {
    const { data } = await backend.post<CambioIniciado>(CAMBIO, { concesionId: form.concesionId, expediente: form.expediente })
    return data
  },

  /** Paso 2. Guarda el avance de los datos del nuevo titular. */
  async guardarDatos(id: string, datos: NuevoTitularForm): Promise<BorradorCambioTitularidad> {
    const { data } = await api.patch<BorradorCambioTitularidad>(`${BORRADORES}/${id}`, { datos, actualizado: new Date().toISOString() })
    return data
  },

  async eliminarBorrador(id: string): Promise<void> {
    await api.delete(`${BORRADORES}/${id}`)
  },

  /**
   * Cierra la carga en Catastro: crea el expediente en la siguiente oficina con los datos
   * de la concesión y del nuevo titular, y borra el borrador. El backend real debería
   * hacerlo en una sola operación (transacción).
   */
  async enviar({ borrador, datos, concesion, etapaId, oficinaOrigen, oficinaDestino, usuarioId }: EnviarCambioInput): Promise<Expediente> {
    const ahora = new Date().toISOString()
    const completo: DatosExpedienteCambioTitularidad = {
      numeroExpediente: borrador.numeroExpediente,
      concesionId: concesion.id,
      numeroConcesion: concesion.numeroConcesion ?? borrador.numeroConcesion,
      titularesAnteriores: titularesDe(concesion),
      domiciliosAnteriores: domiciliosDe(concesion),
      ...datos,
    }

    const expediente = await expedientesApi.crear({
      numero: borrador.numeroExpediente,
      tramiteId: 'cambio_titularidad',
      estadoId: 'en_tramite',
      oficinaId: oficinaDestino,
      fechaInicio: borrador.creado,
      fechaActualizacion: ahora,
      titular: descripcionCambio(titularPrincipal(concesion), nombreTitular(datos.titulares[0])),
      // La concesión no cambia de lugar ni de caudal: se copian sus datos.
      ubicacion: concesion.ubicacion,
      poligono: concesion.poligono,
      usoId: concesion.usoId,
      caudalAsignado: concesion.caudalAsignado,
      numeroConcesion: concesion.numeroConcesion,
      concesionOrigenId: concesion.id,
      resolucion: null,
      padronRentasPendiente: false,
      historial: [{ oficinaId: oficinaOrigen, etapaId, resultado: 'aprobado', fecha: ahora, usuarioId }],
      datos: completo,
    })

    await cambioTitularidadApi.eliminarBorrador(borrador.id)
    return expediente
  },
}
