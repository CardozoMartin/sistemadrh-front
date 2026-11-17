import { useQueries, useQuery } from '@tanstack/react-query'
import { sigApi } from './api'
import { leerCapaDrh } from './capasDrh'
import { leerTemas, SERVICIOS_WMS, type ServicioWms, type TemaWms } from './capasWms'

export const sigKeys = {
  all: ['sig'] as const,
  concesiones: () => [...sigKeys.all, 'concesiones'] as const,
  pozos: () => [...sigKeys.all, 'pozos'] as const,
  puntos: () => [...sigKeys.all, 'puntos'] as const,
  cauces: () => [...sigKeys.all, 'cauces'] as const,
}

/** Capa de concesiones del visor. Se refresca al volver a la pestaña (otro usuario pudo cargar un KML). */
export function useCapaConcesiones() {
  return useQuery({
    queryKey: sigKeys.concesiones(),
    queryFn: () => sigApi.concesiones(),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })
}

/** Capa de pozos del visor. */
export function useCapaPozos() {
  return useQuery({
    queryKey: sigKeys.pozos(),
    queryFn: () => sigApi.pozos(),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })
}

/** Capa de desagües y puntos de entrega del visor. */
export function useCapaPuntos() {
  return useQuery({
    queryKey: sigKeys.puntos(),
    queryFn: () => sigApi.puntos(),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })
}

/** Ríos y canales: cambian muy poco (se recargan con «npm run sig:cauces» en el backend). */
export function useCapaCauces() {
  return useQuery({ queryKey: sigKeys.cauces(), queryFn: () => sigApi.cauces(), staleTime: Infinity })
}

const consultaTemas = (servicio: ServicioWms) => ({ queryKey: [...sigKeys.all, 'wms', servicio.id], queryFn: () => leerTemas(servicio), staleTime: Infinity, retry: 1 })

/** Capas que ofrece un servicio WMS de otro organismo (se lee una vez por sesión). */
export function useTemasWms(servicio: ServicioWms) {
  return useQuery(consultaTemas(servicio))
}

/** Capas de todos los servicios WMS, por id de servicio (el catálogo del visor las reparte por tema). */
export function useTemasServicios(): Record<string, { temas: TemaWms[]; cargando: boolean; error: boolean }> {
  return useQueries({
    queries: SERVICIOS_WMS.map(consultaTemas),
    combine: (resultados) => Object.fromEntries(SERVICIOS_WMS.map((s, i) => [s.id, { temas: resultados[i].data ?? [], cargando: resultados[i].isLoading, error: resultados[i].isError }])),
  })
}

/**
 * Capas del GeoServer de la DRH que están prendidas, leídas de la copia local (no cambian
 * mientras el visor está abierto: se actualizan con «npm run sig:copiar»). Se leen al prenderlas
 * por primera vez: algunas pesan varios MB.
 */
export function useCapasDrh(activas: string[]) {
  return useQueries({
    queries: activas.map((id) => ({ queryKey: [...sigKeys.all, 'drh', id], queryFn: () => leerCapaDrh(id), staleTime: Infinity, retry: false })),
    combine: (resultados) => resultados.map((r, i) => ({ id: activas[i], datos: r.data, cargando: r.isLoading, error: r.error })),
  })
}
