// Configuración de cada trámite para las vistas de consulta (búsqueda, historial de una
// concesión): qué personas y qué datos propios muestra cada uno. Sin pantallas: liviano.
import type { TipoTramite } from '@/types/domain'
import { CONFIG_ALTA } from './AltaDeConcesion/etapas/config'
import { CONFIG_ANULACION } from './Anulacion/etapas/config'
import { CONFIG_CAMBIO } from './CambioDeTitularidad/etapas/config'
import { CONFIG_REDUCCION_AMPLIACION } from './ReduccionAmpliacion/etapas/config'
import { CONFIG_TRAMITE_BASE, type ConfigTramite } from './shared/etapas/config'

const CONFIG_POR_TRAMITE: Partial<Record<TipoTramite, ConfigTramite>> = {
  alta_concesion: CONFIG_ALTA,
  cambio_titularidad: CONFIG_CAMBIO,
  anulacion: CONFIG_ANULACION,
  reduccion_ampliacion: CONFIG_REDUCCION_AMPLIACION,
}

export const configDeTramite = (tramiteId: TipoTramite): ConfigTramite => CONFIG_POR_TRAMITE[tramiteId] ?? CONFIG_TRAMITE_BASE
