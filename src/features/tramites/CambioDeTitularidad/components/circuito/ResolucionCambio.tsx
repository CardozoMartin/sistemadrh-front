import { cambioTitularidadApi } from '../../api'
import type { CambioBackend } from '../../backend.types'
import { numeroConcesion } from '../../../shared/formato'
import { useResolucionCambio } from '../../hooks'
import { PanelResolucion, ResolucionCargada as ResolucionCargadaComun } from '../../../shared/circuito/PanelResolucion'
import type { Terminado } from '../../../shared/circuito/terminado'

const TEXTOS = {
  destino: 'Catastro · verificación final',
  mensajeRegistrada: (resolucion: string, expediente: string) =>
    `Resolución ${resolucion} registrada. El expediente ${expediente} pasó a Catastro para la verificación final: recién ahí la concesión cambia de titular.`,
}

/**
 * Secretaría General (pasos 32-38) del Cambio de Titularidad: el panel común de la resolución. El
 * expediente pasa a Catastro para la verificación final (recién ahí la concesión cambia de titular).
 */
export function ResolucionCambio({ datos, onTerminado }: { datos: CambioBackend; onTerminado: (t: Terminado) => void }) {
  return <PanelResolucion expediente={datos.expediente} concesion={numeroConcesion(datos.cambio.concesion)} useResolucion={useResolucionCambio} textos={TEXTOS} onTerminado={onTerminado} />
}

/** La resolución ya cargada, con el PDF para abrir. */
export function ResolucionCargada({ datos }: { datos: CambioBackend }) {
  return <ResolucionCargadaComun expedienteId={datos.expediente.id} resolucion={datos.cambio.resolucion} descargar={cambioTitularidadApi.archivoResolucion} />
}
