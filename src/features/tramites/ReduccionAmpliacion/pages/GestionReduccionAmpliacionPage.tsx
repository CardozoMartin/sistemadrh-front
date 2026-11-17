import { GestionExpediente } from '../../shared/etapas'
import { CONFIG_REDUCCION_AMPLIACION } from '../etapas/config'
import { EtapaCierreModificacion } from '../etapas/EtapaCierreModificacion'

/** Expediente de reducción / ampliación en la oficina donde está (Recaudación → … → cierre en Catastro). */
export default function GestionReduccionAmpliacionPage() {
  return (
    <GestionExpediente
      tramiteId="reduccion_ampliacion"
      titulo="Expediente de reducción / ampliación"
      config={CONFIG_REDUCCION_AMPLIACION}
      cierre={EtapaCierreModificacion}
    />
  )
}
