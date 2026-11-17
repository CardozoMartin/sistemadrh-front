import { GestionExpediente } from '../../shared/etapas'
import { CONFIG_CAMBIO } from '../etapas/config'
import { EtapaCierreCambio } from '../etapas/EtapaCierreCambio'

/** Expediente de cambio de titularidad en la oficina donde está (Recaudación → … → cierre en Catastro). */
export default function GestionCambioTitularidadPage() {
  return (
    <GestionExpediente
      tramiteId="cambio_titularidad"
      titulo="Expediente de cambio de titularidad"
      config={CONFIG_CAMBIO}
      cierre={EtapaCierreCambio}
    />
  )
}
