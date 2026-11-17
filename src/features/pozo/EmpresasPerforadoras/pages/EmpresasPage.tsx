import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Input } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatearFecha } from '@/config/expedientes'
import { ROUTES } from '@/config/routes'
import { useNotificaciones } from '@/features/notificaciones/context'
import { cn } from '@/lib/cn'
import { DialogoMotivo } from '../components/DialogoMotivo'
import { EstadoEmpresaBadge } from '../components/EstadoEmpresaBadge'
import { useBajaEmpresa, useEmpresas, useReactivarEmpresa } from '../hooks'
import { coincide, cuitConFormato, motivoNoHabilitada, NOMBRE_OFICINA, nombreEmpresa } from '../reglas'
import type { EmpresaPerforadora, EstadoEmpresa } from '../types'

type Filtro = EstadoEmpresa | 'TODAS'

const FILTROS: { valor: Filtro; label: string }[] = [
  { valor: 'ACTIVA', label: 'Activas' },
  { valor: 'EN_TRAMITE', label: 'En trámite' },
  { valor: 'OBSERVADA', label: 'Observadas' },
  { valor: 'BAJA', label: 'De baja' },
  { valor: 'RECHAZADA', label: 'Rechazadas' },
  { valor: 'TODAS', label: 'Todas' },
]

const iniciales = (nombre: string) =>
  nombre
    .replace(/[,.]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || '?'

function Estadistica({ valor, label, icono, color }: { valor: number; label: string; icono: string; color: string }) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <span className={cn('flex size-11 items-center justify-center rounded-xl', color)}>
        <Icon name={icono} />
      </span>
      <div>
        <p className="text-2xl font-bold text-slate-900 tabular-nums dark:text-white">{valor}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      </div>
    </Card>
  )
}

/**
 * Padrón de empresas perforadoras (prototipo GestionEmpresas.html): búsqueda, filtros por
 * estado y, sobre cada empresa, modificar, dar de baja o reactivar.
 */
export default function EmpresasPage() {
  const navigate = useNavigate()
  const { mostrarAviso } = useNotificaciones()
  const empresas = useEmpresas()
  const baja = useBajaEmpresa()
  const reactivar = useReactivarEmpresa()
  const [texto, setTexto] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('ACTIVA')
  const [aDarDeBaja, setADarDeBaja] = useState<EmpresaPerforadora | null>(null)
  const [aReactivar, setAReactivar] = useState<EmpresaPerforadora | null>(null)

  const todas = useMemo(() => empresas.data ?? [], [empresas.data])
  const cuenta = (estado: EstadoEmpresa) => todas.filter((e) => e.estado === estado).length
  const lista = useMemo(() => todas.filter((e) => (filtro === 'TODAS' || e.estado === filtro) && coincide(e, texto)), [todas, filtro, texto])

  function contenido() {
    if (empresas.isPending) return <LoadingState mensaje="Cargando el padrón de empresas…" className="py-12" />
    if (empresas.isError) return <ErrorState error={empresas.error} onRetry={() => void empresas.refetch()} reintentando={empresas.isFetching} className="m-4" />
    if (lista.length === 0) {
      return (
        <EmptyState
          icon="domain_disabled"
          titulo={texto ? 'Ninguna empresa coincide con la búsqueda' : todas.length ? 'No hay empresas en este estado' : 'Todavía no hay empresas cargadas'}
          descripcion={todas.length ? 'Pruebe con otro filtro o texto.' : 'Use «Nueva empresa» para registrar la primera.'}
          className="m-4"
        />
      )
    }
    return (
      <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
        {lista.map((e) => {
          const nombre = nombreEmpresa(e)
          const dir = [e.direccionTecnica.nombre, e.direccionTecnica.apellido].filter(Boolean).join(' ')
          const activas = e.maquinas.filter((m) => m.activa).length
          // El aviso de RN-10 solo para las habilitadas sin máquinas válidas (el resto ya lo dice su estado).
          const noHabilitada = e.estado === 'ACTIVA' ? motivoNoHabilitada(e) : null
          return (
            <li key={e.id} className={cn('flex flex-wrap items-start gap-4 px-6 py-4', e.estado === 'BAJA' && 'bg-slate-50/60 dark:bg-slate-800/30')}>
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{iniciales(nombre)}</span>
              <div className="min-w-60 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={ROUTES.pozo.empresa(e.id)} className="font-bold text-slate-900 hover:text-primary dark:text-white">
                    {nombre}
                  </Link>
                  <EstadoEmpresaBadge empresa={e} />
                </div>
                <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                  <span>CUIT {cuitConFormato(e.cuit)}</span>
                  {e.localidad && <span>{e.localidad}</span>}
                  {e.telefono && <span>{e.telefono}</span>}
                  {dir && <span>Dir. téc.: {dir}</span>}
                  <span>
                    {activas} máquina{activas === 1 ? '' : 's'} activa{activas === 1 ? '' : 's'}
                  </span>
                </p>
                {noHabilitada && (
                  <p className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                    <Icon name="warning" className="text-sm!" /> No puede solicitar autorizaciones: {noHabilitada}
                  </p>
                )}
                {e.modificado && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-sky-700 dark:text-sky-400">
                    <Icon name="edit" className="text-sm!" /> Última actualización el {formatearFecha(e.modificado)}
                    {e.modificadoPor && ` (${e.modificadoPor})`}
                  </p>
                )}
                {e.baja && (
                  <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                    <strong>Baja del {formatearFecha(e.baja.fecha)}</strong> — {e.baja.motivo} ({e.baja.usuario})
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {e.estado === 'OBSERVADA' ? (
                  <Button size="sm" iconLeft="edit_note" onClick={() => navigate(ROUTES.pozo.empresa(e.id))}>
                    Corregir y reenviar
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" iconLeft={e.estado === 'ACTIVA' || e.estado === 'BAJA' ? 'edit' : 'visibility'} onClick={() => navigate(ROUTES.pozo.empresa(e.id))}>
                    {e.estado === 'ACTIVA' || e.estado === 'BAJA' ? 'Ver / modificar' : 'Ver ficha'}
                  </Button>
                )}
                {e.estado === 'EN_TRAMITE' && e.tramite && (
                  <Button size="sm" variant="secondary" iconLeft="fact_check" onClick={() => navigate(ROUTES.pozo.empresaRevision(e.id))}>
                    Revisión de {NOMBRE_OFICINA[e.tramite.oficina]}
                  </Button>
                )}
                {e.estado === 'BAJA' && (
                  <Button size="sm" variant="secondary" iconLeft="restart_alt" onClick={() => setAReactivar(e)}>
                    Reactivar
                  </Button>
                )}
                {e.estado === 'ACTIVA' && (
                  <Button size="sm" variant="danger" iconLeft="domain_disabled" onClick={() => setADarDeBaja(e)}>
                    Dar de baja
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <>
      <PageHeader
        title="Empresas perforadoras"
        description="Registro de las empresas perforadoras. El alta pasa por Jurídico y Secretaría General; solo las habilitadas por resolución y con máquinas registradas pueden tomar trabajos nuevos."
        actions={
          <Button size="sm" iconLeft="add_business" onClick={() => navigate(ROUTES.pozo.empresaNueva)}>
            Nueva empresa
          </Button>
        }
      />

      <div className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Estadistica valor={todas.length} label="Empresas registradas" icono="factory" color="bg-primary/10 text-primary" />
          <Estadistica valor={cuenta('ACTIVA')} label="Activas / habilitadas" icono="verified" color="bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300" />
          <Estadistica valor={cuenta('EN_TRAMITE')} label="En trámite (Jurídico / Sec. Gral.)" icono="pending_actions" color="bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" />
          <Estadistica valor={cuenta('OBSERVADA')} label="Observadas" icono="undo" color="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" />
          <Estadistica valor={cuenta('BAJA')} label="Dadas de baja" icono="domain_disabled" color="bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300" />
        </div>

        <Card>
          <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-4 lg:flex-row lg:items-center lg:justify-between dark:border-slate-700">
            <div className="w-full lg:max-w-md">
              <Input icon="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar por nombre, CUIT, localidad, director técnico o código de máquina…" aria-label="Buscar empresas" />
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
              {FILTROS.map((f) => (
                <button
                  key={f.valor}
                  type="button"
                  aria-pressed={filtro === f.valor}
                  onClick={() => setFiltro(f.valor)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors',
                    filtro === f.valor ? 'border-primary bg-primary text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          {empresas.data && (
            <p className="px-6 pt-3 text-xs text-slate-500 dark:text-slate-400">
              {lista.length} empresa{lista.length === 1 ? '' : 's'}
              {texto && ` para «${texto}»`}
            </p>
          )}
          {contenido()}
        </Card>
      </div>

      <DialogoMotivo
        open={!!aDarDeBaja}
        tono="danger"
        titulo="Dar de baja la empresa"
        mensaje={`${aDarDeBaja ? nombreEmpresa(aDarDeBaja) : ''} dejará de ofrecerse para autorizaciones nuevas. Los pozos y autorizaciones ya cargados conservan sus datos.`}
        confirmar="Dar de baja"
        obligatorio
        placeholder="Ej: cese de actividades"
        cargando={baja.isPending}
        error={baja.error}
        onCancelar={() => {
          setADarDeBaja(null)
          baja.reset()
        }}
        onConfirmar={(motivo) =>
          aDarDeBaja &&
          baja.mutate(
            { empresa: aDarDeBaja, motivo },
            {
              onSuccess: (e) => {
                setADarDeBaja(null)
                mostrarAviso({ titulo: 'Empresa dada de baja', detalle: `${nombreEmpresa(e)} ya no figura entre las habilitadas.`, icono: 'domain_disabled', tono: 'exito' })
              },
            },
          )
        }
      />
      <DialogoMotivo
        open={!!aReactivar}
        titulo="Reactivar la empresa"
        mensaje={`${aReactivar ? nombreEmpresa(aReactivar) : ''} volverá a estar habilitada para tomar trabajos nuevos. La baja anterior queda como antecedente.`}
        confirmar="Reactivar"
        cargando={reactivar.isPending}
        error={reactivar.error}
        onCancelar={() => {
          setAReactivar(null)
          reactivar.reset()
        }}
        onConfirmar={(observacion) =>
          aReactivar &&
          reactivar.mutate({ empresa: aReactivar, observacion }, {
            onSuccess: (e) => {
              setAReactivar(null)
              mostrarAviso({ titulo: 'Empresa reactivada', detalle: `${nombreEmpresa(e)} vuelve a figurar en el padrón.`, icono: 'restart_alt', tono: 'exito' })
            },
          })
        }
      />
    </>
  )
}
