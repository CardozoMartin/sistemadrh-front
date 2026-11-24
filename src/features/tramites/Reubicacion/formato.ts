// Reglas y textos de la Reubicación que no dependen de la pantalla (testeables).
// El backend vuelve a validar todo; esto es para guiar al usuario y armar lo que se manda.
import { coordenadaADto, coordenadaDesdeApi, coordenadaVacia } from '@/lib/coordenadas'
import type { LatLng } from '@/lib/geo'
import { suministroVacio } from '../shared/schemas/suministro'
import type { FormaServicioDto } from './api'
import type { EstadoReubicacion, PoligonoReubicacion, ReubicacionBackend, SuministroReubicacion } from './backend.types'
import type { ServicioReubicacionForm } from './schemas'

/** Catastro todavía puede cargar la propuesta, enviarla o cancelarla: está en la carga. */
export const estaEnCarga = (estado: EstadoReubicacion, etapa: string) => estado === 'EN_TRAMITE' && etapa === 'CARGA'

/** Por qué la propuesta ya no se puede editar: dónde está o cómo terminó. */
export function dondeQuedo(estado: EstadoReubicacion, expediente: { numero: string; oficinaNombre: string; etapaNombre: string }): string {
  const donde = estado === 'EN_TRAMITE' ? `está en ${expediente.oficinaNombre} (${expediente.etapaNombre})` : `quedó ${estado.toLowerCase()}`
  return `Expediente ${expediente.numero}: ${donde}.`
}

const ha = (n: number) => `${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })} ha`

/** El anillo exterior de la primera parte, [lat, lng] sin repetir el primer vértice (lo que usan los mapas). */
export function anilloExterior(poligono: PoligonoReubicacion | null): LatLng[] {
  const anillo = poligono?.geojson.coordinates[0]?.[0] ?? []
  const vertices = anillo.map(([lng, lat]) => [lat, lng] as LatLng)
  const [primero, ultimo] = [vertices[0], vertices[vertices.length - 1]]
  return primero && ultimo && vertices.length > 1 && primero[0] === ultimo[0] && primero[1] === ultimo[1] ? vertices.slice(0, -1) : vertices
}

/** «+1,2 ha» / «−0,5 ha» / «sin cambio». */
export function diferenciaSuperficie(vigenteHa: number, propuestaHa: number): string {
  const d = Math.round((propuestaHa - vigenteHa) * 100) / 100
  if (d === 0) return 'sin cambio'
  return `${d > 0 ? '+' : '−'}${ha(Math.abs(d))}`
}

/** El suministro en una línea: «RIO SALI → TOMA PROPIA POR BOMBEO → … · desagüe: MISMA PROPIEDAD». */
export function caminoSuministro(s: SuministroReubicacion | null): string {
  if (!s) return 'Sin suministro cargado'
  const camino = [s.fuentes.join(' + '), s.sistemaDistribucion, s.canalPrincipal, s.canalSecundario, s.canalTerciario, s.canalCuarto, s.canalQuinto].filter(Boolean).join(' → ')
  return [camino || 'Sin fuente', s.desague && `desagüe: ${s.desague}`].filter(Boolean).join(' · ')
}

/**
 * Lo que se precarga en el formulario de la forma de servicio: lo ya propuesto o, si todavía no
 * se propuso nada, lo vigente (así Catastro cambia solo lo que cambia).
 */
export function servicioInicial({ propuesta, vigente }: ReubicacionBackend['reubicacion']): ServicioReubicacionForm {
  const s = propuesta.servicio?.suministro ?? vigente.suministro
  const punto = propuesta.servicio ? propuesta.servicio.puntoEntrega : null
  const vacio = suministroVacio()
  return {
    suministro: s
      ? {
          ...vacio,
          fuentes: s.fuentes.length ? s.fuentes.map((valor) => ({ valor })) : vacio.fuentes,
          sistemaDistribucion: s.sistemaDistribucion ?? '',
          canalPrincipal: s.canalPrincipal ?? '',
          canalSecundario: s.canalSecundario ?? '',
          canalTerciario: s.canalTerciario ?? '',
          canalCuarto: s.canalCuarto ?? '',
          canalQuinto: s.canalQuinto ?? '',
          desague: s.desague ?? '',
          observacion: s.observacion ?? '',
        }
      : vacio,
    cambiaPuntoEntrega: !!punto,
    puntoEntrega: { ...(punto ? coordenadaDesdeApi(punto) : coordenadaVacia()), referencia: punto?.referencia ?? '' },
  }
}

const opcional = (v: string) => (v.trim() ? v.trim() : undefined)

/** Formulario → PUT …/forma-servicio (listas planas, sin caudal; el punto solo si se cambia). */
export function servicioADto({ suministro: s, cambiaPuntoEntrega, puntoEntrega }: ServicioReubicacionForm): FormaServicioDto {
  const { referencia, ...coordenada } = puntoEntrega
  const punto = cambiaPuntoEntrega ? coordenadaADto(coordenada) : undefined
  return {
    fuentes: s.fuentes.map((f) => f.valor).filter(Boolean),
    sistemaDistribucion: opcional(s.sistemaDistribucion),
    canalPrincipal: opcional(s.canalPrincipal),
    canalSecundario: opcional(s.canalSecundario),
    canalTerciario: opcional(s.canalTerciario),
    canalCuarto: opcional(s.canalCuarto),
    canalQuinto: opcional(s.canalQuinto),
    desague: opcional(s.desague),
    observacion: opcional(s.observacion),
    ...(punto ? { puntoEntrega: { ...punto, ...(referencia ? { referencia } : {}) } } : {}),
  }
}
