import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ROUTES } from '@/config/routes'
import { haceCuanto } from '@/lib/fechas'
import { cn } from '@/lib/cn'
import { backend } from '@/services/api/backend'
import { MODO_DEMO } from '@/services/demo/modo'
import { expedienteKeys } from '@/features/tramites/shared/circuito/expediente'
import type { ExpedienteEnBandeja } from '@/features/tramites/AltaDeConcesion/backend.types'
import type { OficinaPozo } from '../types'

const ESTADO: Record<string, { texto: string; color: string }> = {
  OBSERVADO: { texto: 'Observado', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  EN_ESPERA: { texto: 'En espera', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
}

/**
 * Registros de pozo que están en la oficina (circuito Pozos → Catastro → … → cierre).
 * PROTOTIPO: solo con el modo demo (el backend real todavía no tiene el circuito).
 */
export function BandejaRegistrosPozo({ oficina }: { oficina: OficinaPozo }) {
  const navigate = useNavigate()
  const bandeja = useQuery({
    queryKey: [...expedienteKeys.bandejas(), oficina],
    queryFn: async () => (await backend.get<ExpedienteEnBandeja[]>(`/expedientes/bandeja/${oficina}`)).data,
    refetchInterval: 30_000,
    enabled: MODO_DEMO,
  })
  if (!MODO_DEMO) return null
  const registros = bandeja.data?.filter((e) => (e.tipoTramite as string) === 'REGISTRO_POZO') ?? []

  function contenido() {
    if (bandeja.isPending) return <LoadingState mensaje="Cargando registros de pozo…" className="py-6" />
    if (bandeja.isError) return <ErrorState error={bandeja.error} onRetry={() => void bandeja.refetch()} className="py-6" />
    if (!registros.length) return <EmptyState icon="inbox" titulo="No hay registros de pozo en esta oficina" className="py-6" />
    return (
      <ul className="divide-y divide-slate-200 dark:divide-slate-700">
        {registros.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900 dark:text-white">
                Registro {e.numero}
                {ESTADO[e.estado] && <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', ESTADO[e.estado].color)}>{ESTADO[e.estado].texto}</span>}
                {!e.tomadoPor && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">Sin tomar</span>}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {e.titular ?? 'Sin causante'} · {e.etapaNombre}
                {e.enLaOficinaDesde && ` · llegó ${haceCuanto(e.enLaOficinaDesde)}`}
                {e.tomadoPor && ` · lo tiene ${e.tomadoPor}`}
              </p>
            </div>
            <Button size="sm" iconRight="arrow_forward" onClick={() => navigate(ROUTES.pozo.registroExpediente(e.id))}>
              {e.tomadoPor ? 'Abrir' : 'Revisar'}
            </Button>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <Card className="mb-6 p-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Registros de pozo</h2>
        <span className="text-xs text-slate-400">{bandeja.isFetching && !bandeja.isPending ? 'Actualizando…' : `${registros.length} en la oficina`}</span>
      </div>
      {contenido()}
    </Card>
  )
}
