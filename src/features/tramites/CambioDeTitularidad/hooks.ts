// Hooks de datos del Cambio de Titularidad (backend real): consultas (useQuery) y acciones
// (useMutation). Las pantallas usan solo estos hooks; nunca llaman a la API directamente.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { titularesADto } from '../AltaDeConcesion/adaptadores'
import type { NuevoTitularForm } from './schemas'
import { cambioTitularidadApi, type IniciarCambioDto } from './api'
import type { CambioBackend, DictamenDto } from './backend.types'
import { expedienteKeys } from '../shared/circuito/expediente'

export const cambioKeys = {
  all: ['backend', 'cambiosTitularidad'] as const,
  checklist: () => [...cambioKeys.all, 'checklist'] as const,
  enCurso: () => [...cambioKeys.all, 'en-curso'] as const,
  cambio: (id: string) => [...cambioKeys.all, 'cambio', id] as const,
}

// --- Consultas -----------------------------------------------------------------

/** El checklist casi no cambia: se pide una vez por sesión. */
export function useChecklistCambio() {
  return useQuery({ queryKey: cambioKeys.checklist(), queryFn: cambioTitularidadApi.checklist, staleTime: Infinity })
}

export function useCambiosEnCurso() {
  return useQuery({ queryKey: cambioKeys.enCurso(), queryFn: () => cambioTitularidadApi.listar() })
}

export function useCambio(id: string | undefined) {
  return useQuery({ queryKey: cambioKeys.cambio(id ?? ''), queryFn: () => cambioTitularidadApi.obtener(id!), enabled: !!id })
}

// --- Acciones --------------------------------------------------------------------

/** Después de cada acción: el cambio actualizado a la caché y la lista, a refrescar. */
function useAlActualizar() {
  const qc = useQueryClient()
  return (cambio: CambioBackend) => {
    qc.setQueryData(cambioKeys.cambio(cambio.expediente.id), cambio)
    void qc.invalidateQueries({ queryKey: cambioKeys.enCurso() })
  }
}

export function useIniciarCambio() {
  const qc = useQueryClient()
  const alActualizar = useAlActualizar()
  return useMutation({
    mutationFn: (dto: IniciarCambioDto) => cambioTitularidadApi.iniciar(dto),
    onSuccess: alActualizar,
    // Aun si falla (ej: se cortó la respuesta), la lista se refresca: puede haberse creado igual.
    onError: () => void qc.invalidateQueries({ queryKey: cambioKeys.enCurso() }),
  })
}

/** El formulario del nuevo titular → cuerpo del PUT (el mismo que el alta). */
const guardarPropuesta = (id: string, datos: NuevoTitularForm) => cambioTitularidadApi.guardarTitulares(id, titularesADto(datos.titulares, datos.domicilios))

export function useGuardarTitularesCambio(id: string) {
  const alActualizar = useAlActualizar()
  return useMutation({
    mutationFn: (datos: NuevoTitularForm) => guardarPropuesta(id, datos),
    onSuccess: alActualizar,
  })
}

/** Guarda la propuesta y la envía a Recaudación (dos pasos: el envío valida lo guardado). */
export function useEnviarCambio(id: string) {
  const alActualizar = useAlActualizar()
  return useMutation({
    mutationFn: async (datos: NuevoTitularForm) => {
      await guardarPropuesta(id, datos)
      return cambioTitularidadApi.enviar(id)
    },
    onSuccess: alActualizar,
  })
}

export function useCancelarCambio(id: string) {
  const alActualizar = useAlActualizar()
  return useMutation({ mutationFn: (motivo: string) => cambioTitularidadApi.cancelar(id, motivo), onSuccess: alActualizar })
}

// --- Circuito y Recaudación ------------------------------------------------------

/** Concesiones de los titulares (actuales y nuevos) y si tienen deuda. Cuelga del cambio: se refresca con cada acción. */
export function useAntecedentesDeudaCambio(id: string, habilitado = true) {
  return useQuery({ queryKey: [...cambioKeys.cambio(id), 'recaudacion'], queryFn: () => cambioTitularidadApi.antecedentesDeuda(id), enabled: habilitado })
}

/** Una acción del circuito: después se refrescan el cambio, sus antecedentes, el historial y las bandejas. */
function useAccionCambio<TInput, TOutput>(id: string, accion: (id: string, input: TInput) => Promise<TOutput>) {
  const qc = useQueryClient()
  return useMutation<TOutput, Error, TInput>({
    mutationFn: (input) => accion(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: cambioKeys.cambio(id) })
      void qc.invalidateQueries({ queryKey: cambioKeys.enCurso() })
      // Historial y bandejas de oficina (claves del alta: son comunes a todos los trámites).
      void qc.invalidateQueries({ queryKey: expedienteKeys.historial(id) })
      void qc.invalidateQueries({ queryKey: expedienteKeys.bandejas() })
    },
  })
}

export const useTomarCambio = (id: string) => useAccionCambio<void, unknown>(id, (i) => cambioTitularidadApi.tomar(i))
export const useVerificarDeudaCambio = (id: string) => useAccionCambio(id, cambioTitularidadApi.verificarDeuda)
export const useCursoConDeudaCambio = (id: string) => useAccionCambio(id, cambioTitularidadApi.cursoConDeuda)
export const useNotificarDeudaCambio = (id: string) => useAccionCambio(id, cambioTitularidadApi.notificarDeuda)
export const useDictaminarCambio = (id: string, oficina: 'distrito' | 'juridico') =>
  useAccionCambio(id, (i, dto: DictamenDto) => cambioTitularidadApi.dictaminar(i, oficina, dto))

/** Secretaría General: registra la resolución con su PDF y pasa a Catastro (verificación final). */
export const useResolucionCambio = (id: string) => useAccionCambio(id, cambioTitularidadApi.resolucion)

/** Catastro: verificación final (finaliza el cambio). */
export const useVerificacionFinalCambio = (id: string) => useAccionCambio(id, cambioTitularidadApi.verificacionFinal)

/** Borrador del aviso de deuda: se pide al abrirlo y no se cachea (las deudas pueden cambiar). */
export function useBorradorAvisoCambio(id: string, habilitado: boolean) {
  return useQuery({ queryKey: [...cambioKeys.cambio(id), 'aviso-deuda'], queryFn: () => cambioTitularidadApi.borradorAvisoDeuda(id), enabled: habilitado, staleTime: 0, gcTime: 0 })
}
