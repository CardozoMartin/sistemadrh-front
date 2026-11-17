// Lo que cada trámite aporta a las pantallas compartidas del circuito (Recaudación,
// Distrito, Jurídico, Secretaría General). Las pantallas leen `expediente.datos` solo
// a través de esta configuración, así no dependen de la forma de cada trámite.
import { createContext, useContext, type ComponentType } from 'react'
import type { DominioContextValue } from '@/hooks/useDominio'
import type { Expediente } from '@/types/domain'
import type { TitularForm } from '../schemas/titular'

/** Persona vinculada al expediente: se le verifica deuda y recibe los avisos. */
export interface PersonaExpediente {
  /** Identificador estable dentro del expediente (ej: 'actual-0', 'nuevo-0'). */
  clave: string
  /** Rol en el trámite: "Titular", "Titular actual", "Nuevo titular"… */
  rol: string
  nombre: string
  /** Ej: "DNI 30123456" o "CUIT 30712345678". */
  documento: string
  correo: string
}

/** Fila del resumen del expediente. */
export interface DatoResumen {
  label: string
  valor: string
  /** Ocupa las dos columnas. */
  ancho?: boolean
}

export interface ConfigTramite {
  /** Personas del expediente (titular/es; en un cambio de titularidad, el actual y el nuevo). */
  personas: (expediente: Expediente) => PersonaExpediente[]
  /** Filas propias del trámite en el resumen (titular, documento, situación legal…). */
  datosResumen?: (expediente: Expediente, dominio: DominioContextValue) => DatoResumen[]
  /** Panel propio del trámite debajo del resumen (ej: mapa de la superficie actual y la propuesta). */
  Detalle?: ComponentType<{ expediente: Expediente }>
  /**
   * Trámites que crean varias concesiones nuevas (subdivisión): el nombre de cada una.
   * Secretaría General le pide a Catastro un número para cada una (en vez del número
   * único del expediente).
   */
  concesionesNuevas?: (expediente: Expediente) => string[]
  /** Cómo quedan guardados en el expediente esos números (en el orden de `concesionesNuevas`). */
  aplicarNumerosConcesion?: (expediente: Expediente, numeros: string[]) => Partial<Omit<Expediente, 'id' | 'historial'>>
}

/** Persona a partir de un titular cargado con `TitularFields`. */
export function personaDeTitular(t: TitularForm, clave: string, rol: string): PersonaExpediente {
  const tipo = t.tipoPersona === 'juridica' ? 'CUIT' : t.tipoDocumento.toUpperCase()
  return {
    clave,
    rol,
    nombre: t.tipoPersona === 'juridica' ? t.razonSocial : [t.apellido, t.nombre].filter(Boolean).join(', '),
    documento: t.documento ? `${tipo} ${t.documento}` : '—',
    correo: t.correo,
  }
}

/** Configuración mínima: solo el titular que figura en el expediente. */
export const CONFIG_TRAMITE_BASE: ConfigTramite = {
  personas: (e) => [{ clave: 'titular', rol: 'Titular', nombre: e.titular, documento: '—', correo: '' }],
}

export const ConfigTramiteContext = createContext<ConfigTramite>(CONFIG_TRAMITE_BASE)

/** Configuración del trámite del expediente que se está revisando. */
export const useConfigTramite = () => useContext(ConfigTramiteContext)
