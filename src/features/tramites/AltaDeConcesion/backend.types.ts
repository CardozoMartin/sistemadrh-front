// Tipos de lo que devuelve el backend real para el Alta de Concesión
// (backend/src/tramites/alta-concesion/alta-concesion.respuesta.ts).
import type { MultiPolygon } from 'geojson'
import type { Superposicion } from '@/services/sig'

export type EtapaCircuito = 'CARGA' | 'CORRECCION' | 'RECAUDACION' | 'DISTRITO' | 'JURIDICO' | 'SECRETARIA_GENERAL' | 'CIERRE' | 'ESPERA_PADRON'
export type EstadoExpedienteBackend = 'EN_TRAMITE' | 'OBSERVADO' | 'EN_ESPERA' | 'FINALIZADO' | 'RECHAZADO' | 'ARCHIVADO' | 'ANULADO'
export type OficinaBackend = 'catastro' | 'recaudacion' | 'distrito' | 'juridico' | 'secretaria_general'

export interface CircuitoAlta {
  estado: EstadoExpedienteBackend
  etapa: EtapaCircuito
  etapaNombre: string
  oficinaActual: OficinaBackend
  oficinaNombre: string
  tomadoPor: { id: string; nombre: string } | null
  tomadoEn: string | null
}

export interface TitularBackend {
  personaId: string
  tipoPersona: 'FISICA' | 'JURIDICA'
  tipoDocumento: 'DNI' | 'CUIL' | 'CUIT' | null
  documento: string | null
  apellido: string | null
  nombre: string | null
  fechaNacimiento: string | null
  razonSocial: string | null
  fechaConstitucion: string | null
  email: string | null
  telefono: string | null
}

/** Recaudación le dio curso con deuda: su nota y las deudas, con el estado de hoy. */
export interface AvisoDeudaBackend {
  fecha: string
  usuario: string
  observaciones: string
  deudas: { id: string; detalle: string; titular: string; pendiente: boolean; canceladaEn: string | null }[]
  /** false si después se pagó todo. */
  sigueConDeuda: boolean
}

export interface AltaBackend {
  id: string
  /** Recaudación le dio curso con deuda (null: pasó sin deuda o todavía no pasó). El modo demo no lo informa. */
  avisoDeuda?: AvisoDeudaBackend | null
  /** El usuario no tiene «Ver datos sensibles»: documentos enmascarados, sin contacto ni domicilios. */
  datosSensiblesOcultos?: boolean
  numeroExpediente: string
  expediente: { numero: string; reparticion: string; anio: number }
  fechaIngreso: string
  actualizado: string
  circuito: CircuitoAlta
  situacionLegal: { codigo: string; nombre: string } | null
  documentacionPresentada: { id: number; descripcion: string }[]
  concesion: {
    id: string
    numero: string | null
    estado: string
    caudalAsignado: number | null
    fechaOtorgamiento: string | null
    resolucion: { numero: string; anio: number; fecha: string } | null
  }
  titulares: TitularBackend[]
  domicilios: { id: string; calle: string; numero: string | null; departamento: string; localidad: string; distrito: string }[]
  ubicacion: {
    departamento: string | null
    localidad: string | null
    distrito: string | null
    poligono: {
      id: string
      geojson: MultiPolygon
      superficieHa: number
      perimetroM: number
      puntoInterior: { latitud: number; longitud: number }
      origen: string
      archivo: { nombre: string; bytes: number } | null
      desde: string
    } | null
    /** Corrección del polígono publicado que espera aprobación (mientras tanto rige y se publica `poligono`). */
    poligonoPropuesto: {
      id: string
      superficieHa: number
      archivo: string | null
      publicacion: 'PENDIENTE' | 'OBSERVADO' | 'PUBLICADO'
      nota: string | null
      creadoEn: string
    } | null
    superposiciones: Superposicion[]
  } | null
  inmueble: {
    catastral: { padron: string | null; matricula: string; circunscripcion: string | null; seccion: string | null; parcela: string; lamina: string | null; orden: string | null }
    registral: { libro: string | null; folio: string | null; anio: number | null; matricula: string | null; serie: string | null }
  } | null
  usos: {
    caracter: 'PERMANENTE' | 'EVENTUAL' | null
    codigoServicio: number | null
    periodoInicio: string | null
    periodoFin: string | null
    /**
     * X/Y POSGAR 2007 faja 3 (null en puntos cargados antes) y latitud/longitud WGS84, con el
     * sistema en que se cargó (POSGAR_FAJA3 o WGS84).
     */
    desague: { sistema: string; x: number | null; y: number | null; latitud: number; longitud: number } | null
    items: { uso: string; nombre: string; unidad: string; magnitud: number; dotacion: number; caudal: number }[]
    puntoEntrega: { sistema: string; x: number | null; y: number | null; latitud: number; longitud: number; referencia: string | null } | null
    caudalCalculado: number
  } | null
  suministro: {
    fuentes: string[]
    sistemaDistribucion: string | null
    canalPrincipal: string | null
    canalSecundario: string | null
    canalTerciario: string | null
    canalCuarto: string | null
    canalQuinto: string | null
    desague: string | null
    observacion: string | null
  } | null
  pasos: Record<'inicio' | 'titulares' | 'ubicacion' | 'inmueble' | 'usos' | 'suministro', boolean>
}

export interface SituacionLegalBackend {
  codigo: string
  nombre: string
  titulo: string
  documentos: { id: number; descripcion: string }[]
}

/**
 * Lo que resolvió una oficina. Si quien mira es de otra oficina (reservado), solo se sabe
 * quién actuó, dónde y cuándo: sin el tipo, el resultado, las observaciones ni los datos.
 */
export type ActuacionHistorial = {
  tipo: 'ACTUACION'
  fecha: string
  oficina: string
  etapa: string
  usuario: string
} & (
  | { reservado?: false; actuacion: string; resultado: string; observaciones: string | null; datos: Record<string, unknown> | null }
  | { reservado: true; actuacion: null; resultado: null; observaciones: null; datos: null }
)

/** Una entrada del historial: un pase entre oficinas, una actuación de una oficina o un cambio de estado. */
export type EntradaHistorial =
  | {
      tipo: 'PASE'
      fecha: string
      oficinaOrigen: string | null
      oficinaDestino: string
      etapa: string
      enviadoPor: string
      recibidoPor: string | null
      recibidoEn: string | null
      esDevolucion: boolean
      /** true: quien mira no es de la oficina que lo envió ni de la que lo recibe (sin dictamen ni observaciones). */
      reservado?: boolean
      dictamen: string | null
      observaciones: string | null
    }
  | ActuacionHistorial
  | {
      tipo: 'ESTADO'
      fecha: string
      oficina: string
      /** Código del estado nuevo (el nombre sale del catálogo de la base). */
      estado: string
      estadoNombre: string
      estadoAnteriorNombre: string | null
      usuario: string
    }

/** Usuario que figura en la auditoría. */
export interface UsuarioAuditado {
  id: string
  /** «Apellido, Nombre». */
  nombre: string
  legajo: string
}

/** GET /expedientes/:id/auditoria: quién lo inició, quién lo tuvo en cada oficina y quién lo finalizó. */
export interface AuditoriaExpediente {
  iniciado: { usuario: UsuarioAuditado; fecha: string; oficina: string } | null
  finalizado: { usuario: UsuarioAuditado; fecha: string; oficina: string; estado: string; estadoNombre: string } | null
  /** Cada paso por una oficina, en orden. */
  recorrido: {
    oficina: string
    etapa: string
    llego: string
    /** null: se inició en esa oficina. */
    enviadoPor: UsuarioAuditado | null
    esDevolucion: boolean
    tomadoPor: UsuarioAuditado | null
    tomadoEn: string | null
    /** null: sigue ahí. */
    salio: string | null
    salidaPor: UsuarioAuditado | null
  }[]
  eventos: {
    id: string
    accion: 'INICIO' | 'TOMA' | 'PASE' | 'DEVOLUCION' | 'CAMBIO_ETAPA' | 'CAMBIO_ESTADO' | 'CORRECCION'
    fecha: string
    usuario: UsuarioAuditado
    oficina: string
    oficinaDestino: string | null
    etapa: string
    estadoAnterior: string | null
    estadoNuevo: string | null
  }[]
}

/** GET /tramites/alta-concesion/:id/recaudacion: lo que verifica Recaudación. */
export interface AntecedentesDeuda {
  titulares: { personaId: string; nombre: string; documento: string | null }[]
  /** Concesiones otorgadas de los titulares, con todos sus titulares y si tienen deuda (sí / no). */
  concesiones: {
    id: string
    numero: string | null
    departamento: string | null
    localidad: string | null
    titulares: { personaId: string; nombre: string }[]
    /** Cuáles de los titulares del alta son titulares de esta concesión. */
    deTitulares: string[]
    tieneDeuda: boolean
  }[]
  /** Deudas pendientes registradas sin concesión (de antes). */
  otrasDeudas: { id: string; personaId: string; detalle: string }[]
}

/** GET /expedientes/disponibilidad: si el número está libre o de qué trámite es. */
export interface DisponibilidadExpediente {
  /** El número completo, normalizado («123/332-2026»). */
  numero: string
  disponible: boolean
  expediente: {
    id: string
    tipoTramite: string
    tipoTramiteNombre: string
    estado: EstadoExpedienteBackend
    etapaNombre: string
    oficinaNombre: string
    fechaIngreso: string
  } | null
}

export interface ExpedienteEnBandeja {
  id: string
  numero: string
  tipoTramite: string
  estado: EstadoExpedienteBackend
  etapa: EtapaCircuito
  etapaNombre: string
  titular: string | null
  tomadoPor: string | null
  enLaOficinaDesde: string | null
  /** Oficina de la que vino con el último pase (null: se inició en esta oficina). El modo demo no lo informa. */
  vieneDe?: OficinaBackend | null
  vieneDeNombre?: string | null
  /** Volvió observado, para corregir. */
  esDevolucion?: boolean
  /** Recaudación le dio curso con deuda. */
  cursoConDeuda?: boolean
  /** Solo en la bandeja de Distrito: el distrito de la ubicación (null: sin ubicación cargada). */
  distrito?: string | null
  /** Plazo del trámite en la oficina (null o ausente: la oficina no tiene plazo para ese trámite). */
  plazo?: PlazoEnOficina | null
}

export interface PlazoEnOficina {
  dias: number
  transcurridos: number
  /** Negativo: días de atraso. */
  restantes: number
  /** AAAA-MM-DD */
  vence: string
  semaforo: 'EN_PLAZO' | 'POR_VENCER' | 'VENCIDO'
}

export interface DeudaBackend {
  id: string
  persona: { id: string; nombre: string; documento: string | null }
  detalle: string
  monto: number | null
  estado: 'PENDIENTE' | 'CANCELADA'
  creadoEn: string
  canceladoEn: string | null
  comprobantePago: string | null
}

/** Un correo que mandó el sistema por el expediente (GET /expedientes/:id/emails). */
export interface EmailExpediente {
  id: string
  tipo: string
  para: string[]
  asunto: string
  cuerpo: string
  /** NO_ENVIADO_PRUEBA: no hay servidor de correo configurado (quedó registrado, no salió). */
  estado: 'ENVIADO' | 'NO_ENVIADO_PRUEBA' | 'ERROR'
  error: string | null
  fecha: string
}

/** POST …/recaudacion/notificar-deuda: a quién se mandó y quién no tiene correo cargado. */
export interface ResultadoAvisoDeuda {
  enviados: { id: string; titular: string; para: string[]; estado: EmailExpediente['estado']; error: string | null }[]
  sinCorreo: string[]
}
