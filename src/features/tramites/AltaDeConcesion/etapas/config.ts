import { personaDeTitular, type ConfigTramite } from '../../shared/etapas/config'
import type { DatosExpedienteAlta } from '../types'

const datosDe = (e: { datos: unknown }) => e.datos as DatosExpedienteAlta | null

/** Lo que el alta aporta a las pantallas compartidas del circuito. */
export const CONFIG_ALTA: ConfigTramite = {
  personas: (e) => {
    const titulares = datosDe(e)?.titulares ?? []
    if (titulares.length === 0) return [{ clave: 'titular', rol: 'Titular', nombre: e.titular, documento: '—', correo: '' }]
    return titulares.map((t, i) => personaDeTitular(t, `titular-${i}`, i === 0 ? 'Titular' : `Titular adicional ${i}`))
  },
  datosResumen: (e, d) => {
    const datos = datosDe(e)
    const titular = datos?.titulares[0] ? personaDeTitular(datos.titulares[0], 'titular', 'Titular') : null
    return [
      { label: 'Titular', valor: e.titular, ancho: true },
      ...(titular ? [{ label: 'Documento', valor: titular.documento }] : []),
      ...(datos ? [{ label: 'Situación legal', valor: d.situacionLegal(datos.situacionLegalId)?.nombre ?? '—' }] : []),
    ]
  },
}
