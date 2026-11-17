import type { LatLng } from '@/lib/geo'
import type { DomicilioForm } from '../shared/schemas/domicilio'
import type { TitularForm } from '../shared/schemas/titular'

export type TipoModificacion = 'reduccion' | 'ampliacion'

/** Superficie de la concesión: polígono, hectáreas y caudal que le corresponde. */
export interface SuperficieConcesion {
  coordenadas: LatLng[]
  hectareas: number
  /** Caudal asignado (l/s). */
  caudal: number | null
  /** Usos con la magnitud que corresponde a esta superficie (para el recálculo del caudal). */
  usos: { uso: string; magnitud: string }[]
}

/** Lo que se guarda en `expediente.datos` para una reducción / ampliación. */
export interface DatosExpedienteModificacion {
  numeroExpediente: string
  concesionId: string
  numeroConcesion: string
  /** Titulares de la concesión al iniciar (copia para el circuito y los avisos). */
  titulares: TitularForm[]
  domicilios: DomicilioForm[]
  tipo: TipoModificacion
  /** Superficie vigente al iniciar el trámite. */
  actual: SuperficieConcesion
  /** Nueva superficie propuesta. Se aplica a la concesión recién en el cierre. */
  propuesta: SuperficieConcesion
}
