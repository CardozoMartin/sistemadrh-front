// Coordenadas POSGAR 2007 / Argentina faja 3 (EPSG:5345), el sistema oficial de Tucumán:
// X (este) empieza con 3 e Y (norte) con 7. Es el que usa la oficina en los papeles y el
// que tiene la base (PostGIS).
//
// Acá se usa para MOSTRAR (ej: la posición del cursor en el visor) y para leer un KML en el
// navegador cuando el backend no responde. La conversión de proj4 difiere menos de 1 m de la de
// PostGIS (que aplica la transformación oficial de PROJ): lo que se guarda lo calcula el backend.
import proj4 from 'proj4'

const EPSG_5345 = '+proj=tmerc +lat_0=-90 +lon_0=-66 +k=1 +x_0=3500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs'
proj4.defs('EPSG:5345', EPSG_5345)

/** POSGAR 07 faja 3 (x, y) en metros → WGS84 (lat, lng). */
export function dePosgar(x: number, y: number): { lat: number; lng: number } {
  const [lng, lat] = proj4('EPSG:5345', 'EPSG:4326', [x, y])
  return { lat, lng }
}

/** ¿El par parece POSGAR faja 3 (X ≈ 3.500.000, Y ≈ 7.000.000) y no grados? */
export const pareceaPosgar = (a: number, b: number) => Math.abs(a) > 1000 && Math.abs(b) > 1000

/** WGS84 (lat, lng) → POSGAR 07 faja 3 (x, y) en metros. */
export function aPosgar(lat: number, lng: number): { x: number; y: number } {
  const [x, y] = proj4('EPSG:4326', 'EPSG:5345', [lng, lat])
  return { x, y }
}

const metros = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })
/** "X 3.577.293 · Y 7.035.340" */
export const formatearPosgar = ({ x, y }: { x: number; y: number }) => `X ${metros.format(x)} · Y ${metros.format(y)}`
