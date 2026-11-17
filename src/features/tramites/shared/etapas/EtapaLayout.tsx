import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { RUTA_BANDEJA } from '@/config/routes'
import { CircuitoProgreso } from '@/features/expedientes/components/CircuitoProgreso'
import { EstadoBadge } from '@/features/expedientes/components/EstadoBadge'
import { useDominio } from '@/hooks/useDominio'
import type { Expediente } from '@/types/domain'
import { useConfigTramite } from './config'
import { ResumenExpediente } from './ResumenExpediente'

interface EtapaLayoutProps {
  expediente: Expediente
  titulo: string
  icono: string
  descripcion: string
  /** Formulario de la oficina. */
  children: ReactNode
  /** Botón principal (enviar / guardar). */
  accion: ReactNode
  /** Pantalla ancha sin la columna de resumen (ej: finalización con pestañas). */
  ancho?: boolean
}

/** Estructura común de las pantallas de cada oficina en el circuito (todos los trámites). */
export function EtapaLayout({ expediente, titulo, icono, descripcion, children, accion, ancho }: EtapaLayoutProps) {
  const navigate = useNavigate()
  const d = useDominio()
  const { Detalle } = useConfigTramite()

  return (
    <>
      <PageHeader
        title={titulo}
        description={`Expediente ${expediente.numero} · ${d.nombreTramite(expediente.tramiteId)} · ${expediente.titular}`}
        actions={<EstadoBadge estadoId={expediente.estadoId} />}
      />

      <div className="flex flex-col gap-6">
        <CircuitoProgreso expediente={expediente} />

        <div className={ancho ? 'flex flex-col gap-6' : 'grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]'}>
          {!ancho && (
            <div className="flex flex-col gap-6">
              <ResumenExpediente expediente={expediente} />
              {Detalle && <Detalle expediente={expediente} />}
            </div>
          )}

          <Card>
            <div className="flex items-start gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon name={icono} />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white">{titulo}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{descripcion}</p>
              </div>
            </div>
            <div className="p-6">{children}</div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-800/40">
              <Button variant="ghost" size="sm" iconLeft="arrow_back" onClick={() => navigate(RUTA_BANDEJA[expediente.oficinaId])}>
                Volver a la bandeja
              </Button>
              {accion}
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
