// Peticiones del visor. Van al backend real (NestJS + PostGIS): el proxy de Vite manda
// /api/sig/* al puerto 3000 (ver vite.config.ts). La geometría llega en WGS84, lista para Leaflet.
import { api } from '@/services/api/client'
import type { CapaCauces, CapaConcesiones, CapaPozos, CapaPuntos, ConcesionGeo, Recuadro } from './types'

export const sigApi = {
  /**
   * Concesiones con polígono vigente. Sin recuadro trae todas: con los volúmenes de la
   * DRH (unos miles) es manejable. Si crece, se pide por recuadro (bbox) o se pasa a
   * vector tiles sin cambiar las pantallas.
   */
  async concesiones(recuadro?: Recuadro): Promise<CapaConcesiones> {
    const { data } = await api.get<CapaConcesiones>('/sig/concesiones', { params: recuadro ? { bbox: recuadro.join(',') } : undefined })
    return data
  },

  /** Pozos (puntos), con la concesión que abastecen. */
  async pozos(recuadro?: Recuadro): Promise<CapaPozos> {
    const { data } = await api.get<CapaPozos>('/sig/pozos', { params: recuadro ? { bbox: recuadro.join(',') } : undefined })
    return data
  },

  /** Desagües y puntos de entrega de las concesiones (puntos). */
  async puntos(recuadro?: Recuadro): Promise<CapaPuntos> {
    const { data } = await api.get<CapaPuntos>('/sig/puntos', { params: recuadro ? { bbox: recuadro.join(',') } : undefined })
    return data
  },

  /** Ríos y canales (líneas simplificadas para el mapa). */
  async cauces(): Promise<CapaCauces> {
    const { data } = await api.get<CapaCauces>('/sig/cauces')
    return data
  },

  async concesion(concesionId: number): Promise<ConcesionGeo> {
    const { data } = await api.get<ConcesionGeo>(`/sig/concesiones/${concesionId}`)
    return data
  },
}
