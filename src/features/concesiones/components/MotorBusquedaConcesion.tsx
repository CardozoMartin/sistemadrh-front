import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { formatearFecha } from '@/config/expedientes'
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Input, Select } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Spinner } from '@/components/ui/Spinner'
import {
  useBuscarConcesiones,
  useOpcionesFiltros,
  type ConcesionEncontrada,
  type FiltrosConcesiones,
} from '@/features/catastro/consultaConcesiones'
import { cn } from '@/lib/cn'
import { soloDigitos } from '@/lib/mascaras'

/** Los campos del motor (un subconjunto de los filtros de la consulta de Catastro). */
type CampoMotor = 'numeroConcesion' | 'expediente' | 'titular' | 'documento' | 'departamento' | 'localidad' | 'distrito' | 'otorgadaDesde' | 'otorgadaHasta'
type FiltrosMotor = Partial<Record<CampoMotor, string>>

interface Props {
  seleccionadaId: string | null
  onSeleccionar: (concesion: ConcesionEncontrada) => void
  /** Pie de los resultados (ej: Cancelar / Iniciar trámite). */
  pie?: ReactNode
}

const hayCriterios = (f: FiltrosMotor) => Object.values(f).some((v) => !!v?.trim())

function Campo({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('flex flex-col gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300', className)}>
      {label}
      {children}
    </label>
  )
}

/**
 * Motor de búsqueda de concesiones VIGENTES para iniciar un trámite de Catastro sobre ellas
 * (cambio de titularidad, anulación, reducción/ampliación, subdivisión…). Busca en el backend
 * real (GET /concesiones/buscar) y no pide nada hasta que se busca con al menos un criterio.
 * Si la concesión ya tiene otro trámite en curso, lo rechaza el backend al iniciar.
 */
export function MotorBusquedaConcesion({ seleccionadaId, onSeleccionar, pie }: Props) {
  const opciones = useOpcionesFiltros()
  // Lo que se escribe se aplica recién al tocar «Buscar». null = todavía no se buscó.
  const [borrador, setBorrador] = useState<FiltrosMotor>({})
  const [filtros, setFiltros] = useState<FiltrosConcesiones | null>(null)
  const [pagina, setPagina] = useState(1)
  const [sinCriterios, setSinCriterios] = useState(false)

  const busqueda = useBuscarConcesiones(filtros, pagina)
  const resultados = busqueda.data?.concesiones ?? []

  const o = opciones.data
  const departamentos = useMemo(() => (o?.departamentos ?? []).map((d) => ({ value: String(d.id), label: d.nombre })), [o])
  const distritos = useMemo(() => (o?.distritos ?? []).map((d) => ({ value: String(d.id), label: d.nombre })), [o])
  // Las localidades se acotan al departamento y al distrito elegidos.
  const localidades = useMemo(
    () =>
      (o?.localidades ?? [])
        .filter((l) => (!borrador.departamento || String(l.departamentoId) === borrador.departamento) && (!borrador.distrito || String(l.distritoId) === borrador.distrito))
        .map((l) => ({ value: String(l.id), label: l.nombre })),
    [o, borrador.departamento, borrador.distrito],
  )

  function editar(campo: CampoMotor, valor: string) {
    setSinCriterios(false)
    setBorrador((f) => {
      const nuevo = { ...f, [campo]: valor || undefined }
      // Si cambia el departamento o el distrito, la localidad elegida puede dejar de corresponder.
      if ((campo === 'departamento' || campo === 'distrito') && nuevo.localidad && o) {
        const loc = o.localidades.find((l) => String(l.id) === nuevo.localidad)
        if (loc && ((nuevo.departamento && String(loc.departamentoId) !== nuevo.departamento) || (nuevo.distrito && String(loc.distritoId) !== nuevo.distrito))) {
          nuevo.localidad = undefined
        }
      }
      return nuevo
    })
  }

  function buscar(e: FormEvent) {
    e.preventDefault()
    if (!hayCriterios(borrador)) {
      setSinCriterios(true)
      return
    }
    setFiltros({ ...borrador, estado: 'VIGENTE' })
    setPagina(1)
  }

  function limpiar() {
    setBorrador({})
    setFiltros(null)
    setPagina(1)
    setSinCriterios(false)
  }

  const texto = (campo: CampoMotor, props: Omit<Parameters<typeof Input>[0], 'value' | 'onChange'> & { digitos?: boolean } = {}) => {
    const { digitos, ...resto } = props
    return <Input value={borrador[campo] ?? ''} onChange={(e) => editar(campo, digitos ? soloDigitos(e.target.value) : e.target.value)} {...resto} />
  }
  const lista = (campo: CampoMotor, items: { value: string; label: string }[]) => (
    <Select options={items} placeholder={opciones.isPending ? 'Cargando…' : 'Todos'} disabled={!o} value={borrador[campo] ?? ''} onChange={(e) => editar(campo, e.target.value)} />
  )

  function tabla() {
    if (!filtros) {
      return (
        <EmptyState
          icon="manage_search"
          titulo="Ingrese al menos un criterio"
          descripcion="Complete uno o más filtros y presione «Buscar» para ver las concesiones vigentes."
          className="m-4"
        />
      )
    }
    if (busqueda.isPending) return <LoadingState mensaje="Buscando concesiones vigentes…" className="py-10" />
    if (busqueda.isError) {
      return <ErrorState error={busqueda.error} onRetry={() => void busqueda.refetch()} reintentando={busqueda.isFetching} className="m-4" />
    }
    if (resultados.length === 0) {
      return <EmptyState icon="search_off" titulo="No se encontraron concesiones vigentes" descripcion="Revise los datos ingresados o use menos filtros." className="m-4" />
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-180 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:bg-slate-800/40 dark:text-slate-400">
            <tr>
              <th className="w-10 px-4 py-3" aria-label="Seleccionar" />
              <th className="px-4 py-3 whitespace-nowrap">N° Concesión</th>
              <th className="px-4 py-3 whitespace-nowrap">Titular</th>
              <th className="px-4 py-3 whitespace-nowrap">Ubicación</th>
              <th className="px-4 py-3 whitespace-nowrap">Otorgada</th>
              <th className="px-4 py-3 whitespace-nowrap">Expediente</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {resultados.map((c) => {
              const elegida = seleccionadaId === c.id
              return (
                <tr
                  key={c.id}
                  onClick={() => onSeleccionar(c)}
                  className={cn('cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40', elegida && 'bg-primary/5 hover:bg-primary/5')}
                >
                  <td className="px-4 py-3">
                    <input
                      type="radio"
                      name="concesion-elegida"
                      checked={elegida}
                      onChange={() => onSeleccionar(c)}
                      aria-label={`Seleccionar concesión ${c.numero ?? c.id}`}
                      className="size-4 accent-primary"
                    />
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{c.numero ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-white">
                      {c.titular ?? '—'}
                      {c.cantidadTitulares > 1 && <span className="ml-1 text-xs font-normal text-slate-500">(+{c.cantidadTitulares - 1})</span>}
                    </div>
                    {c.documento && <div className="text-xs text-slate-500 dark:text-slate-400">{c.documento}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div>{[c.localidad, c.departamento].filter(Boolean).join(', ') || '—'}</div>
                    {c.distrito && <div className="text-xs text-slate-500 dark:text-slate-400">Distrito {c.distrito}</div>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{c.fechaOtorgamiento ? formatearFecha(c.fechaOtorgamiento) : '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {c.expediente?.numero ?? '—'}
                    {c.conDeuda && (
                      <span className="ml-2 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                        Con deuda
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

  function paginador() {
    const p = busqueda.data
    if (!filtros || !p) return null
    const paginas = Math.max(1, Math.ceil(p.total / p.porPagina))
    if (paginas <= 1) return null
    const desde = (p.pagina - 1) * p.porPagina + 1
    const hasta = Math.min(p.pagina * p.porPagina, p.total)
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-3 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        <span>
          {desde}–{hasta} de {p.total}
        </span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" iconLeft="chevron_left" disabled={p.pagina <= 1 || busqueda.isFetching} onClick={() => setPagina(p.pagina - 1)}>
            Anterior
          </Button>
          <span className="px-1 whitespace-nowrap">
            {p.pagina} / {paginas}
          </span>
          <Button size="sm" variant="secondary" iconRight="chevron_right" disabled={p.pagina >= paginas || busqueda.isFetching} onClick={() => setPagina(p.pagina + 1)}>
            Siguiente
          </Button>
        </div>
      </div>
    )
  }

  const total = busqueda.data?.total

  return (
    <Card>
      <form onSubmit={buscar} className="flex flex-col gap-5 border-b border-slate-200 p-6 dark:border-slate-700">
        <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <legend className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">Concesión y titular</legend>
          <Campo label="N° de concesión">{texto('numeroConcesion', { icon: 'tag', inputMode: 'numeric', placeholder: 'Ej. 906', digitos: true })}</Campo>
          <Campo label="N° de expediente">{texto('expediente', { icon: 'folder', placeholder: 'Ej. 123/332-2026' })}</Campo>
          <Campo label="Titular">{texto('titular', { icon: 'person', placeholder: 'Apellido, nombre o razón social' })}</Campo>
          <Campo label="DNI / CUIL / CUIT">{texto('documento', { icon: 'badge', inputMode: 'numeric', maxLength: 11, placeholder: 'Solo números', digitos: true })}</Campo>
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <legend className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">Ubicación y otorgamiento</legend>
          <Campo label="Departamento">{lista('departamento', departamentos)}</Campo>
          <Campo label="Distrito">{lista('distrito', distritos)}</Campo>
          <Campo label="Localidad">{lista('localidad', localidades)}</Campo>
          <div className="grid grid-cols-2 gap-2">
            <Campo label="Otorgada desde">{texto('otorgadaDesde', { type: 'date' })}</Campo>
            <Campo label="Hasta">{texto('otorgadaHasta', { type: 'date' })}</Campo>
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center justify-end gap-3">
          {sinCriterios && (
            <span role="alert" className="mr-auto flex items-center gap-1 text-sm text-amber-700 dark:text-amber-400">
              <Icon name="info" className="text-base!" /> Ingrese al menos un criterio para buscar.
            </span>
          )}
          {opciones.isError && <span className="mr-auto text-sm text-red-600 dark:text-red-400">No se pudieron cargar las listas de ubicación.</span>}
          <Button size="sm" variant="ghost" iconLeft="filter_alt_off" disabled={!hayCriterios(borrador) && !filtros} onClick={limpiar}>
            Limpiar
          </Button>
          <Button type="submit" size="sm" iconLeft="search">
            Buscar
          </Button>
        </div>
      </form>

      <div className="flex items-center justify-between gap-3 px-6 py-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Concesiones vigentes</h3>
        <span className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          {busqueda.isFetching && !busqueda.isPending && <Spinner className="size-4 text-primary" />}
          {filtros && total !== undefined && `${total} resultado${total === 1 ? '' : 's'}`}
        </span>
      </div>
      {tabla()}
      {paginador()}
      {pie && <div className="border-t border-slate-200 px-6 py-4 dark:border-slate-700">{pie}</div>}
    </Card>
  )
}
