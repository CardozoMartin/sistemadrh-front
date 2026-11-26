import { useState, type FormEvent } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ErrorState, EmptyState, LoadingState } from '@/components/feedback/States'
import { Field, Input, Select } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useOpcionesFiltros, type ConcesionEncontrada, type FiltrosConcesiones, type ResultadoConcesiones } from '@/features/catastro/consultaConcesiones'
import { formatearFecha } from '@/config/expedientes'
import { cn } from '@/lib/cn'
import { backend } from '@/services/api/backend'

/** Resultados por página en la búsqueda de concesiones del inicio. */
const CONCESIONES_POR_PAGINA = 10

/**
 * Búsqueda de concesiones VIGENTES en el backend (la misma consulta de Catastro, filtrada por estado).
 * Con `filtros` en null no pide nada: la lista arranca vacía hasta que el usuario busca.
 */
function useBuscarVigentes(filtros: FiltrosConcesiones | null, pagina: number) {
  return useQuery({
    queryKey: ['backend', 'concesionesVigentes', filtros ?? {}, pagina],
    queryFn: async () => {
      const params = Object.fromEntries(Object.entries({ ...filtros, estado: 'VIGENTE', pagina, porPagina: CONCESIONES_POR_PAGINA }).filter(([, v]) => v !== undefined && v !== ''))
      return (await backend.get<ResultadoConcesiones>('/concesiones/buscar', { params })).data
    },
    enabled: !!filtros,
    placeholderData: keepPreviousData,
  })
}

interface Props {
  seleccionada: ConcesionEncontrada | null
  onSeleccionar: (c: ConcesionEncontrada) => void
}

const VACIO = { numeroConcesion: '', documento: '', titular: '', distrito: '', otorgadaDesde: '', otorgadaHasta: '' }

/**
 * Búsqueda de la concesión (cambio de titularidad, ampliación / reducción: pasos 1-3): por N° de concesión, DNI / CUIL / CUIT,
 * titular, distrito y fecha de otorgamiento. Solo concesiones VIGENTES, desde el backend.
 */
export function BuscadorVigentes({ seleccionada, onSeleccionar }: Props) {
  const opciones = useOpcionesFiltros()
  const [campos, setCampos] = useState(VACIO)
  const [filtros, setFiltros] = useState<FiltrosConcesiones | null>(null)
  const [pagina, setPagina] = useState(1)
  const resultado = useBuscarVigentes(filtros, pagina)

  const set = (campo: keyof typeof VACIO) => (e: { target: { value: string } }) => setCampos((c) => ({ ...c, [campo]: e.target.value }))

  function buscar(e: FormEvent) {
    e.preventDefault()
    setPagina(1)
    setFiltros(Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, v.trim()])))
  }

  function limpiar() {
    setCampos(VACIO)
    setFiltros(null)
    setPagina(1)
  }

  const total = resultado.data?.total ?? 0
  const paginas = Math.max(1, Math.ceil(total / CONCESIONES_POR_PAGINA))

  return (
    <Card className="p-6 md:p-8">
      <h2 className="text-base font-bold text-slate-900 dark:text-white">Búsqueda de la concesión</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Complete uno o más filtros. Solo se muestran concesiones vigentes.</p>

      <form onSubmit={buscar} className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field id="b-numero" label="N° de concesión">
          <Input id="b-numero" inputMode="numeric" value={campos.numeroConcesion} onChange={set('numeroConcesion')} placeholder="Ej: 906" />
        </Field>
        <Field id="b-documento" label="DNI / CUIL / CUIT del titular">
          <Input id="b-documento" inputMode="numeric" value={campos.documento} onChange={set('documento')} placeholder="Solo números" />
        </Field>
        <Field id="b-titular" label="Titular">
          <Input id="b-titular" value={campos.titular} onChange={set('titular')} placeholder="Apellido, nombre o razón social" />
        </Field>
        <Field id="b-distrito" label="Distrito">
          <Select
            id="b-distrito"
            value={campos.distrito}
            onChange={set('distrito')}
            placeholder={opciones.isPending ? 'Cargando…' : 'Todos'}
            options={(opciones.data?.distritos ?? []).map((d) => ({ value: String(d.id), label: d.nombre }))}
          />
        </Field>
        <Field id="b-desde" label="Otorgada desde">
          <Input id="b-desde" type="date" value={campos.otorgadaDesde} onChange={set('otorgadaDesde')} />
        </Field>
        <Field id="b-hasta" label="Otorgada hasta">
          <Input id="b-hasta" type="date" value={campos.otorgadaHasta} onChange={set('otorgadaHasta')} />
        </Field>
        <div className="flex gap-3 md:col-span-3">
          <Button type="submit" iconLeft="search" loading={resultado.isFetching}>
            Buscar
          </Button>
          <Button type="button" variant="ghost" onClick={limpiar}>
            Limpiar
          </Button>
        </div>
      </form>

      <div className="mt-6">
        {!filtros ? null : resultado.isPending ? (
          <LoadingState mensaje="Buscando concesiones…" className="py-8" />
        ) : resultado.isError ? (
          <ErrorState error={resultado.error} onRetry={() => void resultado.refetch()} reintentando={resultado.isFetching} className="py-8" />
        ) : resultado.data.concesiones.length === 0 ? (
          <EmptyState icon="search_off" titulo="No se encontraron concesiones vigentes" descripcion="Revise los filtros (flujo alterno 1.1)." className="py-8" />
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">N° concesión</th>
                    <th className="px-4 py-3">Titular actual</th>
                    <th className="px-4 py-3">Ubicación</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Otorgada</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {resultado.data.concesiones.map((c) => {
                    const elegida = seleccionada?.id === c.id
                    return (
                      <tr key={c.id} className={cn(elegida && 'bg-primary/5')}>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{c.numero ?? '—'}</td>
                        <td className="px-4 py-3">
                          {c.titular ?? '—'}
                          {c.cantidadTitulares > 1 && <span className="text-slate-400"> y {c.cantidadTitulares - 1} más</span>}
                          {c.documento && <span className="block text-xs text-slate-500">{c.documento}</span>}
                        </td>
                        <td className="px-4 py-3">{[c.localidad, c.distrito && `Distrito ${c.distrito}`].filter(Boolean).join(' · ') || '—'}</td>
                        <td className="px-4 py-3">{c.estadoNombre}</td>
                        <td className="px-4 py-3">{c.fechaOtorgamiento ? formatearFecha(c.fechaOtorgamiento) : '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant={elegida ? 'primary' : 'secondary'} iconLeft={elegida ? 'check' : undefined} onClick={() => onSeleccionar(c)}>
                            {elegida ? 'Seleccionada' : 'Seleccionar'}
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
              <span>
                {total} concesión{total === 1 ? '' : 'es'} · página {pagina} de {paginas}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" iconLeft="chevron_left" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
                  Anterior
                </Button>
                <Button size="sm" variant="ghost" iconRight="chevron_right" disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>
                  Siguiente
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}
