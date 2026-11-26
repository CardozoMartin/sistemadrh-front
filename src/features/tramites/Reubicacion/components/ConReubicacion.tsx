import type { ReactNode } from 'react'
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { PageHeader } from '@/components/ui/PageHeader'
import { esNoEncontrado, toApiError } from '@/services/api/errors'
import type { ReubicacionBackend } from '../backend.types'
import { useReubicacion } from '../hooks'

interface Props {
  expedienteId: string | undefined
  /** Título de la página mientras carga o si falla. */
  titulo: string
  mensajeCarga: string
  tituloNoEncontrado: string
  /** Lo que se ofrece si no existe (ej: volver al inicio). */
  accionNoEncontrado?: ReactNode
  children: (datos: ReubicacionBackend) => ReactNode
}

/** Pide la reubicación y resuelve la carga, «no existe», «sin permiso» y los errores; con los datos, dibuja `children`. */
export function ConReubicacion({ expedienteId, titulo, mensajeCarga, tituloNoEncontrado, accionNoEncontrado, children }: Props) {
  const reubicacion = useReubicacion(expedienteId)

  if (reubicacion.isSuccess) return children(reubicacion.data)

  let contenido: ReactNode
  if (reubicacion.isPending) {
    contenido = <LoadingState mensaje={mensajeCarga} />
  } else if (esNoEncontrado(reubicacion.error)) {
    contenido = (
      <EmptyState icon="search_off" titulo={tituloNoEncontrado}>
        {accionNoEncontrado}
      </EmptyState>
    )
  } else if (toApiError(reubicacion.error).status === 403) {
    contenido = <EmptyState icon="lock" titulo="No puede ver este expediente" descripcion={toApiError(reubicacion.error).message} />
  } else {
    contenido = <ErrorState error={reubicacion.error} onRetry={() => void reubicacion.refetch()} reintentando={reubicacion.isFetching} />
  }

  return (
    <>
      <PageHeader title={titulo} />
      {contenido}
    </>
  )
}
