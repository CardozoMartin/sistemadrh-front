import { GestionExpediente } from '../../shared/etapas'
import { CONFIG_ALTA } from '../etapas/config'
import { EtapaFinalizacion } from '../etapas/EtapaFinalizacion'

/** Expediente de alta en la oficina donde está (Recaudación → … → cierre en Catastro). */
export default function GestionExpedientePage() {
  return (
    <GestionExpediente
      tramiteId="alta_concesion"
      titulo="Expediente de alta de concesión"
      config={CONFIG_ALTA}
      cierre={EtapaFinalizacion}
    />
  )
}
