import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ROUTES } from '@/config/routes'
import { formatearFecha } from '@/config/expedientes'
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { mensajeDeError } from '@/services/api/errors'
import { useBorradoresSubdivision, useEliminarBorradorSubdivision } from '../hooks'
import type { BorradorSubdivision } from '../types'

/** Subdivisiones iniciadas en Catastro que todavía no se enviaron a Recaudación. */
export function SubdivisionesEnCurso() {
  const navigate = useNavigate()
  const borradores = useBorradoresSubdivision()
  const eliminar = useEliminarBorradorSubdivision()
  const [aDescartar, setADescartar] = useState<BorradorSubdivision | null>(null)

  function contenido() {
    if (borradores.isPending) return <LoadingState mensaje="Cargando subdivisiones en carga…" className="py-8" />
    if (borradores.isError) {
      return <ErrorState error={borradores.error} onRetry={() => void borradores.refetch()} reintentando={borradores.isFetching} className="py-8" />
    }
    if (borradores.data.length === 0) {
      return <EmptyState icon="task_alt" titulo="No hay subdivisiones en carga" descripcion="Las subdivisiones iniciadas y no enviadas aparecerán acá." className="py-8" />
    }
    return (
      <ul className="divide-y divide-slate-200 dark:divide-slate-700">
        {borradores.data.map((b) => {
          const conDatos = b.fracciones.filter((f) => f.carga).length
          // Si ya se empezaron a cargar los datos de las fracciones, se retoma ahí.
          const destino = conDatos ? ROUTES.tramites.subdivision.datos(b.id) : ROUTES.tramites.subdivision.fracciones(b.id)
          return (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 dark:text-white">
                  Expediente {b.numeroExpediente} · Concesión {b.numeroConcesion}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {b.madre.titular} · {b.fracciones.length} fracciones · {conDatos ? `Datos de ${conDatos} de ${b.fracciones.length} en carga` : 'Definiendo fracciones'} ·
                  Actualizado {formatearFecha(b.actualizado)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" iconLeft="delete" onClick={() => setADescartar(b)}>
                  Descartar
                </Button>
                <Button size="sm" iconRight="arrow_forward" onClick={() => navigate(destino)}>
                  Continuar
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <Card className="p-6 md:p-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Subdivisiones en carga</h2>
        {borradores.isFetching && !borradores.isPending && <span className="text-xs text-slate-400">Actualizando…</span>}
      </div>
      {eliminar.isError && <Alert className="mb-4">{mensajeDeError(eliminar.error)}</Alert>}
      {contenido()}

      <ConfirmDialog
        open={!!aDescartar}
        tone="danger"
        title="¿Descartar esta subdivisión?"
        message={`Se eliminará la carga del expediente ${aDescartar?.numeroExpediente ?? ''} con sus fracciones y datos.`}
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
