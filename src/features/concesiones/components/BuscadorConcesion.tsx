import { Fragment, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Input, Select } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Spinner } from '@/components/ui/Spinner'
import { documentoConFormato, nombreTitular } from '@/features/tramites/shared/schemas/titular'
import { useCatalogoLocalidades } from '@/hooks/useCatalogos'
import { useDominio } from '@/hooks/useDominio'
import { cn } from '@/lib/cn'
import { soloDigitos } from '@/lib/mascaras'
import { CONCESIONES_POR_PAGINA } from '../api'
import { hayCriterios, titularesDe, type Concesion, type FiltrosConcesion } from '../datos'
import { useBuscarConcesiones, useTramitesEnCurso } from '../hooks'
import { FichaConcesion } from './FichaConcesion'

interface Props {
  seleccionadaId: string | null
  onSeleccionar: (concesion: Concesion) => void
  /** Pie de la tabla de resultados (nota + botones Cancelar / Iniciar trámite). */
  pie?: ReactNode
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
      {label}
      {children}
    </label>
  )
}

/**
 * Búsqueda de concesiones vigentes para iniciar un trámite sobre ellas (prototipo:
 * cambiodeTitularidad/inicioTramite.html). Las que ya tienen un trámite en curso no se
 * pueden elegir.
 *
 * Son decenas de miles de concesiones: no se carga ninguna hasta que el usuario busca con
 * al menos un criterio, y la búsqueda la hace el servidor de a una página.
 */
export function BuscadorConcesion({ seleccionadaId, onSeleccionar, pie }: Props) {
  const d = useDominio()
  const { catalogo } = useCatalogoLocalidades()
  // Lo que se escribe en el formulario se aplica recién al tocar «Buscar». null = todavía no se buscó.
  const [borrador, setBorrador] = useState<FiltrosConcesion>({})
  const [filtros, setFiltros] = useState<FiltrosConcesion | null>(null)
  const [pagina, setPagina] = useState(1)
  const [sinCriterios, setSinCriterios] = useState(false)
  const [ficha, setFicha] = useState<string | null>(null)

  const busqueda = useBuscarConcesiones(filtros, pagina)
  const resultados = useMemo(() => busqueda.data?.items ?? [], [busqueda.data])
  const { porConcesion } = useTramitesEnCurso(useMemo(() => resultados.map((c) => c.id), [resultados]))
  const distritos = useMemo(
    () =>
      [...new Set(Object.values(catalogo ?? {}).flatMap((localidades) => Object.values(localidades).flat()))]
        .sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
        .map((x) => ({ value: x, label: `Distrito ${x}` })),
    [catalogo],
  )
  const editar = (campo: keyof FiltrosConcesion, valor: string) => {
    setSinCriterios(false)
    setBorrador((f) => ({ ...f, [campo]: valor || undefined }))
  }
  const hayFiltros = hayCriterios(borrador) || !!filtros

  function buscar(e: FormEvent) {
    e.preventDefault()
    if (!hayCriterios(borrador)) {
      setSinCriterios(true)
      return
    }
    setFiltros({ ...borrador })
    setPagina(1)
    setFicha(null)
  }

  function limpiar() {
    setBorrador({})
    setFiltros(null)
    setPagina(1)
    setSinCriterios(false)
    setFicha(null)
  }

  function irAPagina(p: number) {
    setPagina(p)
    setFicha(null)
  }

  function tabla() {
    if (!filtros) {
      return (
        <EmptyState
          icon="manage_search"
          titulo="Ingrese un criterio de búsqueda"
          descripcion="Busque por número de concesión, documento del titular, distrito o fecha de otorgamiento para ver las concesiones."
          className="m-4"
        />
      )
    }
    if (busqueda.isPending) return <LoadingState mensaje="Buscando concesiones vigentes…" className="py-10" />
    if (busqueda.isError) {
      return <ErrorState error={busqueda.error} onRetry={() => void busqueda.refetch()} reintentando={busqueda.isFetching} className="m-4" />
    }
    if (resultados.length === 0) {
      return (
        <EmptyState
          icon="search_off"
          titulo="No se encontraron concesiones"
          descripcion="Revise el número de concesión, el documento del titular o las fechas."
          className="m-4"
        />
      )
    }
    return (
      <div className="overflow-x-auto p-2">
        <table className="w-full min-w-190 text-left text-sm">
          <thead className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="px-4 py-3 whitespace-nowrap">Seleccionar</th>
              <th className="px-4 py-3 whitespace-nowrap">N° Concesión</th>
              <th className="px-4 py-3 whitespace-nowrap">Titular actual</th>
              <th className="px-4 py-3 whitespace-nowrap">Ubicación / Distrito</th>
              <th className="px-4 py-3 whitespace-nowrap">Estado</th>
              <th className="px-4 py-3 text-right whitespace-nowrap">Detalles</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {resultados.map((c) => {
              const enCurso = porConcesion.get(c.id)
              const elegida = seleccionadaId === c.id
              const abierta = ficha === c.id
              const titular = titularesDe(c)[0]
              return (
                <Fragment key={c.id}>
                  <tr
                    onClick={() => !enCurso && onSeleccionar(c)}
                    className={cn(
                      'transition-colors',
                      enCurso ? 'opacity-60' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40',
                      elegida && 'bg-primary/5 hover:bg-primary/5',
                    )}
                  >
                    <td className="px-4 py-4">
                      <input
                        type="radio"
                        name="resultado-select"
                        checked={elegida}
                        disabled={!!enCurso}
                        onChange={() => onSeleccionar(c)}
                        aria-label={`Seleccionar concesión ${c.numeroConcesion}`}
                        className="size-4 accent-primary"
                      />
                    </td>
                    <td className="px-4 py-4 font-medium text-slate-900 dark:text-white">
                      <span className="flex items-center gap-2">
                        <Icon name="description" className="text-lg! text-slate-400" />
                        {c.numeroConcesion}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-900 dark:text-white">{titular ? nombreTitular(titular) : c.titular}</div>
                      {titular && <div className="text-xs text-slate-500 dark:text-slate-400">{documentoConFormato(titular)}</div>}
                    </td>
                    <td className="px-4 py-4">
                      <div>
                        {c.ubicacion.localidad}, {c.ubicacion.departamento}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Distrito {c.ubicacion.distrito}</div>
                    </td>
                    <td className="px-4 py-4">
                      {enCurso ? (
                        <span
                          className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                          title={`Expediente ${enCurso.numero} en ${d.nombreOficina(enCurso.oficinaId)}`}
                        >
                          {d.nombreTramite(enCurso.tramiteId)} en curso
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-500/10 dark:text-green-400">
                          Activa / Regular
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setFicha(abierta ? null : c.id)}
                        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-blue-700"
                      >
                        {abierta ? 'Ocultar ficha' : 'Ver ficha'}
                        <Icon name={abierta ? 'expand_less' : 'visibility'} className="text-base!" />
                      </button>
                    </td>
                  </tr>
                  {abierta && (
                    <tr className="bg-slate-50/60 dark:bg-slate-800/30">
                      <td colSpan={6} className="px-6 py-5">
                        <FichaConcesion concesion={c} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  function paginador() {
    const p = busqueda.data
    if (!filtros || !p || p.paginas <= 1) return null
    const desde = (p.pagina - 1) * CONCESIONES_POR_PAGINA + 1
    const hasta = Math.min(p.pagina * CONCESIONES_POR_PAGINA, p.total)
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-3 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        <span>
          Mostrando {desde}–{hasta} de {p.total}. Si no encuentra la concesión, agregue más criterios.
        </span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" iconLeft="chevron_left" disabled={p.pagina <= 1 || busqueda.isFetching} onClick={() => irAPagina(p.pagina - 1)}>
            Anterior
          </Button>
          <span className="px-1 whitespace-nowrap">
            Página {p.pagina} de {p.paginas}
          </span>
          <Button size="sm" variant="secondary" iconRight="chevron_right" disabled={p.pagina >= p.paginas || busqueda.isFetching} onClick={() => irAPagina(p.pagina + 1)}>
            Siguiente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <h3 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
            <Icon name="search" className="text-primary" /> Buscar concesión
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Ingrese los datos para localizar el expediente.</p>
        </div>
        <form onSubmit={buscar} className="flex flex-col gap-5 p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Campo label="Número de concesión">
              <Input icon="tag" inputMode="numeric" placeholder="Ej. 906" value={borrador.numeroConcesion ?? ''} onChange={(e) => editar('numeroConcesion', soloDigitos(e.target.value))} />
            </Campo>
            <Campo label="DNI">
              <Input icon="badge" inputMode="numeric" maxLength={8} placeholder="Ej. 12345678" value={borrador.dni ?? ''} onChange={(e) => editar('dni', soloDigitos(e.target.value))} />
            </Campo>
            <Campo label="CUIL / CUIT">
              <Input icon="fingerprint" inputMode="numeric" maxLength={11} placeholder="Ej. 20123456789" value={borrador.cuit ?? ''} onChange={(e) => editar('cuit', soloDigitos(e.target.value))} />
            </Campo>
            <Campo label="Distrito">
              <Select options={distritos} placeholder="Seleccionar…" value={borrador.distrito ?? ''} onChange={(e) => editar('distrito', e.target.value)} />
            </Campo>
            <Campo label="Fecha desde">
              <Input type="date" value={borrador.desde ?? ''} onChange={(e) => editar('desde', e.target.value)} />
            </Campo>
            <Campo label="Fecha hasta">
              <Input type="date" value={borrador.hasta ?? ''} onChange={(e) => editar('hasta', e.target.value)} />
            </Campo>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button type="submit" size="sm" iconLeft="search">
              Buscar
            </Button>
            <Button size="sm" variant="ghost" iconLeft="filter_alt_off" disabled={!hayFiltros} onClick={limpiar}>
              Limpiar
            </Button>
            {sinCriterios && (
              <span role="alert" className="flex items-center gap-1 text-sm text-amber-700 dark:text-amber-400">
                <Icon name="info" className="text-base!" /> Ingrese al menos un criterio para buscar.
              </span>
            )}
          </div>
        </form>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <h3 className="font-bold text-slate-900 dark:text-white">Resultados de búsqueda</h3>
          <span className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            {busqueda.isFetching && !busqueda.isPending && <Spinner className="size-4 text-primary" />}
            {filtros && busqueda.data && `${busqueda.data.total} resultado${busqueda.data.total === 1 ? '' : 's'} encontrado${busqueda.data.total === 1 ? '' : 's'}`}
          </span>
        </div>
        {tabla()}
        {paginador()}
        {pie && <div className="border-t border-slate-200 px-6 py-4 dark:border-slate-700">{pie}</div>}
      </Card>
    </div>
  )
}
