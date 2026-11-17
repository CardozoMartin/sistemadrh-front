import type { Expediente } from '@/types/domain'
import { personaDeTitular, type ConfigTramite } from '../../shared/etapas/config'
import { ComparacionSuperficie } from '../components/ComparacionSuperficie'
import { NOMBRE_TIPO } from '../superficie'
import type { DatosExpedienteModificacion } from '../types'

export const datosModificacion = (e: Expediente) => e.datos as DatosExpedienteModificacion | null

/**
 * Lo que la reducción / ampliación aporta a las pantallas compartidas: los titulares de
 * la concesión, la superficie y el caudal (actual → propuesto) y el mapa comparativo.
 */
export const CONFIG_REDUCCION_AMPLIACION: ConfigTramite = {
  personas: (e) => {
    const titulares = datosModificacion(e)?.titulares ?? []
    if (titulares.length === 0) return [{ clave: 'titular', rol: 'Titular', nombre: e.titular, documento: '—', correo: '' }]
    return titulares.map((t, i) => personaDeTitular(t, `titular-${i}`, i === 0 ? 'Titular' : `Titular adicional ${i}`))
  },
  datosResumen: (e) => {
    const datos = datosModificacion(e)
    if (!datos) return [{ label: 'Titular', valor: e.titular, ancho: true }]
    const caudal = (n: number | null) => (n == null ? '—' : `${n.toFixed(2)} l/s`)
    return [
      { label: 'Titular', valor: e.titular, ancho: true },
      { label: 'Tipo de modificación', valor: NOMBRE_TIPO[datos.tipo] },
      { label: 'Superficie (propuesta)', valor: `${datos.actual.hectareas.toFixed(2)} → ${datos.propuesta.hectareas.toFixed(2)} ha` },
      { label: 'Caudal (recalculado)', valor: `${caudal(datos.actual.caudal)} → ${caudal(datos.propuesta.caudal)}`, ancho: true },
    ]
  },
  Detalle: ComparacionSuperficie,
}
