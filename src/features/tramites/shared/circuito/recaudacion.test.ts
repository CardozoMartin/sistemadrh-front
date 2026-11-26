import { describe, expect, it } from 'vitest'
import { estadoDeudaPorTitular, faltaEnDecision } from './recaudacion'

describe('decisión de Recaudación (pasos 12-13)', () => {
  const base = { conDeuda: 0, otrasDeudas: 0, observaciones: '' }

  it('sin decisión no hay nada que avisar', () => {
    expect(faltaEnDecision({ ...base, decision: '' })).toBeNull()
  })

  it('«no posee deuda» se guarda sin observaciones', () => {
    expect(faltaEnDecision({ ...base, decision: 'APTO' })).toBeNull()
  })

  it('«no posee deuda» no se puede si quedan deudas sin concesión', () => {
    expect(faltaEnDecision({ ...base, decision: 'APTO', otrasDeudas: 1 })).toContain('sin concesión')
  })

  it('«posee deuda» exige marcar la concesión y el motivo', () => {
    expect(faltaEnDecision({ ...base, decision: 'NO_APTO' })).toBe('Marque en qué concesión está la deuda.')
    expect(faltaEnDecision({ ...base, decision: 'NO_APTO', conDeuda: 1 })).toContain('motivo')
    expect(faltaEnDecision({ ...base, decision: 'NO_APTO', conDeuda: 1, observaciones: '   ' })).toContain('motivo')
    expect(faltaEnDecision({ decision: 'NO_APTO', conDeuda: 1, otrasDeudas: 0, observaciones: 'Canon 2025' })).toBeNull()
  })
})

describe('estado de deuda por titular: se revisa al dueño anterior y al nuevo', () => {
  const antecedentes = {
    titulares: [
      { personaId: '1', nombre: 'ACTUAL' },
      { personaId: '2', nombre: 'NUEVO' },
    ],
    concesiones: [
      { id: '10', numero: '906', deTitulares: ['1'], tieneDeuda: true },
      { id: '11', numero: null, deTitulares: ['2'], tieneDeuda: false },
    ],
    otrasDeudas: [{ personaId: '2', detalle: 'Canon 2019 sin concesión' }],
  }

  it('cada persona con sus concesiones y sus deudas; primero el actual, después el nuevo', () => {
    const [actual, nuevo] = estadoDeudaPorTitular(antecedentes, ['1'], ['2'])
    expect(actual).toMatchObject({ nombre: 'ACTUAL', rol: 'actual', concesiones: ['N° 906'], deudas: ['Concesión N° 906'] })
    expect(nuevo).toMatchObject({ nombre: 'NUEVO', rol: 'nuevo', concesiones: ['id 11'], deudas: ['Canon 2019 sin concesión'] })
  })

  it('el nuevo titular sin concesiones también aparece (sin deuda)', () => {
    const r = estadoDeudaPorTitular({ ...antecedentes, concesiones: [antecedentes.concesiones[0]], otrasDeudas: [] }, ['1'], ['2'])
    expect(r[1]).toMatchObject({ rol: 'nuevo', concesiones: [], deudas: [] })
  })

  it('un cotitular que sigue figura una sola vez', () => {
    const r = estadoDeudaPorTitular(antecedentes, ['1', '2'], ['2'])
    expect(r.find((t) => t.personaId === '2')?.rol).toBe('ambos')
  })
})
