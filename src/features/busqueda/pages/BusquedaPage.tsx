import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Input, Select } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { CLASE_COLOR_ESTADO, formatearFecha } from '@/config/expedientes'
import { useDominio } from '@/hooks/useDominio'
import { cn } from '@/lib/cn'
import type { ColorEstado } from '@/types/domain'
import { POR_PAGINA, rutaVerExpediente, useBuscarExpedientes, type ExpedienteEncontrado, type FiltrosExpedientes } from '../api'

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
      {label}
      {children}
    </label>
  )
}

/** Espera a que se deje de escribir para no consultar con cada tecla. */
function useDemorado<T>(valor: T, ms = 350): T {
  const [demorado, setDemorado] = useState(valor)
  useEffect(() => {
    const t = setTimeout(() => setDemorado(valor), ms)
    return () => clearTimeout(t)
  }, [valor, ms])
  return demorado
}

function EtiquetaEstado({ e }: { e: ExpedienteEncontrado }) {
  const clase = CLASE_COLOR_ESTADO[e.estadoColor as ColorEstado] ?? CLASE_COLOR_ESTADO.gris
  return <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', clase)}>{e.estadoNombre}</span>
}

/**
 * Búsqueda general (backend real): expedientes de cualquier trámite, en curso o terminados, con
 * la oficina de la que vino y la que lo tiene. Para todas las oficinas. Sin filtros muestra los más recientes.
 */
export default function BusquedaPage() {
  const navigate = useNavigate()
  const d = useDominio()
  const [f, setF] = useState<FiltrosExpedientes>({})
  const [pagina, setPagina] = useState(1)
  const texto = useDemorado(f.texto)
  const busqueda = useBuscarExpedientes({ ...f, texto, pagina })

  const editar = (campo: keyof FiltrosExpedientes, valor: string) => {
    setF((x) => ({ ...x, [campo]: valor || undefined }))
    setPagina(1)
  }
  const conFiltros = Object.values(f).some(Boolean)

  // Las opciones salen del dominio (catálogos de la base); al backend va el código de la base.
  const opcionesTramite = d.tramites.filter((t) => t.codigo).map((t) => ({ value: t.codigo!, label: t.nombre }))
  const opcionesEstado = [{ value: 'PENDIENTES', label: 'Pendientes (siguen circulando)' }, ...d.estados.filter((e) => e.codigo).map((e) => ({ value: e.codigo!, label: e.nombre }))]
  const opcionesOficina = d.oficinas.map((o) => ({ value: o.id, label: o.nombre }))

  const datos = busqueda.data
  const paginas = datos ? Math.max(1, Math.ceil(datos.total / POR_PAGINA)) : 1

  function resultados() {
    if (busqueda.isPending) return <LoadingState mensaje="Buscando…" className="py-10" />
    if (busqueda.isError) return <ErrorState error={busqueda.error} onRetry={() => void busqueda.refetch()} reintentando={busqueda.isFetching} className="m-6" />
    if (!datos?.expedientes.length) {
      return (
        <EmptyState
          icon="search_off"
          titulo={conFiltros ? 'No hay resultados' : 'Todavía no hay expedientes'}
          descripcion={conFiltros ? 'Pruebe con otros datos o limpie los filtros.' : 'Los expedientes aparecen acá desde que se inicia el trámite.'}
          className="m-6"
        />
      )
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-250 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Expediente</th>
              <th className="px-4 py-3">Titular</th>
              <th className="px-4 py-3">Trámite</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Oficina anterior</th>
              <th className="px-4 py-3">Oficina actual</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {datos.expedientes.map((e) => {
              const ruta = rutaVerExpediente(e)
              return (
                <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums" title="Fecha de ingreso del expediente">
                    {formatearFecha(e.fechaIngreso)}
                  </td>
                  <td className="px-4 py-3 font-semibold whitespace-nowrap tabular-nums">{e.numero}</td>
                  <td className="px-4 py-3">
                    {e.titular ?? <span className="text-slate-400">—</span>}
                    {e.documento && <span className="block text-xs text-slate-500 dark:text-slate-400">{e.documento}</span>}
                  </td>
                  <td className="px-4 py-3">{e.tramiteNombre}</td>
                  <td className="px-4 py-3">
                    <EtiquetaEstado e={e} />
                    <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{e.etapaNombre}</span>
                  </td>
                  <td className="px-4 py-3">{e.oficinaAnteriorNombre ?? <span className="text-slate-400" title="No salió todavía de la oficina que lo inició">—</span>}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{e.oficinaActualNombre}</span>
                    {e.ultimoPase && <span className="block text-xs text-slate-500 dark:text-slate-400">desde {formatearFecha(e.ultimoPase)}</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {ruta ? (
                      <Button size="sm" variant="secondary" iconLeft="visibility" onClick={() => navigate(ruta)}>
                        Ver
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400" title="Este trámite todavía no tiene su pantalla en el backend">
                        Sin vista aún
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="Búsqueda general"
        description="Consulte cualquier expediente de todos los trámites, en curso o terminado, y en qué oficina está."
      />

      <div className="flex flex-col gap-6">
        <Card>
          <div className="flex flex-col gap-4 p-6">
            <Input
              icon="search"
              placeholder="N° de expediente (ej: 155905 o 155905/332-2026), nombre o documento del titular…"
              value={f.texto ?? ''}
              onChange={(e) => editar('texto', e.target.value)}
              aria-label="Buscar expediente"
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Campo label="Trámite">
                <Select options={opcionesTramite} placeholder="Todos" value={f.tipoTramite ?? ''} onChange={(e) => editar('tipoTramite', e.target.value)} />
              </Campo>
              <Campo label="Estado">
                <Select options={opcionesEstado} placeholder="Todos" value={f.estado ?? ''} onChange={(e) => editar('estado', e.target.value)} />
              </Campo>
              <Campo label="Oficina actual">
                <Select options={opcionesOficina} placeholder="Todas" value={f.oficina ?? ''} onChange={(e) => editar('oficina', e.target.value)} />
              </Campo>
              <Campo label="Ingreso desde">
                <Input type="date" value={f.desde ?? ''} onChange={(e) => editar('desde', e.target.value)} />
              </Campo>
              <Campo label="Ingreso hasta">
                <Input type="date" value={f.hasta ?? ''} onChange={(e) => editar('hasta', e.target.value)} />
              </Campo>
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                iconLeft="close"
                disabled={!conFiltros}
                onClick={() => {
                  setF({})
                  setPagina(1)
                }}
              >
                Limpiar filtros
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">Resultados</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {datos ? `${datos.total} expediente${datos.total === 1 ? '' : 's'}` : '…'} · Los más recientes primero (por el último pase)
              </p>
            </div>
            {busqueda.isFetching && !busqueda.isPending && <Spinner className="size-4 text-primary" />}
          </div>
          {resultados()}
          {datos && datos.total > POR_PAGINA && (
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-6 py-3 text-sm dark:border-slate-700">
              <span className="text-slate-500 dark:text-slate-400">
                Página {pagina} de {paginas}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" iconLeft="arrow_back" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
                  Anterior
                </Button>
                <Button size="sm" variant="secondary" iconRight="arrow_forward" disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
