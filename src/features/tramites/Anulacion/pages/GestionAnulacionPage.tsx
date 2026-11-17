import { GestionExpediente } from '../../shared/etapas'
import { CONFIG_ANULACION } from '../etapas/config'
import { EtapaCierreAnulacion } from '../etapas/EtapaCierreAnulacion'

/** Expediente de anulación en la oficina donde está (Recaudación → … → baja en Catastro). */
export default function GestionAnulacionPage() {
  return <GestionExpediente tramiteId="anulacion" titulo="Expediente de anulación" config={CONFIG_ANULACION} cierre={EtapaCierreAnulacion} />
}
