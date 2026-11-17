// Servicios geográficos del backend real (NestJS + PostGIS). El proxy de Vite manda /api/sig/*
// al puerto 3000. Los usan el formulario de alta (carga de KML) y el visor.
import type { MultiPolygon } from 'geojson'
import { api } from './api/client'

/** Otra concesión cuyo polígono vigente se superpone con el analizado. */
export interface Superposicion {
  concesionId: string
  numero: string | null
  estado: string
  /** NULL si la concesión es migrada (sin expediente digital). */
  expediente: string | null
  titular: string | null
  /** Superficie en común (ha). */
  superficieHa: number
}

/** Resultado de validar un KML/GeoJSON con PostGIS (sin guardar nada). */
export interface AnalisisGeometria {
  archivo: { nombre: string; bytes: number }
  /** Nombres de los Placemark/Feature de donde salieron los polígonos. */
  nombres: string[]
  /** Lo que se ignoró del archivo (puntos, líneas) o que conviene saber (varias partes, ejes invertidos). */
  avisos: string[]
  /** Sistema de coordenadas en que vino el archivo. */
  sistemaOrigen: 'POSGAR_FAJA3' | 'WGS84'
  sistemaOrigenNombre: string
  /** Todos los polígonos del archivo como MultiPolygon, en WGS84 ([lng, lat]). */
  geojson: MultiPolygon
  /** Calculada por PostGIS en POSGAR 07: es el valor oficial. */
  superficieHa: number
  perimetroM: number
  puntoInterior: { latitud: number; longitud: number }
  puntoInteriorPosgar: { x: number; y: number }
  superposiciones: Superposicion[]
  /** Río o canal más cercano (si está a más de 2 km, viene un aviso en `avisos`). */
  cauceCercano: { nombre: string | null; tipo: 'RIO' | 'CANAL'; distanciaM: number } | null
}

/**
 * Manda el archivo al backend para que PostGIS lo lea, lo valide (polígono válido, dentro de
 * Tucumán) y lo mida. Si el archivo tiene un problema, el error trae el motivo para el usuario.
 */
export async function analizarArchivoGeografico(archivo: File): Promise<AnalisisGeometria> {
  const datos = new FormData()
  datos.append('archivo', archivo)
  const { data } = await api.post<AnalisisGeometria>('/sig/kml/analizar', datos, {
    // El cliente manda JSON por defecto; con FormData el navegador arma el multipart y su «boundary».
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}
