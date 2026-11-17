// Peticiones de la Reducción / Ampliación. Solo hablan con la API (sin estado ni caché).
import { datosConcesion, domiciliosDe, titularesDe, titularPrincipal } from '@/features/concesiones/datos'
import type { EstadoExpediente, Expediente, Oficina } from '@/types/domain'
import { expedientesApi } from '../../expedientes/api'
import { validarInicioSobreConcesion, type InicioSobreConcesionForm } from '../shared/inicioSobreConcesion'
import { NOMBRE_TIPO } from './superficie'
import type { DatosExpedienteModificacion, SuperficieConcesion, TipoModificacion } from './types'

export interface IniciarModificacionInput {
  inicio: InicioSobreConcesionForm
  tipo: TipoModificacion
  propuesta: SuperficieConcesion
  estadosPendientes: EstadoExpediente[]
  etapaId: string
  oficinaOrigen: Oficina
  oficinaDestino: Oficina
  usuarioId: string
}

export const reduccionAmpliacionApi = {
  /** Paso 1: la concesión elegida y el expediente asignado sirven para iniciar (sin crear nada todavía). */
  async validarInicio(inicio: InicioSobreConcesionForm, estadosPendientes: EstadoExpediente[]): Promise<void> {
    await validarInicioSobreConcesion({ ...inicio, estadosPendientes })
  },

  /**
   * Paso 2 («Guardar y siguiente»): vuelve a validar y crea el expediente en la siguiente
   * oficina con la superficie actual y la propuesta. La concesión no cambia hasta el cierre.
   */
  async iniciar({ inicio, tipo, propuesta, estadosPendientes, etapaId, oficinaOrigen, oficinaDestino, usuarioId }: IniciarModificacionInput): Promise<Expediente> {
    const concesion = await validarInicioSobreConcesion({ ...inicio, estadosPendientes })
    const ahora = new Date().toISOString()
    const actual: SuperficieConcesion = {
      coordenadas: concesion.poligono?.coordenadas ?? [],
      hectareas: concesion.poligono?.hectareas ?? 0,
      caudal: concesion.caudalAsignado,
      usos: datosConcesion(concesion)?.usos.items ?? [],
    }
    const datos: DatosExpedienteModificacion = {
      numeroExpediente: inicio.numeroExpediente,
      concesionId: concesion.id,
      numeroConcesion: concesion.numeroConcesion ?? '',
      titulares: titularesDe(concesion),
      domicilios: domiciliosDe(concesion),
      tipo,
      actual,
      propuesta,
    }
    const resumen = `${NOMBRE_TIPO[tipo]} de ${actual.hectareas.toFixed(2)} ha a ${propuesta.hectareas.toFixed(2)} ha`
    return expedientesApi.crear({
      numero: inicio.numeroExpediente,
      tramiteId: 'reduccion_ampliacion',
      estadoId: 'en_tramite',
      oficinaId: oficinaDestino,
      fechaInicio: ahora,
      fechaActualizacion: ahora,
      titular: titularPrincipal(concesion),
      ubicacion: concesion.ubicacion,
      // Polígono y caudal propuestos (los vigentes siguen en la concesión hasta el cierre).
      poligono: { coordenadas: propuesta.coordenadas, hectareas: propuesta.hectareas },
      usoId: concesion.usoId,
      caudalAsignado: propuesta.caudal,
      numeroConcesion: concesion.numeroConcesion,
      concesionOrigenId: concesion.id,
      resolucion: null,
      padronRentasPendiente: false,
      historial: [{ oficinaId: oficinaOrigen, etapaId, resultado: 'aprobado', fecha: ahora, usuarioId, observaciones: `${resumen}.` }],
      datos,
    })
  },
}
