// Tipos de dominio compartidos: son el contrato con la API.
//
// Los datos de referencia (nombres, descripciones, circuito, documentación, dotaciones…)
// NO están en el código: vienen de la API (ver services/dominio.ts). Acá solo se tipan
// los ids que el front usa en su lógica o en sus rutas.
import type { LatLng } from '@/lib/geo'

/** Id de oficina (colección /oficinas). */
export type Oficina = 'catastro' | 'recaudacion' | 'distrito' | 'juridico' | 'secretaria_general'

/** Roles de usuario. Por ahora no se usan (no hay login), pero el menú ya los contempla. */
export type Rol = Oficina | 'administrador'

/** Id de tipo de trámite (colección /tramites). */
export type TipoTramite =
  | 'alta_concesion'
  | 'cambio_titularidad'
  | 'anulacion'
  | 'reduccion_ampliacion'
  | 'subdivision'
  | 'reubicacion'
  | 'permiso_uso'

/** Id de estado (colección /estados). */
/** `subdividido`: concesión que se dividió en otras (deja de estar vigente, no se borra). */
export type EstadoExpediente = 'en_tramite' | 'observado' | 'finalizado' | 'anulado' | 'subdividido'

// --- Colecciones de referencia -----------------------------------------------------

export interface OficinaInfo {
  id: Oficina
  nombre: string
  descripcion: string
  descripcionBandeja: string
}

/** Paso del circuito de oficinas. El circuito es la lista ordenada por `orden`. */
export interface EtapaInfo {
  id: string
  nombre: string
  oficinaId: Oficina
  orden: number
}

export interface TramiteInfo {
  id: TipoTramite
  /** Código en la base (ALTA_CONCESION): el que se manda al backend. Solo con el backend real. */
  codigo?: string
  nombre: string
  descripcion: string
  icono: string
}

export type ColorEstado = 'azul' | 'ambar' | 'verde' | 'gris' | 'rojo'

export interface EstadoInfo {
  id: EstadoExpediente
  /** Código en la base (EN_TRAMITE): el que se manda al backend. Solo con el backend real. */
  codigo?: string
  nombre: string
  color: ColorEstado
  /** true = la oficina tiene que atenderlo (aparece en su bandeja). */
  pendiente: boolean
}

export interface SituacionLegalInfo {
  id: string
  nombre: string
  titulo: string
  /** Documentación exigida para esta situación legal. */
  documentacion: string[]
}

export interface UsoInfo {
  id: string
  nombre: string
  /** Litros por segundo por unidad de magnitud (módulo de dotación). */
  dotacion: number
  unidad: string
  /** Exige cargar el punto de entrega de agua (ej: pecuario). */
  requierePuntoEntrega: boolean
}

/** Catálogo simple { id, nombre } (circunscripciones, secciones, caracteres…). */
export interface OpcionCatalogo {
  id: string
  nombre: string
}

export interface Usuario {
  id: string
  nombre: string
  /** null: el usuario «Sistema» (procesos automáticos), que no trabaja en ninguna oficina. */
  oficinaId: Oficina | null
}

// --- Expedientes -------------------------------------------------------------------

/**
 * Archivo adjunto. En la demo solo se guardan los metadatos (json-server no almacena
 * archivos); con el backend real se sube el archivo y se guarda su URL.
 */
export interface Adjunto {
  nombre: string
  tamanioBytes: number
  tipo: string
  url?: string
}

/**
 * Revisión de una oficina. 'aprobado' completa la etapa y el expediente avanza;
 * 'observado' lo deja detenido en esa oficina (deuda, no apto, falta documentación…).
 */
export type ResultadoRevision = 'aprobado' | 'observado'

export interface PasoHistorial {
  oficinaId: Oficina
  etapaId: string
  fecha: string // ISO
  usuarioId: string
  /** Sin valor = aprobado (datos anteriores). */
  resultado?: ResultadoRevision
  observaciones?: string
  /** Datos propios de la revisión de cada oficina (deuda, informe técnico, dictamen…). */
  detalle?: Record<string, unknown>
}

/**
 * Recepción del expediente: un usuario de la oficina lo toma para trabajarlo (antes de
 * revisarlo). Junto con el historial forma la trazabilidad completa del expediente.
 */
export interface RecepcionExpediente {
  oficinaId: Oficina
  /** Etapa del circuito en la que se tomó. */
  etapaId: string
  usuarioId: string
  fecha: string // ISO
}

/**
 * Baja lógica de una concesión (anulación). La concesión no se borra: queda en estado
 * `anulado` con estos datos, y se sigue viendo en búsquedas e historial.
 */
export interface BajaConcesion {
  fecha: string // ISO
  /** Expediente de anulación que la dio de baja. */
  expedienteId: string
  numeroExpediente: string
  resolucion: { numero: string; fecha: string } | null
  motivo: string
}

/** Concesión que salió de una subdivisión (referencia corta para listados e historial). */
export interface ConcesionDerivada {
  id: string
  numeroConcesion: string
  /** Nombre de la fracción (ej: "Lote A"). */
  fraccion: string
  hectareas: number
}

/** Se guarda en la concesión madre al subdividirla (estadoId 'subdividido'). */
export interface SubdivisionConcesion {
  fecha: string // ISO
  /** Expediente de subdivisión que la dividió. */
  expedienteId: string
  numeroExpediente: string
  resolucion: { numero: string; fecha: string } | null
  /** Concesiones nuevas, una por fracción. */
  concesiones: ConcesionDerivada[]
}

/** Pedido de número de concesión de Secretaría General a Catastro (colección /solicitudesNumero). */
export interface SolicitudNumero {
  id: string
  expedienteId: string
  /** Oficina que lo pide. */
  oficinaId: Oficina
  usuarioId: string
  fecha: string // ISO
  estado: 'pendiente' | 'asignada'
  numeroConcesion?: string
  /**
   * Pedido de varios números a la vez (ej: una subdivisión, uno por fracción): qué es cada
   * uno. Sin etiquetas es el pedido de un solo número para el propio expediente.
   */
  etiquetas?: string[]
  /** Números asignados, en el orden de `etiquetas`. */
  numerosConcesion?: string[]
  fechaAsignacion?: string
}

export interface UbicacionInmueble {
  departamento: string
  localidad: string
  distrito: string
}

export interface PoligonoConcesion {
  coordenadas: LatLng[]
  hectareas: number
}

/**
 * Expediente en el circuito de oficinas. Se relaciona por id con las colecciones de
 * referencia (oficinaId → /oficinas, tramiteId → /tramites…). `datos` guarda el
 * formulario completo del trámite.
 */
export interface Expediente {
  id: string
  numero: string
  tramiteId: TipoTramite
  estadoId: EstadoExpediente
  /** Oficina donde está ahora el expediente. */
  oficinaId: Oficina
  fechaInicio: string // ISO
  fechaActualizacion: string // ISO
  /** Nombre del titular principal (para listados). */
  titular: string
  ubicacion: UbicacionInmueble
  poligono: PoligonoConcesion | null
  usoId: string | null
  caudalAsignado: number | null
  /** Lo asigna Catastro a pedido de Secretaría General, antes de la resolución. */
  numeroConcesion: string | null
  resolucion: { numero: string; fecha: string } | null
  /** Al finalizar, queda pendiente la carga en el padrón de Rentas. */
  padronRentasPendiente: boolean
  /**
   * Trámites sobre una concesión vigente (cambio de titularidad, anulación…): id del
   * expediente de la concesión (ver features/concesiones). Null en un alta.
   */
  concesionOrigenId?: string | null
  /**
   * Índices de búsqueda de una concesión (alta finalizada), para que la búsqueda la haga
   * el servidor: fecha de otorgamiento (ISO) y documentos de los titulares actuales
   * separados por espacio. Con el backend real son columnas indexadas.
   */
  fechaOtorgamiento?: string
  documentosTitulares?: string
  /** Solo en una concesión anulada (estadoId 'anulado'): cuándo y por qué se dio de baja. */
  bajaConcesion?: BajaConcesion
  /** Solo en una concesión subdividida (estadoId 'subdividido'): cuándo, por qué expediente y en qué concesiones. */
  subdivisionConcesion?: SubdivisionConcesion
  historial: PasoHistorial[]
  /** Quién tomó el expediente en cada oficina (ver RecepcionExpediente). */
  recepciones?: RecepcionExpediente[]
  datos: unknown
}
