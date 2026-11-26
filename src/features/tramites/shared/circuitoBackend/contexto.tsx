// El trámite en el que trabajan los paneles de las oficinas (Recaudación, Distrito, Jurídico,
// Secretaría): su API, sus claves de caché y cómo se nombra en los mensajes. Cada trámite envuelve
// su página del circuito con <CircuitoProvider> y los paneles comunes usan estos hooks.
import { createContext, useContext, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { altaKeys } from '../../AltaDeConcesion/hooks'
import type { ApiCircuito } from './api'
import type { DictamenDto, NotificarDeudaDto, ResolucionDto, VerificacionDeudaDto, VerificacionFinalDto } from './tipos'

export interface Circuito {
  api: ApiCircuito
  /** Clave del detalle del trámite (se refresca después de cada acción). */
  claveDetalle: (expedienteId: string) => QueryKey
  /** Clave de la lista de trámites en curso. */
  claveLista: QueryKey
  /** Tipo de trámite para el checklist (GET /catalogos/documentos/:tipo). */
  tipoTramite: string
  textos: {
    /** «la ampliación / reducción» */
    tramite: string
    /** Qué pasa si se rechaza: «la concesión sigue igual». */
    alRechazar: string
    /** Quiénes son las personas a las que Recaudación revisa: «titular actual» / «nuevo titular». */
    rolActual: string
    rolNuevo: string
  }
}

const Contexto = createContext<Circuito | null>(null)

export function CircuitoProvider({ circuito, children }: { circuito: Circuito; children: ReactNode }) {
  return <Contexto.Provider value={circuito}>{children}</Contexto.Provider>
}

export function useCircuito(): Circuito {
  const c = useContext(Contexto)
  if (!c) throw new Error('Falta <CircuitoProvider> alrededor de los paneles del circuito.')
  return c
}

/** Una acción del circuito: después se refrescan el trámite, su lista, el historial y las bandejas. */
function useAccion<TInput, TOutput>(expedienteId: string, accion: (api: ApiCircuito, input: TInput) => Promise<TOutput>) {
  const qc = useQueryClient()
  const circuito = useCircuito()
  return useMutation<TOutput, Error, TInput>({
    mutationFn: (input) => accion(circuito.api, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: circuito.claveDetalle(expedienteId) })
      void qc.invalidateQueries({ queryKey: circuito.claveLista })
      // Historial y bandejas de oficina (claves del alta: son comunes a todos los trámites).
      void qc.invalidateQueries({ queryKey: altaKeys.historial(expedienteId) })
      void qc.invalidateQueries({ queryKey: altaKeys.bandejas() })
    },
  })
}

export const useTomar = (id: string) => useAccion<void, unknown>(id, (api) => api.tomar(id))
export const useVerificarDeuda = (id: string) => useAccion(id, (api, dto: VerificacionDeudaDto) => api.verificarDeuda(id, dto))
export const useNotificarDeuda = (id: string) => useAccion(id, (api, dto: NotificarDeudaDto) => api.notificarDeuda(id, dto))
export const useDictaminar = (id: string, oficina: 'distrito' | 'juridico') => useAccion(id, (api, dto: DictamenDto) => api.dictaminar(id, oficina, dto))
export const useRegistrarResolucion = (id: string) => useAccion(id, (api, dto: ResolucionDto) => api.resolucion(id, dto))
export const useVerificacionFinal = (id: string) => useAccion(id, (api, dto: VerificacionFinalDto) => api.verificacionFinal(id, dto))
export const useReenviar = (id: string) => useAccion(id, (api, observaciones: string | undefined) => api.reenviar(id, observaciones))

/** Concesiones de los titulares y si tienen deuda. Cuelga del trámite: se refresca con cada acción. */
export function useAntecedentesDeuda(id: string) {
  const { api, claveDetalle } = useCircuito()
  return useQuery({ queryKey: [...claveDetalle(id), 'recaudacion'], queryFn: () => api.antecedentesDeuda(id) })
}

/** Borrador del aviso de deuda: se pide al abrirlo y no se cachea (las deudas pueden cambiar). */
export function useBorradorAviso(id: string, habilitado: boolean) {
  const { api, claveDetalle } = useCircuito()
  return useQuery({ queryKey: [...claveDetalle(id), 'aviso-deuda'], queryFn: () => api.borradorAvisoDeuda(id), enabled: habilitado, staleTime: 0, gcTime: 0 })
}
