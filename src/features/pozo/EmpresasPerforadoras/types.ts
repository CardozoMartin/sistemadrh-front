import type { Adjunto } from '@/types/domain'

/**
 * Circuito del alta: Planificación carga la empresa y sus máquinas → Jurídico (dictamen)
 * → Secretaría General (resolución que la habilita).
 *
 * EN_TRAMITE: en revisión en la oficina de `tramite.oficina` (en Secretaría General es
 * «pendiente de resolución», CU flujo 16.1.1). OBSERVADA: una oficina la devolvió a
 * Planificación para corregir; se reenvía a esa oficina. RECHAZADA: no procede (fin).
 * ACTIVA: habilitada, puede tomar trabajos nuevos. BAJA: baja lógica (RF10).
 */
export type EstadoEmpresa = 'EN_TRAMITE' | 'OBSERVADA' | 'RECHAZADA' | 'ACTIVA' | 'BAJA'

/** Oficinas del circuito de la empresa (ids de /oficinas). */
export type OficinaEmpresa = 'juridico' | 'secretaria_general'

/** Actuación de una oficina: observación (devuelve) o rechazo. */
export interface ActuacionOficina {
  oficina: OficinaEmpresa
  fecha: string // ISO
  usuario: string
  motivo: string
}

/** Dictamen de Jurídico (aprobado: pasa a Secretaría General). */
export interface DictamenEmpresa {
  fecha: string // ISO
  usuario: string
  /** Puntos del control legal que se verificaron. */
  controles: string[]
  texto: string
  informe: Adjunto[]
}

/** Foto de referencia de una máquina (RN-07). En la demo se guarda reducida dentro del registro. */
export interface FotoMaquina extends Adjunto {
  /** Imagen reducida (data URL). Con el backend real va la ruta del archivo subido. */
  dataUrl: string
}

/** Baja lógica de una empresa o de una máquina. */
export interface BajaRegistro {
  fecha: string // ISO
  motivo: string
  usuario: string
}

/** Datos técnicos de una máquina perforadora (los que carga el formulario). */
export interface DatosMaquina {
  /** «Patente» de identificación que asigna la DRH (ej: EQP-001-A). Única en todo el sistema. */
  codigo: string
  modelo: string
  /** Diámetro de perforación (ej: 12 1/4"). */
  capacidadDiametro: string
  /** Profundidad máxima (m). */
  capacidadProfundidad: string
  /** Altura de la torre (m). */
  alturaTorre: string
  vehiculoPatente: string
  vehiculoModelo: string
  observacion: string
  foto: FotoMaquina | null
}

/** Máquina perforadora (colección /maquinas, relacionada por `empresaId`). */
export interface Maquina extends DatosMaquina {
  id: string
  empresaId: string
  activa: boolean
  alta: string // ISO
  baja?: BajaRegistro | null
}

/** Inscripción en otra jurisdicción por Convenio Multilateral. */
export interface Jurisdiccion {
  jurisdiccion: string
  numero: string
  condicion: string
}

export interface DireccionTecnica {
  nombre: string
  apellido: string
  profesion: string
  matricula: string
  email: string
  domicilio: string
}

/** Datos de la empresa que carga el formulario (alta y modificación). */
export interface DatosEmpresa {
  tipoPersona: 'juridica' | 'fisica'
  /** CUIT (persona jurídica) o CUIL (persona física), 11 dígitos. */
  cuit: string
  /** Solo persona jurídica. */
  razonSocial: string
  /** Solo persona física. */
  nombre: string
  apellido: string
  documento: string
  ingresosBrutos: string
  convenioMultilateral: boolean
  jurisdicciones: Jurisdiccion[]
  registroComercio: string
  domicilio: string
  telefono: string
  provincia: string
  departamento: string
  localidad: string
  /** Resolución de Secretaría General que la habilita (la carga Secretaría al final del circuito). */
  resolucion: { numero: string; anio: string; fecha?: string; archivo?: Adjunto[] }
  observaciones: string
  direccionTecnica: DireccionTecnica
  /** RF09: nota de solicitud de registración y documentación legal. */
  notaSolicitud: Adjunto[]
  documentacionLegal: Adjunto[]
}

/** Un campo que cambió en una modificación. */
export interface CambioCampo {
  etiqueta: string
  antes: string
  ahora: string
}

export type TipoEvento =
  | 'ALTA'
  | 'DICTAMEN'
  | 'OBSERVACION'
  | 'RECHAZO'
  | 'REENVIO'
  | 'RESOLUCION'
  | 'MODIFICACION'
  | 'BAJA'
  | 'REACTIVACION'
  | 'ALTA_MAQUINA'
  | 'MODIFICACION_MAQUINA'
  | 'BAJA_MAQUINA'
  | 'REACTIVACION_MAQUINA'

/**
 * Hecho sobre la empresa o sus máquinas (RF22: quién, cuándo, qué cambió y por qué).
 * Colección /movimientosEmpresas, relacionada por `empresaId` (y `maquinaId` si es de una máquina).
 */
export interface EventoEmpresa {
  id: string
  empresaId: string
  maquinaId?: string
  tipo: TipoEvento
  fecha: string // ISO
  usuario: string
  observacion?: string
  cambios?: CambioCampo[]
  /** Código de la máquina, en los eventos de máquina. */
  maquina?: string
}

/**
 * Empresa perforadora tal como se guarda (colección /empresas). Sus máquinas y su
 * historial son recursos aparte (/maquinas y /movimientosEmpresas, por `empresaId`).
 */
export interface EmpresaRegistro extends DatosEmpresa {
  id: string
  estado: EstadoEmpresa
  /** Autoría (modelo de datos: creado_en / creado_usuario, modificado_en / modificado_usuario). */
  creado: string // ISO
  creadoPor: string
  modificado?: string // ISO
  modificadoPor?: string
  /** Mientras está EN_TRAMITE: dónde está y desde cuándo. */
  tramite?: { oficina: OficinaEmpresa; desde: string } | null
  /** Última observación (si está OBSERVADA, es lo que hay que corregir). */
  observacion?: ActuacionOficina | null
  rechazo?: ActuacionOficina | null
  dictamen?: DictamenEmpresa | null
  baja?: BajaRegistro | null
  /** Bajas anteriores (si se reactivó): no se pierden. */
  bajasPrevias?: BajaRegistro[]
}

/** Empresa con sus máquinas y su historial (lo que usan las pantallas). */
export interface EmpresaPerforadora extends EmpresaRegistro {
  maquinas: Maquina[]
  /** Del más nuevo al más viejo. En el padrón viene vacío (se pide solo en la ficha). */
  historial: EventoEmpresa[]
}
