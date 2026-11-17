// Preferencias del visor que se guardan en la PC (localStorage): qué capas se ven, de qué
// servicios, la opacidad de cada una y por qué se colorean las concesiones. Así el visor se abre
// como el usuario lo dejó. Lo guardado se revisa al leerlo: si cambió el catálogo (una capa o un
// servicio que ya no existe), se descarta lo que no corresponde y se completa con lo de fábrica.
import { useEffect, useState } from 'react'
import { storage } from '@/lib/storage'
import { CAPAS_DRH, ESTADO_DRH_INICIAL, type EstadoDrh } from './capasDrh'
import { ESTADO_WMS_INICIAL, SERVICIOS_WMS, type EstadoWms } from './capasWms'
import { CRITERIOS, type CriterioColor } from './colores'
import { CAPAS_TODAS, type CapasVisor } from './filtros'

/** Opacidad elegida por capa (0 a 1). Las que no están usan la de fábrica. */
export type Opacidades = Record<string, number>

/** Claves de las opacidades: una por tema WMS, una por capa del GeoServer y el relleno de las concesiones. */
export const claveOpacidadWms = (servicio: string, tema: string) => `wms:${servicio}|${tema}`
export const claveOpacidadDrh = (capa: string) => `drh:${capa}`
export const CLAVE_RELLENO_CONCESIONES = 'concesiones:relleno'

/** Secciones del catálogo que el usuario dejó abiertas (las guarda el panel de capas). */
export const CLAVE_SECCIONES_ABIERTAS = 'drh_visor_secciones'

/** Relleno de fábrica de los polígonos (concesiones y capas del GeoServer; el borde siempre es opaco). */
export const RELLENO_CONCESIONES = 0.3

export const opacidadDe = (opacidades: Opacidades, clave: string, porDefecto: number) => opacidades[clave] ?? porDefecto

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function leerCapas(v: unknown): CapasVisor {
  if (!esObjeto(v)) return CAPAS_TODAS
  return Object.fromEntries(Object.entries(CAPAS_TODAS).map(([k, porDefecto]) => [k, typeof v[k] === 'boolean' ? v[k] : porDefecto])) as unknown as CapasVisor
}

function leerWms(v: unknown): EstadoWms {
  if (!esObjeto(v)) return ESTADO_WMS_INICIAL
  return Object.fromEntries(
    SERVICIOS_WMS.map((s) => {
      const e = v[s.id]
      if (!esObjeto(e) || !esObjeto(e.elegidas)) return [s.id, ESTADO_WMS_INICIAL[s.id]]
      const elegidas = Object.fromEntries(Object.entries(e.elegidas).filter((par): par is [string, string] => typeof par[1] === 'string'))
      // Un servicio apagado no tiene temas elegidos (el panel muestra cada tema por separado).
      return [s.id, e.activo === true ? { activo: true, elegidas } : ESTADO_WMS_INICIAL[s.id]]
    }),
  )
}

function leerDrh(v: unknown): EstadoDrh {
  if (!esObjeto(v) || !Array.isArray(v.elegidas)) return ESTADO_DRH_INICIAL
  const elegidas = v.elegidas.filter((id): id is string => CAPAS_DRH.some((c) => c.id === id))
  return v.activo === true && elegidas.length > 0 ? { activo: true, elegidas } : ESTADO_DRH_INICIAL
}

function leerOpacidades(v: unknown): Opacidades {
  if (!esObjeto(v)) return {}
  return Object.fromEntries(Object.entries(v).filter((par): par is [string, number] => typeof par[1] === 'number' && par[1] >= 0 && par[1] <= 1))
}

const leerCriterio = (v: unknown): CriterioColor => (CRITERIOS.some((c) => c.valor === v) ? (v as CriterioColor) : 'estado')

/** Un estado que se lee de la PC al abrir el visor y se guarda cada vez que cambia. */
function usePreferencia<T>(clave: string, leer: (guardado: unknown) => T) {
  const [valor, setValor] = useState<T>(() => leer(storage.get<unknown>(clave, null)))
  useEffect(() => storage.set(clave, valor), [clave, valor])
  return [valor, setValor] as const
}

export const usePreferenciaCapas = () => usePreferencia('drh_visor_capas', leerCapas)
export const usePreferenciaWms = () => usePreferencia('drh_visor_wms', leerWms)
export const usePreferenciaDrh = () => usePreferencia('drh_visor_geoserver', leerDrh)
export const usePreferenciaOpacidades = () => usePreferencia('drh_visor_opacidades', leerOpacidades)
export const usePreferenciaCriterio = () => usePreferencia('drh_visor_criterio', leerCriterio)

/** Borra todas las preferencias guardadas del visor (vuelve a como viene de fábrica). */
export function borrarPreferencias() {
  for (const clave of ['drh_visor_capas', 'drh_visor_wms', 'drh_visor_geoserver', 'drh_visor_opacidades', 'drh_visor_criterio', 'drh_visor_fondo', CLAVE_SECCIONES_ABIERTAS]) storage.remove(clave)
}
