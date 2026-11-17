import { useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Select } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import type { FiltrosExpedientes } from '@/features/expedientes/api'
import { TablaExpedientes } from '@/features/expedientes/components/TablaExpedientes'
import { useExpedientes } from '@/features/expedientes/hooks'
import { useDominio } from '@/hooks/useDominio'

const aOpciones = (xs: { id: string; nombre: string }[]) => xs.map((x) => ({ value: x.id, label: x.nombre }))

export default function PendientesPage() {
  const { oficinas, tramites, estados } = useDominio()
  const [filtros, setFiltros] = useState<FiltrosExpedientes>({})
  const expedientes = useExpedientes(filtros)

  function filtrar<K extends keyof FiltrosExpedientes>(campo: K, valor: string) {
    setFiltros((f) => ({ ...f, [campo]: (valor || undefined) as FiltrosExpedientes[K] }))
  }

  const hayFiltros = Object.values(filtros).some(Boolean)

  function contenido() {
    if (expedientes.isPending) return <LoadingState mensaje="Cargando expedientes…" />
    if (expedientes.isError) {
      return <ErrorState error={expedientes.error} onRetry={() => void expedientes.refetch()} reintentando={expedientes.isFetching} className="m-6" />
    }
    if (expedientes.data.length === 0) {
      return (
        <EmptyState
          icon="folder_off"
          titulo={hayFiltros ? 'No hay expedientes con esos filtros' : 'Todavía no hay expedientes'}
          descripcion={hayFiltros ? 'Pruebe cambiando o limpiando los filtros.' : 'Los trámites enviados desde Catastro aparecerán acá.'}
          className="m-6"
        />
      )
    }
    // Mientras llegan resultados de otros filtros se atenúa la lista anterior.
    return <TablaExpedientes expedientes={expedientes.data} atenuada={expedientes.isPlaceholderData} />
  }

  return (
    <>
      <PageHeader
        title="Seguimiento de expedientes"
        description="Todos los expedientes del circuito, en cualquier oficina. Filtre por oficina, trámite o estado."
      />

      <Card>
        <div className="flex flex-wrap items-end gap-4 border-b border-slate-200 p-4 md:p-6 dark:border-slate-700">
          <label className="flex min-w-48 flex-1 flex-col gap-1.5 text-sm font-medium">
            Oficina actual
            <Select options={aOpciones(oficinas)} placeholder="Todas" value={filtros.oficinaId ?? ''} onChange={(e) => filtrar('oficinaId', e.target.value)} />
          </label>
          <label className="flex min-w-48 flex-1 flex-col gap-1.5 text-sm font-medium">
            Trámite
            <Select options={aOpciones(tramites)} placeholder="Todos" value={filtros.tramiteId ?? ''} onChange={(e) => filtrar('tramiteId', e.target.value)} />
          </label>
          <label className="flex min-w-48 flex-1 flex-col gap-1.5 text-sm font-medium">
            Estado
            <Select
              options={aOpciones(estados)}
              placeholder="Todos"
              value={typeof filtros.estadoId === 'string' ? filtros.estadoId : ''}
              onChange={(e) => filtrar('estadoId', e.target.value)}
            />
          </label>
          <div className="flex items-center gap-3 pb-1.5">
            {expedientes.isFetching && !expedientes.isPending && <Spinner className="size-4 text-primary" />}
            <Button size="sm" variant="ghost" iconLeft="filter_alt_off" disabled={!hayFiltros} onClick={() => setFiltros({})}>
              Limpiar
            </Button>
          </div>
        </div>

        {contenido()}

        {expedientes.data && expedientes.data.length > 0 && (
          <p className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500 md:px-6 dark:border-slate-700 dark:text-slate-400">
            {expedientes.data.length} expediente{expedientes.data.length === 1 ? '' : 's'}
          </p>
        )}
      </Card>
    </>
  )
}
