// Capas del visor emuladas (como backend/src/sig): las mismas propiedades que las vistas
// sig.v_concesiones, sig.v_pozos y sig.v_puntos, y el análisis de un KML/GeoJSON.
import type { Feature } from 'geojson'
import type { AtributosConcesion, AtributosPozo, AtributosPunto, CapaCauces, CapaConcesiones, CapaPozos, CapaPuntos, ConcesionGeo, Recuadro } from '@/features/visor/types'
import { puntoEnPoligono } from '@/lib/geo'
import type { ConcesionDemo, Db } from './db'
import { datosConcesion } from './baja'
import { formatearNumero, NOMBRE_OFICINA } from './expedientes'
import { analizarArchivo, anilloDe, distanciaAlPoligono, obtenerCauces, poligonoDeConcesion } from './geo'
import { error400, error404, type Peticion, type Ruta } from './http'

const VISIBLES = ['EN_TRAMITE', 'VIGENTE', 'MODIFICADA', 'ARCHIVADA']
const n = (id: string) => Number(id)

function atributos(db: Db, c: ConcesionDemo): AtributosConcesion {
  const m = c.migrada
  const alta = c.expedienteId ? db.altas[c.expedienteId] : undefined
  const exp = c.expedienteId ? db.expedientes.find((e) => e.id === c.expedienteId) : undefined
  const conc = datosConcesion(db, c.id)
  const s = alta?.suministro
  return {
    poligono_id: n(alta?.poligono?.id ?? c.id),
    concesion_id: n(c.id),
    numero: c.numero,
    estado: c.estado as AtributosConcesion['estado'],
    tipo_derecho: 'CONCESION',
    origen: c.origen,
    anio_otorgamiento: c.anio,
    expediente: exp ? formatearNumero(exp) : null,
    oficina_actual: exp && exp.estado !== 'FINALIZADO' ? NOMBRE_OFICINA[exp.oficina] : null,
    titular: conc?.titular ?? null,
    documento: m?.documento ?? (alta?.titulares[0] ? (db.personas.find((p) => p.id === alta.titulares[0])?.documento ?? null) : null),
    cantidad_titulares: alta?.titulares.length ?? 1,
    departamento: conc?.departamento ?? null,
    localidad: conc?.localidad ?? null,
    distrito: conc?.distrito ?? null,
    cuenca: m?.cuenca ?? null,
    padron: alta?.inmueble?.catastral.padron ?? null,
    matricula_catastral: alta?.inmueble?.catastral.matricula ?? null,
    parcela: alta?.inmueble?.catastral.parcela ?? null,
    superficie_ha: m?.superficieHa ?? alta?.poligono?.superficieHa ?? 0,
    caudal_lps: m?.caudalLps ?? alta?.caudalAsignado ?? null,
    caracter: m?.caracter ?? alta?.usos?.caracter ?? null,
    codigo_servicio: m?.codigoServicio ?? alta?.usos?.codigoServicio ?? null,
    usos: m?.usos ?? (alta?.usos?.items.map((i) => i.nombre).join(', ') || null),
    fuente: m?.fuente ?? s?.fuentes[0] ?? null,
    sistema: m?.sistema ?? s?.sistemaDistribucion ?? null,
    canal_principal: m?.canalPrincipal ?? s?.canalPrincipal ?? null,
    origen_poligono: m ? 'MIGRACION' : 'ALTA',
    poligono_desde: c.fechaOtorgamiento ?? alta?.poligono?.desde ?? `${c.anio ?? 2000}-01-01`,
    // La demo no emula la publicación: las otorgadas se toman como publicadas.
    publicacion: c.estado === 'EN_TRAMITE' ? 'PENDIENTE' : 'PUBLICADO',
    publicacion_en: null,
  }
}

/** ¿El punto [lng, lat] está dentro del recuadro (oeste, sur, este, norte)? */
const enRecuadro = (lng: number, lat: number, r?: Recuadro) => !r || (lng >= r[0] && lng <= r[2] && lat >= r[1] && lat <= r[3])

function leerRecuadro(texto?: string): Recuadro | undefined {
  if (!texto) return undefined
  const v = texto.split(',').map(Number)
  if (v.length !== 4 || v.some((x) => !Number.isFinite(x))) throw error400('bbox debe ser "oeste,sur,este,norte" en grados decimales.')
  return v as Recuadro
}

function featureConcesion(db: Db, c: ConcesionDemo): ConcesionGeo | null {
  const geom = poligonoDeConcesion(db, c.id)
  return geom ? { type: 'Feature', id: n(c.id), geometry: geom, properties: atributos(db, c) } : null
}

function concesiones({ db, query }: Peticion): CapaConcesiones {
  const r = leerRecuadro(query.bbox)
  const features = db.concesiones
    .filter((c) => VISIBLES.includes(c.estado))
    .map((c) => featureConcesion(db, c))
    .filter((f): f is ConcesionGeo => !!f && (!r || anilloDe(f.geometry).some(([lat, lng]) => enRecuadro(lng, lat, r))))
  return { type: 'FeatureCollection', features }
}

function pozos({ db, query }: Peticion): CapaPozos {
  const r = leerRecuadro(query.bbox)
  const features = db.pozos
    .filter((p) => p.estado !== 'ANULADO' && enRecuadro(p.longitud, p.latitud, r))
    .map((p): Feature<GeoJSON.Point, AtributosPozo> => {
      const conc = datosConcesion(db, p.concesionId)
      const geom = p.concesionId ? poligonoDeConcesion(db, p.concesionId) : null
      return {
        type: 'Feature',
        id: n(p.id),
        geometry: { type: 'Point', coordinates: [p.longitud, p.latitud] },
        properties: {
          pozo_id: n(p.id),
          id_interno: p.idInterno,
          alias: p.alias,
          estado: p.estado as AtributosPozo['estado'],
          origen: p.origen,
          tipo_pozo: p.tipoPozo,
          jurisdiccion_drh: p.jurisdiccionDrh,
          profundidad_m: p.profundidadM,
          nivel_estatico_m: p.nivelEstaticoM,
          nivel_dinamico_m: p.nivelDinamicoM,
          caudal_m3h: p.caudalM3h,
          caudal_lps: p.caudalM3h === null ? null : +(p.caudalM3h / 3.6).toFixed(3),
          coord_x: p.x,
          coord_y: p.y,
          concesion_id: p.concesionId ? n(p.concesionId) : null,
          concesion_numero: conc?.c.numero ?? null,
          titular: conc?.titular ?? null,
          departamento: conc?.departamento ?? null,
          localidad: conc?.localidad ?? null,
          dentro_de_concesion: geom ? puntoEnPoligono([p.latitud, p.longitud], anilloDe(geom)) : null,
        },
      }
    })
  return { type: 'FeatureCollection', features }
}

function puntos({ db, query }: Peticion): CapaPuntos {
  const r = leerRecuadro(query.bbox)
  const features = db.puntos
    .filter((p) => enRecuadro(p.longitud, p.latitud, r))
    .flatMap((p): Feature<GeoJSON.Point, AtributosPunto>[] => {
      const conc = datosConcesion(db, p.concesionId)
      if (!conc || conc.c.estado === 'ANULADA' || conc.c.estado === 'DENEGADA') return []
      const geom = poligonoDeConcesion(db, p.concesionId)
      const exp = conc.c.expedienteId ? db.expedientes.find((e) => e.id === conc.c.expedienteId) : undefined
      return [
        {
          type: 'Feature',
          id: n(p.id),
          geometry: { type: 'Point', coordinates: [p.longitud, p.latitud] },
          properties: {
            punto_id: n(p.id),
            tipo: p.tipo,
            sistema_carga: p.sistema,
            coord_x: p.x,
            coord_y: p.y,
            latitud: p.latitud,
            longitud: p.longitud,
            referencia: p.referencia,
            concesion_id: n(conc.c.id),
            concesion_numero: conc.c.numero,
            concesion_estado: conc.c.estado,
            expediente: exp ? formatearNumero(exp) : null,
            titular: conc.titular,
            departamento: conc.departamento,
            localidad: conc.localidad,
            distancia_poligono_m: geom ? distanciaAlPoligono([p.latitud, p.longitud], geom) : null,
            publicado: conc.c.estado !== 'EN_TRAMITE',
          },
        },
      ]
    })
  return { type: 'FeatureCollection', features }
}

async function cauces(): Promise<CapaCauces> {
  const { fuente, cauces: lista } = await obtenerCauces()
  return {
    type: 'FeatureCollection',
    features: lista.map((c, i) => ({
      type: 'Feature',
      id: i + 1,
      geometry: { type: 'LineString', coordinates: c.linea },
      properties: { id: i + 1, nombre: c.nombre, tipo: c.tipo, fuente: fuente.startsWith('©') ? 'OpenStreetMap' : fuente, largo_km: c.largoKm },
    })),
  }
}

async function analizar({ db, cuerpo }: Peticion) {
  const archivo = cuerpo instanceof FormData ? cuerpo.get('archivo') : null
  if (!(archivo instanceof Blob)) throw error400('Adjunte el archivo (campo «archivo»).')
  const nombre = archivo instanceof File ? archivo.name : 'archivo.kml'
  return analizarArchivo(db, await archivo.text(), nombre, archivo.size)
}

export const rutasSig: Ruta[] = [
  ['GET', '/sig/concesiones', concesiones],
  [
    'GET',
    '/sig/concesiones/:id',
    ({ db, ruta }) => {
      const c = db.concesiones.find((x) => x.id === ruta.id)
      const f = c && featureConcesion(db, c)
      if (!f) throw error404('La concesión no existe o no tiene polígono cargado.')
      return f
    },
  ],
  ['GET', '/sig/pozos', pozos],
  ['GET', '/sig/puntos', puntos],
  ['GET', '/sig/cauces', cauces],
  ['POST', '/sig/kml/analizar', analizar],
]
