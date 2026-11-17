import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { ROUTES } from '@/config/routes'
import { esNoEncontrado } from '@/services/api/errors'
import { useBorradorSubdivision } from '../hooks'
import type { BorradorSubdivision } from '../types'

/** Carga la subdivisión en carga (`:borradorId`) y muestra los estados de carga / error / no encontrada. */
export function ConBorrador({ titulo, children }: { titulo: string; children: (borrador: BorradorSubdivision) => ReactNode }) {
  const navigate = useNavigate()
  const { borradorId } = useParams()
  const borrador = useBorradorSubdivision(borradorId)

  if (borrador.isPending) {
    return (
      <>
        <PageHeader title={titulo} />
        <LoadingState mensaje="Cargando la subdivisión…" />
      </>
    )
  }

  if (borrador.isError) {
    return (
      <>
        <PageHeader title={titulo} />
        {esNoEncontrado(borrador.error) ? (
          <EmptyState icon="search_off" titulo="No se encontró la subdivisión" descripcion="Puede que ya se haya enviado a la siguiente oficina o que haya sido descartada.">
            <Button size="sm" onClick={() => navigate(ROUTES.tramites.subdivision.inicio)}>
              Ir al inicio de la subdivisión
            </Button>
          </EmptyState>
        ) : (
          <ErrorState error={borrador.error} onRetry={() => void borrador.refetch()} reintentando={borrador.isFetching} />
        )}
      </>
    )
  }

  return children(borrador.data)
}
