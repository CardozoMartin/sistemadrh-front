import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Input, Select } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { CLASE_COLOR_ESTADO, formatearFecha } from '@/config/expedientes'
import { ROUTES } from '@/config/routes'
import { cn } from '@/lib/cn'
import type { ColorEstado } from '@/types/domain'
import {
  CONCESIONES_POR_PAGINA,
  exportarConcesiones,
  useBuscarConcesiones,
  useFichaConcesion,
  useOpcionesFiltros,
  type ConcesionEncontrada,
  type FichaConcesion,
  type FiltrosConcesiones,
  type OpcionesFiltros,
} from '../consultaConcesiones'

type Campo = keyof FiltrosConcesiones

function Etiqueta({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('flex flex-col gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300', className)}>
      {label}
      {children}
    </label>
  )
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">{titulo}</legend>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </fieldset>
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

function EtiquetaEstado({ nombre, color }: { nombre: string; color: string }) {
  const clase = CLASE_COLOR_ESTADO[color as ColorEstado] ?? CLASE_COLOR_ESTADO.gris
  return <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', clase)}>{nombre}</span>
}

const Vacio = () => <span className="text-slate-400">—</span>
const SI_NO = [
  { value: 'SI', label: 'Sí' },
  { value: 'NO', label: 'No' },
]
const ORDENES = [
  { value: 'NUMERO', label: 'N° de concesión' },
  { value: 'RECIENTES', label: 'Más recientes' },
  { value: 'TITULAR', label: 'Titular (A-Z)' },
]
/** Los que se ven sin abrir «Más filtros» (para contar los avanzados activos). */
const FILTROS_PRINCIPALES: Campo[] = ['texto', 'titular', 'documento', 'expediente', 'padron', 'estado', 'departamento', 'distrito', 'localidad', 'orden']

/** Consulta de la ficha de un expediente según su trámite (los que ya tienen pantalla). */
const RUTA_EXPEDIENTE: Record<string, (id: string) => string> = {
  ALTA_CONCESION: ROUTES.consulta.alta,
}

/**
 * Consulta de concesiones de Catastro (backend real): combina filtros por concesión, expediente,
 * titular, ubicación (departamento → localidad, distrito → localidades del distrito), inmueble,
 * usos, caudal, suministro, polígono y deuda. Las opciones salen de los catálogos de la base.
 */
export default function ConsultaConcesionesPage() {
  const opciones = useOpcionesFiltros()
  const [f, setF] = useState<FiltrosConcesiones>({})
  const [pagina, setPagina] = useState(1)
  const [masFiltros, setMasFiltros] = useState(false)
  const [fichaId, setFichaId] = useState<string | null>(null)
  const filtros = useDemorado(f)
  const busqueda = useBuscarConcesiones(filtros, pagina)

  const editar = (campo: Campo, valor: string) => {
    setF((x) => {
      const nuevo = { ...x, [campo]: valor || undefined }
      // La localidad tiene que ser del departamento y del distrito elegidos.
      if ((campo === 'departamento' || campo === 'distrito') && nuevo.localidad && opciones.data) {
        const loc = opciones.data.localidades.find((l) => String(l.id) === nuevo.localidad)
        if (loc && ((nuevo.departamento && String(loc.departamentoId) !== nuevo.departamento) || (nuevo.distrito && String(loc.distritoId) !== nuevo.distrito))) {
          nuevo.localidad = undefined
        }
      }
      return nuevo
    })
    setPagina(1)
  }
  const activos = Object.entries(f).filter(([k, v]) => v && k !== 'orden')
  const avanzadosActivos = activos.filter(([k]) => !FILTROS_PRINCIPALES.includes(k as Campo)).length

  if (opciones.isPending) return <LoadingState mensaje="Cargando los filtros…" className="py-16" />
  if (opciones.isError) return <ErrorState error={opciones.error} onRetry={() => void opciones.refetch()} reintentando={opciones.isFetching} className="m-6" />
  const o = opciones.data

  /** Input de texto o número de un filtro. */
  const texto = (campo: Campo, props: Omit<Parameters<typeof Input>[0], 'value' | 'onChange'> = {}) => (
    <Input value={f[campo] ?? ''} onChange={(e) => editar(campo, e.target.value)} {...props} />
  )
  /** Lista de un filtro (las opciones vienen del catálogo). */
  const lista = (campo: Campo, items: { value: string; label: string }[], placeholder = 'Todos') => (
    <Select options={items} placeholder={placeholder} value={f[campo] ?? ''} onChange={(e) => editar(campo, e.target.value)} />
  )
  const deCatalogo = (items: { codigo: string; nombre: string }[]) => items.map((i) => ({ value: i.codigo, label: i.nombre }))

  return (
    <>
      <PageHeader
        title="Consulta de concesiones"
        description="Busque concesiones combinando datos del titular, el expediente, la ubicación, el inmueble, los usos y el suministro."
      />

      <div className="flex flex-col gap-6">
        <Card>
          <div className="flex flex-col gap-5 p-6">
            {texto('texto', {
              icon: 'search',
              placeholder: 'N° de concesión, de expediente, padrón, matrícula, nombre o documento del titular…',
              'aria-label': 'Buscar concesión',
            })}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Etiqueta label="Titular">{texto('titular', { placeholder: 'Apellido, nombre o razón social' })}</Etiqueta>
              <Etiqueta label="DNI / CUIT">{texto('documento', { placeholder: 'Con o sin guiones', inputMode: 'numeric' })}</Etiqueta>
              <Etiqueta label="N° de expediente">{texto('expediente', { placeholder: 'Ej: 155905/332-2026' })}</Etiqueta>
              <Etiqueta label="Padrón">{texto('padron', { inputMode: 'numeric' })}</Etiqueta>
              <Etiqueta label="Estado">{lista('estado', deCatalogo(o.estados))}</Etiqueta>
              <Etiqueta label="Departamento">
                {lista('departamento', o.departamentos.map((d) => ({ value: String(d.id), label: d.nombre })))}
              </Etiqueta>
              <Etiqueta label="Distrito">
                {lista('distrito', o.distritos.map((d) => ({ value: String(d.id), label: d.nombre })))}
              </Etiqueta>
              <Etiqueta label="Localidad">
                <SelectorLocalidad opciones={o} filtros={f} onChange={(v) => editar('localidad', v)} />
              </Etiqueta>
            </div>

            {masFiltros && <FiltrosAvanzados o={o} texto={texto} lista={lista} deCatalogo={deCatalogo} />}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button size="sm" variant="ghost" iconLeft={masFiltros ? 'expand_less' : 'tune'} onClick={() => setMasFiltros((v) => !v)}>
                {masFiltros ? 'Menos filtros' : `Más filtros${avanzadosActivos ? ` (${avanzadosActivos} activo${avanzadosActivos === 1 ? '' : 's'})` : ''}`}
              </Button>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  Ordenar por
                  <Select options={ORDENES} value={f.orden ?? 'NUMERO'} onChange={(e) => editar('orden', e.target.value)} />
                </label>
                <Button
                  size="sm"
                  variant="ghost"
                  iconLeft="close"
                  disabled={!activos.length}
                  onClick={() => {
                    setF((x) => ({ orden: x.orden }))
                    setPagina(1)
                  }}
                >
                  Limpiar filtros
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <Resultados busqueda={busqueda} filtros={filtros} pagina={pagina} setPagina={setPagina} conFiltros={activos.length > 0} onFicha={setFichaId} />
      </div>

      <ModalFicha id={fichaId} onClose={() => setFichaId(null)} />
    </>
  )
}

/** Localidades del departamento y/o del distrito elegidos (o todas). */
function SelectorLocalidad({ opciones, filtros, onChange }: { opciones: OpcionesFiltros; filtros: FiltrosConcesiones; onChange: (v: string) => void }) {
  const items = useMemo(() => {
    const nombreDepto = new Map(opciones.departamentos.map((d) => [d.id, d.nombre]))
    return opciones.localidades
      .filter((l) => (!filtros.departamento || String(l.departamentoId) === filtros.departamento) && (!filtros.distrito || String(l.distritoId) === filtros.distrito))
      .map((l) => ({ value: String(l.id), label: filtros.departamento ? l.nombre : `${l.nombre} (${nombreDepto.get(l.departamentoId) ?? ''})` }))
  }, [opciones, filtros.departamento, filtros.distrito])
  const placeholder = filtros.distrito || filtros.departamento ? `Todas (${items.length})` : 'Todas'
  return <Select options={items} placeholder={placeholder} value={filtros.localidad ?? ''} onChange={(e) => onChange(e.target.value)} />
}

interface PropsAvanzados {
  o: OpcionesFiltros
  texto: (campo: Campo, props?: Omit<Parameters<typeof Input>[0], 'value' | 'onChange'>) => ReactNode
  lista: (campo: Campo, items: { value: string; label: string }[], placeholder?: string) => ReactNode
  deCatalogo: (items: { codigo: string; nombre: string }[]) => { value: string; label: string }[]
}

function FiltrosAvanzados({ o, texto, lista, deCatalogo }: PropsAvanzados) {
  return (
    <div className="flex flex-col gap-5 border-t border-slate-200 pt-5 dark:border-slate-700">
      <Grupo titulo="Concesión">
        <Etiqueta label="N° de concesión">{texto('numeroConcesion')}</Etiqueta>
        <Etiqueta label="N° desde">{texto('numeroDesde', { type: 'number', min: 0 })}</Etiqueta>
        <Etiqueta label="N° hasta">{texto('numeroHasta', { type: 'number', min: 0 })}</Etiqueta>
        <Etiqueta label="Situación legal">{lista('situacionLegal', deCatalogo(o.situacionesLegales), 'Todas')}</Etiqueta>
        <Etiqueta label="Resolución">{texto('resolucion', { placeholder: 'Ej: 125/2026' })}</Etiqueta>
        <Etiqueta label="Otorgada desde">{texto('otorgadaDesde', { type: 'date' })}</Etiqueta>
        <Etiqueta label="Otorgada hasta">{texto('otorgadaHasta', { type: 'date' })}</Etiqueta>
        <Etiqueta label="Cuenca">{lista('cuenca', o.cuencas.map((c) => ({ value: String(c.id), label: c.nombre })), 'Todas')}</Etiqueta>
      </Grupo>

      <Grupo titulo="Inmueble">
        <Etiqueta label="Matrícula catastral">{texto('matricula')}</Etiqueta>
        <Etiqueta label="Circunscripción">{lista('circunscripcion', deCatalogo(o.circunscripciones), 'Todas')}</Etiqueta>
        <Etiqueta label="Sección">{lista('seccion', deCatalogo(o.secciones), 'Todas')}</Etiqueta>
        <Etiqueta label="Parcela">{texto('parcela')}</Etiqueta>
        <Etiqueta label="Matrícula de dominio">{texto('matriculaDominio')}</Etiqueta>
      </Grupo>

      <Grupo titulo="Usos y caudal">
        <Etiqueta label="Tipo de uso">{lista('tipoUso', deCatalogo(o.tiposUso))}</Etiqueta>
        <Etiqueta label="Carácter">{lista('caracter', deCatalogo(o.caracteres))}</Etiqueta>
        <Etiqueta label="Código de servicio">{lista('codigoServicio', deCatalogo(o.codigosServicio))}</Etiqueta>
        <div className="grid grid-cols-2 gap-2">
          <Etiqueta label="Caudal desde (l/s)">{texto('caudalDesde', { type: 'number', min: 0, step: 'any' })}</Etiqueta>
          <Etiqueta label="hasta (l/s)">{texto('caudalHasta', { type: 'number', min: 0, step: 'any' })}</Etiqueta>
        </div>
      </Grupo>

      <Grupo titulo="Suministro">
        <Etiqueta label="Fuente">{texto('fuente', { list: 'consulta-fuentes', placeholder: 'Ej: Río Salí' })}</Etiqueta>
        <Etiqueta label="Sistema de distribución">{texto('sistemaDistribucion', { list: 'consulta-sistemas' })}</Etiqueta>
        <Etiqueta label="Canal (cualquier nivel)">{texto('canal')}</Etiqueta>
        <datalist id="consulta-fuentes">
          {o.fuentes.map((x) => (
            <option key={x} value={x} />
          ))}
        </datalist>
        <datalist id="consulta-sistemas">
          {o.sistemas.map((x) => (
            <option key={x} value={x} />
          ))}
        </datalist>
      </Grupo>

      <Grupo titulo="Situación">
        <Etiqueta label="Con polígono">{lista('conPoligono', SI_NO, 'Indistinto')}</Etiqueta>
        <Etiqueta label="Con deuda pendiente">{lista('conDeuda', SI_NO, 'Indistinto')}</Etiqueta>
      </Grupo>
    </div>
  )
}

interface PropsResultados {
  busqueda: ReturnType<typeof useBuscarConcesiones>
  /** Los filtros aplicados: la exportación usa los mismos. */
  filtros: FiltrosConcesiones
  pagina: number
  setPagina: (fn: (p: number) => number) => void
  conFiltros: boolean
  onFicha: (id: string) => void
}

function Resultados({ busqueda, filtros, pagina, setPagina, conFiltros, onFicha }: PropsResultados) {
  const navigate = useNavigate()
  const datos = busqueda.data
  const [exportando, setExportando] = useState(false)
  const [errorExportar, setErrorExportar] = useState<string | null>(null)

  async function exportar() {
    setExportando(true)
    setErrorExportar(null)
    try {
      await exportarConcesiones(filtros)
    } catch (e) {
      setErrorExportar(e instanceof Error ? e.message : 'No se pudo exportar la planilla.')
    } finally {
      setExportando(false)
    }
  }
  const paginas = datos ? Math.max(1, Math.ceil(datos.total / CONCESIONES_POR_PAGINA)) : 1

  function tabla() {
    if (busqueda.isPending) return <LoadingState mensaje="Buscando…" className="py-10" />
    if (busqueda.isError) return <ErrorState error={busqueda.error} onRetry={() => void busqueda.refetch()} reintentando={busqueda.isFetching} className="m-6" />
    if (!datos?.concesiones.length) {
      return (
        <EmptyState
          icon="search_off"
          titulo={conFiltros ? 'No hay concesiones con esos datos' : 'Todavía no hay concesiones'}
          descripcion={conFiltros ? 'Pruebe con otros datos o limpie los filtros.' : 'Las concesiones aparecen acá desde que se inicia el alta o se migra el padrón.'}
          className="m-6"
        />
      )
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-275 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Concesión</th>
              <th className="px-4 py-3">Titular</th>
              <th className="px-4 py-3">Ubicación</th>
              <th className="px-4 py-3">Inmueble</th>
              <th className="px-4 py-3">Usos y caudal</th>
              <th className="px-4 py-3">Expediente</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {datos.concesiones.map((c) => (
              <FilaConcesion key={c.id} c={c} onFicha={() => onFicha(c.id)} onExpediente={(ruta) => navigate(ruta)} />
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white">Resultados</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{datos ? `${datos.total} concesi${datos.total === 1 ? 'ón' : 'ones'}` : '…'}</p>
        </div>
        <div className="flex items-center gap-3">
          {busqueda.isFetching && !busqueda.isPending && <Spinner className="size-4 text-primary" />}
          <Button
            size="sm"
            variant="secondary"
            iconLeft="download"
            loading={exportando}
            disabled={exportando || !datos?.total}
            title="Todas las concesiones de la búsqueda (no solo esta página), con todos sus detalles"
            onClick={() => void exportar()}
          >
            Exportar a Excel
          </Button>
        </div>
      </div>
      {errorExportar && <Alert className="mx-6 mt-4">{errorExportar}</Alert>}
      {datos?.datosSensiblesOcultos && (
        <Alert tone="info" className="mx-6 mt-4">
          Los documentos se muestran parcialmente: su usuario no tiene permiso para ver datos sensibles.
        </Alert>
      )}
      {tabla()}
      {datos && datos.total > CONCESIONES_POR_PAGINA && (
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
  )
}

function FilaConcesion({ c, onFicha, onExpediente }: { c: ConcesionEncontrada; onFicha: () => void; onExpediente: (ruta: string) => void }) {
  const rutaExpediente = c.expediente && RUTA_EXPEDIENTE[c.expediente.tipoTramite]?.(c.expediente.id)
  const sub = 'block text-xs text-slate-500 dark:text-slate-400'
  return (
    <tr className="align-top hover:bg-slate-50 dark:hover:bg-slate-800/40">
      <td className="px-4 py-3">
        <span className="block font-semibold tabular-nums">{c.numero ?? <span className="font-normal text-slate-400">Sin número</span>}</span>
        <span className="mt-1 flex flex-wrap gap-1">
          <EtiquetaEstado nombre={c.estadoNombre} color={c.estadoColor} />
          {c.conDeuda && <EtiquetaEstado nombre="Con deuda" color="rojo" />}
        </span>
        {c.resolucion && <span className={sub}>Res. {c.resolucion}</span>}
      </td>
      <td className="px-4 py-3">
        {c.titular ?? <Vacio />}
        {c.cantidadTitulares > 1 && <span className={sub}>y {c.cantidadTitulares - 1} más</span>}
        {c.documento && <span className={cn(sub, 'tabular-nums')}>{c.documento}</span>}
      </td>
      <td className="px-4 py-3">
        {c.departamento ? (
          <>
            {c.localidad}
            <span className={sub}>
              {c.departamento} · Distrito {c.distrito}
            </span>
          </>
        ) : (
          <Vacio />
        )}
      </td>
      <td className="px-4 py-3 tabular-nums">
        {c.padron || c.matricula ? (
          <>
            {c.padron ? `Padrón ${c.padron}` : <Vacio />}
            {c.matricula && <span className={sub}>Matrícula {c.matricula}</span>}
            {c.superficieHa !== null && <span className={sub}>{c.superficieHa.toLocaleString('es-AR')} ha (polígono)</span>}
          </>
        ) : (
          <Vacio />
        )}
      </td>
      <td className="px-4 py-3">
        {c.usos ?? <Vacio />}
        {c.caudalAsignado !== null && <span className={cn(sub, 'tabular-nums')}>{c.caudalAsignado.toLocaleString('es-AR')} l/s</span>}
      </td>
      <td className="px-4 py-3 whitespace-nowrap tabular-nums">{c.expediente?.numero ?? <span className="text-slate-400" title="Concesión migrada del padrón anterior">Migrada</span>}</td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" iconLeft="info" onClick={onFicha}>
            Ficha
          </Button>
          {rutaExpediente && (
            <Button size="sm" variant="ghost" iconLeft="folder_open" onClick={() => onExpediente(rutaExpediente)}>
              Expediente
            </Button>
          )}
        </div>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Ficha
// ---------------------------------------------------------------------------

function Dato({ label, valor }: { label: string; valor: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-900 dark:text-slate-100">{valor === null || valor === undefined || valor === '' ? <Vacio /> : valor}</dd>
    </div>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{titulo}</h3>
      {children}
    </section>
  )
}

const grilla = 'grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3'
const num = (n: number | null | undefined, unidad = '') => (n === null || n === undefined ? null : `${n.toLocaleString('es-AR')}${unidad}`)

function ModalFicha({ id, onClose }: { id: string | null; onClose: () => void }) {
  const ficha = useFichaConcesion(id)
  const navigate = useNavigate()
  const c = ficha.data
  const rutaExpediente = c?.expediente && RUTA_EXPEDIENTE[c.expediente.tipoTramite]?.(c.expediente.id)
  return (
    <Modal
      open={id !== null}
      onClose={onClose}
      size="xl"
      icon="water_drop"
      title={c ? `Concesión ${c.numero ?? 'sin número'}` : 'Ficha de la concesión'}
      description={c?.expediente ? `Expediente ${c.expediente.numero}` : c ? 'Migrada del padrón anterior' : undefined}
      footer={
        <>
          {rutaExpediente && (
            <Button variant="secondary" iconLeft="folder_open" onClick={() => navigate(rutaExpediente)}>
              Ver expediente
            </Button>
          )}
          <Button onClick={onClose}>Cerrar</Button>
        </>
      }
    >
      {ficha.isPending && id !== null && <LoadingState className="py-10" />}
      {ficha.isError && <ErrorState error={ficha.error} onRetry={() => void ficha.refetch()} reintentando={ficha.isFetching} />}
      {c && <ContenidoFicha c={c} />}
    </Modal>
  )
}

function ContenidoFicha({ c }: { c: FichaConcesion }) {
  // Nombres de las listas, del mismo catálogo que los filtros (ya está en caché).
  const { data: o } = useOpcionesFiltros()
  const nombreDe = (items: { codigo: string; nombre: string }[] | undefined, codigo: string | number | null | undefined) =>
    codigo === null || codigo === undefined ? null : (items?.find((i) => i.codigo === String(codigo))?.nombre ?? String(codigo))
  return (
    <div className="flex flex-col gap-6">
      {c.datosSensiblesOcultos && <Alert tone="info">Documentos, contactos, domicilios y montos están ocultos: su usuario no tiene permiso para ver datos sensibles.</Alert>}

      <Seccion titulo="Concesión">
        <dl className={grilla}>
          <Dato label="Estado" valor={<EtiquetaEstado nombre={c.estadoNombre} color={c.estadoColor} />} />
          <Dato label="Situación legal" valor={c.situacionLegal} />          <Dato label="Resolución" valor={c.resolucion && `${c.resolucion.numero}/${c.resolucion.anio}${c.resolucion.fecha ? ` del ${formatearFecha(c.resolucion.fecha)}` : ''}`} />
          <Dato label="Fecha de otorgamiento" valor={c.fechaOtorgamiento ? formatearFecha(c.fechaOtorgamiento) : c.anioOtorgamiento} />
          <Dato label="Observaciones" valor={c.observaciones} />
        </dl>
      </Seccion>

      <Seccion titulo={`Titulares (${c.titulares.length})`}>
        {c.titulares.length ? (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
            {c.titulares.map((t) => (
              <li key={t.personaId} className="grid gap-2 px-4 py-3 sm:grid-cols-3">
                <span className="font-medium">{t.nombre}</span>
                <span className="text-sm tabular-nums">
                  {t.tipoDocumento} {t.documento}
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">{[t.email, t.telefono].filter(Boolean).join(' · ') || '—'}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Vacio />
        )}
        {c.domicilios.map((d, i) => (
          <p key={i} className="text-sm text-slate-600 dark:text-slate-300">
            Domicilio legal: {[d.calle, d.numero].filter(Boolean).join(' ')} — {d.localidad}, {d.departamento} (Distrito {d.distrito})
          </p>
        ))}
      </Seccion>

      <Seccion titulo="Ubicación e inmueble">
        <dl className={grilla}>
          <Dato label="Departamento" valor={c.ubicacion.departamento} />
          <Dato label="Localidad" valor={c.ubicacion.localidad} />
          <Dato label="Distrito" valor={c.ubicacion.distrito} />
          <Dato label="Cuenca" valor={c.ubicacion.cuenca} />
          <Dato label="Padrón" valor={c.inmueble?.padron} />
          <Dato label="Matrícula catastral" valor={c.inmueble?.matricula} />
          <Dato label="Circunscripción / Sección / Parcela" valor={c.inmueble && [c.inmueble.circunscripcion, c.inmueble.seccion, c.inmueble.parcela].filter(Boolean).join(' / ')} />
          <Dato label="Lámina / Orden" valor={c.inmueble && [c.inmueble.lamina, c.inmueble.orden].filter(Boolean).join(' / ')} />
          <Dato
            label="Dominio (libro / folio / año / matrícula / serie)"
            valor={c.inmueble && [c.inmueble.libro, c.inmueble.folio, c.inmueble.anioDominio, c.inmueble.matriculaDominio, c.inmueble.serie].filter(Boolean).join(' / ')}
          />
          <Dato label="Polígono" valor={c.poligono ? `${num(c.poligono.superficieHa, ' ha')} · perímetro ${num(c.poligono.perimetroM, ' m')}` : 'Sin polígono cargado'} />
        </dl>
      </Seccion>

      <Seccion titulo="Usos y caudal">
        {c.usos.length ? (
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-1 pr-3">Uso</th>
                <th className="py-1 pr-3">Magnitud</th>
                <th className="py-1 pr-3">Módulo</th>
                <th className="py-1 text-right">Caudal</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {c.usos.map((u) => (
                <tr key={u.nombre}>
                  <td className="py-1 pr-3">{u.nombre}</td>
                  <td className="py-1 pr-3">
                    {num(u.magnitud)} {u.unidad}
                  </td>
                  <td className="py-1 pr-3">
                    {num(u.dotacion)} l/s por {u.unidad}
                  </td>
                  <td className="py-1 text-right">{num(u.caudal, ' l/s')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Vacio />
        )}
        <dl className={grilla}>
          <Dato label="Caudal asignado" valor={num(c.condicion?.caudalAsignado, ' l/s')} />
          <Dato label="Carácter" valor={nombreDe(o?.caracteres, c.condicion?.caracter)} />
          <Dato label="Código de servicio" valor={nombreDe(o?.codigosServicio, c.condicion?.codigoServicio)} />
          <Dato label="Desagüe (X / Y POSGAR)" valor={c.desague && c.desague.x !== null ? `${c.desague.x} / ${c.desague.y}` : null} />
          <Dato label="Punto de entrega" valor={c.puntoEntrega && `${c.puntoEntrega.latitud}, ${c.puntoEntrega.longitud}${c.puntoEntrega.referencia ? ` (${c.puntoEntrega.referencia})` : ''}`} />
        </dl>
      </Seccion>

      <Seccion titulo="Suministro">
        <dl className={grilla}>
          <Dato label="Fuentes" valor={c.suministro?.fuentes.join(', ')} />
          <Dato label="Sistema de distribución" valor={c.suministro?.sistemaDistribucion} />
          <Dato label="Canales" valor={c.suministro?.canales.join(' → ')} />
          <Dato label="Desagüe" valor={c.suministro?.desague} />
          <Dato label="Observación" valor={c.suministro?.observacion} />
        </dl>
      </Seccion>

      <Seccion titulo="Deuda pendiente">
        {c.deudas.length ? (
          <ul className="flex flex-col gap-1 text-sm">
            {c.deudas.map((d) => (
              <li key={d.id}>
                <span className="font-medium">{d.titular}</span>: {d.detalle ?? 'Deuda registrada por Recaudación'}
                {d.monto !== null && ` — $ ${num(d.monto)}`} <span className="text-slate-500">({formatearFecha(d.registradaEn)})</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">No tiene deuda pendiente registrada.</p>
        )}
      </Seccion>
    </div>
  )
}
