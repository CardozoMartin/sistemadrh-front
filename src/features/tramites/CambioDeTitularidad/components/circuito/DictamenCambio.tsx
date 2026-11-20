import type { CambioBackend } from '../../backend.types'
import { numeroConcesion } from '../../formato'
import { useChecklistCambio, useDictaminarCambio } from '../../hooks'
import { PanelDictamen, type TextosDictamen } from '../../../shared/circuito/PanelDictamen'
import type { Terminado } from '../../../shared/circuito/terminado'
import { DocumentacionRevision } from '../../../shared/circuito/DocumentacionRevision'

const TEXTOS: TextosDictamen = {
  informeTecnico: 'Informe técnico del cambio',
  avisoRechazo: 'El cambio de titularidad se rechaza: la concesión sigue a nombre del titular actual. No se puede deshacer.',
  botonRechazo: 'Rechazar el cambio',
  tituloConfirmarRechazo: '¿Rechazar el cambio de titularidad?',
  mensajeConfirmarRechazo: 'El expediente queda rechazado y la concesión sigue con el titular actual. No se puede deshacer.',
  tituloRechazado: 'Cambio rechazado',
  mensajeRechazado: (numero) => `El expediente ${numero} quedó rechazado: la concesión sigue con el titular actual.`,
}

/**
 * Distrito (pasos 18-24) y Jurídico (pasos 25-31) del Cambio de Titularidad: el panel común de
 * dictamen. No apto: el cambio se rechaza y la concesión sigue con el titular actual.
 */
export function DictamenCambio({ datos, oficina, onTerminado }: { datos: CambioBackend; oficina: 'distrito' | 'juridico'; onTerminado: (t: Terminado) => void }) {
  const checklist = useChecklistCambio()
  return (
    <PanelDictamen
      expediente={datos.expediente}
      concesion={numeroConcesion(datos.cambio.concesion)}
      oficina={oficina}
      useDictaminar={useDictaminarCambio}
      textos={TEXTOS}
      // Jurídico revisa los papeles (caso de uso, paso 25).
      revision={oficina === 'juridico' ? <DocumentacionRevision checklist={checklist.data} presentados={datos.cambio.documentacionPresentada} /> : undefined}
      onTerminado={onTerminado}
    />
  )
}
