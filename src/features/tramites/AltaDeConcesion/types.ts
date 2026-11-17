import type { DomicilioForm } from '../shared/schemas/domicilio'
import type { TitularForm } from '../shared/schemas/titular'
import type { InicioAltaForm, PreCargaForm } from './schemas'

/** Alta en carga en Catastro (antes de derivarse a Recaudación). Colección /borradoresAlta. */
export interface BorradorAlta extends InicioAltaForm {
  id: string
  creado: string // ISO
  actualizado: string // ISO
  /** Pre carga de datos (paso 2). Se guarda al avanzar de sección. */
  datos?: PreCargaForm
  /** Índice de la última sección alcanzada en la pre carga. */
  seccionAlcanzada?: number
}

/** Titulares que tuvo la concesión antes de un cambio de titularidad (no se borran: trazabilidad). */
export interface TitularidadAnterior {
  titulares: TitularForm[]
  domicilios: DomicilioForm[]
  /** Fecha (ISO) en que dejaron de ser titulares. */
  hasta: string
  /** Expediente de cambio de titularidad que los reemplazó. */
  expedienteId: string
  numeroExpediente: string
}

/** Superficie que tuvo la concesión antes de una reducción / ampliación (no se pisa: trazabilidad). */
export interface SuperficieAnterior {
  tipo: 'reduccion' | 'ampliacion'
  coordenadas: [number, number][]
  hectareas: number
  caudal: number | null
  /** Superficie y caudal con que quedó. */
  hectareasNueva: number
  caudalNuevo: number | null
  /** Fecha (ISO) en que se aplicó el cambio. */
  fecha: string
  expedienteId: string
  numeroExpediente: string
  resolucion: { numero: string; fecha: string } | null
}

/** Una concesión nacida de una subdivisión: de qué concesión y por qué expediente. */
export interface OrigenSubdivision {
  tipo: 'subdivision'
  concesionMadreId: string
  numeroConcesionMadre: string
  expedienteId: string
  numeroExpediente: string
  /** Nombre de la fracción (ej: "Lote A"). */
  fraccion: string
}

/** Lo que se guarda en `expediente.datos` para un alta de concesión. */
export interface DatosExpedienteAlta extends InicioAltaForm, PreCargaForm {
  /** Historial de titulares (lo completan los cambios de titularidad). */
  titularesAnteriores?: TitularidadAnterior[]
  /** Historial de superficies (lo completan las reducciones / ampliaciones). */
  superficiesAnteriores?: SuperficieAnterior[]
  /** Solo si la concesión salió de una subdivisión (no tuvo un alta propia). */
  origen?: OrigenSubdivision
}
