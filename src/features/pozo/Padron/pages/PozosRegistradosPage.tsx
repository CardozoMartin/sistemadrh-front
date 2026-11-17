import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Input, Select, toOptions } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { IconButton } from '@/components/ui/IconButton'
import { PageHeader } from '@/components/ui/PageHeader'
import { ROUTES } from '@/config/routes'
import { cn } from '@/lib/cn'
import { MODO_DEMO } from '@/services/demo/modo'
import { ESTADO_POZO, formatoFecha, formatoNumero } from '../../BajaDePozo/estilos'
import { usePadronPozos } from '../api'
import { MarcaOrigen } from '../components/MarcaOrigen'
import { exportarPozosCsv } from '../exportar'
import { ORIGEN_POZO } from '../estilos'
import {
  chipsDe,
  CLAVES_DEL_CHIP,
  CLAVES_FILTRO,
  OPCIONES_BAJA,
  OPCIONES_CAMPO_FECHA,
  OPCIONES_CIRCUITO,
  OPCIONES_ESTADO,
  OPCIONES_MONITOREOS,
  OPCIONES_SI_NO,
  VISTAS_RAPIDAS,
  type ClaveFiltro,
  type Filtros,
} from '../filtros'
import type { FiltrosPozos, OrigenPozo, PozoEnPadron } from '../types'

const SOLAPAS: { origen: OrigenPozo | null; texto: string }[] = [
  { origen: 'OFICIO', texto: 'Alta de oficio' },
  { origen: 'AUTORIZACION', texto: 'Con autorización' },
  { origen: 'MIGRACION', texto: 'Padrón anterior' },
  { origen: null, texto: 'Todos' },
]

/** Espera a que el usuario deje de escribir para buscar. */
function useDemorado<T>(valor: T, ms = 300) {
  const [demorado, setDemorado] = useState(valor)
  useEffect(() => {
    const t = setTimeout(() => setDemorado(valor), ms)
    return () => clearTimeout(t)
  }, [valor, ms])
  return demorado
}

/** Los filtros que están en la URL (?estado=…&baja=…). */
const leerFiltros = (p: URLSearchParams): Filtros => Object.fromEntries(CLAVES_FILTRO.flatMap((k) => (p.get(k) ? [[k, p.get(k)!]] : [])))

function Campo({ label, ayuda, children }: { label: string; ayuda?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
      {label}
      {children}
      {ayuda && <span className="text-xs font-normal text-slate-400">{ayuda}</span>}
    </label>
  )
}

function Grupo({ titulo, icono, children }: { titulo: string; icono: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 flex items-center gap-1.5 text-xs font-bold tracking-wide text-slate-500 uppercase">
        <Icon name={icono} className="text-[16px]!" /> {titulo}
      </legend>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </fieldset>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-slate-400 uppercase">{etiqueta}</dt>
      <dd className="text-sm text-slate-800 dark:text-slate-100">{valor || '—'}</dd>
    </div>
  )
}

const ORIGEN_BAJA = { DE_OFICIO: 'Baja de oficio', A_SOLICITUD: 'Baja a solicitud' } as const
const BAJA_ABIERTA = ['EN_TRAMITE', 'EN_ESPERA', 'OBSERVADA']

/** Marca de la baja en la tabla: cómo se pidió y si ya quedó firme o sigue en trámite. */
function MarcaBaja({ baja }: { baja: PozoEnPadron['baja'] }) {
  if (!baja) return <span className="text-slate-400">—</span>
  const abierta = BAJA_ABIERTA.includes(baja.estado)
  return (
    <div>
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
          abierta ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' : baja.origen === 'DE_OFICIO' ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
        )}
      >
        <Icon name={abierta ? 'pending_actions' : baja.origen === 'DE_OFICIO' ? 'gavel' : 'description'} className="text-[14px]!" />
        {abierta ? 'Baja en trámite' : ORIGEN_BAJA[baja.origen]}
      </span>
      <p className="mt-1 text-xs text-slate-500">{baja.fechaBaja ? formatoFecha(baja.fechaBaja) : `Iniciada ${formatoFecha(baja.iniciada)}`}</p>
    </div>
  )
}

/** Detalle de la fila: el registro de oficio (o lo que se sabe del migrado), la baja y las coordenadas. */
function Detalle({ p }: { p: PozoEnPadron }) {
  const r = p.registro
  const b = p.baja
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
      {r && (
        <>
          <Dato etiqueta="Registro de oficio" valor={r.expediente} />
          <Dato etiqueta="Circuito" valor={r.circuito.estado === 'FINALIZADO' ? 'Finalizado' : r.circuito.estado === 'RECHAZADO' ? 'Rechazado' : `${r.circuito.oficinaNombre} · ${r.circuito.etapaNombre}`} />
          <Dato etiqueta="Motivo" valor={r.motivo} />
          <Dato etiqueta="Fecha de ingreso" valor={formatoFecha(r.fechaIngreso)} />
          <Dato etiqueta="Registró" valor={`${r.registradoPor} · ${formatoFecha(r.registradoEn)}`} />
          <Dato etiqueta="Causante" valor={r.causante} />
          <Dato etiqueta="CUIT / DNI" valor={r.documento} />
          <Dato etiqueta="Asunto" valor={r.asunto} />
          <Dato etiqueta="Monitoreos" valor={`${r.monitoreos.hidraulicos} hidráulico${r.monitoreos.hidraulicos === 1 ? '' : 's'} · ${r.monitoreos.quimicos} químico${r.monitoreos.quimicos === 1 ? '' : 's'}`} />
        </>
      )}
      <Dato etiqueta="Concesión" valor={p.concesion?.numero ?? (b?.concesionAnterior ? `${b.concesionAnterior} (antes de la baja)` : null)} />
      <Dato etiqueta="Expediente de la concesión" valor={p.concesion?.expediente} />
      <Dato etiqueta="Titular" valor={p.concesion?.titular} />
      <Dato etiqueta="CUIT / DNI del titular" valor={p.concesion?.documento} />
      {b && (
        <>
          <Dato etiqueta="Baja" valor={`${ORIGEN_BAJA[b.origen]}${BAJA_ABIERTA.includes(b.estado) ? ' (en trámite)' : ''}`} />
          <Dato etiqueta="Fecha de baja" valor={b.fechaBaja ? formatoFecha(b.fechaBaja) : `Pendiente · iniciada ${formatoFecha(b.iniciada)}`} />
          <Dato etiqueta="Expediente de la baja" valor={b.expediente ?? (b.origen === 'DE_OFICIO' ? 'Sin expediente (de oficio)' : null)} />
          <Dato etiqueta="Solicitante" valor={b.solicitante} />
          <div className="sm:col-span-2 lg:col-span-4">
            <Dato etiqueta="Motivo de la baja" valor={b.motivo} />
          </div>
        </>
      )}
      <Dato etiqueta="Profundidad" valor={p.profundidadM !== null ? `${formatoNumero(p.profundidadM)} m` : null} />
      <Dato etiqueta="Caudal" valor={p.caudalLps !== null ? `${formatoNumero(p.caudalLps, 2)} l/s` : null} />
      <Dato etiqueta="POSGAR 07 faja 3" valor={`X ${formatoNumero(p.coordX, 2)} · Y ${formatoNumero(p.coordY, 2)}${r?.sistemaCoordenada === 'POSGAR_FAJA3' ? ' (cargada)' : ''}`} />
      <Dato etiqueta="Latitud / longitud" valor={`${p.latitud.toFixed(6)}, ${p.longitud.toFixed(6)}${r?.sistemaCoordenada === 'WGS84' ? ' (cargada)' : ''}`} />
      <Dato etiqueta="Jurisdicción DRH" valor={p.jurisdiccionDrh ? 'Sí' : 'No'} />
    </dl>
  )
}

/**
 * Consulta de pozos: el padrón con todos los filtros. Las solapas separan cómo entró el pozo
 * (alta de oficio, con autorización, padrón anterior) y los filtros avanzados se combinan con
 * ellas: concesión, expediente, cliente (titular, causante o solicitante, por nombre o CUIT/DNI),
 * baja (de oficio, a solicitud, en trámite), estado, ubicación, fechas de alta, baja o monitoreo,
 * circuito del registro, monitoreos, profundidad y caudal. Todo queda en la URL, así una consulta
 * se puede compartir o guardar como favorito. El resultado se puede exportar a Excel (CSV).
 * PROTOTIPO: funciona con el backend emulado (npm run demo).
 */
export default function PozosRegistradosPage() {
  const [parametros, setParametros] = useSearchParams()
  const origenUrl = parametros.get('origen')
  const origen: OrigenPozo | null = origenUrl === 'TODOS' ? null : ((origenUrl as OrigenPozo | null) ?? 'OFICIO')

  // Lo que se está escribiendo; se aplica (URL y consulta) cuando el usuario deja de escribir.
  const [borrador, setBorrador] = useState<Filtros>(() => leerFiltros(parametros))
  const aplicados = useDemorado(borrador)
  const [avanzados, setAvanzados] = useState(() => Object.keys(leerFiltros(parametros)).some((k) => k !== 'q'))
  const filtros: FiltrosPozos = useMemo(() => ({ ...aplicados, origen: origen ?? undefined }) as FiltrosPozos, [aplicados, origen])
  const padron = usePadronPozos(filtros)
  const [abierto, setAbierto] = useState<string | null>(null)

  useEffect(() => {
    setParametros(
      (p) => {
        const n = new URLSearchParams()
        if (p.get('origen')) n.set('origen', p.get('origen')!)
        for (const k of CLAVES_FILTRO) if (aplicados[k]) n.set(k, aplicados[k]!)
        return n
      },
      { replace: true },
    )
  }, [aplicados, setParametros])

  const editar = (clave: ClaveFiltro, valor: string) =>
    setBorrador((f) => {
      const n = { ...f, [clave]: valor || undefined }
      // La localidad depende del departamento.
      if (clave === 'departamento') delete n.localidad
      return n
    })
  const quitar = (clave: ClaveFiltro) =>
    setBorrador((f) => {
      const n = { ...f }
      for (const k of CLAVES_DEL_CHIP[clave] ?? [clave]) delete n[k]
      return n
    })
  const limpiar = () => setBorrador({})
  const elegir = (o: OrigenPozo | null) =>
    setParametros((p) => {
      const n = new URLSearchParams(p)
      n.set('origen', o ?? 'TODOS')
      return n
    })
  /** Una vista rápida muestra todos los orígenes: las bajas de oficio pueden ser de cualquier pozo. */
  function vistaRapida(v: Filtros) {
    setBorrador((f) => ({ ...f, ...v }))
    elegir(null)
  }

  const chips = chipsDe(aplicados)
  const opciones = padron.data?.opciones
  const totales = padron.data?.totales

  function tabla() {
    if (padron.isPending) return <LoadingState mensaje="Cargando el padrón de pozos…" className="py-10" />
    if (padron.isError) return <ErrorState error={padron.error} onRetry={() => void padron.refetch()} className="py-10" />
    const { pozos } = padron.data
    if (!pozos.length) {
      return (
        <EmptyState
          icon={chips.length ? 'search_off' : 'water_pump'}
          titulo={chips.length ? 'Ningún pozo cumple los filtros' : origen === 'OFICIO' ? 'No hay pozos dados de alta de oficio' : 'No hay pozos con este origen'}
          descripcion={
            chips.length
              ? totales?.TODOS
                ? `Hay ${totales.TODOS} en otras solapas. Pruebe con «Todos» o quite algún filtro.`
                : 'Quite algún filtro o use «Limpiar filtros».'
              : origen === 'AUTORIZACION'
                ? 'Aparecen cuando se registre un pozo con autorización de perforación (trámite pendiente).'
                : undefined
          }
          className="py-10"
        />
      )
    }
    return (
      <div className={cn('overflow-x-auto', padron.isFetching && 'opacity-60')}>
        <table className="w-full min-w-245 text-left text-sm">
          <thead className="border-b border-slate-200 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:border-slate-700 dark:text-slate-400">
            <tr>
              <th className="w-10" />
              <th className="px-3 py-3">Pozo</th>
              <th className="px-3 py-3">Alta</th>
              <th className="px-3 py-3">Expediente / concesión</th>
              <th className="px-3 py-3">Cliente</th>
              <th className="px-3 py-3">Ubicación</th>
              <th className="px-3 py-3">Estado</th>
              <th className="px-3 py-3">Baja</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {pozos.map((p) => {
              const desplegado = abierto === p.id
              const concesion = p.concesion?.numero ?? p.baja?.concesionAnterior
              return (
                <Fragment key={p.id}>
                  <tr className={cn('align-top', p.origen === 'OFICIO' && 'bg-amber-50/50 dark:bg-amber-500/5')}>
                    <td className="px-2 py-2">
                      <IconButton icon={desplegado ? 'expand_less' : 'expand_more'} label={desplegado ? 'Ocultar detalle' : 'Ver detalle'} onClick={() => setAbierto(desplegado ? null : p.id)} />
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-slate-900 dark:text-white">{p.idInterno}</p>
                      {p.alias && <p className="text-xs text-slate-500">{p.alias}</p>}
                    </td>
                    <td className="px-3 py-3">
                      <MarcaOrigen origen={p.origen} />
                      {p.fechaAlta && <p className="mt-1 text-xs text-slate-500">{formatoFecha(p.fechaAlta)}</p>}
                      {p.registro && <p className="text-xs text-slate-500">{p.registro.motivo.charAt(0) + p.registro.motivo.slice(1).toLowerCase()}</p>}
                    </td>
                    <td className="px-3 py-3">
                      {(p.registro?.expediente ?? p.concesion?.expediente) && <p className="font-medium">{p.registro?.expediente ?? p.concesion?.expediente}</p>}
                      <p className={cn((p.registro || p.concesion?.expediente) && 'text-xs text-slate-500')}>
                        {concesion ? `Concesión ${concesion}${!p.concesion ? ' (antes de la baja)' : ''}` : 'Sin concesión'}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <p>{p.concesion?.titular ?? p.registro?.causante ?? '—'}</p>
                      {(p.concesion?.documento ?? p.registro?.documento) && <p className="text-xs text-slate-500">{p.concesion?.documento ?? p.registro?.documento}</p>}
                    </td>
                    <td className="px-3 py-3">
                      {[p.localidad, p.departamento].filter(Boolean).join(', ') || '—'}
                      {p.distrito && <p className="text-xs text-slate-500">Distrito {p.distrito}</p>}
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap', ESTADO_POZO[p.estado].color)}>{ESTADO_POZO[p.estado].texto}</span>
                    </td>
                    <td className="px-3 py-3">
                      <MarcaBaja baja={p.baja} />
                    </td>
                  </tr>
                  {desplegado && (
                    <tr className="bg-slate-50/70 dark:bg-slate-800/40">
                      <td />
                      <td colSpan={7} className="px-3 py-4">
                        <Detalle p={p} />
                        <div className="mt-3 flex flex-wrap gap-4">
                          <Link to={ROUTES.visor} className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                            <Icon name="map" className="text-[18px]!" /> Ver en el visor
                          </Link>
                          <Link to={ROUTES.pozo.monitoreos(p.id)} className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                            <Icon name="monitoring" className="text-[18px]!" /> Monitoreos
                          </Link>
                          {p.registro && (
                            <Link to={ROUTES.pozo.registroExpediente(p.registro.expedienteId)} className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                              <Icon name="folder_open" className="text-[18px]!" /> Ver el expediente
                            </Link>
                          )}
                          <Link to={ROUTES.pozo.bajaPozo(p.id)} className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                            <Icon name="water_pump" className="text-[18px]!" /> Ficha del pozo
                          </Link>
                        </div>
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

  const f = borrador
  return (
    <>
      <PageHeader
        title="Consulta de pozos"
        description="Padrón de pozos con todos los filtros: cómo se dio de alta, bajas de oficio o a solicitud, concesión, expediente, cliente, ubicación y fechas."
        actions={
          <Link to={ROUTES.pozo.registro}>
            <Button iconLeft="add">Registrar pozo</Button>
          </Link>
        }
      />
      {!MODO_DEMO && (
        <div className="mb-4">
          <Alert tone="info">Pantalla de prototipo: la consulta de pozos todavía no está en el backend. Para probarla, use el modo demo (npm run demo).</Alert>
        </div>
      )}

      <Card className="mb-4">
        <div className="flex flex-col gap-4 p-4 sm:p-6">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <Input
              icon="search"
              value={f.q ?? ''}
              onChange={(e) => editar('q', e.target.value)}
              placeholder="Buscar en todo: ID, concesión, expediente, titular, CUIT, localidad…"
              aria-label="Buscar pozos"
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" iconLeft="tune" onClick={() => setAvanzados(!avanzados)} aria-expanded={avanzados}>
                Filtros{chips.length ? ` (${chips.length})` : ''}
              </Button>
              <Button variant="secondary" iconLeft="download" onClick={() => padron.data && exportarPozosCsv(padron.data.pozos)} disabled={!padron.data?.pozos.length}>
                Exportar
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Vistas rápidas</span>
            {VISTAS_RAPIDAS.map((v) => (
              <button
                key={v.texto}
                type="button"
                onClick={() => vistaRapida(v.filtros)}
                className="flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
              >
                <Icon name={v.icono} className="text-[16px]!" /> {v.texto}
              </button>
            ))}
          </div>

          {avanzados && (
            <div className="flex flex-col gap-6 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <Grupo titulo="Concesión, expediente y cliente" icono="badge">
                <Campo label="N° de concesión" ayuda="También la que tenía antes de la baja.">
                  <Input placeholder="Ej. 906 o D-0001" value={f.concesion ?? ''} onChange={(e) => editar('concesion', e.target.value)} />
                </Campo>
                <Campo label="¿Tiene concesión?">
                  <Select options={OPCIONES_SI_NO} placeholder="Todos" value={f.conConcesion ?? ''} onChange={(e) => editar('conConcesion', e.target.value)} />
                </Campo>
                <Campo label="Expediente" ayuda="De la concesión, del registro de oficio o de la baja.">
                  <Input placeholder="Ej. 123/2026 u OF-0001" value={f.expediente ?? ''} onChange={(e) => editar('expediente', e.target.value)} />
                </Campo>
                <Campo label="Cliente" ayuda="Titular, causante o solicitante: nombre o CUIT/DNI.">
                  <Input placeholder="Ej. Pérez o 20-12345678-9" value={f.cliente ?? ''} onChange={(e) => editar('cliente', e.target.value)} />
                </Campo>
              </Grupo>

              <Grupo titulo="Alta, baja y estado" icono="swap_vert">
                <Campo label="Baja">
                  <Select options={OPCIONES_BAJA} placeholder="Todas" value={f.baja ?? ''} onChange={(e) => editar('baja', e.target.value)} />
                </Campo>
                <Campo label="Estado del pozo">
                  <Select options={OPCIONES_ESTADO} placeholder="Todos" value={f.estado ?? ''} onChange={(e) => editar('estado', e.target.value)} />
                </Campo>
                <Campo label="Motivo del alta de oficio">
                  <Select options={toOptions(opciones?.motivos ?? [])} placeholder="Todos" value={f.motivo ?? ''} onChange={(e) => editar('motivo', e.target.value)} />
                </Campo>
                <Campo label="Circuito del registro de oficio">
                  <Select options={OPCIONES_CIRCUITO} placeholder="Todos" value={f.circuito ?? ''} onChange={(e) => editar('circuito', e.target.value)} />
                </Campo>
              </Grupo>

              <Grupo titulo="Fechas" icono="calendar_month">
                <Campo label="Buscar por">
                  <Select options={OPCIONES_CAMPO_FECHA} value={f.campoFecha ?? 'ALTA'} onChange={(e) => editar('campoFecha', e.target.value === 'ALTA' ? '' : e.target.value)} />
                </Campo>
                <Campo label="Desde">
                  <Input type="date" value={f.desde ?? ''} max={f.hasta} onChange={(e) => editar('desde', e.target.value)} />
                </Campo>
                <Campo label="Hasta">
                  <Input type="date" value={f.hasta ?? ''} min={f.desde} onChange={(e) => editar('hasta', e.target.value)} />
                </Campo>
                <Campo label="Monitoreos">
                  <Select options={OPCIONES_MONITOREOS} placeholder="Todos" value={f.monitoreos ?? ''} onChange={(e) => editar('monitoreos', e.target.value)} />
                </Campo>
              </Grupo>

              <Grupo titulo="Ubicación" icono="location_on">
                <Campo label="Departamento">
                  <Select options={toOptions(opciones?.departamentos ?? [])} placeholder="Todos" value={f.departamento ?? ''} onChange={(e) => editar('departamento', e.target.value)} />
                </Campo>
                <Campo label="Localidad">
                  <Select options={toOptions(opciones?.localidades ?? [])} placeholder="Todas" value={f.localidad ?? ''} onChange={(e) => editar('localidad', e.target.value)} />
                </Campo>
                <Campo label="Distrito de riego">
                  <Select options={(opciones?.distritos ?? []).map((d) => ({ value: d, label: `Distrito ${d}` }))} placeholder="Todos" value={f.distrito ?? ''} onChange={(e) => editar('distrito', e.target.value)} />
                </Campo>
                <Campo label="Jurisdicción DRH">
                  <Select options={OPCIONES_SI_NO} placeholder="Todos" value={f.jurisdiccion ?? ''} onChange={(e) => editar('jurisdiccion', e.target.value)} />
                </Campo>
              </Grupo>

              <Grupo titulo="Datos técnicos" icono="straighten">
                <Campo label="Profundidad mínima (m)">
                  <Input inputMode="decimal" value={f.profundidadMin ?? ''} onChange={(e) => editar('profundidadMin', e.target.value)} />
                </Campo>
                <Campo label="Profundidad máxima (m)">
                  <Input inputMode="decimal" value={f.profundidadMax ?? ''} onChange={(e) => editar('profundidadMax', e.target.value)} />
                </Campo>
                <Campo label="Caudal mínimo (l/s)">
                  <Input inputMode="decimal" value={f.caudalMin ?? ''} onChange={(e) => editar('caudalMin', e.target.value)} />
                </Campo>
                <Campo label="Caudal máximo (l/s)">
                  <Input inputMode="decimal" value={f.caudalMax ?? ''} onChange={(e) => editar('caudalMax', e.target.value)} />
                </Campo>
              </Grupo>
            </div>
          )}

          {chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {chips.map((c) => (
                <span key={c.clave} className="flex items-center gap-1 rounded-full bg-primary/10 py-1 pr-1 pl-3 text-xs font-semibold text-primary">
                  {c.texto}
                  <button type="button" onClick={() => quitar(c.clave)} aria-label={`Quitar filtro ${c.texto}`} className="flex rounded-full p-0.5 hover:bg-primary/15">
                    <Icon name="close" className="text-[14px]!" />
                  </button>
                </span>
              ))}
              <button type="button" onClick={limpiar} className="text-xs font-semibold text-slate-500 hover:text-red-600">
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 dark:border-slate-700">
          <div role="tablist" className="flex gap-1 overflow-x-auto">
            {SOLAPAS.map((s) => {
              const activa = s.origen === origen
              const n = totales?.[s.origen ?? 'TODOS']
              return (
                <button
                  key={s.texto}
                  type="button"
                  role="tab"
                  aria-selected={activa}
                  onClick={() => elegir(s.origen)}
                  className={cn('flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-semibold', activa ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200')}
                >
                  {s.origen && <Icon name={ORIGEN_POZO[s.origen].icono} className="text-[18px]!" />}
                  {s.texto}
                  {n !== undefined && <span className={cn('rounded-full px-1.5 text-xs', activa ? 'bg-primary/10' : 'bg-slate-100 dark:bg-slate-800')}>{n}</span>}
                </button>
              )
            })}
          </div>
          {padron.data && (
            <p className="py-2 text-sm text-slate-500">
              {padron.data.pozos.length} pozo{padron.data.pozos.length === 1 ? '' : 's'}
            </p>
          )}
        </div>
        {tabla()}
      </Card>
    </>
  )
}
