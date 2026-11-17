import type { Expediente } from '@/types/domain'
import { personaDeTitular, type ConfigTramite } from '../../shared/etapas/config'
import type { DatosExpedienteAnulacion } from '../types'

export const datosAnulacion = (e: Expediente) => e.datos as DatosExpedienteAnulacion | null

/** Lo que la anulación aporta a las pantallas compartidas: los titulares de la concesión y el motivo. */
export const CONFIG_ANULACION: ConfigTramite = {
  personas: (e) => {
    const titulares = datosAnulacion(e)?.titulares ?? []
    if (titulares.length === 0) return [{ clave: 'titular', rol: 'Titular', nombre: e.titular, documento: '—', correo: '' }]
    return titulares.map((t, i) => personaDeTitular(t, `titular-${i}`, i === 0 ? 'Titular' : `Titular adicional ${i}`))
  },
  datosResumen: (e) => {
    const datos = datosAnulacion(e)
    const titular = datos?.titulares[0] ? personaDeTitular(datos.titulares[0], 'titular', 'Titular') : null
    return [
      { label: 'Titular', valor: e.titular, ancho: true },
      ...(titular ? [{ label: 'Documento', valor: titular.documento, ancho: true }] : []),
      ...(datos ? [{ label: 'Motivo de la anulación', valor: datos.motivo, ancho: true }] : []),
    ]
  },
}
