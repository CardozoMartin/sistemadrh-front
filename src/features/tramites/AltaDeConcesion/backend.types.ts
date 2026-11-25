// Tipos de lo que devuelve el backend real para el Alta de Concesión
// (backend/src/tramites/alta-concesion/alta-concesion.respuesta.ts).
import type { MultiPolygon } from 'geojson'
import type { Superposicion } from '@/services/sig'
import type { AvisoDeudaBackend, EstadoEmail } from '../shared/circuito/deuda.types'

// Comunes a todos los trámites (viven en shared); se re-exportan para no cambiar los imports del alta.
export type { AntecedentesDeuda, AvisoDeudaBackend, BorradorAvisoDeuda, EstadoEmail, NotificarDeudaDto, ResultadoAvisoDeuda } from '../shared/circuito/deuda.types'
export type { ActuacionHistorial, EntradaHistorial } from '../shared/circuito/historial.types'

export type EtapaCircuito = 'CARGA' | 'CORRECCION' | 'RECAUDACION' | 'DISTRITO' | 'JURIDICO' | 'SECRETARIA_GENERAL' | 'CIERRE' | 'ESPERA_PADRON'
export type EstadoExpedienteBackend = 'EN_TRAMITE' | 'OBSERVADO' | 'EN_ESPERA' | 'FINALIZADO' | 'RECHAZADO' | 'ARCHIVADO' | 'ANULADO'
/** GET /tramites/alta-concesion/:id/reasignables: a quién puede pasar el alta el Jefe de Catastro. */
export interface UsuarioReasignable {
  id: string
  nombre: string
  legajo: string
}

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
    /** Pedido del número a Catastro: PENDIENTE (Catastro todavía no lo cargó) o ASIGNADA. */
    // Optativo: el emulador de la demo no lo arma.
    solicitudNumero?: { id: string; estado: 'PENDIENTE' | 'ASIGNADA'; solicitadoEn: string; asignadoEn: string | null } | null
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
    accion: 'INICIO' | 'TOMA' | 'PASE' | 'DEVOLUCION' | 'CAMBIO_ETAPA' | 'CAMBIO_ESTADO' | 'CORRECCION' | 'LIBERACION' | 'REASIGNACION'
    fecha: string
    usuario: UsuarioAuditado
    oficina: string
    oficinaDestino: string | null
    etapa: string
    estadoAnterior: string | null
    estadoNuevo: string | null
  }[]
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
  /** Id de quien lo tiene tomado (para saber si es de quien mira la bandeja). */
  tomadoPorId?: string | null
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
  estado: EstadoEmail
  error: string | null
  fecha: string
}

