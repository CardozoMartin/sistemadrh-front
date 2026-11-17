// Tipos de lo que devuelve el backend real para la Baja de Pozo
// (backend/src/tramites/baja-pozo y backend/src/pozos/pozos.service.ts).
import type { EstadoExpedienteBackend } from '@/features/tramites/AltaDeConcesion/backend.types'

export type EtapaBaja = 'INICIO_POZOS' | 'ANTECEDENTES_POZOS' | 'EVALUACION_TECNICA_POZOS' | 'CORRECCION_POZOS' | 'JURIDICO' | 'SECRETARIA_GENERAL' | 'CLAUSURA_POZOS'
export type OficinaBaja = 'pozos' | 'juridico' | 'secretaria_general'
export type OrigenBaja = 'A_SOLICITUD' | 'DE_OFICIO'
export type EstadoBaja = 'EN_TRAMITE' | 'EN_ESPERA' | 'OBSERVADA' | 'CLAUSURA_PENDIENTE' | 'CONFIRMADA' | 'RECHAZADA'

/** Un documento del checklist de la mesa de entrada. */
export interface DocumentoBaja {
  codigo: string
  descripcion: string
  obligatorio: boolean
}

/** Ficha de un pozo (búsqueda y detalle). */
export interface PozoBackend {
  id: string
  idInterno: string
  alias: string | null
  estado: 'EN_USO' | 'FUERA_DE_SERVICIO' | 'PARADO' | 'BAJA' | 'ANULADO'
  origen: string
  tipoPozo: string | null
  jurisdiccionDrh: boolean
  profundidadM: number | null
  caudalM3h: number | null
  caudalLps: number | null
  /** POSGAR 07 faja 3. */
  coordX: number
  coordY: number
  latitud: number
  longitud: number
  concesion: { id: string; numero: string | null; estado: string; titular: string | null; departamento: string | null; localidad: string | null } | null
  bajaAbierta: { expedienteId: string; expediente: string; etapa: EtapaBaja; oficina: OficinaBaja } | null
  /** Si el pozo está dado de baja: cómo, cuándo, por qué y quién la registró. */
  bajaConfirmada: {
    origen: OrigenBaja
    fechaBaja: string | null
    motivo: string
    /** Solo las bajas a solicitud tienen expediente y resolución. */
    expedienteId: string | null
    expediente: string | null
    resolucion: string | null
    /** Número de la concesión que abastecía (el pozo se desvincula al darlo de baja). */
    concesionAnterior: string | null
    /** Si la resolución anuló también la concesión. */
    concesionAnulada: boolean
    /** Solo si correspondía clausura física: fecha y acta (null mientras está pendiente). */
    clausura: { fecha: string | null; acta: string | null } | null
    usuario: string
  } | null
  /** El expediente de la concesión y los de las bajas del pozo, del más nuevo al más viejo. */
  expedientes: { id: string; numero: string; tipoTramite: string; estado: EstadoExpedienteBackend }[]
}

export interface BajaBackend {
  expediente: {
    id: string
    numero: string
    tipoTramite: string
    estado: EstadoExpedienteBackend
    etapa: EtapaBaja
    etapaNombre: string
    oficinaActual: OficinaBaja
    oficinaNombre: string
    tomadoPor: { id: string; nombre: string } | null
    tomadoEn: string | null
  }
  baja: {
    id: string
    origen: OrigenBaja
    estado: EstadoBaja
    motivo: string
    solicitanteNombre: string | null
    solicitanteDocumento: string | null
    documentacion: (DocumentoBaja & { presentado: boolean })[]
    inspeccionRealizada: boolean | null
    fechaInspeccion: string | null
    observacionesInspeccion: string | null
    informeTecnico: string | null
    requiereClausura: boolean | null
    anularConcesion: boolean | null
    estadoPozoAnterior: string
    /** Concesión que abastecía el pozo al iniciar la baja. */
    concesionAnterior: string | null
    /** «145/2026». */
    resolucion: string | null
    fechaBaja: string | null
    clausura: { fecha: string; acta: string; observaciones: string | null } | null
    avisoDistrito: { enviado: string; visto: string | null } | null
    creadoEn: string
  }
  pozo: PozoBackend
  /** Deudas pendientes de los titulares de la concesión (tasa de uso del agua). */
  deudasTasa: { persona: string; detalle: string; monto: number | null }[]
}

/** Una fila de la lista de bajas. Las de oficio no tienen expediente (esos campos van en null). */
export interface BajaEnLista {
  expedienteId: string | null
  expediente: string | null
  pozo: { id: string; idInterno: string; alias: string | null }
  origen: OrigenBaja
  estado: EstadoBaja
  etapa: EtapaBaja | null
  etapaNombre: string | null
  oficina: OficinaBaja | null
  oficinaNombre: string | null
  tomadoPor: string | null
  solicitante: string | null
  iniciada: string
  fechaBaja: string | null
}

/** Baja aprobada de la que Distrito tiene que tomar conocimiento. */
export interface AvisoDistrito {
  bajaId: string
  origen: OrigenBaja
  estado: EstadoBaja
  fechaBaja: string | null
  motivo: string
  pozo: { id: string; idInterno: string; alias: string | null }
  concesion: string | null
  concesionAnulada: boolean
  requiereClausura: boolean
  ubicacion: { distrito: string | null; departamento: string | null; localidad: string | null }
  expedienteId: string | null
  expediente: string | null
  resolucion: string | null
  avisado: string
  visto: { en: string; por: string } | null
}

/** Datos de la solicitud que carga y corrige Pozos (mesa de entrada). */
export interface DatosBajaDto {
  motivo: string
  solicitanteNombre: string
  solicitanteDocumento?: string
  documentacionPresentada: string[]
}

/** Baja a solicitud del titular: con expediente, recorre el circuito. */
export interface IniciarBajaDto extends DatosBajaDto {
  pozoId: string
  expediente: { numero: string; reparticion: string; anio: number }
}

/** Baja de oficio: en el acto, sin expediente ni solicitante. */
export interface BajaDeOficioDto {
  motivo: string
  fechaInspeccion?: string
  observacionesInspeccion?: string
}

export interface EvaluacionTecnicaDto {
  resultado: 'FAVORABLE' | 'REQUIERE_SUBSANACION'
  inspeccionRealizada: boolean
  fechaInspeccion?: string
  observacionesInspeccion?: string
  informeTecnico: string
  requiereClausura?: boolean
}

export interface DictamenJuridicoDto {
  resultado: 'APTO' | 'OBSERVADO' | 'NO_APTO'
  anularConcesion?: boolean
  observaciones?: string
}

export interface ResolucionBajaDto {
  decision: 'APROBAR' | 'RECHAZAR'
  numero: string
  anio: number
  fecha: string
  observaciones?: string
}
