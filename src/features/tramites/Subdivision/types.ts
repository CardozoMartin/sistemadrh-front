import type { LatLng } from '@/lib/geo'
import type { PreCargaForm } from '../AltaDeConcesion/schemas'
import type { InicioSobreConcesionForm } from '../shared/inicioSobreConcesion'
import type { DomicilioForm } from '../shared/schemas/domicilio'
import type { TitularForm } from '../shared/schemas/titular'

/** La concesión que se subdivide, tal como estaba al iniciar el trámite. */
export interface MadreSubdivision {
  coordenadas: LatLng[]
  hectareas: number
  /** Caudal asignado (l/s). */
  caudal: number | null
  usoId: string | null
  /** Usos con su magnitud (para repartir el caudal entre las fracciones). */
  usos: { uso: string; magnitud: string }[]
  titular: string
  padron: string
}

/** Una fracción de la subdivisión: será una concesión nueva al cierre. */
export interface FraccionSubdivision {
  /** Letra estable de la fracción (A, B, C…). */
  clave: string
  /** Nombre editable (ej: "Lote A"). */
  nombre: string
  color: string
  /** Superficie que se quiere para la fracción (ha); sirve para la división automática. */
  objetivo: number
  /** Polígono dibujado. Vacío = pendiente. */
  coordenadas: LatLng[]
  /** Superficie del polígono dibujado (ha). */
  hectareas: number
  /** Caudal que le corresponde en proporción a la superficie (l/s). */
  caudal: number | null
  /** Datos de la nueva concesión (los mismos del Alta). Null hasta que se abre su formulario. */
  carga: PreCargaForm | null
  /** Última sección alcanzada en el formulario de la fracción. */
  seccionAlcanzada?: number
  /** N° de la nueva concesión: lo asigna Catastro a pedido de Secretaría General. */
  numeroConcesion?: string
}

/** Subdivisión en carga en Catastro (antes de enviarse a Recaudación). Colección /borradoresSubdivision. */
export interface BorradorSubdivision extends InicioSobreConcesionForm {
  id: string
  creado: string // ISO
  actualizado: string // ISO
  /** Copia para listar sin pedir la concesión. */
  numeroConcesion: string
  madre: MadreSubdivision
  /**
   * Datos de la concesión madre en el formato del Alta: es el punto de partida del
   * formulario de cada fracción (titular, ubicación, registro…).
   */
  base: PreCargaForm
  fracciones: FraccionSubdivision[]
}

/** Lo que se guarda en `expediente.datos` para una subdivisión. */
export interface DatosExpedienteSubdivision {
  numeroExpediente: string
  concesionId: string
  numeroConcesion: string
  /** Titulares de la concesión madre al iniciar (copia para el circuito y los avisos). */
  titulares: TitularForm[]
  domicilios: DomicilioForm[]
  madre: MadreSubdivision
  fracciones: FraccionSubdivision[]
}
