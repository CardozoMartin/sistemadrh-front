import { useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatearFecha } from '@/config/expedientes'
import { ROUTES } from '@/config/routes'
import { useNotificaciones } from '@/features/notificaciones/context'
import { cn } from '@/lib/cn'
import { esNoEncontrado, mensajeDeError, toApiError } from '@/services/api/errors'
import { CircuitoEmpresa } from '../components/CircuitoEmpresa'
import { DialogoMotivo } from '../components/DialogoMotivo'
import { EmpresaFields } from '../components/EmpresaFields'
import { EstadoEmpresaBadge } from '../components/EstadoEmpresaBadge'
import { HistorialEmpresa } from '../components/HistorialEmpresa'
import { MaquinasPanel } from '../components/MaquinasPanel'
import { ResumenEmpresa } from '../components/ResumenEmpresa'
import { useBajaEmpresa, useEmpresa, useModificarEmpresa, useReactivarEmpresa, useReenviarEmpresa } from '../hooks'
import { compararEmpresa, cuitConFormato, datosDe, esEditable, motivoNoHabilitada, NOMBRE_OFICINA, nombreEmpresa } from '../reglas'
import { datosEmpresaSchema, type DatosEmpresaCampos } from '../schemas'
import type { CambioCampo, DatosEmpresa, EmpresaPerforadora } from '../types'

const TITULO = 'Empresa perforadora'

type Pestania = 'datos' | 'maquinas' | 'historial'

/** Ficha de la empresa: modificación de datos, parque de máquinas e historial; baja y reactivación. */
export default function EmpresaPage() {
  const navigate = useNavigate()
  const { empresaId } = useParams()
  const empresa = useEmpresa(empresaId)

  if (empresa.isPending) {
    return (
      <>
        <PageHeader title={TITULO} />
        <LoadingState mensaje="Cargando la empresa…" />
      </>
    )
  }
  if (empresa.isError) {
    return (
      <>
        <PageHeader title={TITULO} />
        {esNoEncontrado(empresa.error) ? (
          <EmptyState icon="search_off" titulo="No se encontró la empresa">
            <Button size="sm" onClick={() => navigate(ROUTES.pozo.empresas)}>
              Volver al padrón
            </Button>
          </EmptyState>
        ) : (
          <ErrorState error={empresa.error} onRetry={() => void empresa.refetch()} reintentando={empresa.isFetching} />
        )}
      </>
    )
  }
  return <Ficha empresa={empresa.data} />
}

function Ficha({ empresa }: { empresa: EmpresaPerforadora }) {
  const { mostrarAviso } = useNotificaciones()
  const [params, setParams] = useSearchParams()
  const pestania = (params.get('tab') as Pestania | null) ?? 'datos'
  const baja = useBajaEmpresa()
  const reactivar = useReactivarEmpresa()
  const reenviar = useReenviarEmpresa()
  const [dialogo, setDialogo] = useState<'baja' | 'reactivar' | 'reenviar' | null>(null)
  const nombre = nombreEmpresa(empresa)
  const noHabilitada = motivoNoHabilitada(empresa)
  const activas = empresa.maquinas.filter((m) => m.activa).length

  const PESTANIAS: { id: Pestania; label: string; icono: string }[] = [
    { id: 'datos', label: 'Datos de la empresa', icono: 'apartment' },
    { id: 'maquinas', label: `Máquinas (${activas}/${empresa.maquinas.length})`, icono: 'precision_manufacturing' },
    { id: 'historial', label: `Historial (${empresa.historial.length})`, icono: 'history' },
  ]

  return (
    <>
      <PageHeader
        title={nombre}
        description={`CUIT ${cuitConFormato(empresa.cuit)} · ${[empresa.localidad, empresa.departamento].filter(Boolean).join(', ')} · Registrada el ${formatearFecha(empresa.creado)}`}
        actions={
          <div className="flex items-center gap-3">
            <EstadoEmpresaBadge empresa={empresa} className="px-3 py-1" />
            {empresa.estado === 'BAJA' && (
              <Button size="sm" variant="secondary" iconLeft="restart_alt" onClick={() => setDialogo('reactivar')}>
                Reactivar
              </Button>
            )}
            {empresa.estado === 'ACTIVA' && (
              <Button size="sm" variant="danger" iconLeft="domain_disabled" onClick={() => setDialogo('baja')}>
                Dar de baja
              </Button>
            )}
            {empresa.estado === 'OBSERVADA' && empresa.observacion && (
              <Button size="sm" iconLeft="redo" onClick={() => setDialogo('reenviar')}>
                Reenviar a {NOMBRE_OFICINA[empresa.observacion.oficina]}
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-col gap-6">
        <CircuitoEmpresa empresa={empresa} />

        {empresa.estado === 'EN_TRAMITE' && empresa.tramite ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
            <p className="flex items-start gap-3">
              <Icon name="hourglass_top" className="text-sky-600" />
              <span>
                <strong>En revisión en {NOMBRE_OFICINA[empresa.tramite.oficina]}</strong> desde el {formatearFecha(empresa.tramite.desde)}
                {empresa.tramite.oficina === 'secretaria_general' && ' (pendiente de la resolución que la habilita)'}. Mientras tanto no se pueden modificar sus
                datos ni sus máquinas.
              </span>
            </p>
            <Link to={ROUTES.pozo.empresaRevision(empresa.id)} className="font-semibold text-sky-700 underline dark:text-sky-300">
              Ir a la revisión de {NOMBRE_OFICINA[empresa.tramite.oficina]}
            </Link>
          </div>
        ) : empresa.estado === 'OBSERVADA' && empresa.observacion ? (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <Icon name="undo" className="text-amber-600" />
            <p>
              <strong>Observada por {NOMBRE_OFICINA[empresa.observacion.oficina]}</strong> el {formatearFecha(empresa.observacion.fecha)} ({empresa.observacion.usuario}):
              “{empresa.observacion.motivo}”. Corrija los datos o las máquinas y reenvíe a {NOMBRE_OFICINA[empresa.observacion.oficina]}.
            </p>
          </div>
        ) : empresa.estado === 'RECHAZADA' && empresa.rechazo ? (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            <Icon name="cancel" className="text-red-600" />
            <p>
              <strong>Alta rechazada por {NOMBRE_OFICINA[empresa.rechazo.oficina]}</strong> el {formatearFecha(empresa.rechazo.fecha)} ({empresa.rechazo.usuario}): “
              {empresa.rechazo.motivo}”. El trámite terminó.
            </p>
          </div>
        ) : empresa.baja ? (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            <Icon name="domain_disabled" className="text-red-600" />
            <p>
              <strong>Empresa dada de baja</strong> el {formatearFecha(empresa.baja.fecha)} por {empresa.baja.usuario}. Motivo: “{empresa.baja.motivo}”. No se
              ofrece para autorizaciones nuevas; sus datos se pueden seguir corrigiendo.
            </p>
          </div>
        ) : noHabilitada ? (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <Icon name="warning" className="text-amber-600" />
            <p>
              <strong>No puede solicitar autorizaciones de perforación:</strong> {noHabilitada}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-200">
            <Icon name="verified" filled className="text-green-600" />
            Habilitada para solicitar autorizaciones de perforación (resolución {empresa.resolucion.numero}/{empresa.resolucion.anio}, {activas} máquina{activas === 1 ? '' : 's'} activa
            {activas === 1 ? '' : 's'}).
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-700" role="tablist">
          {PESTANIAS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={pestania === p.id}
              onClick={() => setParams({ tab: p.id }, { replace: true })}
              className={cn(
                '-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors',
                pestania === p.id ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
              )}
            >
              <Icon name={p.icono} className="text-lg!" /> {p.label}
            </button>
          ))}
        </div>

        {pestania === 'datos' && (esEditable(empresa) ? <DatosEmpresaForm key={empresa.modificado ?? empresa.creado} empresa={empresa} /> : <ResumenEmpresa empresa={empresa} />)}
        {pestania === 'maquinas' && <MaquinasPanel empresa={empresa} />}
        {pestania === 'historial' && (
          <Card className="p-6">
            <HistorialEmpresa eventos={empresa.historial} />
          </Card>
        )}
      </div>

      <DialogoMotivo
        open={dialogo === 'baja'}
        tono="danger"
        titulo="Dar de baja la empresa"
        mensaje={`${nombre} dejará de ofrecerse para autorizaciones nuevas. Los pozos y autorizaciones ya cargados conservan sus datos.`}
        confirmar="Dar de baja"
        obligatorio
        placeholder="Ej: cese de actividades"
        cargando={baja.isPending}
        error={baja.error}
        onCancelar={() => {
          setDialogo(null)
          baja.reset()
        }}
        onConfirmar={(motivo) =>
          baja.mutate(
            { empresa, motivo },
            {
              onSuccess: () => {
                setDialogo(null)
                mostrarAviso({ titulo: 'Empresa dada de baja', detalle: `${nombre} ya no figura entre las habilitadas.`, icono: 'domain_disabled', tono: 'exito' })
              },
            },
          )
        }
      />
      <DialogoMotivo
        open={dialogo === 'reenviar'}
        titulo={`Reenviar a ${empresa.observacion ? NOMBRE_OFICINA[empresa.observacion.oficina] : ''}`}
        mensaje={`Se reenvía ${nombre} con las correcciones. Mientras esté en revisión no se podrán modificar sus datos.`}
        confirmar="Reenviar"
        placeholder="Qué se corrigió (ej: se adjuntó el estatuto social)"
        cargando={reenviar.isPending}
        error={reenviar.error}
        onCancelar={() => {
          setDialogo(null)
          reenviar.reset()
        }}
        onConfirmar={(observacion) =>
          reenviar.mutate(
            { empresa, observacion },
            {
              onSuccess: (e) => {
                setDialogo(null)
                mostrarAviso({ titulo: 'Empresa reenviada', detalle: `${nombre} volvió a ${e.tramite ? NOMBRE_OFICINA[e.tramite.oficina] : 'revisión'}.`, icono: 'redo', tono: 'exito' })
              },
            },
          )
        }
      />
      <DialogoMotivo
        open={dialogo === 'reactivar'}
        titulo="Reactivar la empresa"
        mensaje={`${nombre} volverá a estar habilitada para tomar trabajos nuevos. La baja anterior queda como antecedente.`}
        confirmar="Reactivar"
        cargando={reactivar.isPending}
        error={reactivar.error}
        onCancelar={() => {
          setDialogo(null)
          reactivar.reset()
        }}
        onConfirmar={(observacion) =>
          reactivar.mutate(
            { empresa, observacion },
            {
              onSuccess: () => {
                setDialogo(null)
                mostrarAviso({ titulo: 'Empresa reactivada', detalle: `${nombre} vuelve a figurar en el padrón.`, icono: 'restart_alt', tono: 'exito' })
              },
            },
          )
        }
      />
    </>
  )
}

/**
 * Modificación de los datos (mismo formulario del alta, precargado). Antes de guardar se
 * muestra qué cambia y se pide el motivo: cada modificación queda en el historial.
 */
function DatosEmpresaForm({ empresa }: { empresa: EmpresaPerforadora }) {
  const { mostrarAviso } = useNotificaciones()
  const modificar = useModificarEmpresa()
  const [pendiente, setPendiente] = useState<{ datos: DatosEmpresa; cambios: CambioCampo[] } | null>(null)
  const [sinCambios, setSinCambios] = useState(false)
  const form = useForm<DatosEmpresaCampos, unknown, DatosEmpresa>({
    resolver: zodResolver(datosEmpresaSchema),
    defaultValues: datosDe(empresa),
    mode: 'onTouched',
  })

  const revisar = form.handleSubmit((datos) => {
    const cambios = compararEmpresa(datosDe(empresa), datos)
    if (cambios.length === 0) {
      setSinCambios(true)
      return
    }
    setPendiente({ datos, cambios })
  })

  function confirmar(observacion: string) {
    if (!pendiente) return
    modificar.mutate(
      { empresa, datos: pendiente.datos, observacion },
      {
        onSuccess: (e) => {
          setPendiente(null)
          mostrarAviso({
            titulo: 'Cambios guardados',
            detalle: `${pendiente.cambios.length} campo${pendiente.cambios.length === 1 ? '' : 's'} de ${nombreEmpresa(e)} modificado${pendiente.cambios.length === 1 ? '' : 's'} y asentado${pendiente.cambios.length === 1 ? '' : 's'} en el historial.`,
            icono: 'check_circle',
            tono: 'exito',
          })
        },
        onError: (e) => {
          if (toApiError(e).code === 'CUIT_EXISTENTE') {
            setPendiente(null)
            form.setError('cuit', { message: toApiError(e).message }, { shouldFocus: true })
          }
        },
      },
    )
  }

  return (
    <FormProvider {...form}>
      <form noValidate onSubmit={revisar}>
        <Card>
          <div className="flex flex-col gap-10 p-6 md:p-8">
            <EmpresaFields resolucionVinculada={empresa.resolucion.numero ? `Res. ${empresa.resolucion.numero}/${empresa.resolucion.anio}` : undefined} />
            {sinCambios && <Alert tone="info">No hay cambios: los datos son los mismos que ya estaban guardados.</Alert>}
            {modificar.error && !pendiente && toApiError(modificar.error).code !== 'CUIT_EXISTENTE' && <Alert>{mensajeDeError(modificar.error)}</Alert>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 md:px-8 dark:border-slate-700 dark:bg-slate-800/40">
            <p className="text-xs text-slate-500 dark:text-slate-400">Los cambios quedan asentados en el historial con fecha, responsable y motivo.</p>
            <div className="flex gap-3">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  form.reset(datosDe(empresa))
                  setSinCambios(false)
                }}
              >
                Descartar cambios
              </Button>
              <Button size="sm" iconLeft="save" type="submit" onClick={() => setSinCambios(false)}>
                Guardar cambios
              </Button>
            </div>
          </div>
        </Card>
      </form>

      <DialogoMotivo
        open={!!pendiente}
        titulo="Confirmar la modificación"
        mensaje={`${pendiente?.cambios.length ?? 0} ${pendiente?.cambios.length === 1 ? 'campo cambia' : 'campos cambian'} en ${nombreEmpresa(empresa)}.`}
        confirmar="Guardar cambios"
        placeholder="Motivo del cambio (ej: mudanza del domicilio fiscal)"
        cargando={modificar.isPending}
        error={modificar.error}
        onCancelar={() => {
          setPendiente(null)
          modificar.reset()
        }}
        onConfirmar={confirmar}
      >
        <ul className="max-h-56 overflow-y-auto rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800/60">
          {pendiente?.cambios.map((c) => (
            <li key={c.etiqueta} className="flex flex-wrap items-center gap-1.5 py-0.5">
              <span className="font-semibold text-slate-600 dark:text-slate-300">{c.etiqueta}:</span>
              <span className="text-slate-400 line-through">{c.antes || '(vacío)'}</span>
              <Icon name="arrow_right_alt" className="text-sm! text-slate-400" />
              <span className="font-semibold text-primary">{c.ahora || '(vacío)'}</span>
            </li>
          ))}
        </ul>
      </DialogoMotivo>
    </FormProvider>
  )
}
