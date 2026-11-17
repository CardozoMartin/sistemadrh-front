// Monitoreos del pozo (hidráulicos y químicos). PROTOTIPO: los responde el backend emulado
// (GET/POST /pozos/:id/monitoreos). Como en el prototipo (shared/state.js): cada medición se
// guarda con SU fecha, no pisa a las anteriores y se compara contra la anterior del mismo tipo.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { backend } from '@/services/api/backend'
import type { PozoBackend } from '../BajaDePozo/types'
import { caudalEspecifico, depresion, formatear, m3hALps } from '../AltaDePozo/calculos'

export type TipoMonitoreo = 'hidraulico' | 'quimico'

export interface DatosHidraulicos {
  nivelEstatico: number | null
  nivelDinamico: number | null
  caudalM3h: number | null
  regimenM3h?: number | null
  profundidadBomba?: number | null
  nivelCementacion?: number | null
  tipoBomba?: string | null
}

export interface ParametroQuimico {
  parametro: string
  tipoResultado: 'VALOR' | 'MENOR'
  simbolo: string | null
  resultado: string
  unidad: string | null
  observacion: string | null
}

export interface Monitoreo {
  id: string
  tipo: TipoMonitoreo
  /** Fecha de la medición (AAAA-MM-DD), no la de carga. */
  fecha: string
  /** Cuándo se cargó. */
  registrado: string
  usuario: string
  datos: Record<string, unknown>
}

export interface MonitoreosPozo {
  pozo: PozoBackend
  /** Del más reciente al más viejo. */
  monitoreos: Monitoreo[]
}

export const NOMBRE_TIPO: Record<TipoMonitoreo, { texto: string; icono: string; color: string }> = {
  hidraulico: { texto: 'Hidráulico', icono: 'water', color: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' },
  quimico: { texto: 'Químico', icono: 'science', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
}

export interface Campo {
  etiqueta: string
  valor: string
}

const metros = (n: number | null | undefined) => (n === null || n === undefined ? '' : `${formatear(n)} m`)

/** Lo medido en cada monitoreo, como se compara de uno al siguiente (incluye los derivados). */
export function camposDe(m: Monitoreo): Campo[] {
  if (m.tipo === 'quimico') {
    return ((m.datos.parametros as ParametroQuimico[] | undefined) ?? []).map((p) => ({
      etiqueta: p.parametro,
      valor: `${p.tipoResultado === 'MENOR' ? '< ' : ''}${p.resultado.replace('.', ',')}${p.unidad ? ` ${p.unidad}` : ''}`,
    }))
  }
  const d = m.datos as unknown as DatosHidraulicos
  const s = depresion(d.nivelEstatico ?? null, d.nivelDinamico ?? null)
  const q = d.caudalM3h ?? null
  const especifico = caudalEspecifico(q, s)
  const campos: Campo[] = [
    { etiqueta: 'Nivel estático', valor: metros(d.nivelEstatico) },
    { etiqueta: 'Nivel dinámico', valor: metros(d.nivelDinamico) },
    { etiqueta: 'Depresión (s)', valor: metros(s) },
    { etiqueta: 'Caudal de bombeo', valor: q === null ? '' : `${formatear(q)} m³/h = ${formatear(m3hALps(q), 3)} l/s` },
    { etiqueta: 'Caudal específico', valor: especifico === null ? '' : `${formatear(especifico, 3)} m³/h/m` },
    { etiqueta: 'Régimen de bombeo', valor: d.regimenM3h === null || d.regimenM3h === undefined ? '' : `${formatear(d.regimenM3h)} m³/h` },
    { etiqueta: 'Prof. de la bomba', valor: metros(d.profundidadBomba) },
    { etiqueta: 'Tipo de bomba', valor: d.tipoBomba ?? '' },
  ]
  return campos.filter((c) => c.valor !== '')
}

export interface Cambio {
  etiqueta: string
  /** null: el campo no estaba en el monitoreo anterior. */
  antes: string | null
  ahora: string
}

/**
 * Qué cambió contra el monitoreo ANTERIOR del mismo tipo (el de fecha previa). Un monitoreo que
 * repite los mismos valores no ensucia el historial. null si es el primero de su tipo.
 */
export function cambiosDe(m: Monitoreo, lista: Monitoreo[]): Cambio[] | null {
  const orden = lista.filter((x) => x.tipo === m.tipo).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.registrado.localeCompare(b.registrado))
  const i = orden.findIndex((x) => x.id === m.id)
  if (i <= 0) return null
  const antes = new Map(camposDe(orden[i - 1]).map((c) => [c.etiqueta, c.valor]))
  return camposDe(m)
    .filter((c) => antes.get(c.etiqueta) !== c.valor)
    .map((c) => ({ etiqueta: c.etiqueta, antes: antes.get(c.etiqueta) ?? null, ahora: c.valor }))
}

/** dd/mm/aaaa sin pasar por Date (no corre un día por la zona horaria). */
export const fechaCorta = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

/** «hace 3 años»: cuán vieja es una medición, de un vistazo. */
export function antiguedad(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(`${iso.slice(0, 10)}T12:00:00`).getTime()) / 86_400_000)
  if (dias < 1) return 'hoy'
  if (dias < 31) return `hace ${dias} día${dias === 1 ? '' : 's'}`
  const meses = Math.floor(dias / 30.4)
  if (meses < 12) return `hace ${meses} mes${meses === 1 ? '' : 'es'}`
  const anios = Math.floor(meses / 12)
  return `hace ${anios} año${anios === 1 ? '' : 's'}`
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

const clave = (pozoId: string) => ['backend', 'pozos', 'monitoreos', pozoId] as const

export function useMonitoreos(pozoId: string | undefined) {
  return useQuery({ queryKey: clave(pozoId ?? ''), queryFn: async () => (await backend.get<MonitoreosPozo>(`/pozos/${pozoId}/monitoreos`)).data, enabled: !!pozoId })
}

export function useRegistrarMonitoreo(pozoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dto: { tipo: TipoMonitoreo; fecha: string; datos: Record<string, unknown> }) => (await backend.post<MonitoreosPozo>(`/pozos/${pozoId}/monitoreos`, dto)).data,
    onSuccess: (r) => {
      qc.setQueryData(clave(pozoId), r)
      // El hidráulico más reciente cambia los datos vigentes del pozo (padrón, visor, registro).
      void qc.invalidateQueries({ queryKey: ['backend', 'pozos'] })
      void qc.invalidateQueries({ queryKey: ['backend', 'registro-pozo'] })
      void qc.invalidateQueries({ queryKey: ['sig'] })
    },
  })
}
