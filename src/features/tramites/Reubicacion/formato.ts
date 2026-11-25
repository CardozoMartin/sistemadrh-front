// Reglas y textos de la Reubicación que no dependen de la pantalla (testeables).
// El backend vuelve a validar todo; esto es para guiar al usuario y armar lo que se manda.
import { formatearFecha } from '@/config/expedientes'
import { coordenadaADto, coordenadaDesdeApi, coordenadaVacia } from '@/lib/coordenadas'
import type { LatLng } from '@/lib/geo'
import { faltaEnVerificacionFinal, type EstadoCierre } from '../shared/circuito/cierre'
import { suministroVacio } from '../shared/schemas/suministro'
import type { FormaServicioDto } from './api'
import type { EstadoReubicacion, PoligonoReubicacion, ReubicacionBackend, SuministroReubicacion } from './backend.types'
import type { ServicioReubicacionForm } from './schemas'

/** Cómo se ve un trámite que ya no está en curso (en «Dónde está»). */
export const TERMINADO: Record<Exclude<EstadoReubicacion, 'EN_TRAMITE'>, string> = {
  FINALIZADO: 'Finalizado: el nuevo lugar y la forma de servicio rigen en la concesión',
  RECHAZADO: 'Rechazado: la concesión sigue como estaba',
  ANULADO: 'Cancelado: iniciado por error',
}

/** null mientras está en trámite; si terminó, cómo terminó. */
export const terminado = (estado: EstadoReubicacion): string | null => (estado === 'EN_TRAMITE' ? null : TERMINADO[estado])

// --- Cierre en Catastro (visto bueno final) ------------------------------------------

/** Qué falta para cerrar (null: se puede). */
export const faltaEnCierre = (estado: EstadoCierre): string | null => faltaEnVerificacionFinal(estado, 'el nuevo lugar y la forma de servicio')

/** El mensaje de «Trámite finalizado» después del cierre. */
export function mensajeCierre({ concesion, expediente, fechaResolucion }: { concesion: string; expediente: string; fechaResolucion: string | null }): string {
  const desde = fechaResolucion ? ` desde el ${formatearFecha(fechaResolucion)}` : ''
  return `El nuevo lugar y la forma de servicio rigen en la concesión ${concesion}${desde}. Lo anterior y el expediente ${expediente} quedan en el historial.`
}

// --- Etapas en Catastro -----------------------------------------------------------------

/** La carga inicial de la propuesta (se puede cancelar) y su corrección si Jurídico la observa (se reenvía a Jurídico). */
export const ETAPA_CARGA = 'CARGA'
export const ETAPA_CORRECCION = 'CORRECCION'

/** Catastro puede editar la propuesta: en la carga o en la corrección de lo que observó Jurídico. */
export const seEditaEnCatastro = (estado: EstadoReubicacion, etapa: string) => estado === 'EN_TRAMITE' && (etapa === ETAPA_CARGA || etapa === ETAPA_CORRECCION)

/** Por qué la propuesta ya no se puede editar: dónde está o cómo terminó. */
export function dondeQuedo(estado: EstadoReubicacion, expediente: { numero: string; oficinaNombre: string; etapaNombre: string }): string {
  const donde = estado === 'EN_TRAMITE' ? `está en ${expediente.oficinaNombre} (${expediente.etapaNombre})` : `quedó ${estado.toLowerCase()}`
  return `Expediente ${expediente.numero}: ${donde}.`
}

/** «12,5 ha». */
export const hectareas = (n: number) => `${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })} ha`

/** El anillo exterior de la primera parte, [lat, lng] sin repetir el primer vértice (lo que usan los mapas). */
export function anilloExterior(poligono: PoligonoReubicacion | null): LatLng[] {
  const anillo = poligono?.geojson.coordinates[0]?.[0] ?? []
  const vertices = anillo.map(([lng, lat]) => [lat, lng] as LatLng)
  const [primero, ultimo] = [vertices[0], vertices[vertices.length - 1]]
  return primero && ultimo && vertices.length > 1 && primero[0] === ultimo[0] && primero[1] === ultimo[1] ? vertices.slice(0, -1) : vertices
}

/** «Localidad · Departamento · Distrito X» (vacío si no hay nada registrado). */
export const textoUbicacion = (u: { localidad: string | null; departamento: string | null; distrito: string | null }) =>
  [u.localidad, u.departamento, u.distrito && `Distrito ${u.distrito}`].filter(Boolean).join(' · ')

/** «+1,2 ha» / «−0,5 ha» / «sin cambio». */
export function diferenciaSuperficie(vigenteHa: number, propuestaHa: number): string {
  const d = Math.round((propuestaHa - vigenteHa) * 100) / 100
  if (d === 0) return 'sin cambio'
  return `${d > 0 ? '+' : '−'}${hectareas(Math.abs(d))}`
}

/** El suministro en una línea: «RIO SALI → TOMA PROPIA POR BOMBEO → … · desagüe: MISMA PROPIEDAD». */
export function caminoSuministro(s: SuministroReubicacion | null): string {
  if (!s) return 'Sin suministro cargado'
  const camino = [s.fuentes.join(' + '), s.sistemaDistribucion, s.canalPrincipal, s.canalSecundario, s.canalTerciario, s.canalCuarto, s.canalQuinto].filter(Boolean).join(' → ')
  return [camino || 'Sin fuente', s.desague && `desagüe: ${s.desague}`].filter(Boolean).join(' · ')
}

/** Un punto en una línea: «X 3599757.68 · Y 7019346.8 (Estación de bombeo)». */
export const textoPunto = (p: { x: number | null; y: number | null; latitud: number; longitud: number; referencia: string | null } | null) =>
  p ? `${p.x !== null && p.y !== null ? `X ${p.x} · Y ${p.y}` : `${p.latitud}, ${p.longitud}`}${p.referencia ? ` (${p.referencia})` : ''}` : 'sin punto de entrega cargado'

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
