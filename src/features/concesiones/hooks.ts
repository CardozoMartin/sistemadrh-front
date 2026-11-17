import { useMemo } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { expedienteKeys } from '@/features/expedientes/hooks'
import { useDominio } from '@/hooks/useDominio'
import type { Expediente } from '@/types/domain'
import { concesionesApi } from './api'
import type { FiltrosConcesion } from './datos'

/** Cuelgan de `expedienteKeys.all`: todo lo que refresca expedientes refresca concesiones. */
export const concesionKeys = {
  all: [...expedienteKeys.all, 'concesiones'] as const,
  busqueda: (filtros: FiltrosConcesion, pagina: number) => [...concesionKeys.all, 'busqueda', filtros, pagina] as const,
  delDepartamento: (departamento: string) => [...concesionKeys.all, 'departamento', departamento] as const,
  enCurso: (ids: string[]) => [...concesionKeys.all, 'en-curso', ids] as const,
  detalle: (id: string) => [...concesionKeys.all, 'detalle', id] as const,
  tramites: (id: string) => [...concesionKeys.all, 'tramites', id] as const,
}

/**
 * Búsqueda de concesiones vigentes en el servidor. Con `filtros` en null no pide nada:
 * la lista arranca vacía hasta que el usuario busca.
 */
export function useBuscarConcesiones(filtros: FiltrosConcesion | null, pagina: number) {
  return useQuery({
    queryKey: concesionKeys.busqueda(filtros ?? {}, pagina),
    queryFn: () => concesionesApi.buscarVigentes(filtros!, pagina),
    enabled: !!filtros,
    placeholderData: keepPreviousData,
  })
}

/** Concesiones vigentes de un departamento (vecinas de un polígono). */
export function useConcesionesDelDepartamento(departamento: string | undefined) {
  return useQuery({
    queryKey: concesionKeys.delDepartamento(departamento ?? ''),
    queryFn: () => concesionesApi.vigentesDelDepartamento(departamento!),
    enabled: !!departamento,
  })
}

export function useConcesion(id: string | undefined) {
  return useQuery({
    queryKey: concesionKeys.detalle(id ?? ''),
    queryFn: () => concesionesApi.obtener(id!),
    enabled: !!id,
  })
}

/** Trámites hechos sobre la concesión a lo largo del tiempo (cambios de titularidad, etc.). */
export function useTramitesDeConcesion(id: string | undefined) {
  return useQuery({
    queryKey: concesionKeys.tramites(id ?? ''),
    queryFn: () => concesionesApi.tramites(id!),
    enabled: !!id,
  })
}

/**
 * Trámites en curso sobre las concesiones indicadas (concesión id → expediente). Una
 * concesión con un trámite pendiente no puede iniciar otro hasta que ese termine.
 */
export function useTramitesEnCurso(concesionIds: string[]) {
  const { estadosPendientes } = useDominio()
  const enCurso = useQuery({
    queryKey: concesionKeys.enCurso(concesionIds),
    queryFn: () => concesionesApi.tramitesEnCurso(concesionIds, estadosPendientes),
    enabled: concesionIds.length > 0,
  })
  const porConcesion = useMemo(
    () => new Map<string, Expediente>((enCurso.data ?? []).map((e) => [e.concesionOrigenId!, e])),
    [enCurso.data],
  )
  return { porConcesion, cargando: enCurso.isFetching }
}
