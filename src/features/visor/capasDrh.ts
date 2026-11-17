// Capas del GeoServer de la DRH (http://192.168.11.105:8082/geoserver, workspace DRH), leídas de
// la copia local que arma el backend con «npm run sig:copiar» (backend/recursos/sig/geoserver,
// fuera de git: tiene nombres y CUIT). Vite sirve esa carpeta en /capas-drh (vite.config.ts), así
// el visor no consulta el GeoServer cada vez y anda fuera de la red de la oficina.
//
// Casi todas vienen en WGS84. t07_pozos viene en POSGAR 2007 faja 3 (el GeoServer no la puede
// reproyectar: 92 pozos tienen coordenadas infinitas) y se convierte acá; esos 92 no se dibujan.
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { dePosgar } from '@/lib/posgar'

export type TipoCapaDrh = 'punto' | 'linea' | 'poligono' | 'limite'

export interface CapaDrh {
  /** Nombre de la capa en el GeoServer (y del archivo de la copia). */
  id: string
  nombre: string
  grupo: string
  tipo: TipoCapaDrh
  color: string
  /** Título del objeto en el tooltip y en el globo. */
  titulo: (p: Record<string, unknown>) => string
  /** Campos que no se muestran en el globo (además de los vacíos). */
  ocultos?: string[]
  /** Borde punteado (concesiones anuladas, departamentos). */
  punteado?: boolean
}

const texto = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim())

export const CAPAS_DRH: CapaDrh[] = [
  {
    id: 't07_concesiones',
    nombre: 'Concesiones',
    grupo: 'Derechos de agua',
    tipo: 'poligono',
    color: '#db2777',
    titulo: (p) => `Concesión ${texto(p.concesion) || 's/n'}`,
    ocultos: ['distrito', 'concesion'],
  },
  {
    id: 't07_concesiones_anuladas',
    nombre: 'Concesiones anuladas',
    grupo: 'Derechos de agua',
    tipo: 'poligono',
    color: '#64748b',
    punteado: true,
    titulo: (p) => `Concesión ${texto(p.concesion) || 's/n'} (anulada)`,
    ocultos: ['distrito', 'concesion'],
  },
  {
    id: 't07_concesiones_bebida_e_industriales',
    nombre: 'Concesiones de bebida e industriales',
    grupo: 'Derechos de agua',
    tipo: 'punto',
    color: '#7c3aed',
    titulo: (p) => `Concesión ${texto(p.concesion) || 's/n'}`,
    ocultos: ['X', 'Y'],
  },
  {
    id: 't07_permisos_precarios',
    nombre: 'Permisos precarios',
    grupo: 'Derechos de agua',
    tipo: 'poligono',
    color: '#ea580c',
    titulo: (p) => `Permiso precario · ${texto(p.usuario) || 'sin usuario'}`,
  },
  {
    id: 't07_derecho_tradicional',
    nombre: 'Derecho tradicional',
    grupo: 'Derechos de agua',
    tipo: 'poligono',
    color: '#a16207',
    titulo: (p) => `Derecho tradicional ${texto(p.der_trad)}`,
  },
  {
    id: 't07_pozos',
    nombre: 'Pozos',
    grupo: 'Aguas subterráneas',
    tipo: 'punto',
    color: '#0369a1',
    titulo: (p) => `${texto(p.nro_privado) || 'Pozo'} · concesión ${texto(p.nro_concesion) || 's/n'}`,
  },
  {
    id: 't07_canales_riego',
    nombre: 'Canales de riego',
    grupo: 'Red de riego',
    tipo: 'linea',
    color: '#0891b2',
    titulo: (p) => texto(p.denominacion) || `Canal ${texto(p.sistema)} ${texto(p.tramo)}`.trim(),
  },
  {
    id: 't07_tomas',
    nombre: 'Tomas',
    grupo: 'Red de riego',
    tipo: 'punto',
    color: '#16a34a',
    titulo: (p) => `Toma${texto(p.CANAL) ? ` · ${texto(p.CANAL)}` : ''}`,
  },
  {
    id: 't07_compuertas',
    nombre: 'Compuertas',
    grupo: 'Red de riego',
    tipo: 'punto',
    color: '#65a30d',
    titulo: (p) => `Compuerta${texto(p.canal) ? ` · ${texto(p.canal)}` : ''}`,
  },
  {
    id: 't07_obras_arte',
    nombre: 'Obras de arte',
    grupo: 'Red de riego',
    tipo: 'punto',
    color: '#ca8a04',
    titulo: (p) => `${texto(p.tipo) || 'Obra de arte'}${texto(p.canal) ? ` · ${texto(p.canal)}` : ''}`,
  },
  {
    id: 't07_rios',
    nombre: 'Ríos y arroyos',
    grupo: 'Hidrografía',
    tipo: 'linea',
    color: '#2563eb',
    titulo: (p) => `${texto(p.tipo) || 'Cauce'} ${texto(p.nombre) || 'sin nombre'}`,
    ocultos: ['union', 'estado', 'fecha', 'pais', 'provincia'],
  },
  {
    id: 't07_represas',
    nombre: 'Diques y represas',
    grupo: 'Hidrografía',
    tipo: 'punto',
    color: '#1e3a8a',
    titulo: (p) => texto(p.nombre) || 'Represa',
    ocultos: ['objectid'],
  },
  {
    id: 't07_distritos',
    nombre: 'Distritos de riego',
    grupo: 'Límites',
    tipo: 'limite',
    color: '#be123c',
    titulo: (p) => `Distrito ${texto(p.name)}`,
  },
  {
    id: 't07_departamentos',
    nombre: 'Departamentos',
    grupo: 'Límites',
    tipo: 'limite',
    color: '#475569',
    punteado: true,
    titulo: (p) => texto(p.NAME),
  },
]

export const GRUPOS_DRH = [...new Set(CAPAS_DRH.map((c) => c.grupo))]

/** Qué se ve: si el grupo está prendido y las capas elegidas (se recuerdan al apagarlo). */
export interface EstadoDrh {
  activo: boolean
  elegidas: string[]
}

export const ESTADO_DRH_INICIAL: EstadoDrh = { activo: false, elegidas: [] }

/** Origen de los archivos (vite.config.ts los sirve desde la copia del backend). */
const URL_CAPAS = '/capas-drh'

async function leerArchivo(id: string): Promise<FeatureCollection> {
  const r = await fetch(`${URL_CAPAS}/${id}.geojson`)
  if (r.status === 404) throw new Error('No está en la copia local. Correr «npm run sig:copiar» en la carpeta backend.')
  if (!r.ok) throw new Error(`No se pudo leer la copia local (${r.status})`)
  return (await r.json()) as FeatureCollection
}

/** Pasa de POSGAR faja 3 a WGS84 todas las coordenadas de una geometría. */
function geometriaAWgs84(g: Geometry): Geometry {
  const convertir = (c: unknown): unknown => {
    if (Array.isArray(c) && typeof c[0] === 'number') {
      const { lat, lng } = dePosgar(c[0], c[1] as number)
      return [lng, lat]
    }
    return (c as unknown[]).map(convertir)
  }
  return g.type === 'GeometryCollection' ? { ...g, geometries: g.geometries.map(geometriaAWgs84) } : ({ ...g, coordinates: convertir(g.coordinates) } as Geometry)
}

/**
 * Datos de cada concesión de la tabla t_concesiones (usuario, CUIT, padrón, uso, canal…): los
 * polígonos de t07_concesiones solo traen el número. Una concesión puede tener varias filas
 * (varios titulares o usos): se juntan los valores distintos.
 */
async function datosDeConcesiones(): Promise<Map<string, Record<string, string>>> {
  const tabla = await leerArchivo('t_concesiones').catch(() => null)
  const porNumero = new Map<string, Record<string, Set<string>>>()
  for (const f of tabla?.features ?? []) {
    const p = f.properties ?? {}
    const numero = texto(p.Concesion)
    if (!numero) continue
    const acumulado = porNumero.get(numero) ?? {}
    for (const [campo, valor] of Object.entries(p)) {
      if (campo === 'Concesion' || texto(valor) === '') continue
      ;(acumulado[campo] ??= new Set()).add(texto(valor))
    }
    porNumero.set(numero, acumulado)
  }
  return new Map([...porNumero].map(([numero, campos]) => [numero, Object.fromEntries(Object.entries(campos).map(([c, v]) => [c, [...v].join(' / ')]))]))
}

/** Lee una capa de la copia local, en WGS84 y sin los objetos sin geometría. */
export async function leerCapaDrh(id: string): Promise<FeatureCollection> {
  const capa = await leerArchivo(id)
  const crs = (capa as { crs?: { properties?: { name?: string } } }).crs?.properties?.name ?? ''
  const enPosgar = crs.endsWith('5345')
  let features = capa.features.filter((f): f is Feature<Geometry> => f.geometry !== null).map((f) => (enPosgar ? { ...f, geometry: geometriaAWgs84(f.geometry) } : f))
  if (id === 't07_concesiones') {
    const datos = await datosDeConcesiones()
    features = features.map((f) => ({ ...f, properties: { ...f.properties, ...datos.get(texto(f.properties?.concesion)) } }))
  }
  return { type: 'FeatureCollection', features }
}

/** Nombres legibles de los campos de las capas; el resto se arma del nombre de la columna. */
const NOMBRES_CAMPO: Record<string, string> = {
  nro_concesion: 'N° de concesión',
  nro_privado: 'Pozo',
  titular_conc: 'Titular',
  usuario_conc: 'Usuario',
  usuario_alias: 'Alias',
  cuit: 'CUIT',
  CUIT_CUIL: 'CUIT/CUIL',
  caudal_bombeo_m3_h: 'Caudal de bombeo (m³/h)',
  caudal_bombeo_lts_s: 'Caudal de bombeo (l/s)',
  reg_bombeo_m3_h: 'Régimen de bombeo (m³/h)',
  reg_bombeo_lts_seg: 'Régimen de bombeo (l/s)',
  caudal_erogado: 'Caudal erogado (l/s)',
  caudal_tributario_lts_seg: 'Caudal tributario (l/s)',
  equivalencia_has: 'Equivalencia (ha)',
  codigo_servicio: 'Código de servicio',
  codigo_uso: 'Código de uso',
  Padron_rentas: 'Padrón de Rentas',
  Padron_catastral: 'Padrón catastral',
  Cod_serv: 'Código de servicio',
  Canal_prin: 'Canal principal',
  Canal_sec: 'Canal secundario',
  Canal_ter: 'Canal terciario',
  Canal_cuar: 'Canal cuaternario',
  Canal_quin: 'Canal quinario',
  observac: 'Observaciones',
  der_trad: 'N° de derecho tradicional',
  tipo_revest: 'Revestimiento',
  fecha_relev: 'Fecha de relevamiento',
  'X (G K)': 'X (Gauss-Krüger)',
  'Y (G K)': 'Y (Gauss-Krüger)',
}

const nombreCampo = (campo: string) => NOMBRES_CAMPO[campo] ?? (campo.charAt(0).toUpperCase() + campo.slice(1).toLowerCase()).replace(/_/g, ' ')

/** «TITULAR CONCE.: CITRUSVIL S.A.» → «CITRUSVIL S.A.»: algunos valores traen el nombre del campo adelante. */
const sinRotulo = (valor: string) => valor.replace(/^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ .]*:\s*/, '')

/** Campos para mostrar en el globo de un objeto: sin vacíos ni ocultos, con nombre legible. */
export function camposDe(capa: CapaDrh, p: Record<string, unknown>): [string, string][] {
  return Object.entries(p)
    .filter(([campo, valor]) => !capa.ocultos?.includes(campo) && texto(valor) !== '')
    .map(([campo, valor]) => [nombreCampo(campo), sinRotulo(typeof valor === 'number' ? valor.toLocaleString('es-AR') : texto(valor))])
}
