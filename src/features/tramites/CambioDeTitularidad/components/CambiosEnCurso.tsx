import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ROUTES } from '@/config/routes'
import { formatearFecha } from '@/config/expedientes'
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { mensajeDeError } from '@/services/api/errors'
import { useBorradoresCambio, useEliminarBorradorCambio } from '../hooks'
import type { BorradorCambioTitularidad } from '../types'

/** Cambios de titularidad iniciados en Catastro que todavía no se enviaron a Recaudación. */
export function CambiosEnCurso() {
  const navigate = useNavigate()
  const borradores = useBorradoresCambio()
  const eliminar = useEliminarBorradorCambio()
  const [aDescartar, setADescartar] = useState<BorradorCambioTitularidad | null>(null)

  function contenido() {
    if (borradores.isPending) return <LoadingState mensaje="Cargando cambios en carga…" className="py-8" />
    if (borradores.isError) {
      return <ErrorState error={borradores.error} onRetry={() => void borradores.refetch()} reintentando={borradores.isFetching} className="py-8" />
    }
    if (borradores.data.length === 0) {
      return <EmptyState icon="task_alt" titulo="No hay cambios en carga" descripcion="Los cambios iniciados y no enviados aparecerán acá." className="py-8" />
    }
    return (
      <ul className="divide-y divide-slate-200 dark:divide-slate-700">
        {borradores.data.map((b) => (
          <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 dark:text-white">
                Expediente {b.numeroExpediente} · Concesión {b.numeroConcesion}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Titular actual: {b.titularActual} · {b.datos ? 'Nuevo titular en carga' : 'Falta cargar el nuevo titular'} · Actualizado{' '}
                {formatearFecha(b.actualizado)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" iconLeft="delete" onClick={() => setADescartar(b)}>
                Descartar
              </Button>
              <Button size="sm" iconRight="arrow_forward" onClick={() => navigate(ROUTES.tramites.cambioTitularidad.datos(b.id))}>
                Continuar
              </Button>
            </div>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <Card className="p-6 md:p-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Cambios en carga</h2>
        {borradores.isFetching && !borradores.isPending && <span className="text-xs text-slate-400">Actualizando…</span>}
      </div>
      {eliminar.isError && <Alert className="mb-4">{mensajeDeError(eliminar.error)}</Alert>}
      {contenido()}

      <ConfirmDialog
        open={!!aDescartar}
        tone="danger"
        title="¿Descartar este cambio de titularidad?"
        message={`Se eliminará la carga del expediente ${aDescartar?.numeroExpediente ?? ''} y los datos ingresados.`}
        confirmLabel="Sí, descartar"
        cancelLabel="Volver"
        onCancel={() => setADescartar(null)}
        onConfirm={() => {
          if (aDescartar) eliminar.mutate(aDescartar.id)
          setADescartar(null)
        }}
      />
    </Card>
  )
}
