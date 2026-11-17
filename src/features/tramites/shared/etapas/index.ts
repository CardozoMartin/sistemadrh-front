// Pantallas del circuito de oficinas compartidas por todos los trámites.
// Cada trámite arma su página de gestión con <GestionExpediente> y aporta su cierre.
export { GestionExpediente, PANTALLAS_CIRCUITO, type PantallaEtapa } from './GestionExpediente'
export { EtapaLayout } from './EtapaLayout'
export { ChecksCircuito } from './ChecksCircuito'
export { useAccionEtapa, type ConfiguracionAccion } from './useAccionEtapa'
export { personaDeTitular, useConfigTramite, type ConfigTramite, type DatoResumen, type PersonaExpediente } from './config'
