// Reglas de la decisión de Recaudación (caso de uso, pasos 12-13). Las mismas que valida el
// backend (tramites/circuito/validaciones: validarDecisionDeuda), para avisar antes de mandar.

export type DecisionDeuda = 'APTO' | 'NO_APTO'

interface Entrada {
  decision: DecisionDeuda | ''
  /** Concesiones marcadas con deuda. */
  conDeuda: number
  /** Deudas registradas antes, sin concesión. */
  otrasDeudas: number
  observaciones: string
}

/** Qué falta para poder guardar la decisión (null: se puede guardar). */
export function faltaEnDecision({ decision, conDeuda, otrasDeudas, observaciones }: Entrada): string | null {
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

export interface EstadoDeudaTitular {
  personaId: string
  nombre: string
  rol: 'actual' | 'nuevo' | 'ambos'
  /** Concesiones otorgadas de la persona (N° o id). */
  concesiones: string[]
  /** Las que tienen deuda registrada, más las deudas sin concesión. */
  deudas: string[]
}

/**
 * El estado de deuda de CADA persona del cambio: el titular actual (dueño anterior) y el nuevo.
 * Recaudación tiene que revisar a los dos; un cotitular que sigue figura una sola vez («ambos»).
 */
export function estadoDeudaPorTitular(a: Antecedentes, actuales: string[], nuevos: string[]): EstadoDeudaTitular[] {
  const nombre = (c: { id: string; numero: string | null }) => (c.numero ? `N° ${c.numero}` : `id ${c.id}`)
  const rol = (id: string): EstadoDeudaTitular['rol'] => (actuales.includes(id) && nuevos.includes(id) ? 'ambos' : actuales.includes(id) ? 'actual' : 'nuevo')
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
