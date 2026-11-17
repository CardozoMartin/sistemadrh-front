// Datos del backend emulado. Es la misma información que guardan las tablas del backend real,
// simplificada: una lista por tabla, guardada en el navegador (localStorage) para que la demo
// sobreviva a recargar la página. «Reiniciar demo» vuelve a la semilla.
import type { MultiPolygon } from 'geojson'
import type { AltaBackend, EntradaHistorial, EstadoExpedienteBackend, TitularBackend } from '@/features/tramites/AltaDeConcesion/backend.types'
import type { EstadoBaja, OrigenBaja } from '@/features/pozo/BajaDePozo/types'
import type { AltaPozoOficioDto } from '@/features/pozo/AltaDePozo/types'
import type { DatosCatastroPozo } from '@/features/pozo/CircuitoPozo/types'

export type OficinaDemo = 'catastro' | 'recaudacion' | 'distrito' | 'juridico' | 'secretaria_general' | 'pozos'

export interface UsuarioDemo {
  id: string
  apellido: string
  nombre: string
  oficina: OficinaDemo | null
  esAdministrador: boolean
}

/** exp_expediente: la carátula, dónde está y quién lo tiene. */
export interface ExpedienteDemo {
  id: string
  numero: string
  reparticion: string
  anio: number
  tipoTramite: 'ALTA_CONCESION' | 'BAJA_POZO' | 'REGISTRO_POZO'
  /** Número para mostrar cuando no es «número/repartición-año» (ej: registro de oficio «OF-0001/2026»). */
  etiqueta?: string
  estado: EstadoExpedienteBackend
  etapa: string
  oficina: OficinaDemo
  tomadoPor: string | null
  tomadoEn: string | null
  /** Desde cuándo está en la oficina actual. */
  oficinaDesde: string
  fechaIngreso: string
  actualizado: string
  /** Etapa a la que vuelve al reenviarse después de corregir (la de la oficina que observó). */
  vuelveA: string | null
}

export type EntradaDemo = EntradaHistorial & { expedienteId: string }

/** per_persona: única por documento. */
export type PersonaDemo = Omit<TitularBackend, 'personaId'> & { id: string }

export interface DeudaDemo {
  id: string
  personaId: string
  /** Concesión que tiene la deuda (las de antes, sin concesión, son de la persona). */
  concesionId?: string | null
  detalle: string
  monto: number | null
  estado: 'PENDIENTE' | 'CANCELADA'
  creadoEn: string
  canceladoEn: string | null
  comprobantePago: string | null
}

/** con_concesion + lo que muestra la capa del visor. Las del sistema toman sus datos del alta. */
export interface ConcesionDemo {
  id: string
  numero: string | null
  estado: 'EN_TRAMITE' | 'VIGENTE' | 'MODIFICADA' | 'ARCHIVADA' | 'DENEGADA' | 'ANULADA'
  origen: 'SISTEMA' | 'MIGRACION'
  expedienteId: string | null
  anio: number | null
  fechaOtorgamiento: string | null
  resolucion: { numero: string; anio: number; fecha: string } | null
  /** Datos de las migradas (las del sistema los toman del alta). */
  migrada: {
    titular: string | null
    documento: string | null
    departamento: string | null
    localidad: string | null
    distrito: string | null
    cuenca: string | null
    caudalLps: number | null
    caracter: string | null
    codigoServicio: number | null
    usos: string | null
    fuente: string | null
    sistema: string | null
    canalPrincipal: string | null
    geom: MultiPolygon | null
    superficieHa: number | null
  } | null
}

/** Lo cargado en el alta (las secciones del formulario de Catastro), por expediente. */
export interface AltaDemo {
  expedienteId: string
  concesionId: string
  situacionLegal: string
  documentacion: number[]
  titulares: string[]
  domicilios: AltaBackend['domicilios']
  ubicacion: { departamento: string; localidad: string; distrito: string } | null
  poligono: NonNullable<NonNullable<AltaBackend['ubicacion']>['poligono']> | null
  inmueble: AltaBackend['inmueble']
  usos: { caracter: 'PERMANENTE' | 'EVENTUAL' | null; codigoServicio: number | null; periodoInicio: string | null; periodoFin: string | null; items: NonNullable<AltaBackend['usos']>['items'] } | null
  suministro: AltaBackend['suministro']
  caudalAsignado: number | null
  /** Personas a las que Recaudación ya les verificó la deuda. */
  verificados: string[]
}

/** con_punto: desagüe y punto de entrega, con las dos formas de la coordenada. */
export interface PuntoDemo {
  id: string
  concesionId: string
  tipo: 'DESAGUE' | 'ENTREGA'
  sistema: 'POSGAR_FAJA3' | 'WGS84'
  x: number
  y: number
  latitud: number
  longitud: number
  referencia: string | null
}

/** poz_pozo. */
export interface PozoDemo {
  id: string
  idInterno: string
  alias: string | null
  estado: 'EN_USO' | 'FUERA_DE_SERVICIO' | 'PARADO' | 'BAJA' | 'ANULADO'
  origen: 'AUTORIZACION' | 'OFICIO' | 'MIGRACION'
  tipoPozo: string | null
  jurisdiccionDrh: boolean
  profundidadM: number | null
  nivelEstaticoM: number | null
  nivelDinamicoM: number | null
  caudalM3h: number | null
  latitud: number
  longitud: number
  x: number
  y: number
  concesionId: string | null
  /** Lo cargado en el registro de oficio (ficha completa del pozo). Los migrados no lo tienen. */
  registro?: RegistroPozoDemo
}

/** Ficha del registro de oficio: lo que mandó el formulario, sin los monitoreos (van aparte). */
export type RegistroPozoDemo = Omit<AltaPozoOficioDto, 'coordenada' | 'hidraulico' | 'quimico'> & {
  expediente: string
  /** Expediente del circuito (Pozos → Catastro → … → cierre). */
  expedienteId: string
  /** Lo que completa Catastro (concesión, titulares, nomenclatura, uso). */
  catastro: DatosCatastroPozo | null
  resolucion: { numero: string; anio: number; fecha: string } | null
  sistemaCoordenada: 'POSGAR_FAJA3' | 'WGS84'
  registradoPor: string
  registradoEn: string
}

/**
 * Monitoreo del pozo: cada medición hidráulica o informe químico con SU fecha. No se pisan:
 * el historial por fecha sale de esta lista (el vigente es el de fecha más reciente).
 */
export interface MonitoreoDemo {
  id: string
  pozoId: string
  tipo: 'hidraulico' | 'quimico'
  fecha: string
  registrado: string
  usuario: string
  datos: Record<string, unknown>
}

/** poz_baja. */
export interface BajaDemo {
  id: string
  expedienteId: string | null
  pozoId: string
  origen: OrigenBaja
  estado: EstadoBaja
  motivo: string
  solicitanteNombre: string | null
  solicitanteDocumento: string | null
  documentacion: string[]
  inspeccionRealizada: boolean | null
  fechaInspeccion: string | null
  observacionesInspeccion: string | null
  informeTecnico: string | null
  requiereClausura: boolean | null
  anularConcesion: boolean | null
  estadoPozoAnterior: string
  concesionAnteriorId: string | null
  resolucion: string | null
  fechaBaja: string | null
  clausura: { fecha: string; acta: string; observaciones: string | null } | null
  avisoDistrito: { enviado: string; visto: { en: string; por: string } | null } | null
  creadoEn: string
  usuario: string
}

export interface Db {
  version: number
  seq: number
  usuarios: UsuarioDemo[]
  expedientes: ExpedienteDemo[]
  historial: EntradaDemo[]
  personas: PersonaDemo[]
  deudas: DeudaDemo[]
  concesiones: ConcesionDemo[]
  altas: Record<string, AltaDemo>
  puntos: PuntoDemo[]
  pozos: PozoDemo[]
  bajas: BajaDemo[]
  monitoreos: MonitoreoDemo[]
}

/** Si cambia la forma de los datos, se sube la versión y la demo arranca de nuevo de la semilla. */
const VERSION = 5
const CLAVE = 'drh_demo_backend'

let db: Db | null = null
let cargando: Promise<Db> | null = null

/** La base de la demo: la guardada en el navegador o, si no hay, la semilla. */
export function obtenerDb(): Promise<Db> {
  if (db) return Promise.resolve(db)
  cargando ??= (async () => {
    const guardada = leerGuardada()
    if (guardada) return (db = guardada)
    const { crearSemilla } = await import('./semilla')
    db = await crearSemilla()
    guardar()
    return db
  })()
  return cargando
}

function leerGuardada(): Db | null {
  try {
    const texto = localStorage.getItem(CLAVE)
    const datos = texto ? (JSON.parse(texto) as Db) : null
    return datos?.version === VERSION ? datos : null
  } catch {
    return null
  }
}

/** Guarda la base después de cada cambio (si el navegador no deja, queda en memoria). */
export function guardar(): void {
  if (!db) return
  try {
    localStorage.setItem(CLAVE, JSON.stringify(db))
  } catch {
    /* sin almacenamiento: la demo sigue en memoria hasta recargar */
  }
}

/** Vuelve a la semilla (botón «Reiniciar demo»). */
export function reiniciarDb(): void {
  try {
    localStorage.removeItem(CLAVE)
  } catch {
    /* nada que borrar */
  }
  db = null
  cargando = null
}

export const nuevoId = (d: Db) => String(++d.seq)
export const ahora = () => new Date().toISOString()
export const hoy = () => ahora().slice(0, 10)
export { VERSION }
