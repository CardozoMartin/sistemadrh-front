// Los datos de cada trámite (nombre, descripción, ícono) vienen de la API (/tramites).
// Acá solo está lo que es del front: a qué pantallas lleva cada uno.
import type { TipoTramite } from '@/types/domain'
import { ROUTES } from './routes'

/** Pantalla para iniciar cada trámite. */
export const RUTA_TRAMITE: Record<TipoTramite, string> = {
  alta_concesion: ROUTES.tramites.altaConcesion.inicio,
  cambio_titularidad: ROUTES.tramites.cambioTitularidad.inicio,
  anulacion: ROUTES.tramites.anulacion.inicio,
  reduccion_ampliacion: ROUTES.tramites.reduccionAmpliacion.inicio,
  subdivision: ROUTES.tramites.subdivision.inicio,
  reubicacion: ROUTES.tramites.reubicacion.inicio,
  permiso_uso: ROUTES.tramites.permisos,
}

/**
 * Pantalla donde cada oficina revisa un expediente de ese trámite. Los trámites que
 * todavía no tienen pantallas se derivan directo desde la bandeja.
 */
export const RUTA_GESTION: Partial<Record<TipoTramite, (expedienteId: string) => string>> = {
  alta_concesion: ROUTES.tramites.altaConcesion.gestion,
  cambio_titularidad: ROUTES.tramites.cambioTitularidad.gestion,
  anulacion: ROUTES.tramites.anulacion.gestion,
  reduccion_ampliacion: ROUTES.tramites.reduccionAmpliacion.gestion,
  subdivision: ROUTES.tramites.subdivision.gestion,
}
