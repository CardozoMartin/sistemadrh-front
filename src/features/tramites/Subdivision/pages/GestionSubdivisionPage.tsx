import { GestionExpediente } from '../../shared/etapas'
import { CONFIG_SUBDIVISION } from '../etapas/config'
import { EtapaCierreSubdivision } from '../etapas/EtapaCierreSubdivision'

/** Expediente de subdivisión en la oficina donde está (Recaudación → … → cierre en Catastro). */
export default function GestionSubdivisionPage() {
  return <GestionExpediente tramiteId="subdivision" titulo="Expediente de subdivisión" config={CONFIG_SUBDIVISION} cierre={EtapaCierreSubdivision} />
}
