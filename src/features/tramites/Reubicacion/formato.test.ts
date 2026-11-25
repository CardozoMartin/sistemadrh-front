import { describe, expect, it } from 'vitest'
import { coordenadaVacia } from '@/lib/coordenadas'
import { suministroVacio } from '../shared/schemas/suministro'
import type { ReubicacionBackend } from './backend.types'
import { anilloExterior, caminoSuministro, diferenciaSuperficie, faltaEnCierre, hectareas, mensajeCierre, seEditaEnCatastro, servicioADto, servicioInicial, terminado, textoPunto, textoUbicacion } from './formato'

const suministro = {
  fuentes: ['RIO SALI'],
  sistemaDistribucion: 'TOMA PROPIA POR BOMBEO',
  canalPrincipal: 'CAÑERIA PROPIA',
  canalSecundario: null,
  canalTerciario: null,
  canalCuarto: null,
  canalQuinto: null,
  desague: 'ARROYO LA PERDIZ',
  observacion: 'Riego por aspersión',
}

const reubicacion = (cambios: Partial<ReubicacionBackend['reubicacion']> = {}) =>
  ({
    vigente: { poligono: null, suministro, puntoEntrega: null },
    propuesta: { poligono: null, servicio: null },
    ...cambios,
  }) as ReubicacionBackend['reubicacion']

describe('formato de la reubicación', () => {
  it('Catastro edita en la carga y en la corrección de lo observado, solo en trámite', () => {
    expect(seEditaEnCatastro('EN_TRAMITE', 'CARGA')).toBe(true)
    expect(seEditaEnCatastro('EN_TRAMITE', 'CORRECCION')).toBe(true)
    expect(seEditaEnCatastro('EN_TRAMITE', 'RECAUDACION')).toBe(false)
    expect(seEditaEnCatastro('EN_TRAMITE', 'JURIDICO')).toBe(false)
    expect(seEditaEnCatastro('ANULADO', 'CARGA')).toBe(false)
  })

  it('hectáreas y ubicación en texto', () => {
    expect(hectareas(1250.5)).toBe('1.250,5 ha')
    expect(textoUbicacion({ localidad: 'Famaillá', departamento: null, distrito: '7' })).toBe('Famaillá · Distrito 7')
    expect(textoUbicacion({ localidad: null, departamento: null, distrito: null })).toBe('')
  })

  it('cierre: hace falta la resolución y el cotejo', () => {
    expect(faltaEnCierre({ conResolucion: true, cotejado: true })).toBeNull()
    expect(faltaEnCierre({ conResolucion: true, cotejado: false })).not.toBeNull()
    expect(mensajeCierre({ concesion: 'N° 7089', expediente: '856/332-2025', fechaResolucion: null })).toBe('El nuevo lugar y la forma de servicio rigen en la concesión N° 7089. Lo anterior y el expediente 856/332-2025 quedan en el historial.')
  })

  it('cómo terminó (null mientras está en trámite)', () => {
    expect(terminado('EN_TRAMITE')).toBeNull()
    expect(terminado('RECHAZADO')).toBe('Rechazado: la concesión sigue como estaba')
  })

  it('un punto en una línea: X/Y si las tiene, si no latitud/longitud', () => {
    expect(textoPunto({ x: 3599757.68, y: 7019346.8, latitud: -26.9512, longitud: -64.9954, referencia: 'Estación de bombeo' })).toBe('X 3599757.68 · Y 7019346.8 (Estación de bombeo)')
    expect(textoPunto({ x: null, y: null, latitud: -26.9512, longitud: -64.9954, referencia: null })).toBe('-26.9512, -64.9954')
    expect(textoPunto(null)).toBe('sin punto de entrega cargado')
  })

  it('el anillo del GeoJSON pasa a [lat, lng] sin repetir el cierre', () => {
    const poligono = { geojson: { type: 'MultiPolygon' as const, coordinates: [[[[-64.94, -26.6], [-64.93, -26.6], [-64.93, -26.61], [-64.94, -26.6]]]] }, superficieHa: 1, perimetroM: 1, archivo: null }
    expect(anilloExterior(poligono)).toEqual([[-26.6, -64.94], [-26.6, -64.93], [-26.61, -64.93]])
    expect(anilloExterior(null)).toEqual([])
  })

  it('diferencia de superficie', () => {
    expect(diferenciaSuperficie(90, 90)).toBe('sin cambio')
    expect(diferenciaSuperficie(90, 92.5)).toBe('+2,5 ha')
    expect(diferenciaSuperficie(90, 88)).toBe('−2 ha')
  })

  it('el suministro en una línea', () => {
    expect(caminoSuministro(suministro)).toBe('RIO SALI → TOMA PROPIA POR BOMBEO → CAÑERIA PROPIA · desagüe: ARROYO LA PERDIZ')
    expect(caminoSuministro(null)).toBe('Sin suministro cargado')
  })

  it('sin propuesta, el formulario se precarga con lo vigente (y sin cambiar el punto)', () => {
    const form = servicioInicial(reubicacion())
    expect(form.suministro).toMatchObject({ fuentes: [{ valor: 'RIO SALI' }], sistemaDistribucion: 'TOMA PROPIA POR BOMBEO', desague: 'ARROYO LA PERDIZ' })
    expect(form.cambiaPuntoEntrega).toBe(false)
  })

  it('con propuesta, se precarga lo propuesto (con su punto de entrega)', () => {
    const propuesto = { ...suministro, desague: 'MISMA PROPIEDAD', observacion: 'Riego por goteo' }
    const punto = { sistema: 'POSGAR_FAJA3', x: 3583790.86, y: 7046059.72, latitud: -26.7, longitud: -65.1, referencia: 'Estación de bombeo' }
    const form = servicioInicial(reubicacion({ propuesta: { poligono: null, servicio: { suministro: propuesto, puntoEntrega: punto } } }))
    expect(form.suministro.desague).toBe('MISMA PROPIEDAD')
    expect(form.cambiaPuntoEntrega).toBe(true)
    expect(form.puntoEntrega).toMatchObject({ sistema: 'posgar', x: '3583790.86', referencia: 'Estación de bombeo' })
  })

  it('al backend: listas planas, sin vacíos ni caudal, y el punto solo si cambia', () => {
    const base = { suministro: { ...suministroVacio('25'), fuentes: [{ valor: 'RIO SALI' }], desague: 'MISMA PROPIEDAD', observacion: '  Riego por goteo ' } }
    const sinPunto = servicioADto({ ...base, cambiaPuntoEntrega: false, puntoEntrega: { ...coordenadaVacia(), sistema: 'grados', latitud: '-26.6', longitud: '-64.9', referencia: 'x' } })
    expect(sinPunto).toEqual({ fuentes: ['RIO SALI'], desague: 'MISMA PROPIEDAD', observacion: 'Riego por goteo' })

    const conPunto = servicioADto({ ...base, cambiaPuntoEntrega: true, puntoEntrega: { ...coordenadaVacia(), sistema: 'grados', latitud: '-26.6045', longitud: '-64.935', referencia: 'Estación de bombeo' } })
    expect(conPunto.puntoEntrega).toEqual({ latitud: -26.6045, longitud: -64.935, referencia: 'Estación de bombeo' })
  })
})
