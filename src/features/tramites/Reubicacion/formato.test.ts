import { describe, expect, it } from 'vitest'
import { coordenadaVacia } from '@/lib/coordenadas'
import { suministroVacio } from '../shared/schemas/suministro'
import type { ReubicacionBackend } from './backend.types'
import {
  anilloExterior,
  caminoSuministro,
  diferenciaSuperficie,
  faltaEnCierre,
  anilloAGeoJson,
  filasServicio,
  ladoDeAnillo,
  ladoDePoligono,
  textoAjuste,
  verticesMovidos,
  hectareas,
  ladoDeForm,
  mensajeCierre,
  nivelDiferencia,
  pasosPropuesta,
  seEditaEnCatastro,
  servicioADto,
  servicioDeForm,
  servicioInicial,
  terminado,
  textoPunto,
  textoUbicacion,
} from './formato'

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

describe('comparación «Hoy» / «Cómo queda»', () => {
  it('nivel de la diferencia de superficie (tolerancia del 5 %)', () => {
    expect(nivelDiferencia(null, 90)).toBe('sin-referencia')
    expect(nivelDiferencia(90, 90)).toBe('igual')
    expect(nivelDiferencia(90, 93)).toBe('dentro')
    expect(nivelDiferencia(90, 100)).toBe('fuera')
  })

  it('el KML elegido (sin guardar) se compara con su superficie y perímetro', () => {
    const lado = ladoDeForm({ nombreArchivo: 'nuevo.kml', tamanioBytes: 10, coordenadas: [[-26.6, -64.94], [-26.6, -64.93], [-26.61, -64.93]], hectareas: 55.5 })
    expect(lado).toMatchObject({ superficieHa: 55.5, archivo: 'nuevo.kml' })
    expect(lado.perimetroM).toBeGreaterThan(0)
  })

  const hoy = {
    suministro: { fuentes: ['RIO SALI'], sistemaDistribucion: 'TOMA PROPIA', canalPrincipal: null, canalSecundario: null, canalTerciario: null, canalCuarto: null, canalQuinto: null, desague: 'ARROYO LA PERDIZ', observacion: 'Aspersión' },
    puntoEntrega: { x: 3599757.68, y: 7019346.8, latitud: -26.9512, longitud: -64.9954, referencia: 'Bomba vieja' },
  }

  it('marca solo lo que cambia y no muestra niveles que ningún lado tiene', () => {
    const queda = { suministro: { ...hoy.suministro, desague: 'MISMA PROPIEDAD', observacion: 'Goteo' }, puntoEntrega: undefined }
    const filas = filasServicio(hoy, queda)
    expect(filas.map((f) => f.campo)).toEqual(['Fuente', 'Sistema de distribución', 'Desagüe', 'Sistema de riego / observación', 'Punto de entrega'])
    expect(filas.filter((f) => f.cambia).map((f) => f.campo)).toEqual(['Desagüe', 'Sistema de riego / observación'])
    // Sin punto propuesto queda el de hoy.
    expect(filas.at(-1)).toMatchObject({ cambia: false, queda: 'X 3599757.68 · Y 7019346.8 (Bomba vieja)' })
  })

  it('lo que se está cargando en el formulario se ve como quedaría', () => {
    const lado = servicioDeForm({
      suministro: { ...suministroVacio(), fuentes: [{ valor: 'RIO SALI' }], desague: 'MISMA PROPIEDAD' },
      cambiaPuntoEntrega: true,
      puntoEntrega: { ...coordenadaVacia(), sistema: 'grados', latitud: '-26.9512', longitud: '-64.9954', referencia: 'Estación de bombeo' },
    })
    expect(lado.suministro).toMatchObject({ fuentes: ['RIO SALI'], desague: 'MISMA PROPIEDAD', sistemaDistribucion: null })
    expect(lado.puntoEntrega).toMatchObject({ latitud: -26.9512, longitud: -64.9954, referencia: 'Estación de bombeo' })
    expect(servicioDeForm({ suministro: suministroVacio(), cambiaPuntoEntrega: false, puntoEntrega: { ...coordenadaVacia(), referencia: '' } }).puntoEntrega).toBeUndefined()
  })
})

describe('ajuste del polígono en el mapa', () => {
  const base: [number, number][] = [[-26.6, -64.94], [-26.6, -64.93], [-26.609, -64.93], [-26.609, -64.94]]

  it('marca los vértices que se movieron', () => {
    const ajustado: [number, number][] = [base[0], [-26.6, -64.925], base[2], base[3]]
    expect(verticesMovidos(base, ajustado)).toEqual([false, true, false, false])
    expect(verticesMovidos(base, base)).toEqual([false, false, false, false])
  })

  it('el anillo del mapa sale como GeoJSON cerrado, en [lng, lat]', () => {
    expect(anilloAGeoJson(base)).toEqual({ type: 'Polygon', coordinates: [[[-64.94, -26.6], [-64.93, -26.6], [-64.93, -26.609], [-64.94, -26.609], [-64.94, -26.6]]] })
  })

  it('lo ajustado sin guardar se compara con una superficie estimada', () => {
    const lado = ladoDeAnillo(base, 'plano.kml', 'x')
    expect(lado).toMatchObject({ archivo: 'plano.kml', aproximada: true })
    expect(lado.superficieHa).toBeGreaterThan(90)
  })

  it('cómo se cargó el propuesto, para mostrar', () => {
    expect(textoAjuste(true, 3)).toBe('KML del plano ajustado en el sistema: 3 vértices movidos')
    expect(textoAjuste(false, 0)).toBe('Ajustado en el sistema sobre el polígono vigente: todavía no se movió ningún vértice')
    const p = { geojson: { type: 'MultiPolygon' as const, coordinates: [] }, superficieHa: 1, perimetroM: 1, archivo: null, carga: 'KML_AJUSTADO' as const }
    expect(ladoDePoligono(p).origen).toBe('KML del plano, ajustado en el sistema')
  })
})

describe('pasos de la propuesta', () => {
  const poligono = { geojson: { type: 'MultiPolygon' as const, coordinates: [] }, superficieHa: 1, perimetroM: 1, archivo: null }
  const servicio = { suministro: { fuentes: [], sistemaDistribucion: null, canalPrincipal: null, canalSecundario: null, canalTerciario: null, canalCuarto: null, canalQuinto: null, desague: null, observacion: null }, puntoEntrega: null }

  it('sin nada cargado: faltan el lugar y la forma de servicio', () => {
    const pasos = pasosPropuesta({ propuesta: { poligono: null, servicio: null } }, 'Recaudación')
    expect(pasos.map((p) => p.listo)).toEqual([false, false, false])
    expect(pasos[2].titulo).toBe('Revisar y enviar a Recaudación')
  })

  it('con todo cargado, solo queda enviar', () => {
    const pasos = pasosPropuesta({ propuesta: { poligono, servicio } }, 'Jurídico')
    expect(pasos.map((p) => p.listo)).toEqual([true, true, false])
    expect(pasos[2].falta).toBeNull()
  })
})
