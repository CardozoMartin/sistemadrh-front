// Única fuente de verdad para las URLs. No escribir paths a mano en los componentes.
import type { Oficina } from '@/types/domain'

export const ROUTES = {
  dashboard: '/',

  catastro: {
    root: '/catastro',
    bandeja: '/catastro/bandeja',
    tramites: '/catastro/tramites',
    pendientes: '/catastro/pendientes',
    /** Consulta de concesiones con filtros (backend real). */
    concesiones: '/catastro/concesiones',
    /** Verificar y publicar en Argenmap los polígonos de las concesiones con resolución. */
    publicacionMapa: '/catastro/publicacion-mapa',
    /** ABM del catálogo de suministro (zonas, fuentes, sistemas, desagües y árbol de canales). */
    suministro: '/catastro/suministro',
  },

  recaudacion: '/recaudacion',
  distrito: '/distrito',
  juridico: '/juridico',
  secretariaGeneral: '/secretaria-general',

  tramites: {
    altaConcesion: {
      inicio: '/tramites/alta-concesion',
      /** Carga y corrección de datos en Catastro (backend real; el id es el del expediente). */
      datos: (expedienteId: string) => `/tramites/alta-concesion/${expedienteId}/datos`,
      /** El expediente en el circuito de oficinas (backend real): tomar, actuar, historial. */
      circuito: (expedienteId: string) => `/tramites/alta-concesion/circuito/${expedienteId}`,
      /** Corrección de errores materiales (datos mal escritos, KML mal cargado), con permiso y motivo. */
      correccion: (expedienteId: string) => `/tramites/alta-concesion/${expedienteId}/correccion`,
      /** Altas viejas de json-server (datos de demo anteriores al backend real). */
      gestion: (expedienteId: string) => `/tramites/alta-concesion/expediente/${expedienteId}`,
    },
    cambioTitularidad: {
      /** Búsqueda de la concesión; al elegirla se asigna el expediente. */
      inicio: '/tramites/cambio-titularidad',
      datos: (expedienteId: string) => `/tramites/cambio-titularidad/${expedienteId}/datos`,
      gestion: (expedienteId: string) => `/tramites/cambio-titularidad/expediente/${expedienteId}`,
      /** El expediente en el circuito de oficinas (backend real). */
      circuito: (expedienteId: string) => `/tramites/cambio-titularidad/circuito/${expedienteId}`,
    },
    anulacion: {
      /** Búsqueda de la concesión; al elegirla se asigna el expediente. */
      inicio: '/tramites/anulacion',
      /** Verificación de datos e «Iniciar anulación» (backend real). */
      verificacion: (expedienteId: string) => `/tramites/anulacion/${expedienteId}/verificacion`,
      gestion: (expedienteId: string) => `/tramites/anulacion/expediente/${expedienteId}`,
    },
    reduccionAmpliacion: {
      /** Búsqueda de la concesión; al elegirla se asigna el expediente. */
      inicio: '/tramites/reduccion-ampliacion',
      superficie: (concesionId: string, numeroExpediente: string) =>
        `/tramites/reduccion-ampliacion/superficie?${new URLSearchParams({ concesion: concesionId, expediente: numeroExpediente })}`,
      gestion: (expedienteId: string) => `/tramites/reduccion-ampliacion/expediente/${expedienteId}`,
    },
    subdivision: {
      /** Búsqueda de la concesión; al elegirla se asigna el expediente. */
      inicio: '/tramites/subdivision',
      /** Editor de fracciones sobre el polígono de la concesión madre. */
      fracciones: (borradorId: string) => `/tramites/subdivision/${borradorId}/fracciones`,
      /** Datos de cada nueva concesión (los mismos del Alta). */
      datos: (borradorId: string) => `/tramites/subdivision/${borradorId}/datos`,
      gestion: (expedienteId: string) => `/tramites/subdivision/expediente/${expedienteId}`,
    },
    reubicacion: '/tramites/reubicacion',
    permisos: '/tramites/permisos',
  },

  pozo: {
    root: '/pozo',
    autorizacion: '/pozo/autorizacion',
    registro: '/pozo/registro',
    /** Registro de pozo en el circuito (Pozos → Catastro → … → cierre). */
    registroExpediente: (expedienteId: string) => `/pozo/registro/${expedienteId}`,
    /** Padrón de empresas perforadoras. */
    empresas: '/pozo/empresas',
    empresaNueva: '/pozo/empresas/nueva',
    /** Ficha de la empresa: datos (modificación), máquinas e historial. */
    empresa: (empresaId: string) => `/pozo/empresas/${empresaId}`,
    /** Revisión de la oficina donde está la empresa (Jurídico o Secretaría General). */
    empresaRevision: (empresaId: string) => `/pozo/empresas/${empresaId}/revision`,
    autorizaciones: '/pozo/autorizaciones',
    /** Padrón de pozos por origen (de oficio, con autorización, padrón anterior). */
    registrados: '/pozo/registrados',
    /** Historial de monitoreos hidráulicos y químicos de un pozo. */
    monitoreos: (pozoId: string) => `/pozo/registrados/${pozoId}/monitoreos`,
    consulta: '/pozo/consulta',
    /** Baja de pozo (backend real): bajas en trámite, inicio y el expediente en el circuito. */
    /** Buscador de pozos: el punto de entrada de la baja. */
    bajas: '/pozo/bajas',
    /** Bajas en trámite (y las terminadas). */
    bajasEnTramite: '/pozo/bajas/tramites',
    /** Vista del pozo: se elige la baja (a solicitud o de oficio) y se carga el expediente. */
    bajaPozo: (pozoId: string) => `/pozo/bajas/pozo/${pozoId}`,
    baja: (expedienteId: string) => `/pozo/bajas/${expedienteId}`,
  },

  /** Búsqueda general: expedientes de todos los trámites, para todas las oficinas. */
  busqueda: '/busqueda',
  /** Historial completo de una concesión (titulares y trámites a lo largo del tiempo). */
  concesion: (concesionId: string) => `/busqueda/concesion/${concesionId}`,
  /** Consulta de un expediente (solo lectura, con su historial). */
  expediente: (expedienteId: string) => `/busqueda/expediente/${expedienteId}`,
  /** Consulta desde la búsqueda (backend real): datos, auditoría e historial, sin el panel de la oficina. */
  consulta: {
    alta: (expedienteId: string) => `/busqueda/alta/${expedienteId}`,
    bajaPozo: (expedienteId: string) => `/busqueda/baja-pozo/${expedienteId}`,
  },
  visor: '/visor',
  /** El visor con la ficha de una concesión abierta (y el mapa centrado en ella). */
  visorConcesion: (concesionId: string) => `/visor?concesion=${concesionId}`,
  configuracion: '/configuracion',

  /** Informática: administración del acceso (solo administradores). */
  informatica: {
    root: '/informatica',
    usuarios: '/informatica/usuarios',
    permisos: '/informatica/permisos',
  },

  login: '/login',
  cambiarClave: '/cambiar-clave',
} as const

/** Bandeja de expedientes de cada oficina (la usan notificaciones y sidebar). */
export const RUTA_BANDEJA: Record<Oficina, string> = {
  catastro: ROUTES.catastro.bandeja,
  recaudacion: ROUTES.recaudacion,
  distrito: ROUTES.distrito,
  juridico: ROUTES.juridico,
  secretaria_general: ROUTES.secretariaGeneral,
}
