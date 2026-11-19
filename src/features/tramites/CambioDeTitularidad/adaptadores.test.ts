import { describe, expect, it } from 'vitest'
import { titularesADto } from '../AltaDeConcesion/adaptadores'
import { propuestaAFormulario } from './adaptadores'
import type { CambioBackend } from './backend.types'

const cambio = (nuevos: Partial<CambioBackend['cambio']> = {}): CambioBackend => ({
  expediente: { id: '12', numero: '12026/332-2026', tipoTramite: 'CAMBIO_TITULARIDAD', estado: 'EN_TRAMITE', etapa: 'CARGA', etapaNombre: 'Carga', oficinaActual: 'catastro', oficinaNombre: 'Catastro', tomadoPor: null, tomadoEn: null },
  cambio: {
    id: '1',
    estado: 'EN_TRAMITE',
    concesion: { id: '15', numero: '906', estado: 'VIGENTE', fechaOtorgamiento: null, padron: null },
    titularesActuales: [],
    domiciliosActuales: [],
    nuevosTitulares: [],
    nuevosDomicilios: [],
    cargaCompleta: false,
    documentacionPresentada: [],
    resolucion: null,
    ...nuevos,
  },
  avisoDeuda: null,
})

const persona = {
  personaId: '7',
  nombreCompleto: 'PÉREZ, JUAN',
  tipoPersona: 'FISICA' as const,
  tipoDocumento: 'DNI' as const,
  documento: '30123456',
  apellido: 'PÉREZ',
  nombre: 'JUAN',
  fechaNacimiento: '1980-05-10',
  razonSocial: null,
  fechaConstitucion: null,
  email: 'juan@ejemplo.com',
  telefono: '3815551234',
}
const domicilio = { calle: 'Av. Siempreviva', numero: null, departamento: 'CAPITAL', localidad: 'SAN MIGUEL DE TUCUMAN', distrito: 'I' }

describe('propuestaAFormulario (volver a abrir un cambio en carga)', () => {
  it('sin propuesta guardada arranca con un titular y un domicilio vacíos', () => {
    const form = propuestaAFormulario(cambio())
    expect(form.titulares).toHaveLength(1)
    expect(form.titulares[0].documento).toBe('')
    expect(form.domicilios).toHaveLength(1)
  })

  it('pasa los enumerados a minúscula y los nulos a texto vacío; el distrito va por código', () => {
    const form = propuestaAFormulario(cambio({ nuevosTitulares: [persona], nuevosDomicilios: [domicilio] }))
    expect(form.titulares[0]).toMatchObject({ tipoPersona: 'fisica', tipoDocumento: 'dni', documento: '30123456', correo: 'juan@ejemplo.com', razonSocial: '' })
    expect(form.domicilios[0]).toEqual({ calle: 'Av. Siempreviva', numero: '', departamento: 'CAPITAL', localidad: 'SAN MIGUEL DE TUCUMAN', distrito: 'I' })
  })

  it('ida y vuelta: lo que se reabre se vuelve a guardar igual', () => {
    const form = propuestaAFormulario(cambio({ nuevosTitulares: [persona], nuevosDomicilios: [domicilio] }))
    const dto = titularesADto(form.titulares, form.domicilios)
    expect(dto.titulares[0]).toMatchObject({ tipoPersona: 'FISICA', tipoDocumento: 'DNI', documento: '30123456', apellido: 'PÉREZ', email: 'juan@ejemplo.com' })
    expect(dto.domicilios[0]).toEqual({ calle: 'Av. Siempreviva', numero: undefined, departamento: 'CAPITAL', localidad: 'SAN MIGUEL DE TUCUMAN', distrito: 'I' })
  })

  it('una persona jurídica se guarda siempre con CUIT', () => {
    const juridica = { ...persona, tipoPersona: 'JURIDICA' as const, tipoDocumento: 'CUIT' as const, documento: '30708513543', razonSocial: 'TIERRA DE ARANDANOS SRL', fechaConstitucion: '2003-10-02', apellido: null, nombre: null, fechaNacimiento: null }
    const form = propuestaAFormulario(cambio({ nuevosTitulares: [juridica], nuevosDomicilios: [domicilio] }))
    expect(form.titulares[0]).toMatchObject({ tipoPersona: 'juridica', razonSocial: 'TIERRA DE ARANDANOS SRL' })
    expect(titularesADto(form.titulares, form.domicilios).titulares[0]).toMatchObject({ tipoPersona: 'JURIDICA', tipoDocumento: 'CUIT', razonSocial: 'TIERRA DE ARANDANOS SRL' })
  })
})
