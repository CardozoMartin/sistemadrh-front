// Pedidos de número de concesión en el BACKEND REAL (GET/POST /api/solicitudes-numero).
// Secretaría General lo pide desde el expediente; Catastro lo toma de su libro de concesiones
// («Petete») y lo carga. El backend no publica eventos en vivo: la lista se consulta cada
// 30 segundos, y con eso se avisa a Catastro de los pedidos nuevos (AvisoPedidosNumero).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { backend } from '@/services/api/backend'
import { altaKeys } from '@/features/tramites/AltaDeConcesion/hooks'

export interface PedidoNumero {
  id: string
  expediente: { id: string; numero: string; tipoTramite: string; titular: string | null }
  estado: 'PENDIENTE' | 'ASIGNADA'
  /** Varios números a la vez (ej: una subdivisión, uno por fracción). Vacío: uno solo. */
  etiquetas: string[]
  numeros: string[]
  /** Quién de Secretaría General lo pidió («Apellido, Nombre»). */
  solicitadoPor: string
  solicitadoEn: string
  asignadoPor: string | null
  asignadoEn: string | null
}

/** Cada cuánto se buscan pedidos nuevos (el backend todavía no avisa en vivo). */
export const INTERVALO_PEDIDOS_MS = 30_000

const datos = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data)

export const pedidosNumeroApi = {
  pendientes: () => datos(backend.get<PedidoNumero[]>('/solicitudes-numero', { params: { estado: 'PENDIENTE' } })),
  ultimoNumero: () => datos(backend.get<{ ultimoNumero: string | null }>('/solicitudes-numero/ultimo-numero')),
  asignar: (id: string, numeros: string[]) => datos(backend.post<PedidoNumero>(`/solicitudes-numero/${id}/asignar`, { numeros })),
}

export const pedidoKeys = {
  all: ['backend', 'pedidos-numero'] as const,
  pendientes: () => [...pedidoKeys.all, 'pendientes'] as const,
  ultimo: () => [...pedidoKeys.all, 'ultimo'] as const,
}

/** Pedidos pendientes. Lo usan el aviso (en toda la app) y el panel de la bandeja: es una sola consulta. */
export function usePedidosNumeroPendientes(habilitado = true) {
  return useQuery({
    queryKey: pedidoKeys.pendientes(),
    queryFn: pedidosNumeroApi.pendientes,
    enabled: habilitado,
    refetchInterval: INTERVALO_PEDIDOS_MS,
    refetchOnWindowFocus: true,
  })
}

export function useUltimoNumeroConcesion() {
  return useQuery({ queryKey: pedidoKeys.ultimo(), queryFn: pedidosNumeroApi.ultimoNumero })
}

/** Catastro carga el número: se refrescan los pedidos, el último número y el alta (ya tiene número). */
export function useAsignarNumero() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ pedido, numeros }: { pedido: PedidoNumero; numeros: string[] }) => pedidosNumeroApi.asignar(pedido.id, numeros),
    onSuccess: (_, { pedido }) => {
      void qc.invalidateQueries({ queryKey: pedidoKeys.all })
      void qc.invalidateQueries({ queryKey: altaKeys.alta(pedido.expediente.id) })
    },
  })
}
