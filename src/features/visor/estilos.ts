import type { EstadoConcesionGeo, EstadoPozo, TipoPunto } from './types'

/** Color y nombre de cada estado: los usan el mapa, la lista y la leyenda. */
export const ESTADOS: Record<EstadoConcesionGeo, { nombre: string; color: string }> = {
  EN_TRAMITE: { nombre: 'En trámite', color: '#f59e0b' },
  VIGENTE: { nombre: 'Vigente', color: '#16a34a' },
  MODIFICADA: { nombre: 'Modificada', color: '#137fec' },
  ARCHIVADA: { nombre: 'Archivada', color: '#64748b' },
}

/** Nombre de la oficina en que está un expediente (la ficha y el criterio «Etapa del expediente»). */
export const NOMBRE_OFICINA: Record<string, string> = {
  catastro: 'Catastro',
  recaudacion: 'Recaudación',
  distrito: 'Distrito',
  juridico: 'Jurídico',
  secretaria_general: 'Secretaría General',
}

/** Polígono que se está comparando (KML cargado en el visor, todavía no guardado). */
export const COLOR_COMPARACION = '#dc2626'

export const colorEstado = (estado: string) => ESTADOS[estado as EstadoConcesionGeo]?.color ?? '#64748b'
export const nombreEstado = (estado: string) => ESTADOS[estado as EstadoConcesionGeo]?.nombre ?? estado

/** Título corto de una concesión: el número, o el expediente si todavía está en trámite. */
export const tituloConcesion = (p: { numero: string | null; expediente: string | null }) =>
  p.numero ? `Concesión ${p.numero}` : p.expediente ? `Exp. ${p.expediente}` : 'Concesión sin número'

export const formatoHa = (ha: number) => `${ha.toLocaleString('es-AR', { maximumFractionDigits: 2 })} ha`

/** Códigos de servicio de Catastro (mismos que el backend). */
export const SERVICIOS: Record<number, string> = {
  0: 'Dique de embalse permanente',
  1: 'Dique de embalse eventual',
  2: 'Dique nivelador permanente',
  3: 'Dique nivelador eventual',
  4: 'Toma rústica permanente',
  5: 'Toma rústica eventual',
}

/** Color y nombre de cada estado de pozo (los pozos se dibujan como puntos celestes). */
export const ESTADOS_POZO: Record<EstadoPozo, { nombre: string; color: string }> = {
  EN_USO: { nombre: 'En uso', color: '#0284c7' },
  PARADO: { nombre: 'Parado', color: '#d97706' },
  FUERA_DE_SERVICIO: { nombre: 'Fuera de servicio', color: '#64748b' },
  BAJA: { nombre: 'Baja', color: '#94a3b8' },
}
export const colorPozo = (estado: string) => ESTADOS_POZO[estado as EstadoPozo]?.color ?? '#0284c7'
export const nombreEstadoPozo = (estado: string) => ESTADOS_POZO[estado as EstadoPozo]?.nombre ?? estado

/** Borde de un pozo que cae fuera de su concesión (hay que revisar la carga). */
export const COLOR_POZO_A_REVISAR = '#dc2626'

/** Borde de un pozo registrado de oficio (sin autorización previa): se diferencia del resto. */
export const COLOR_POZO_OFICIO = '#d97706'

/** Color y nombre de cada tipo de punto de la sección de usos (se dibujan como rombos). */
export const TIPOS_PUNTO: Record<TipoPunto, { nombre: string; color: string }> = {
  DESAGUE: { nombre: 'Desagüe', color: '#7c3aed' },
  ENTREGA: { nombre: 'Punto de entrega (pecuario)', color: '#059669' },
}

/**
 * Más lejos que esto del polígono de su concesión, el punto se marca para revisar (suele ser
 * una coordenada mal tipeada). Mismo valor que el backend (DISTANCIA_MAX_PUNTO_M).
 */
export const DISTANCIA_MAX_PUNTO_M = 1000

export const formatoNumero = (n: number, decimales = 1) => n.toLocaleString('es-AR', { maximumFractionDigits: decimales })

/**
 * Desde este zoom se escribe el número de cada concesión sobre su polígono, y además solo
 * si el número entra dentro de la finca: las grandes lo muestran antes, las chicas al acercarse
 * más. Solo se dibujan las que están a la vista: con miles, son pocas a la vez.
 */
export const ZOOM_ETIQUETAS = 13
