import { useNavigate } from 'react-router'
import { ROUTES } from '@/config/routes'
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { haceCuanto } from '@/lib/fechas'
import { cn } from '@/lib/cn'
import { bajaSinTerminar, ESTADO_BAJA, NOMBRE_ORIGEN } from '../estilos'
import { useBajasPozo } from '../hooks'
import type { OficinaBaja } from '../types'

interface Props {
  /** Solo las que están en esa oficina (bandeja). Sin oficina: todas. */
  oficina?: OficinaBaja
  /** Incluir las terminadas (confirmadas y rechazadas). */
  todas?: boolean
}

/** Bajas de pozo del backend real: en qué oficina están, quién las tiene y cómo abrirlas. */
export function ListaBajas({ oficina, todas = false }: Props) {
  const navigate = useNavigate()
  const lista = useBajasPozo(todas)
  const bajas = (lista.data ?? []).filter((b) => !oficina || (b.oficina === oficina && bajaSinTerminar(b.estado)))

  if (lista.isPending) return <LoadingState mensaje="Cargando bajas…" className="py-6" />
  if (lista.isError) return <ErrorState error={lista.error} onRetry={() => void lista.refetch()} reintentando={lista.isFetching} className="py-6" />
  if (!bajas.length) return <EmptyState icon="inbox" titulo={oficina ? 'No hay bajas de pozo en esta oficina' : 'No hay bajas de pozo'} className="py-6" />

  return (
    <ul className="divide-y divide-slate-200 dark:divide-slate-700">
      {bajas.map((b) => {
        const abierta = bajaSinTerminar(b.estado)
        return (
          <li key={b.expedienteId ?? `oficio-${b.pozo.id}-${b.iniciada}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900 dark:text-white">
                Pozo {b.pozo.idInterno}
                {b.pozo.alias && <span className="font-normal text-slate-500">· {b.pozo.alias}</span>}
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', ESTADO_BAJA[b.estado].color)}>{ESTADO_BAJA[b.estado].texto}</span>
                {abierta && !b.tomadoPor && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">Sin tomar</span>}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {b.expediente ? `Exp. ${b.expediente} · ` : ''}
                {NOMBRE_ORIGEN[b.origen]}
                {b.origen === 'A_SOLICITUD' && b.solicitante && ` (${b.solicitante})`}
                {abierta && ` · en ${b.oficinaNombre}: ${b.etapaNombre}`}
                {b.tomadoPor && abierta && ` · lo tiene ${b.tomadoPor}`}
                {b.origen === 'DE_OFICIO' ? ` · dado de baja ${haceCuanto(b.iniciada)}` : ` · iniciada ${haceCuanto(b.iniciada)}`}
              </p>
            </div>
            <Button
              size="sm"
              variant={abierta ? 'primary' : 'secondary'}
              iconRight="arrow_forward"
              // Las de oficio no tienen expediente: se abre la vista del pozo.
              onClick={() => navigate(b.expedienteId ? ROUTES.pozo.baja(b.expedienteId) : ROUTES.pozo.bajaPozo(b.pozo.id))}
            >
              {abierta ? (b.tomadoPor ? 'Abrir' : 'Revisar') : 'Ver'}
            </Button>
          </li>
        )
      })}
    </ul>
  )
}
