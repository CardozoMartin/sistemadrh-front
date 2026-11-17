// Peticiones de la Anulación de Concesión. Solo hablan con la API (sin estado ni caché):
// eso lo resuelven los hooks de ./hooks.ts con TanStack Query.
import { domiciliosDe, titularesDe, titularPrincipal } from '@/features/concesiones/datos'
import type { EstadoExpediente, Expediente, Oficina } from '@/types/domain'
import { expedientesApi } from '../../expedientes/api'
import { validarInicioSobreConcesion, type InicioSobreConcesionForm } from '../shared/inicioSobreConcesion'
import type { VerificacionAnulacionForm } from './schemas'
import type { DatosExpedienteAnulacion } from './types'

export interface IniciarAnulacionInput {
  inicio: InicioSobreConcesionForm
  verificacion: VerificacionAnulacionForm
  estadosPendientes: EstadoExpediente[]
  /** Etapa que completa Catastro (primera del circuito, de /etapas). */
  etapaId: string
  oficinaOrigen: Oficina
  oficinaDestino: Oficina
  usuarioId: string
}

export const anulacionApi = {
  /** Paso 1: la concesión elegida y el expediente asignado sirven para iniciar (sin crear nada todavía). */
  async validarInicio(inicio: InicioSobreConcesionForm, estadosPendientes: EstadoExpediente[]): Promise<void> {
    await validarInicioSobreConcesion({ ...inicio, estadosPendientes })
  },

  /**
   * Paso 2 («Iniciar anulación»): vuelve a validar y crea el expediente en la siguiente
   * oficina del circuito. La concesión sigue vigente hasta la baja en el cierre.
   */
  async iniciar({ inicio, verificacion, estadosPendientes, etapaId, oficinaOrigen, oficinaDestino, usuarioId }: IniciarAnulacionInput): Promise<Expediente> {
    const concesion = await validarInicioSobreConcesion({ ...inicio, estadosPendientes })
    const ahora = new Date().toISOString()
    const datos: DatosExpedienteAnulacion = {
      numeroExpediente: inicio.numeroExpediente,
      concesionId: concesion.id,
      numeroConcesion: concesion.numeroConcesion ?? '',
      titulares: titularesDe(concesion),
      domicilios: domiciliosDe(concesion),
      motivo: verificacion.motivo,
      documentacionConfirmada: true,
    }
    return expedientesApi.crear({
      numero: inicio.numeroExpediente,
      tramiteId: 'anulacion',
      estadoId: 'en_tramite',
      oficinaId: oficinaDestino,
      fechaInicio: ahora,
      fechaActualizacion: ahora,
      titular: titularPrincipal(concesion),
      ubicacion: concesion.ubicacion,
      poligono: concesion.poligono,
      usoId: concesion.usoId,
      caudalAsignado: concesion.caudalAsignado,
      numeroConcesion: concesion.numeroConcesion,
      concesionOrigenId: concesion.id,
      resolucion: null,
      padronRentasPendiente: false,
      historial: [{ oficinaId: oficinaOrigen, etapaId, resultado: 'aprobado', fecha: ahora, usuarioId, observaciones: `Motivo: ${verificacion.motivo}` }],
      datos,
    })
  },
}
