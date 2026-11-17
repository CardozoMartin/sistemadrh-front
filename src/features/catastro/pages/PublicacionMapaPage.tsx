import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Input, Select } from '@/components/form'
import { controlClass } from '@/components/form/styles'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { ROUTES } from '@/config/routes'
import { usePuede } from '@/features/auth/components/RutaDeOficina'
import { cn } from '@/lib/cn'
import { mensajeDeError } from '@/services/api/errors'
import { useOpcionesFiltros, type OpcionesFiltros } from '../consultaConcesiones'
import {
  ESTADOS_PUBLICACION,
  POLIGONOS_POR_PAGINA,
  useAccionPublicacion,
  usePoligonosParaPublicar,
  type EstadoPublicacion,
  type FiltrosPublicacion,
  type PoligonoParaPublicar,
} from '../publicacionMapa'

const formatoHa = (ha: number) => `${ha.toLocaleString('es-AR', { maximumFractionDigits: 2 })} ha`
const formatoFecha = (iso: string) => new Date(iso).toLocaleDateString('es-AR')

type Accion = { tipo: 'publicar' | 'observar'; poligono: PoligonoParaPublicar }

/** Espera a que se deje de escribir para no consultar con cada tecla. */
function useDemorado<T>(valor: T, ms = 350): T {
  const [demorado, setDemorado] = useState(valor)
  useEffect(() => {
    const t = setTimeout(() => setDemorado(valor), ms)
    return () => clearTimeout(t)
  }, [valor, ms])
  return demorado
}

/** Publicar (nota optativa) u observar / retirar del mapa (nota obligatoria). */
function DialogoAccion({ accion, onCerrar }: { accion: Accion | null; onCerrar: () => void }) {
  const { publicar, observar } = useAccionPublicacion()
  const [nota, setNota] = useState('')
  const mutacion = accion?.tipo === 'publicar' ? publicar : observar
  const p = accion?.poligono
  const retirar = accion?.tipo === 'observar' && p?.publicacion === 'PUBLICADO'
  const notaValida = accion?.tipo === 'publicar' || nota.trim().length >= 5

  function cerrar() {
    setNota('')
    publicar.reset()
    observar.reset()
    onCerrar()
  }

  function confirmar() {
    if (!accion) return
    const datos = { poligonoId: accion.poligono.poligonoId, observaciones: nota.trim() }
    const opciones = { onSuccess: cerrar }
    if (accion.tipo === 'publicar') publicar.mutate(datos, opciones)
    else observar.mutate(datos, opciones)
  }

  return (
    <Modal
      open={!!accion}
      onClose={cerrar}
      bloqueado={mutacion.isPending}
      size="md"
      icon={accion?.tipo === 'publicar' ? 'public' : 'report'}
      title={accion?.tipo === 'publicar' ? 'Publicar en el mapa' : retirar ? 'Retirar del mapa público' : 'Observar el polígono'}
      description={p ? `${p.numero ? `Concesión ${p.numero}` : `Exp. ${p.expediente}`} · ${p.titular ?? ''}` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={cerrar} disabled={mutacion.isPending}>
            Cancelar
          </Button>
          <Button
            variant={accion?.tipo === 'publicar' ? 'primary' : 'danger'}
            iconLeft={accion?.tipo === 'publicar' ? 'public' : 'report'}
            loading={mutacion.isPending}
            disabled={!notaValida}
            onClick={confirmar}
          >
            {accion?.tipo === 'publicar' ? 'Publicar' : retirar ? 'Retirar' : 'Observar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {accion?.tipo === 'publicar'
            ? 'Verificó que el polígono coincide con la resolución: desde ahora se ve en Argenmap, fuera de la repartición.'
            : retirar
              ? 'Deja de verse en Argenmap. Catastro va a ver la nota y puede subir el KML corregido.'
              : 'No se publica. Catastro va a ver la nota y puede subir el KML corregido; después vuelve a quedar para publicar.'}
        </p>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {accion?.tipo === 'publicar' ? 'Nota (optativa)' : 'Qué hay que corregir'}
          <textarea rows={3} maxLength={2000} value={nota} onChange={(e) => setNota(e.target.value)} className={controlClass({})} />
        </label>
        {mutacion.isError && <Alert>{mensajeDeError(mutacion.error)}</Alert>}
      </div>
    </Modal>
  )
}

/** Catastro sube el KML corregido de un polígono observado. */
function ReemplazarKml({ poligono }: { poligono: PoligonoParaPublicar }) {
  const { reemplazar } = useAccionPublicacion()
  const entrada = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={entrada}
        type="file"
        accept=".kml,.geojson,.json"
        className="hidden"
        onChange={(e) => {
          const archivo = e.target.files?.[0]
          e.target.value = ''
          if (archivo) reemplazar.mutate({ poligonoId: poligono.poligonoId, archivo })
        }}
      />
      <Button size="sm" variant="secondary" iconLeft="upload_file" loading={reemplazar.isPending} onClick={() => entrada.current?.click()}>
        Subir KML corregido
      </Button>
      {reemplazar.isError && <Alert className="basis-full">{mensajeDeError(reemplazar.error)}</Alert>}
      {reemplazar.isSuccess && reemplazar.data.avisos.length > 0 && (
        <Alert tone="info" className="basis-full">
          {reemplazar.data.avisos.join(' ')}
        </Alert>
      )}
    </>
  )
}

function Fila({ p, onAccion }: { p: PoligonoParaPublicar; onAccion: (a: Accion) => void }) {
  const puede = usePuede()
  const estado = ESTADOS_PUBLICACION[p.publicacion]
  return (
    <li className="flex flex-col gap-3 px-4 py-4 md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900 dark:text-white">
            {p.numero ? `Concesión ${p.numero}` : `Alta en trámite · Exp. ${p.expediente}`}
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', estado.clases)}>{estado.nombre}</span>
            {p.esCorreccion && (
              <span
                title="Corrección del polígono publicado: al aprobarla reemplaza al que se ve hoy en Argenmap."
                className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
              >
                <Icon name="edit_note" className="text-[14px]!" />
                Corrección
              </span>
            )}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {[p.titular, p.localidad, p.departamento, p.distrito && `Distrito ${p.distrito}`, formatoHa(p.superficieHa)].filter(Boolean).join(' · ')}
            {p.esCorreccion && p.superficieAnteriorHa !== null && <span className="text-slate-500 dark:text-slate-400"> (publicado: {formatoHa(p.superficieAnteriorHa)})</span>}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {p.resolucion ? (
              <>
                <Icon name="gavel" className="mr-1 align-middle text-[14px]!" />
                Resolución {p.resolucion}
                {p.resolucionFecha && ` del ${formatoFecha(p.resolucionFecha)}`}
              </>
            ) : (
              'Sin resolución todavía: se puede publicar cuando pase por Recaudación, Distrito, Jurídico y Secretaría General.'
            )}
            {p.usuario && p.fecha && ` · ${p.publicacion === 'PUBLICADO' ? 'Publicó' : 'Observó'} ${p.usuario} el ${formatoFecha(p.fecha)}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to={ROUTES.visorConcesion(p.concesionId)} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10">
            <Icon name="map" className="text-[16px]!" />
            Ver en el visor
          </Link>
          {p.expedienteId && (
            <Link
              to={ROUTES.tramites.altaConcesion.circuito(p.expedienteId)}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
            >
              <Icon name="folder_open" className="text-[16px]!" />
              Expediente
            </Link>
          )}
        </div>
      </div>

      {p.publicacion === 'OBSERVADO' && p.nota && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          <span className="font-semibold">Observación: </span>
          {p.nota}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {puede('MAPA_PUBLICAR') && p.publicacion !== 'PUBLICADO' && (
          <Button size="sm" iconLeft="public" disabled={!p.listoParaPublicar} onClick={() => onAccion({ tipo: 'publicar', poligono: p })}>
            Publicar en el mapa
          </Button>
        )}
        {puede('MAPA_PUBLICAR') && p.publicacion !== 'OBSERVADO' && (
          <Button size="sm" variant="secondary" iconLeft="report" onClick={() => onAccion({ tipo: 'observar', poligono: p })}>
            {p.publicacion === 'PUBLICADO' ? 'Retirar del mapa' : 'Observar'}
          </Button>
        )}
        {p.publicacion === 'OBSERVADO' && puede('KML_CARGAR') && <ReemplazarKml poligono={p} />}
      </div>
    </li>
  )
}

/** Buscador y ubicación (departamento, distrito y localidad, con las opciones de los catálogos). */
function BarraFiltros({ filtros, onChange }: { filtros: FiltrosPublicacion; onChange: (f: FiltrosPublicacion) => void }) {
  const opciones = useOpcionesFiltros()
  const o = opciones.data
  const editar = (campo: keyof FiltrosPublicacion, valor: string) => {
    const nuevo = { ...filtros, [campo]: valor || undefined }
    // La localidad tiene que ser del departamento y del distrito elegidos.
    if ((campo === 'departamento' || campo === 'distrito') && nuevo.localidad && o) {
      const loc = o.localidades.find((l) => String(l.id) === nuevo.localidad)
      if (loc && ((nuevo.departamento && String(loc.departamentoId) !== nuevo.departamento) || (nuevo.distrito && String(loc.distritoId) !== nuevo.distrito))) {
        nuevo.localidad = undefined
      }
    }
    onChange(nuevo)
  }
  return (
    <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] dark:border-slate-700">
      <div className="sm:col-span-2 lg:col-span-1">
        <Input
          icon="search"
          placeholder="N° de concesión, expediente o resolución, titular, documento o padrón…"
          aria-label="Buscar concesión"
          value={filtros.texto ?? ''}
          onChange={(e) => editar('texto', e.target.value)}
        />
      </div>
      <Select
        aria-label="Departamento"
        placeholder="Todos los departamentos"
        disabled={!o}
        options={o?.departamentos.map((d) => ({ value: String(d.id), label: d.nombre })) ?? []}
        value={filtros.departamento ?? ''}
        onChange={(e) => editar('departamento', e.target.value)}
      />
      <Select
        aria-label="Distrito"
        placeholder="Todos los distritos"
        disabled={!o}
        options={o?.distritos.map((d) => ({ value: String(d.id), label: d.nombre })) ?? []}
        value={filtros.distrito ?? ''}
        onChange={(e) => editar('distrito', e.target.value)}
      />
      <SelectorLocalidad opciones={o} filtros={filtros} onChange={(v) => editar('localidad', v)} />
      <Button variant="ghost" iconLeft="close" disabled={!Object.values(filtros).some(Boolean)} onClick={() => onChange({})}>
        Limpiar
      </Button>
    </div>
  )
}

/** Localidades del departamento y/o del distrito elegidos (o todas). */
function SelectorLocalidad({ opciones, filtros, onChange }: { opciones?: OpcionesFiltros; filtros: FiltrosPublicacion; onChange: (v: string) => void }) {
  const items = useMemo(() => {
    if (!opciones) return []
    const nombreDepto = new Map(opciones.departamentos.map((d) => [d.id, d.nombre]))
    return opciones.localidades
      .filter((l) => (!filtros.departamento || String(l.departamentoId) === filtros.departamento) && (!filtros.distrito || String(l.distritoId) === filtros.distrito))
      .map((l) => ({ value: String(l.id), label: filtros.departamento ? l.nombre : `${l.nombre} (${nombreDepto.get(l.departamentoId) ?? ''})` }))
  }, [opciones, filtros.departamento, filtros.distrito])
  return (
    <Select
      aria-label="Localidad"
      placeholder={filtros.distrito || filtros.departamento ? `Todas las localidades (${items.length})` : 'Todas las localidades'}
      disabled={!opciones}
      options={items}
      value={filtros.localidad ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

const VISTAS: { id: EstadoPublicacion | undefined; nombre: string }[] = [
  { id: undefined, nombre: 'Por revisar' },
  { id: 'PUBLICADO', nombre: 'Publicadas' },
]

/**
 * Concesiones para publicar en el mapa público (Argenmap). Adentro de la DRH se ven siempre en el
 * visor; afuera, recién cuando alguien con el permiso «Publicar en el mapa» verifica el polígono
 * de una concesión con resolución.
 */
export default function PublicacionMapaPage() {
  const [vista, setVista] = useState<EstadoPublicacion | undefined>(undefined)
  const [accion, setAccion] = useState<Accion | null>(null)
  const [f, setF] = useState<FiltrosPublicacion>({})
  const [pagina, setPagina] = useState(1)
  const filtros = useDemorado(f)
  const lista = usePoligonosParaPublicar(vista, filtros, pagina)
  const datos = lista.data
  const paginas = datos ? Math.max(1, Math.ceil(datos.total / POLIGONOS_POR_PAGINA)) : 1

  // Si al publicar u observar se vació la última página, se vuelve a la anterior.
  useEffect(() => {
    if (datos && !lista.isPlaceholderData && pagina > paginas) setPagina(paginas)
  }, [datos, lista.isPlaceholderData, pagina, paginas])

  function cambiarFiltros(nuevos: FiltrosPublicacion) {
    setF(nuevos)
    setPagina(1)
  }

  function contenido() {
    if (lista.isPending) return <LoadingState mensaje="Cargando concesiones…" />
    if (lista.isError) return <ErrorState error={lista.error} onRetry={() => void lista.refetch()} reintentando={lista.isFetching} className="m-6" />
    if (lista.data.items.length === 0) {
      if (Object.values(filtros).some(Boolean)) {
        return <EmptyState icon="search_off" titulo="No hay concesiones con esos datos" descripcion="Pruebe con otros datos o limpie los filtros." className="m-6" />
      }
      return (
        <EmptyState
          icon="public"
          titulo={vista ? 'No hay concesiones publicadas desde el sistema' : 'No hay concesiones para revisar'}
          descripcion={vista ? 'Las que se publiquen acá van a aparecer en esta lista.' : 'Las altas con polígono cargado aparecen acá hasta que se publiquen.'}
          className="m-6"
        />
      )
    }
    return (
      <ul className="divide-y divide-slate-200 dark:divide-slate-700">
        {lista.data.items.map((p) => (
          <Fila key={p.poligonoId} p={p} onAccion={setAccion} />
        ))}
      </ul>
    )
  }

  return (
    <>
      <PageHeader
        title="Publicación en el mapa"
        description="Una concesión se ve en Argenmap recién cuando tiene resolución y alguien con el permiso «Publicar en el mapa» verifica su polígono. Mientras tanto la ven solo los usuarios internos, en el visor."
      />
      <Card>
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-2 dark:border-slate-700">
          <div className="flex gap-1">
            {VISTAS.map((v) => (
              <button
                key={v.nombre}
                type="button"
                onClick={() => {
                  setVista(v.id)
                  setPagina(1)
                }}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm font-semibold',
                  vista === v.id ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/50',
                )}
              >
                {v.nombre}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 px-2 text-xs text-slate-500 dark:text-slate-400">
            {lista.isFetching && !lista.isPending && <Spinner className="size-4 text-primary" />}
            {datos && `${datos.total} concesi${datos.total === 1 ? 'ón' : 'ones'}`}
          </div>
        </div>
        <BarraFiltros filtros={f} onChange={cambiarFiltros} />
        {contenido()}
        {datos && datos.total > POLIGONOS_POR_PAGINA && (
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
      <DialogoAccion accion={accion} onCerrar={() => setAccion(null)} />
    </>
  )
}
