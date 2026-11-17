// Padrón de pozos (listado por origen). PROTOTIPO: lo responde el backend emulado
// (services/demo/servidor/pozos.ts, GET /pozos/padron).
import type { EstadoBaja, OrigenBaja, PozoBackend } from '../BajaDePozo/types'

/** Cómo entró el pozo al padrón. */
export type OrigenPozo = 'OFICIO' | 'AUTORIZACION' | 'MIGRACION'

export interface PozoEnPadron {
  id: string
  idInterno: string
  alias: string | null
  estado: PozoBackend['estado']
  origen: OrigenPozo
  jurisdiccionDrh: boolean
  profundidadM: number | null
  caudalLps: number | null
  coordX: number
  coordY: number
  latitud: number
  longitud: number
  departamento: string | null
  localidad: string | null
  distrito: string | null
  concesion: { id: string; numero: string | null; titular: string | null; documento: string | null; expediente: string | null } | null
  /** Fecha de alta en el padrón: la de ingreso del registro de oficio. Los migrados no la tienen. */
  fechaAlta: string | null
  /** La baja más reciente del pozo (en trámite o aprobada). null si nunca se pidió la baja. */
  baja: {
    origen: OrigenBaja
    estado: EstadoBaja
    motivo: string
    /** Fecha en que quedó dada de baja (null mientras está en trámite). */
    fechaBaja: string | null
    iniciada: string
    expediente: string | null
    solicitante: string | null
    /** Concesión que abastecía (el pozo se desvincula al darlo de baja). */
    concesionAnterior: string | null
  } | null
  /** Solo los registrados de oficio (los migrados vienen del padrón anterior, sin ficha). */
  registro: {
    expediente: string
    /** Expediente del circuito y dónde está. */
    expedienteId: string
    circuito: { estado: string; etapaNombre: string; oficinaNombre: string }
    motivo: string
    causante: string
    documento: string | null
    fechaIngreso: string
    asunto: string | null
    registradoPor: string
    registradoEn: string
    /** En qué se cargó la coordenada (la otra forma la calculó el sistema). */
    sistemaCoordenada: 'POSGAR_FAJA3' | 'WGS84'
    monitoreos: { hidraulicos: number; quimicos: number }
  } | null
}

/** Situación de baja del pozo, para filtrar. */
export type FiltroBaja = 'SIN_BAJA' | 'BAJA_DE_OFICIO' | 'BAJA_A_SOLICITUD' | 'BAJA_EN_TRAMITE' | 'DADO_DE_BAJA'

/** Sobre qué fecha se aplica el rango desde/hasta. */
export type CampoFecha = 'ALTA' | 'BAJA' | 'MONITOREO'

/**
 * Filtros de la consulta de pozos. Todos son opcionales y se combinan (Y): un pozo aparece
 * solo si cumple todos los que se completaron. Viajan como query string a GET /pozos/padron.
 */
export interface FiltrosPozos {
  origen?: OrigenPozo
  /** Búsqueda libre: todas las palabras, en cualquier campo. */
  q?: string
  estado?: PozoEnPadron['estado']
  baja?: FiltroBaja
  /** N° de concesión (actual o la que abastecía antes de la baja). */
  concesion?: string
  conConcesion?: 'SI' | 'NO'
  /** Cualquier expediente del pozo: registro de oficio, alta de la concesión o baja. */
  expediente?: string
  /** Titular, causante o solicitante de la baja: nombre o CUIT/DNI. */
  cliente?: string
  departamento?: string
  localidad?: string
  distrito?: string
  /** Motivo del registro de oficio. */
  motivo?: string
  /** Estado del circuito del registro de oficio. */
  circuito?: 'EN_CURSO' | 'FINALIZADO' | 'RECHAZADO'
  jurisdiccion?: 'SI' | 'NO'
  monitoreos?: 'CON' | 'SIN'
  campoFecha?: CampoFecha
  desde?: string
  hasta?: string
  profundidadMin?: string
  profundidadMax?: string
  caudalMin?: string
  caudalMax?: string
}

export interface PadronPozos {
  pozos: PozoEnPadron[]
  /** Cuántos hay de cada origen (para las solapas), con todos los filtros salvo el origen. */
  totales: Record<OrigenPozo | 'TODOS', number>
  /** Valores que existen en el padrón, para armar las listas de los filtros. */
  opciones: { departamentos: string[]; localidades: string[]; distritos: string[]; motivos: string[] }
}
