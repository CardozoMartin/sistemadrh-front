import type { Feature, FeatureCollection, LineString, MultiPolygon, Point } from 'geojson'

/**
 * Atributos de una concesión en la capa geográfica. Son las columnas de la vista
 * sig.v_concesiones del backend: los mismos nombres que se ven en QGIS.
 */
export interface AtributosConcesion {
  poligono_id: number
  concesion_id: number
  /** Vacío mientras está en trámite (Catastro lo asigna en el cierre). */
  numero: string | null
  estado: EstadoConcesionGeo
  tipo_derecho: string
  /** SISTEMA (alta cargada en el sistema) o MIGRACION (padrón anterior). */
  origen: 'SISTEMA' | 'MIGRACION'
  anio_otorgamiento: number | null
  /** Las migradas no tienen expediente digital. */
  expediente: string | null
  oficina_actual: string | null
  titular: string | null
  documento: string | null
  cantidad_titulares: number | null
  departamento: string | null
  localidad: string | null
  distrito: string | null
  cuenca: string | null
  padron: string | null
  matricula_catastral: string | null
  parcela: string | null
  superficie_ha: number
  caudal_lps: number | null
  caracter: string | null
  codigo_servicio: number | null
  usos: string | null
  fuente: string | null
  sistema: string | null
  canal_principal: string | null
  origen_poligono: string
  poligono_desde: string
  /** Si se ve en el mapa público (Argenmap). Adentro de la DRH se ve siempre. */
  publicacion: 'PENDIENTE' | 'OBSERVADO' | 'PUBLICADO'
  publicacion_en: string | null
}

export type EstadoConcesionGeo = 'EN_TRAMITE' | 'VIGENTE' | 'MODIFICADA' | 'ARCHIVADA'

export type ConcesionGeo = Feature<MultiPolygon, AtributosConcesion>
export type CapaConcesiones = FeatureCollection<MultiPolygon, AtributosConcesion>

/** Recuadro del mapa en grados: oeste, sur, este, norte. */
export type Recuadro = [number, number, number, number]

/** Atributos de un pozo: columnas de la vista sig.v_pozos del backend. */
export interface AtributosPozo {
  pozo_id: number
  id_interno: string
  alias: string | null
  estado: EstadoPozo
  origen: 'AUTORIZACION' | 'OFICIO' | 'MIGRACION'
  tipo_pozo: string | null
  jurisdiccion_drh: boolean
  profundidad_m: number | null
  nivel_estatico_m: number | null
  nivel_dinamico_m: number | null
  caudal_m3h: number | null
  caudal_lps: number | null
  /** POSGAR 07 faja 3. */
  coord_x: number
  coord_y: number
  concesion_id: number | null
  concesion_numero: string | null
  titular: string | null
  departamento: string | null
  localidad: string | null
  /** false: el pozo cae fuera del polígono de su concesión (error de carga). null: sin polígono. */
  dentro_de_concesion: boolean | null
}

export type EstadoPozo = 'EN_USO' | 'FUERA_DE_SERVICIO' | 'PARADO' | 'BAJA'

export type PozoGeo = Feature<Point, AtributosPozo>
export type CapaPozos = FeatureCollection<Point, AtributosPozo>

/** Atributos de un desagüe o punto de entrega: columnas de la vista sig.v_puntos del backend. */
export interface AtributosPunto {
  punto_id: number
  tipo: TipoPunto
  /** En qué sistema se cargó (el otro lo calculó PostGIS). */
  sistema_carga: 'POSGAR_FAJA3' | 'WGS84'
  /** POSGAR 07 faja 3. */
  coord_x: number
  coord_y: number
  latitud: number
  longitud: number
  referencia: string | null
  concesion_id: number
  concesion_numero: string | null
  concesion_estado: string
  expediente: string | null
  titular: string | null
  departamento: string | null
  localidad: string | null
  /** Distancia al polígono de la concesión (0 si cae dentro). null: la concesión no tiene polígono. */
  distancia_poligono_m: number | null
  /** Si su concesión está publicada en el mapa público (Argenmap). */
  publicado: boolean
}

export type TipoPunto = 'DESAGUE' | 'ENTREGA'

export type PuntoGeo = Feature<Point, AtributosPunto>
export type CapaPuntos = FeatureCollection<Point, AtributosPunto>

/** Río o canal (tabla sig.cauce del backend). */
export interface AtributosCauce {
  id: number
  /** null en arroyos y acequias sin nombre. */
  nombre: string | null
  tipo: 'RIO' | 'CANAL'
  fuente: string
  largo_km: number
}
export type CauceGeo = Feature<LineString, AtributosCauce>
export type CapaCauces = FeatureCollection<LineString, AtributosCauce>
