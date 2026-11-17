// Peticiones del Cambio de Titularidad. Solo hablan con la API (sin estado ni caché):
// eso lo resuelven los hooks de ./hooks.ts con TanStack Query.
import { api } from '@/services/api/client'
import { ApiError } from '@/services/api/errors'
import { filtro } from '@/services/api/jsonServer'
import { domiciliosDe, titularesDe, titularPrincipal, type Concesion } from '@/features/concesiones/datos'
import type { EstadoExpediente, Expediente, Oficina } from '@/types/domain'
import { expedientesApi } from '../../expedientes/api'
import { validarInicioSobreConcesion } from '../shared/inicioSobreConcesion'
import { nombreTitular } from '../shared/schemas/titular'
import type { InicioCambioForm, NuevoTitularForm } from './schemas'
import type { BorradorCambioTitularidad, DatosExpedienteCambioTitularidad } from './types'

const BORRADORES = '/borradoresCambioTitularidad'

/** Ya hay un cambio en carga con ese número de expediente o sobre esa concesión. */
export class CambioEnCargaError extends ApiError {
  readonly borradorId: string
  constructor(mensaje: string, borradorId: string) {
    super(mensaje, 409, 'CAMBIO_EN_CARGA')
    this.borradorId = borradorId
  }
}

export interface IniciarCambioInput {
  form: InicioCambioForm
  /** Estados que cuentan como trámite en curso (de /estados). */
  estadosPendientes: EstadoExpediente[]
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
  async listarBorradores(): Promise<BorradorCambioTitularidad[]> {
    const { data } = await api.get<BorradorCambioTitularidad[]>(BORRADORES, { params: { _sort: '-actualizado' } })
    return data
  },

  async obtenerBorrador(id: string): Promise<BorradorCambioTitularidad> {
    const { data } = await api.get<BorradorCambioTitularidad>(`${BORRADORES}/${id}`)
    return data
  },

  /**
   * Paso 1. Valida el número de expediente y que la concesión esté vigente y sin otro
   * trámite en curso. Con el backend real estas validaciones las hace el servidor (409).
   */
  async iniciar({ form, estadosPendientes }: IniciarCambioInput): Promise<BorradorCambioTitularidad> {
    const { numeroExpediente, concesionId } = form
    // Propio del cambio: no puede haber otra carga en curso con ese número o sobre esa concesión.
    const { data: mismoNumero } = await api.get<BorradorCambioTitularidad[]>(BORRADORES, { params: filtro({ numeroExpediente }) })
    if (mismoNumero[0]) throw new CambioEnCargaError(`Ya hay un cambio de titularidad en carga con el expediente ${numeroExpediente}.`, mismoNumero[0].id)
    const { data: mismaConcesion } = await api.get<BorradorCambioTitularidad[]>(BORRADORES, { params: filtro({ concesionId }) })
    if (mismaConcesion[0]) throw new CambioEnCargaError('Ya hay un cambio de titularidad en carga para esa concesión.', mismaConcesion[0].id)

    // Común a todos los trámites sobre una concesión.
    const concesion = await validarInicioSobreConcesion({ numeroExpediente, concesionId, estadosPendientes })

    const ahora = new Date().toISOString()
    const { data } = await api.post<BorradorCambioTitularidad>(BORRADORES, {
      ...form,
      numeroConcesion: concesion.numeroConcesion,
      titularActual: titularPrincipal(concesion),
      creado: ahora,
      actualizado: ahora,
    })
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
