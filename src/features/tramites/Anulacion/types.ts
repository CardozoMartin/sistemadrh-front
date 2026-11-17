import type { DomicilioForm } from '../shared/schemas/domicilio'
import type { TitularForm } from '../shared/schemas/titular'

/** Lo que se guarda en `expediente.datos` para una anulación de concesión. */
export interface DatosExpedienteAnulacion {
  numeroExpediente: string
  concesionId: string
  numeroConcesion: string
  /** Titulares de la concesión al iniciar la anulación (copia para el circuito y la auditoría). */
  titulares: TitularForm[]
  domicilios: DomicilioForm[]
  /** Motivo de la baja (RN-A04: obligatorio en toda anulación). */
  motivo: string
  /** Catastro confirmó que la documentación está completa (verificación de datos). */
  documentacionConfirmada: true
}
