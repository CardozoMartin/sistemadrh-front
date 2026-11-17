// Filtros de la consulta de pozos: qué claves existen, sus opciones y cómo se leen de la URL.
import type { Option } from '@/components/form'
import { ESTADO_POZO, formatoFecha } from '../BajaDePozo/estilos'
import type { CampoFecha, FiltroBaja, FiltrosPozos } from './types'

/** Claves que viajan en la URL y en la query string (el origen va aparte: son las solapas). */
export const CLAVES_FILTRO = [
  'q', 'estado', 'baja', 'concesion', 'conConcesion', 'expediente', 'cliente', 'departamento', 'localidad', 'distrito',
  'motivo', 'circuito', 'jurisdiccion', 'monitoreos', 'campoFecha', 'desde', 'hasta', 'profundidadMin', 'profundidadMax', 'caudalMin', 'caudalMax',
] as const satisfies readonly (keyof FiltrosPozos)[]

export type ClaveFiltro = (typeof CLAVES_FILTRO)[number]
export type Filtros = Partial<Record<ClaveFiltro, string>>

export const OPCIONES_BAJA: (Option & { value: FiltroBaja })[] = [
  { value: 'SIN_BAJA', label: 'Sin baja' },
  { value: 'BAJA_DE_OFICIO', label: 'Baja de oficio' },
  { value: 'BAJA_A_SOLICITUD', label: 'Baja a solicitud del titular' },
  { value: 'BAJA_EN_TRAMITE', label: 'Baja en trámite' },
  { value: 'DADO_DE_BAJA', label: 'Dado de baja (cualquier forma)' },
]

export const OPCIONES_ESTADO: Option[] = (['EN_USO', 'PARADO', 'FUERA_DE_SERVICIO', 'BAJA'] as const).map((e) => ({ value: e, label: ESTADO_POZO[e].texto }))

export const OPCIONES_CIRCUITO: Option[] = [
  { value: 'EN_CURSO', label: 'En curso' },
  { value: 'FINALIZADO', label: 'Finalizado' },
  { value: 'RECHAZADO', label: 'Rechazado' },
]

export const OPCIONES_SI_NO: Option[] = [
  { value: 'SI', label: 'Sí' },
  { value: 'NO', label: 'No' },
]

export const OPCIONES_MONITOREOS: Option[] = [
  { value: 'CON', label: 'Con monitoreos' },
  { value: 'SIN', label: 'Sin monitoreos' },
]

export const OPCIONES_CAMPO_FECHA: (Option & { value: CampoFecha })[] = [
  { value: 'ALTA', label: 'Fecha de alta (registro de oficio)' },
  { value: 'BAJA', label: 'Fecha de baja (o de inicio si está en trámite)' },
  { value: 'MONITOREO', label: 'Fecha de algún monitoreo' },
]

/** Atajos de un clic: completan uno o más filtros. */
export const VISTAS_RAPIDAS: { texto: string; icono: string; filtros: Filtros }[] = [
  { texto: 'Bajas de oficio', icono: 'gavel', filtros: { baja: 'BAJA_DE_OFICIO' } },
  { texto: 'Bajas en trámite', icono: 'pending_actions', filtros: { baja: 'BAJA_EN_TRAMITE' } },
  { texto: 'Sin concesión', icono: 'link_off', filtros: { conConcesion: 'NO' } },
  { texto: 'Sin monitoreos', icono: 'monitoring', filtros: { monitoreos: 'SIN' } },
  { texto: 'Registro en curso', icono: 'route', filtros: { circuito: 'EN_CURSO' } },
]

const nombreDe = (opciones: Option[], valor: string) => opciones.find((o) => o.value === valor)?.label ?? valor

/** Texto de cada filtro activo, para los chips que se pueden quitar. */
export function chipsDe(f: Filtros): { clave: ClaveFiltro; texto: string }[] {
  const chips: { clave: ClaveFiltro; texto: string }[] = []
  const agregar = (clave: ClaveFiltro, texto: string) => f[clave] && chips.push({ clave, texto })
  agregar('q', `Búsqueda: «${f.q}»`)
  agregar('estado', `Estado: ${nombreDe(OPCIONES_ESTADO, f.estado ?? '')}`)
  agregar('baja', nombreDe(OPCIONES_BAJA, f.baja ?? ''))
  agregar('concesion', `Concesión ${f.concesion}`)
  agregar('conConcesion', f.conConcesion === 'SI' ? 'Con concesión' : 'Sin concesión')
  agregar('expediente', `Expediente: ${f.expediente}`)
  agregar('cliente', `Cliente: ${f.cliente}`)
  agregar('departamento', `Departamento: ${f.departamento}`)
  agregar('localidad', `Localidad: ${f.localidad}`)
  agregar('distrito', `Distrito ${f.distrito}`)
  agregar('motivo', `Motivo: ${f.motivo}`)
  agregar('circuito', `Registro: ${nombreDe(OPCIONES_CIRCUITO, f.circuito ?? '').toLowerCase()}`)
  agregar('jurisdiccion', f.jurisdiccion === 'SI' ? 'Jurisdicción DRH' : 'Fuera de jurisdicción DRH')
  agregar('monitoreos', nombreDe(OPCIONES_MONITOREOS, f.monitoreos ?? ''))
  if (f.desde || f.hasta) {
    const campo = { ALTA: 'Alta', BAJA: 'Baja', MONITOREO: 'Monitoreo' }[(f.campoFecha ?? 'ALTA') as CampoFecha]
    const rango = f.desde && f.hasta ? `${formatoFecha(f.desde)} al ${formatoFecha(f.hasta)}` : f.desde ? `desde ${formatoFecha(f.desde)}` : `hasta ${formatoFecha(f.hasta!)}`
    chips.push({ clave: 'desde', texto: `${campo}: ${rango}` })
  }
  const rango = (min: ClaveFiltro, max: ClaveFiltro, nombre: string, unidad: string) => {
    if (f[min] && f[max]) chips.push({ clave: min, texto: `${nombre}: ${f[min]} a ${f[max]} ${unidad}` })
    else if (f[min]) chips.push({ clave: min, texto: `${nombre} ≥ ${f[min]} ${unidad}` })
    else if (f[max]) chips.push({ clave: max, texto: `${nombre} ≤ ${f[max]} ${unidad}` })
  }
  rango('profundidadMin', 'profundidadMax', 'Profundidad', 'm')
  rango('caudalMin', 'caudalMax', 'Caudal', 'l/s')
  return chips
}

/** Al quitar un chip se borran también las claves que van con él (el rango de fechas, mín. y máx.). */
export const CLAVES_DEL_CHIP: Partial<Record<ClaveFiltro, ClaveFiltro[]>> = {
  desde: ['desde', 'hasta', 'campoFecha'],
  profundidadMin: ['profundidadMin', 'profundidadMax'],
  caudalMin: ['caudalMin', 'caudalMax'],
}
