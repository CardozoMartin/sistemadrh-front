// Peticiones de expedientes (todos los trámites). Solo hablan con la API; el cacheo
// y los estados de carga los manejan los hooks de ./hooks.
import { api } from '@/services/api/client'
import { filtro } from '@/services/api/jsonServer'
import type { EstadoExpediente, Expediente, Oficina, PasoHistorial, RecepcionExpediente, TipoTramite } from '@/types/domain'
import type { PasoSiguiente } from './circuito'

export interface FiltrosExpedientes {
  oficinaId?: Oficina
  tramiteId?: TipoTramite
  /** Un estado o varios (ej: los pendientes). */
  estadoId?: EstadoExpediente | EstadoExpediente[]
  numero?: string
}

export type NuevoExpediente = Omit<Expediente, 'id'>

export interface RevisionInput {
  expediente: Expediente
  /**
   * Paso del circuito (ver circuito.ts). Con resultado 'aprobado' el expediente avanza
   * a `paso.destino` (o se finaliza); con 'observado' queda en la misma oficina.
   */
  paso: PasoSiguiente
  resultado: PasoHistorial['resultado']
  /** Usuario de la oficina que revisa (relación con /usuarios). */
  usuarioId: string
  observaciones?: string
  /** Datos propios de la revisión (deuda, informe, dictamen, resolución…). */
  detalle?: Record<string, unknown>
  /** Cambios extra sobre el expediente (ej: resolución, datos corregidos en el cierre). */
  cambios?: Partial<Omit<Expediente, 'id' | 'historial'>>
}

export interface TomarInput {
  expediente: Expediente
  etapaId: string
  usuarioId: string
}

export interface EmailSimulado {
  expedienteId: string
  destinatarios: string[]
  asunto: string
  cuerpo: string
}

export const expedientesApi = {
  async listar({ estadoId, ...resto }: FiltrosExpedientes = {}): Promise<Expediente[]> {
    const { data } = await api.get<Expediente[]>('/expedientes', {
      params: {
        ...filtro({ ...resto, estadoId: Array.isArray(estadoId) ? { in: estadoId } : estadoId }),
        _sort: '-fechaActualizacion',
      },
    })
    return data
  },

  async obtener(id: string): Promise<Expediente> {
    const { data } = await api.get<Expediente>(`/expedientes/${id}`)
    return data
  },

  async buscarPorNumero(numero: string): Promise<Expediente | null> {
    const { data } = await api.get<Expediente[]>('/expedientes', { params: filtro({ numero }) })
    return data[0] ?? null
  },

  async crear(expediente: NuevoExpediente): Promise<Expediente> {
    const { data } = await api.post<Expediente>('/expedientes', expediente)
    return data
  },

  /**
   * Registra la revisión de la oficina actual: si se aprueba, el expediente pasa a la
   * siguiente oficina (o se finaliza); si se observa, queda detenido en la oficina.
   * Futuro: POST /expedientes/:id/revisiones — el servidor valida circuito y usuario.
   */
  async registrarRevision({ expediente, paso, resultado = 'aprobado', usuarioId, observaciones, detalle, cambios }: RevisionInput): Promise<Expediente> {
    const ahora = new Date().toISOString()
    const aprobado = resultado === 'aprobado'
    const revision: PasoHistorial = {
      oficinaId: expediente.oficinaId,
      etapaId: paso.etapaId,
      resultado,
      fecha: ahora,
      usuarioId,
      ...(observaciones ? { observaciones } : {}),
      ...(detalle ? { detalle } : {}),
    }
    const { data } = await api.patch<Expediente>(`/expedientes/${expediente.id}`, {
      ...cambios,
      oficinaId: aprobado ? (paso.destino ?? expediente.oficinaId) : expediente.oficinaId,
      estadoId: !aprobado ? 'observado' : paso.accion === 'finalizar' ? 'finalizado' : 'en_tramite',
      fechaActualizacion: ahora,
      historial: [...expediente.historial, revision],
    })
    return data
  },

  /**
   * La oficina toma el expediente para trabajarlo: queda registrado quién y cuándo.
   * Futuro: POST /expedientes/:id/recepciones (el servidor fija la fecha).
   */
  async tomar({ expediente, etapaId, usuarioId }: TomarInput): Promise<Expediente> {
    const recepcion: RecepcionExpediente = { oficinaId: expediente.oficinaId, etapaId, usuarioId, fecha: new Date().toISOString() }
    const { data } = await api.patch<Expediente>(`/expedientes/${expediente.id}`, {
      recepciones: [...(expediente.recepciones ?? []), recepcion],
    })
    return data
  },

  /** Envío de email simulado: queda registrado en /emails (bandeja de salida de la demo). */
  async enviarEmail(email: EmailSimulado): Promise<void> {
    await api.post('/emails', { ...email, fecha: new Date().toISOString() })
  },
}
