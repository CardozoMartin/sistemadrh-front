// Reglas y textos de la Reubicación que no dependen de la pantalla (testeables).
// El backend vuelve a validar todo; esto es para guiar al usuario y armar lo que se manda.
import { formatearFecha } from '@/config/expedientes'
import { coordenadaADto, coordenadaDesdeApi, coordenadaVacia, leerCoordenada } from '@/lib/coordenadas'
import { calcularHectareas, perimetroMetros, type LatLng } from '@/lib/geo'
import type { PoligonoForm } from '../shared/schemas/poligono'
import { faltaEnVerificacionFinal, type EstadoCierre } from '../shared/circuito/cierre'
import { suministroVacio } from '../shared/schemas/suministro'
import type { FormaServicioDto } from './api'
import type { CargaPoligono, EstadoReubicacion, PoligonoReubicacion, PuntoReubicacion, ReubicacionBackend, SuministroReubicacion } from './backend.types'
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

// --- Comparación «Hoy» / «Cómo queda» --------------------------------------------------

/**
 * Diferencia de superficie (en %) a partir de la cual se marca en ámbar. La magnitud no cambia en
 * una reubicación: es la misma tolerancia con la que avisa el backend (TOLERANCIA_SUPERFICIE_PCT).
 */
export const TOLERANCIA_SUPERFICIE_PCT = 5

export type NivelDiferencia = 'sin-referencia' | 'igual' | 'dentro' | 'fuera'

/** Cómo marcar la diferencia de superficie: sin polígono vigente, igual, dentro o fuera de la tolerancia. */
export function nivelDiferencia(vigenteHa: number | null, propuestaHa: number): NivelDiferencia {
  if (vigenteHa === null || vigenteHa <= 0) return 'sin-referencia'
  const pct = (Math.abs(propuestaHa - vigenteHa) / vigenteHa) * 100
  if (Math.round((propuestaHa - vigenteHa) * 100) === 0) return 'igual'
  return pct <= TOLERANCIA_SUPERFICIE_PCT ? 'dentro' : 'fuera'
}

/** Un polígono listo para comparar (el guardado en el backend, el KML recién elegido o el ajustado en el mapa). */
export interface LadoPoligono {
  anillo: LatLng[]
  superficieHa: number
  perimetroM: number
  archivo: string | null
  /** De dónde salió (solo el propuesto). */
  origen?: string | null
  /** La superficie es una estimación del navegador (ajustado y todavía sin guardar: PostGIS mide al guardar). */
  aproximada?: boolean
}

/** Cómo se cargó el polígono propuesto, para mostrar. */
export const NOMBRE_CARGA: Record<CargaPoligono, string> = {
  KML: 'KML del plano',
  KML_AJUSTADO: 'KML del plano, ajustado en el sistema',
  DIBUJADO: 'Ajustado en el sistema sobre el polígono vigente',
}

export const ladoDePoligono = (p: PoligonoReubicacion): LadoPoligono => ({
  anillo: anilloExterior(p),
  superficieHa: p.superficieHa,
  perimetroM: p.perimetroM,
  archivo: p.archivo?.nombre ?? null,
  origen: p.carga ? NOMBRE_CARGA[p.carga] : null,
})

/** Un anillo ajustado en el mapa, todavía sin guardar: la superficie y el perímetro los estima el navegador. */
export const ladoDeAnillo = (anillo: LatLng[], archivo: string | null, origen: string): LadoPoligono => ({
  anillo,
  superficieHa: calcularHectareas(anillo),
  perimetroM: perimetroMetros(anillo),
  archivo,
  origen,
  aproximada: true,
})

/** Qué vértices se movieron respecto del polígono del que se partió (por índice). */
export function verticesMovidos(base: LatLng[], ajustado: LatLng[]): boolean[] {
  const igual = (a: number, b: number) => Math.abs(a - b) < 1e-9
  return ajustado.map((p, i) => !base[i] || !igual(p[0], base[i][0]) || !igual(p[1], base[i][1]))
}

/** El anillo del mapa ([lat, lng], sin repetir el primero) → GeoJSON Polygon ([lng, lat], cerrado). */
export function anilloAGeoJson(anillo: LatLng[]): { type: 'Polygon'; coordinates: number[][][] } {
  const posiciones = anillo.map(([lat, lng]) => [lng, lat])
  return { type: 'Polygon', coordinates: [[...posiciones, posiciones[0]]] }
}

/** «KML del plano ajustado en el sistema: 3 vértices movidos». */
export function textoAjuste(desdeKml: boolean, movidos: number): string {
  const origen = desdeKml ? 'KML del plano ajustado en el sistema' : 'Ajustado en el sistema sobre el polígono vigente'
  return `${origen}: ${movidos === 0 ? 'todavía no se movió ningún vértice' : movidos === 1 ? '1 vértice movido' : `${movidos} vértices movidos`}`
}

/** El KML elegido y todavía no guardado (la superficie es la que calculó el backend al leerlo). */
export const ladoDeForm = (f: PoligonoForm): LadoPoligono => ({ anillo: f.coordenadas, superficieHa: f.hectareas, perimetroM: perimetroMetros(f.coordenadas), archivo: f.nombreArchivo })

/** La forma de servicio de un lado de la comparación. `puntoEntrega` undefined: no cambia (queda el de hoy). */
export interface LadoServicio {
  suministro: SuministroReubicacion | null
  puntoEntrega: Pick<PuntoReubicacion, 'x' | 'y' | 'latitud' | 'longitud' | 'referencia'> | null | undefined
}

/** Lo que se está cargando en el formulario, para verlo como quedaría (antes de guardar). */
export function servicioDeForm(values: ServicioReubicacionForm): LadoServicio {
  const dto = servicioADto(values)
  const nulo = (v: string | undefined) => v ?? null
  const { punto } = leerCoordenada(values.puntoEntrega, '')
  return {
    suministro: {
      fuentes: dto.fuentes,
      sistemaDistribucion: nulo(dto.sistemaDistribucion),
      canalPrincipal: nulo(dto.canalPrincipal),
      canalSecundario: nulo(dto.canalSecundario),
      canalTerciario: nulo(dto.canalTerciario),
      canalCuarto: nulo(dto.canalCuarto),
      canalQuinto: nulo(dto.canalQuinto),
      desague: nulo(dto.desague),
      observacion: nulo(dto.observacion),
    },
    puntoEntrega: values.cambiaPuntoEntrega ? (punto ? { ...punto, referencia: values.puntoEntrega.referencia.trim() || null } : null) : undefined,
  }
}

export interface FilaServicio {
  campo: string
  hoy: string
  queda: string
  cambia: boolean
}

const NIVELES: [string, keyof SuministroReubicacion][] = [
  ['Sistema de distribución', 'sistemaDistribucion'],
  ['Canal principal', 'canalPrincipal'],
  ['Canal secundario', 'canalSecundario'],
  ['Canal terciario', 'canalTerciario'],
  ['Canal cuarto', 'canalCuarto'],
  ['Canal quinto', 'canalQuinto'],
  ['Desagüe', 'desague'],
]

/**
 * La forma de servicio campo por campo, hoy y cómo queda, marcando lo que cambia. Los niveles del
 * árbol que no tiene ninguno de los dos lados no se muestran.
 */
export function filasServicio(hoy: LadoServicio, queda: LadoServicio): FilaServicio[] {
  const texto = (v: string | null | undefined) => (v?.trim() ? v.trim() : '—')
  const fila = (campo: string, a: string, b: string): FilaServicio => ({ campo, hoy: a, queda: b, cambia: a !== b })
  const filas: FilaServicio[] = [fila('Fuente', texto(hoy.suministro?.fuentes.join(' + ')), texto(queda.suministro?.fuentes.join(' + ')))]
  for (const [campo, clave] of NIVELES) {
    const a = texto(hoy.suministro?.[clave] as string | null | undefined)
    const b = texto(queda.suministro?.[clave] as string | null | undefined)
    if (a !== '—' || b !== '—') filas.push(fila(campo, a, b))
  }
  filas.push(fila('Sistema de riego / observación', texto(hoy.suministro?.observacion), texto(queda.suministro?.observacion)))
  // Sin punto propuesto queda el de hoy: se muestra igual a la izquierda y a la derecha.
  const puntoHoy = hoy.puntoEntrega ? textoPunto({ ...hoy.puntoEntrega }) : '—'
  const puntoQueda = queda.puntoEntrega === undefined ? puntoHoy : queda.puntoEntrega ? textoPunto({ ...queda.puntoEntrega }) : '—'
  filas.push(fila('Punto de entrega', puntoHoy, puntoQueda))
  return filas
}

// --- Pasos de la propuesta -----------------------------------------------------------

export interface PasoPropuesta {
  id: 'poligono' | 'servicio' | 'enviar'
  titulo: string
  listo: boolean
  /** Lo que falta, si no está listo. */
  falta: string | null
}

/** 1) Nuevo lugar, 2) Forma de servicio, 3) Revisar y enviar: qué está listo y qué falta. */
export function pasosPropuesta({ propuesta }: Pick<ReubicacionBackend['reubicacion'], 'propuesta'>, destino: string): PasoPropuesta[] {
  const poligono = !!propuesta.poligono
  const servicio = !!propuesta.servicio
  return [
    { id: 'poligono', titulo: 'Nuevo lugar', listo: poligono, falta: poligono ? null : 'Cargar y guardar el KML del nuevo lugar.' },
    { id: 'servicio', titulo: 'Forma de servicio', listo: servicio, falta: servicio ? null : 'Revisar y guardar la forma de servicio (aunque no cambie nada).' },
    { id: 'enviar', titulo: `Revisar y enviar a ${destino}`, listo: false, falta: poligono && servicio ? null : 'Completar los pasos anteriores.' },
  ]
}
