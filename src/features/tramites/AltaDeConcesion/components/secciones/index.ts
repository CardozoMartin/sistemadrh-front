import type { ComponentType } from 'react'
import { SECCIONES_PRECARGA, type InfoSeccion } from './config'
import { SeccionCatastral } from './SeccionCatastral'
import { SeccionRegistral } from './SeccionRegistral'
import { SeccionSuministro } from './SeccionSuministro'
import { TitularesDomiciliosFields } from '../../../shared'
import { SeccionUbicacion } from './SeccionUbicacion'
import { SeccionUsos } from './SeccionUsos'

export { SECCIONES_PRECARGA, seccionDeCampo } from './config'

const COMPONENTES: Record<InfoSeccion['key'], ComponentType> = {
  titular: TitularesDomiciliosFields,
  ubicacion: SeccionUbicacion,
  catastral: SeccionCatastral,
  registral: SeccionRegistral,
  usos: SeccionUsos,
  suministro: SeccionSuministro,
}

/** Secciones con su componente, para la pantalla de pre carga. */
export const SECCIONES_CON_COMPONENTE = SECCIONES_PRECARGA.map((s) => ({ ...s, Component: COMPONENTES[s.key] }))
