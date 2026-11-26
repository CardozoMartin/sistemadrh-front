import { describe, expect, it } from 'vitest'
import { anioActual } from '../shared/schemas/expediente'
import { cierreAnulacionSchema, inicioAnulacionSchema, motivoSchema } from './schemas'

const mensaje = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues[0].message

describe('motivo de la anulación (RN-A04 / RN-A09)', () => {
  it('acepta un motivo descriptivo y lo recorta', () => {
    const r = motivoSchema.safeParse('  Renuncia del titular a la concesión  ')
    expect(r.success).toBe(true)
    expect(r.data).toBe('Renuncia del titular a la concesión')
  })

  it('exige al menos 10 caracteres (sin contar los espacios de los bordes)', () => {
    expect(mensaje(motivoSchema.safeParse('Abandono'))).toBe('El motivo debe tener al menos 10 caracteres.')
    expect(mensaje(motivoSchema.safeParse('   s/d      '))).toBe('El motivo debe tener al menos 10 caracteres.')
  })

  it('no acepta más de 1000 caracteres', () => {
    expect(mensaje(motivoSchema.safeParse('Abandono del uso del agua. '.repeat(40)))).toBe('Máximo 1000 caracteres.')
  })

  it('rechaza texto de relleno: sin palabras o con muy pocos caracteres distintos', () => {
    for (const relleno of ['xxxxxxxxxx', '——————————', '1234567890', 'ab ab ab ab ab', '..........']) {
      expect(mensaje(motivoSchema.safeParse(relleno)), relleno).toBe('Describa el motivo de la anulación.')
    }
  })

  it('acepta acentos y ñ', () => expect(motivoSchema.safeParse('Resolución judicial por daño').success).toBe(true))
})

describe('inicio de la anulación (Catastro, pasos 1-6)', () => {
  const valido = {
    concesionId: '15',
    expediente: { numero: '123', reparticion: '332', anio: anioActual() },
    documentacionPresentada: [1, 3],
    motivo: 'Renuncia del titular a la concesión',
  }

  it('acepta la concesión, el expediente del año en curso, los papeles y el motivo', () => {
    expect(inicioAnulacionSchema.safeParse(valido).success).toBe(true)
  })

  it('exige elegir la concesión', () => {
    expect(mensaje(inicioAnulacionSchema.safeParse({ ...valido, concesionId: '' }))).toBe('Seleccione la concesión.')
  })

  it('el expediente tiene que ser del año en curso', () => {
    const r = inicioAnulacionSchema.safeParse({ ...valido, expediente: { ...valido.expediente, anio: '2020' } })
    expect(mensaje(r)).toBe('El expediente tiene que ser del año en curso.')
  })

  it('el número de expediente tiene hasta 6 dígitos', () => {
    const r = inicioAnulacionSchema.safeParse({ ...valido, expediente: { ...valido.expediente, numero: '1234567' } })
    expect(mensaje(r)).toBe('Ingrese el número (hasta 6 dígitos).')
  })

  it('el motivo es obligatorio', () => {
    const r = inicioAnulacionSchema.safeParse({ ...valido, motivo: '' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].path).toEqual(['motivo'])
  })

  it('el checklist puede venir vacío en el schema (los obligatorios los controla faltantesDelChecklist)', () => {
    expect(inicioAnulacionSchema.safeParse({ ...valido, documentacionPresentada: [] }).success).toBe(true)
  })
})

describe('cierre de la anulación (circuito json-server)', () => {
  it('sin confirmar que es irreversible no se finaliza', () => {
    expect(mensaje(cierreAnulacionSchema.safeParse({ confirmaIrreversible: false }))).toMatch(/no se puede revertir/)
  })
  it('confirmado, se puede', () => expect(cierreAnulacionSchema.safeParse({ confirmaIrreversible: true }).success).toBe(true))
})
