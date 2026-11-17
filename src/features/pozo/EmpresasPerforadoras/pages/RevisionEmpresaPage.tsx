import { useMemo, useState } from 'react'
import { FormProvider, useController, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useParams } from 'react-router'
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { FormAdjuntosField, FormNumericField, FormTextareaField, FormTextField, useFieldError } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatearFecha } from '@/config/expedientes'
import { RUTA_BANDEJA, ROUTES } from '@/config/routes'
import { useNotificaciones } from '@/features/notificaciones/context'
import { cn } from '@/lib/cn'
import { esNoEncontrado, mensajeDeError } from '@/services/api/errors'
import { CircuitoEmpresa } from '../components/CircuitoEmpresa'
import { DialogoMotivo } from '../components/DialogoMotivo'
import { EstadoEmpresaBadge } from '../components/EstadoEmpresaBadge'
import { HistorialEmpresa } from '../components/HistorialEmpresa'
import { MaquinasPanel } from '../components/MaquinasPanel'
import { ResumenEmpresa } from '../components/ResumenEmpresa'
import { useDevolverEmpresa, useDictaminar, useEmpresa, useRegistrarResolucion, useUsuarioOficina } from '../hooks'
import { CONTROLES_JURIDICO, CONTROLES_SECRETARIA, cuitConFormato, estadoDetallado, NOMBRE_OFICINA, nombreEmpresa } from '../reglas'
import { crearDictamenSchema, crearResolucionSchema, type DictamenForm, type ResolucionForm } from '../schemas'
import type { EmpresaPerforadora, OficinaEmpresa } from '../types'

const TITULO = 'Revisión de empresa perforadora'

/** Checklist de control (prototipo pozo/Circuito: «Control legal»). */
function Controles({ opciones }: { opciones: readonly string[] }) {
  const { field } = useController({ name: 'controles' })
  const error = useFieldError('controles')
  const marcados = (field.value as string[]) ?? []
  const alternar = (c: string) => field.onChange(marcados.includes(c) ? marcados.filter((x) => x !== c) : [...marcados, c])
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Control previo</legend>
      {opciones.map((c) => (
        <label
          key={c}
          className={cn(
            'flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors',
            marcados.includes(c) ? 'border-green-300 bg-green-50 dark:border-green-500/40 dark:bg-green-500/10' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800',
          )}
        >
          <input type="checkbox" checked={marcados.includes(c)} onChange={() => alternar(c)} className="mt-0.5 size-4 shrink-0 accent-green-600" />
          <span className="text-slate-700 dark:text-slate-200">{c}</span>
        </label>
      ))}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </fieldset>
  )
}

/** Rechazar / Observar: piden el motivo. */
function AccionesDevolver({ empresa, oficina, deshabilitado }: { empresa: EmpresaPerforadora; oficina: OficinaEmpresa; deshabilitado: boolean }) {
  const navigate = useNavigate()
  const { mostrarAviso } = useNotificaciones()
  const devolver = useDevolverEmpresa(oficina)
  const [accion, setAccion] = useState<'observar' | 'rechazar' | null>(null)
  return (
    <>
      <Button size="sm" variant="ghost" iconLeft="cancel" className="text-red-600" disabled={deshabilitado} onClick={() => setAccion('rechazar')}>
        Rechazar
      </Button>
      <Button size="sm" variant="secondary" iconLeft="undo" disabled={deshabilitado} onClick={() => setAccion('observar')}>
        Observar
      </Button>
      <DialogoMotivo
        open={!!accion}
        tono={accion === 'rechazar' ? 'danger' : 'info'}
        titulo={accion === 'rechazar' ? 'Rechazar el alta' : 'Observar y devolver a Planificación'}
        mensaje={
          accion === 'rechazar'
            ? `El alta de ${nombreEmpresa(empresa)} no procede. El trámite termina y la empresa queda registrada como rechazada.`
            : `${nombreEmpresa(empresa)} vuelve a Planificación para corregir lo observado. Después se reenvía a ${NOMBRE_OFICINA[oficina]}.`
        }
        confirmar={accion === 'rechazar' ? 'Rechazar' : 'Observar y devolver'}
        obligatorio
        placeholder={accion === 'rechazar' ? 'Motivo del rechazo' : 'Qué hay que corregir (ej: falta el estatuto social)'}
        cargando={devolver.isPending}
        error={devolver.error}
        onCancelar={() => {
          setAccion(null)
          devolver.reset()
        }}
        onConfirmar={(motivo) =>
          accion &&
          devolver.mutate(
            { empresa, accion, motivo },
            {
              onSuccess: () => {
                mostrarAviso({
                  titulo: accion === 'rechazar' ? 'Alta rechazada' : 'Empresa observada',
                  detalle: accion === 'rechazar' ? `${nombreEmpresa(empresa)}: el trámite terminó.` : `${nombreEmpresa(empresa)} volvió a Planificación para corregir.`,
                  icono: accion === 'rechazar' ? 'cancel' : 'undo',
                  tono: 'exito',
                })
                navigate(RUTA_BANDEJA[oficina])
              },
            },
          )
        }
      />
    </>
  )
}

/** Jurídico: control legal + dictamen → Secretaría General. */
function FormJuridico({ empresa }: { empresa: EmpresaPerforadora }) {
  const navigate = useNavigate()
  const { mostrarAviso } = useNotificaciones()
  const usuario = useUsuarioOficina('juridico')
  const dictaminar = useDictaminar()
  const [confirmar, setConfirmar] = useState<DictamenForm | null>(null)
  const schema = useMemo(() => crearDictamenSchema(CONTROLES_JURIDICO), [])
  const form = useForm<DictamenForm>({ resolver: zodResolver(schema), defaultValues: { controles: [], texto: '', informe: [] }, mode: 'onTouched' })
  const aprobar = form.handleSubmit((v) => setConfirmar(v))

  return (
    <FormProvider {...form}>
      <form noValidate onSubmit={aprobar} className="flex flex-col gap-5">
        <Controles opciones={CONTROLES_JURIDICO} />
        <FormTextareaField name="texto" label="Dictamen" required rows={5} placeholder="Redacte el dictamen jurídico sobre la inscripción de la empresa…" />
        <FormAdjuntosField name="informe" label="Informe de Jurídico (opcional)" extensiones={['.pdf']} maxMB={5} />
        <p className="text-xs text-slate-500 dark:text-slate-400">Queda registrado a nombre de {usuario}.</p>
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
          <AccionesDevolver empresa={empresa} oficina="juridico" deshabilitado={dictaminar.isPending} />
          <Button size="sm" iconRight="send" type="submit" loading={dictaminar.isPending}>
            Dictaminar y enviar a Secretaría
          </Button>
        </div>
      </form>
      <ConfirmDialog
        open={!!confirmar}
        title="¿Enviar a Secretaría General?"
        message={`Se registrará el dictamen y ${nombreEmpresa(empresa)} pasará a Secretaría General para la resolución que la habilita.`}
        confirmLabel="Sí, enviar"
        cancelLabel="Cancelar"
        loading={dictaminar.isPending}
        onCancel={() => {
          setConfirmar(null)
          dictaminar.reset()
        }}
        onConfirm={() =>
          confirmar &&
          dictaminar.mutate(
            { empresa, input: confirmar },
            {
              onSuccess: () => {
                mostrarAviso({ titulo: 'Dictamen registrado', detalle: `${nombreEmpresa(empresa)} pasó a Secretaría General.`, icono: 'gavel', tono: 'exito' })
                navigate(RUTA_BANDEJA.juridico)
              },
            },
          )
        }
      >
        {!!dictaminar.error && <Alert>{mensajeDeError(dictaminar.error)}</Alert>}
      </ConfirmDialog>
    </FormProvider>
  )
}

/** Secretaría General: resolución que habilita a la empresa. */
function FormSecretaria({ empresa }: { empresa: EmpresaPerforadora }) {
  const navigate = useNavigate()
  const { mostrarAviso } = useNotificaciones()
  const usuario = useUsuarioOficina('secretaria_general')
  const registrar = useRegistrarResolucion()
  const [confirmar, setConfirmar] = useState<ResolucionForm | null>(null)
  const schema = useMemo(() => crearResolucionSchema(CONTROLES_SECRETARIA), [])
  const form = useForm<ResolucionForm>({
    resolver: zodResolver(schema),
    defaultValues: { controles: [], numero: '', anio: String(new Date().getFullYear()), fecha: '', archivo: [], observaciones: '' },
    mode: 'onTouched',
  })
  const aprobar = form.handleSubmit((v) => setConfirmar(v))

  return (
    <FormProvider {...form}>
      <form noValidate onSubmit={aprobar} className="flex flex-col gap-5">
        {empresa.dictamen && (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm dark:border-indigo-500/30 dark:bg-indigo-500/10">
            <p className="flex items-center gap-1.5 font-semibold text-indigo-800 dark:text-indigo-200">
              <Icon name="gavel" className="text-base!" /> Dictamen de Jurídico · {formatearFecha(empresa.dictamen.fecha)} · {empresa.dictamen.usuario}
            </p>
            <p className="mt-1 text-indigo-900 dark:text-indigo-100">{empresa.dictamen.texto}</p>
          </div>
        )}
        <Controles opciones={CONTROLES_SECRETARIA} />
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <FormTextField name="numero" label="N° de resolución" required icon="gavel" placeholder="Ej: 145" />
          <FormNumericField name="anio" label="Año" required maxLength={4} />
        </div>
        <FormTextField name="fecha" label="Fecha de firma" required type="date" />
        <FormAdjuntosField name="archivo" label="Resolución firmada" required extensiones={['.pdf']} maxMB={5} />
        <FormTextareaField name="observaciones" label="Observaciones (opcional)" rows={2} />
        <p className="text-xs text-slate-500 dark:text-slate-400">Queda registrado a nombre de {usuario}.</p>
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
          <AccionesDevolver empresa={empresa} oficina="secretaria_general" deshabilitado={registrar.isPending} />
          <Button size="sm" iconRight="verified" type="submit" loading={registrar.isPending}>
            Registrar resolución y habilitar
          </Button>
        </div>
      </form>
      <ConfirmDialog
        open={!!confirmar}
        title="¿Habilitar la empresa?"
        message={`Se registrará la resolución ${confirmar?.numero ?? ''}/${confirmar?.anio ?? ''} y ${nombreEmpresa(empresa)} quedará habilitada para solicitar autorizaciones de perforación.`}
        confirmLabel="Sí, habilitar"
        cancelLabel="Cancelar"
        loading={registrar.isPending}
        onCancel={() => {
          setConfirmar(null)
          registrar.reset()
        }}
        onConfirm={() =>
          confirmar &&
          registrar.mutate(
            { empresa, input: confirmar },
            {
              onSuccess: () => {
                mostrarAviso({ titulo: 'Empresa habilitada', detalle: `${nombreEmpresa(empresa)}: resolución ${confirmar.numero}/${confirmar.anio}.`, icono: 'verified', tono: 'exito' })
                navigate(RUTA_BANDEJA.secretaria_general)
              },
            },
          )
        }
      >
        {!!registrar.error && <Alert>{mensajeDeError(registrar.error)}</Alert>}
      </ConfirmDialog>
    </FormProvider>
  )
}

/**
 * Revisión de una empresa en la oficina donde está (Jurídico o Secretaría General).
 * Prototipos pozo/Circuito/juridicoPozo.html y secretariaPozo.html.
 */
export default function RevisionEmpresaPage() {
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
              Ir al padrón
            </Button>
          </EmptyState>
        ) : (
          <ErrorState error={empresa.error} onRetry={() => void empresa.refetch()} reintentando={empresa.isFetching} />
        )}
      </>
    )
  }

  const e = empresa.data
  const oficina = e.estado === 'EN_TRAMITE' ? e.tramite?.oficina : undefined
  if (!oficina) {
    return (
      <>
        <PageHeader title={nombreEmpresa(e)} />
        <EmptyState icon="task_alt" titulo="No hay nada para revisar" descripcion={`La empresa está ${estadoDetallado(e).toLowerCase()}.`}>
          <Button size="sm" onClick={() => navigate(ROUTES.pozo.empresa(e.id))}>
            Ver la ficha
          </Button>
        </EmptyState>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={oficina === 'juridico' ? 'Dictamen de Jurídico' : 'Resolución de Secretaría General'}
        description={`${nombreEmpresa(e)} · CUIT ${cuitConFormato(e.cuit)} · en ${NOMBRE_OFICINA[oficina]} desde el ${formatearFecha(e.tramite!.desde)}`}
        actions={<EstadoEmpresaBadge empresa={e} className="px-3 py-1" />}
      />
      <div className="flex flex-col gap-6">
        <CircuitoEmpresa empresa={e} />
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
          <div className="flex min-w-0 flex-col gap-6">
            <ResumenEmpresa empresa={e} />
            <MaquinasPanel empresa={e} />
            <Card className="p-6">
              <h3 className="mb-4 flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                <Icon name="history" className="text-primary" /> Historial
              </h3>
              <HistorialEmpresa eventos={e.historial} />
            </Card>
          </div>
          <Card className="p-6 xl:sticky xl:top-4">
            <h3 className="mb-1 flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <Icon name={oficina === 'juridico' ? 'gavel' : 'verified'} className="text-primary" />
              {oficina === 'juridico' ? 'Dictamen jurídico' : 'Resolución de habilitación'}
            </h3>
            <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">
              {oficina === 'juridico'
                ? 'Verifique la documentación legal. Si está todo en orden, dictamine y envíe a Secretaría General.'
                : 'Registre la resolución firmada: la empresa queda habilitada para solicitar autorizaciones.'}
            </p>
            {oficina === 'juridico' ? <FormJuridico empresa={e} /> : <FormSecretaria empresa={e} />}
            <Link to={ROUTES.pozo.empresa(e.id)} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              Ver la ficha completa
            </Link>
          </Card>
        </div>
      </div>
    </>
  )
}
