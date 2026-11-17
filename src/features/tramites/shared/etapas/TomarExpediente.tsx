import { useNavigate } from 'react-router'
import { Alert } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { RUTA_BANDEJA } from '@/config/routes'
import { etapaActual, ultimaAprobacion } from '@/features/expedientes/circuito'
import { CircuitoProgreso } from '@/features/expedientes/components/CircuitoProgreso'
import { EstadoBadge } from '@/features/expedientes/components/EstadoBadge'
import { useTomarExpediente, useUsuarioDeOficina } from '@/features/expedientes/hooks'
import { useDominio } from '@/hooks/useDominio'
import { haceCuanto } from '@/lib/fechas'
import { mensajeDeError } from '@/services/api/errors'
import type { Expediente } from '@/types/domain'
import { ResumenExpediente } from './ResumenExpediente'

/**
 * El expediente llegó a la oficina y nadie lo tomó todavía. Al tomarlo queda registrado
 * quién y cuándo (historial), y recién ahí se habilita la revisión.
 */
export function TomarExpediente({ expediente }: { expediente: Expediente }) {
  const navigate = useNavigate()
  const d = useDominio()
  const tomar = useTomarExpediente()
  const usuario = useUsuarioDeOficina(expediente.oficinaId)
  const etapa = etapaActual(expediente, d)
  const llegada = ultimaAprobacion(expediente)
  const oficina = d.nombreOficina(expediente.oficinaId)

  return (
    <>
      <PageHeader
        title={`Expediente ${expediente.numero}`}
        description={`${d.nombreTramite(expediente.tramiteId)} · ${expediente.titular}`}
        actions={<EstadoBadge estadoId={expediente.estadoId} />}
      />
      <div className="flex flex-col gap-6">
        <CircuitoProgreso expediente={expediente} />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <ResumenExpediente expediente={expediente} />
          <Card className="flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon name="move_to_inbox" className="text-3xl!" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">El expediente llegó a {oficina}</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {llegada && `Derivado por ${d.nombreOficina(llegada.oficinaId)} ${haceCuanto(llegada.fecha)}. `}
                Tómelo para comenzar «{etapa?.nombre ?? 'la revisión'}». Queda registrado en el historial del expediente
                {usuario && ` a nombre de ${usuario.nombre}`}.
              </p>
            </div>
            {tomar.isError && <Alert className="w-full text-left">{mensajeDeError(tomar.error)}</Alert>}
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="ghost" size="sm" iconLeft="arrow_back" onClick={() => navigate(RUTA_BANDEJA[expediente.oficinaId])}>
                Volver a la bandeja
              </Button>
              <Button
                size="sm"
                iconLeft="pan_tool"
                loading={tomar.isPending}
                disabled={!usuario || !etapa}
                onClick={() => usuario && etapa && tomar.mutate({ expediente, etapaId: etapa.id, usuarioId: usuario.id })}
              >
                Tomar expediente
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
