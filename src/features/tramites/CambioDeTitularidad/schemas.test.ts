import { describe, expect, it } from 'vitest'
import { anioActual } from '../shared/schemas/expediente'
import { crearNuevoTitularSchema, inicioCambioSchema, nuevoTitularVacio } from './schemas'

describe('inicio del cambio', () => {
  const valido = { concesionId: '15', expediente: { numero: '123', reparticion: '332', anio: anioActual() }, documentacionPresentada: [1, 3] }

  it('acepta la concesión, el expediente del año en curso y los papeles marcados', () => {
    expect(inicioCambioSchema.safeParse(valido).success).toBe(true)
  })

  it('exige elegir la concesión', () => {
    const r = inicioCambioSchema.safeParse({ ...valido, concesionId: '' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toBe('Seleccione la concesión.')
  })

  it('el expediente tiene que ser del año en curso', () => {
    const r = inicioCambioSchema.safeParse({ ...valido, expediente: { ...valido.expediente, anio: '2020' } })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toBe('El expediente tiene que ser del año en curso.')
  })
})

describe('nuevo titular (pasos 6-8)', () => {
  const titular = {
    ...nuevoTitularVacio().titulares[0],
    tipoPersona: 'fisica' as const,
    tipoDocumento: 'dni' as const,
    documento: '30123456',
    apellido: 'PÉREZ',
    nombre: 'JUAN',
    fechaNacimiento: '1980-05-10',
    correo: 'juan@ejemplo.com',
    telefono: '3815551234',
  }
  const domicilio = { calle: 'Av. Siempreviva', numero: '742', departamento: 'CAPITAL', localidad: 'SAN MIGUEL DE TUCUMAN', distrito: 'I' }

  it('acepta un titular nuevo con su domicilio', () => {
    expect(crearNuevoTitularSchema(['20111111']).safeParse({ titulares: [titular], domicilios: [domicilio] }).success).toBe(true)
  })

  it('rechaza que el nuevo sea el titular actual (también si se carga con su CUIL)', () => {
    for (const documento of ['30123456', '20301234569']) {
      const r = crearNuevoTitularSchema(['30123456']).safeParse({ titulares: [{ ...titular, documento, tipoDocumento: documento.length === 11 ? 'cuil' : 'dni' }], domicilios: [domicilio] })
      expect(r.success).toBe(false)
      expect(r.error?.issues.some((i) => i.message.startsWith('Es titular actual de la concesión'))).toBe(true)
    }
  })

  it('puede quedar un cotitular actual si entra uno nuevo', () => {
    const otro = { ...titular, documento: '28999888' }
    expect(crearNuevoTitularSchema(['30123456']).safeParse({ titulares: [titular, otro], domicilios: [domicilio] }).success).toBe(true)
  })
})
