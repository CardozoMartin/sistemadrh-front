// Reglas de las oficinas del circuito: las mismas que valida el backend (tramites/circuito/), para
// avisar antes de mandar. Funciones puras.
import type { AptoNoApto, ResultadoDictamen } from './tipos'

// --- Recaudación ------------------------------------------------------------------

interface EntradaDeuda {
  decision: AptoNoApto | ''
  /** Concesiones marcadas con deuda. */
  conDeuda: number
  /** Deudas registradas antes, sin concesión. */
  otrasDeudas: number
  observaciones: string
}

/** Qué falta para poder guardar la decisión de Recaudación (null: se puede guardar). */
export function faltaEnDecision({ decision, conDeuda, otrasDeudas, observaciones }: EntradaDeuda): string | null {
  if (!decision) return null
  if (decision === 'APTO') return otrasDeudas ? 'Hay deudas registradas sin concesión: regístrelas como pagadas antes de marcar «Apto».' : null
  if (!conDeuda && !otrasDeudas) return 'Marque en qué concesión está la deuda.'
  if (!observaciones.trim()) return 'Indique el motivo del «No apto» (qué se adeuda).'
  return null
}

type Antecedentes = {
  titulares: { personaId: string; nombre: string }[]
  concesiones: { id: string; numero: string | null; deTitulares: string[]; tieneDeuda: boolean }[]
  otrasDeudas: { personaId: string; detalle: string }[]
}

export interface EstadoDeudaPersona {
  personaId: string
  nombre: string
  rol: 'actual' | 'nuevo' | 'ambos'
  /** Concesiones otorgadas de la persona (N° o id). */
  concesiones: string[]
  /** Las que tienen deuda registrada, más las deudas sin concesión. */
  deudas: string[]
}

/** El estado de deuda de cada persona del trámite (los actuales primero; un cotitular que sigue, una sola vez). */
export function estadoDeudaPorPersona(a: Antecedentes, actuales: string[], nuevos: string[]): EstadoDeudaPersona[] {
  const nombre = (c: { id: string; numero: string | null }) => (c.numero ? `N° ${c.numero}` : `id ${c.id}`)
  const rol = (id: string): EstadoDeudaPersona['rol'] => (actuales.includes(id) && nuevos.includes(id) ? 'ambos' : actuales.includes(id) ? 'actual' : 'nuevo')
  const orden = { actual: 0, ambos: 1, nuevo: 2 }
  return a.titulares
    .map((t) => {
      const suyas = a.concesiones.filter((c) => c.deTitulares.includes(t.personaId))
      return {
        personaId: t.personaId,
        nombre: t.nombre,
        rol: rol(t.personaId),
        concesiones: suyas.map(nombre),
        deudas: [...suyas.filter((c) => c.tieneDeuda).map((c) => `Concesión ${nombre(c)}`), ...a.otrasDeudas.filter((d) => d.personaId === t.personaId).map((d) => d.detalle)],
      }
    })
    .sort((x, y) => orden[x.rol] - orden[y.rol])
}

// --- Distrito y Jurídico ------------------------------------------------------------

/** Largo mínimo de las observaciones técnicas de Distrito (igual que el backend). */
export const MINIMO_OBSERVACIONES_TECNICAS = 10

/**
 * Qué falta para poder dictaminar (null: se puede).
 *   - Distrito (`observacionesTecnicas`): el informe técnico es obligatorio siempre.
 *   - Observado y No apto exigen el motivo (es lo que Catastro tiene que corregir, o por qué se rechaza).
 */
export function faltaEnDictamen(resultado: ResultadoDictamen | '', observaciones: string, observacionesTecnicas = false): string | null {
  if (!resultado) return null
  if (observacionesTecnicas && observaciones.trim().length < MINIMO_OBSERVACIONES_TECNICAS) {
    return `Ingrese las observaciones técnicas (al menos ${MINIMO_OBSERVACIONES_TECNICAS} caracteres).`
  }
  if (resultado === 'OBSERVADO' && !observaciones.trim()) return 'Indique qué tiene que corregir o completar Catastro.'
  if (resultado === 'NO_APTO' && !observaciones.trim()) return 'Indique el motivo del «No apto»: el trámite se rechaza y queda en el historial.'
  return null
}

// --- Secretaría General -------------------------------------------------------------

/** Tope del PDF (igual que el backend: 10 MB). */
export const MAX_MB_RESOLUCION = 10

export interface DatosResolucion {
  numero: string
  /** Fecha de firma (AAAA-MM-DD). El año de la resolución sale de acá. */
  fecha: string
  archivo: { name: string; size: number } | null
}

/** Qué falta o está mal para registrar la resolución (null: se puede). `hoy` en AAAA-MM-DD. */
export function faltaEnResolucion({ numero, fecha, archivo }: DatosResolucion, hoy: string): string | null {
  if (!/^\d{1,6}$/.test(numero.trim())) return 'Ingrese el número de resolución (hasta 6 dígitos).'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return 'Ingrese la fecha de firma.'
  if (fecha > hoy) return 'La fecha de firma no puede ser futura.'
  if (!archivo) return 'Adjunte la resolución escaneada (PDF).'
  if (!/\.pdf$/i.test(archivo.name)) return 'La resolución tiene que ser un archivo PDF.'
  if (!archivo.size) return 'El PDF está vacío.'
  if (archivo.size > MAX_MB_RESOLUCION * 1024 * 1024) return `El PDF supera los ${MAX_MB_RESOLUCION} MB: escanéelo con menos resolución.`
  return null
}

/** El año de la resolución es el de la fecha de firma. */
export const anioDeFecha = (fecha: string) => Number(fecha.slice(0, 4))

/** Tamaño legible de un archivo (para los resúmenes). */
export const tamanio = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`)

// --- Formato ------------------------------------------------------------------------

/** «N° 906» (o el id, si la concesión todavía no tiene número). */
export const numeroConcesion = (c: { id: string; numero: string | null }) => `N° ${c.numero ?? c.id}`

/** «A, B y C»: los nombres de una lista de personas, para los mensajes. */
export const nombres = (lista: { nombreCompleto: string }[]) => {
  const n = lista.map((p) => p.nombreCompleto)
  return n.length <= 1 ? (n[0] ?? '') : `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`
}

/** «12,5 ha» con hasta 4 decimales. */
export const hectareas = (n: number) => `${n.toLocaleString('es-AR', { maximumFractionDigits: 4 })} ha`

/** «3,25 l/s» con hasta 3 decimales. */
export const litrosPorSegundo = (n: number) => `${n.toLocaleString('es-AR', { maximumFractionDigits: 3 })} l/s`
