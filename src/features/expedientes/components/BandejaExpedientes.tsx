import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ROUTES } from '@/config/routes'
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { controlClass } from '@/components/form/styles'
import { Icon } from '@/components/ui/Icon'
import { useSesion } from '@/features/auth/context'
import { useDominio } from '@/hooks/useDominio'
import { cn } from '@/lib/cn'
import { mensajeDeError } from '@/services/api/errors'
import type { EstadoExpedienteBackend, ExpedienteEnBandeja, OficinaBackend, PlazoEnOficina } from '@/features/tramites/AltaDeConcesion/backend.types'
import { Select } from '@/components/form'
import { useBandeja, useCancelarAlta, useLiberarAlta, useReasignables, useReasignarAlta, useTomarDeBandeja } from '@/features/tramites/AltaDeConcesion/hooks'

/** Pantalla de trabajo de cada trámite que ya circula en el backend real. */
const RUTA_TRABAJO: Record<string, (id: string) => string> = {
  ALTA_CONCESION: ROUTES.tramites.altaConcesion.circuito,
  CAMBIO_TITULARIDAD: ROUTES.tramites.cambioTitularidad.circuito,
  AMPLIACION_REDUCCION: ROUTES.tramites.reduccionAmpliacion.circuito,
  ANULACION: ROUTES.tramites.anulacion.circuito,
  REUBICACION: ROUTES.tramites.reubicacion.circuito,
  BAJA_POZO: ROUTES.pozo.baja,
}

const ESTADO: Partial<Record<EstadoExpedienteBackend, { texto: string; color: string }>> = {
  OBSERVADO: { texto: 'Observado', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  EN_ESPERA: { texto: 'En espera', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
}

/** En Recaudación, «en espera» es el «No apto» por deuda: queda pausado hasta que se pague. */
const etiquetaEstado = (e: ExpedienteEnBandeja) =>
  e.estado === 'EN_ESPERA' && e.etapa === 'RECAUDACION' ? { texto: 'Deuda pendiente', color: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' } : ESTADO[e.estado]

/** Solo el número del expediente («123/332-2026» → «123»); el completo queda en el título. */
const soloNumero = (numero: string) => numero.split('/')[0]

const plural = (n: number, palabra: string) => `${n} ${palabra}${n === 1 ? '' : 's'}`

const COLOR_PLAZO: Record<PlazoEnOficina['semaforo'], string> = {
  VENCIDO: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  POR_VENCER: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  EN_PLAZO: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}

function textoPlazo({ restantes }: PlazoEnOficina) {
  if (restantes < 0) return `Vencido · ${plural(-restantes, 'día')}`
  if (restantes === 0) return 'Vence hoy'
  return `${plural(restantes, 'día')} restante${restantes === 1 ? '' : 's'}`
}

function Plazo({ plazo }: { plazo: PlazoEnOficina }) {
  const [anio, mes, dia] = plazo.vence.split('-')
  return (
    <span title={`Plazo: ${plural(plazo.dias, 'día')} · Vencimiento: ${dia}/${mes}/${anio}`} className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap', COLOR_PLAZO[plazo.semaforo])}>
      {plazo.semaforo !== 'EN_PLAZO' && <Icon name={plazo.semaforo === 'VENCIDO' ? 'error' : 'schedule'} className="text-[14px]!" />}
      {textoPlazo(plazo)}
    </span>
  )
}

/** Aviso arriba de la bandeja: cuántos expedientes tienen el plazo vencido o por vencer. */
function AvisoPlazos({ expedientes }: { expedientes: ExpedienteEnBandeja[] }) {
  const vencidos = expedientes.filter((e) => e.plazo?.semaforo === 'VENCIDO').length
  const porVencer = expedientes.filter((e) => e.plazo?.semaforo === 'POR_VENCER').length
  if (!vencidos && !porVencer) return null
  const partes = [vencidos && `${plural(vencidos, 'expediente')} con plazo vencido`, porVencer && `${plural(porVencer, 'expediente')} próximo${porVencer === 1 ? '' : 's'} a vencer`].filter(Boolean)
  return (
    <div
      role="alert"
      className={cn(
        'mb-6 flex items-center gap-3 rounded-lg border p-4 text-sm',
        vencidos
          ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200'
          : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
      )}
    >
      <Icon name={vencidos ? 'notification_important' : 'schedule'} className="shrink-0" />
      <p>
        <span className="font-semibold">{partes.join(' y ')}.</span> Se listan en primer lugar.
      </p>
    </div>
  )
}

type Grupo = 'sin-revisar' | 'pendientes'

/** Acción secundaria de la fila: solo ícono, con el nombre en el tooltip y para lectores de pantalla. */
function AccionIcono({ icono, etiqueta, ayuda, onClick }: { icono: string; etiqueta: string; ayuda: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={`${etiqueta}: ${ayuda}`}
      aria-label={etiqueta}
      onClick={onClick}
      className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-4 focus-visible:ring-slate-400/30 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-slate-100"
    >
      <Icon name={icono} className="text-xl!" />
    </button>
  )
}

/** Hueco del tamaño de un ícono: mantiene las acciones alineadas entre filas cuando una no corresponde. */
const HuecoAccion = () => <span aria-hidden className="size-9 shrink-0" />

/** Un alta que todavía está en la carga (no se envió a ninguna oficina) se puede cancelar si se inició por error. */
const sePuedeCancelar = (e: ExpedienteEnBandeja) => e.tipoTramite === 'ALTA_CONCESION' && e.etapa === 'CARGA'

/** Pide el motivo y cancela el alta: queda anulada en el historial y el número de expediente se libera. */
function CancelarAlta({ expediente, onCerrar }: { expediente: ExpedienteEnBandeja | null; onCerrar: () => void }) {
  const cancelar = useCancelarAlta()
  const [motivo, setMotivo] = useState('')
  const cerrar = () => {
    setMotivo('')
    cancelar.reset()
    onCerrar()
  }
  return (
    <ConfirmDialog
      open={!!expediente}
      tone="danger"
      title="Anular expediente"
      message={`El expediente N° ${expediente?.numero ?? ''} será anulado y retirado de la bandeja. La información registrada se conserva en el historial y el número de expediente quedará disponible.`}
      confirmLabel="Anular"
      cancelLabel="Volver"
      loading={cancelar.isPending}
      onCancel={cerrar}
      onConfirm={() => {
        if (!expediente) return
        if (motivo.trim().length < 10) return
        cancelar.mutate({ id: expediente.id, observaciones: motivo.trim() }, { onSuccess: cerrar })
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Motivo de la anulación
        <textarea
          rows={3}
          value={motivo}
          onChange={(ev) => setMotivo(ev.target.value)}
          placeholder="Ej.: Expediente registrado por error."
          className={controlClass({ className: 'resize-y' })}
        />
      </label>
      {motivo.trim().length > 0 && motivo.trim().length < 10 && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Mínimo 10 caracteres.</p>}
      {cancelar.isError && <Alert className="mt-3">{mensajeDeError(cancelar.error)}</Alert>}
    </ConfirmDialog>
  )
}

/** Suelta el alta: vuelve a «sin revisar» de la oficina y cualquiera la puede tomar. */
function LiberarAlta({ expediente, propio, onCerrar }: { expediente: ExpedienteEnBandeja | null; propio: boolean; onCerrar: () => void }) {
  const liberar = useLiberarAlta()
  const cerrar = () => {
    liberar.reset()
    onCerrar()
  }
  return (
    <ConfirmDialog
      open={!!expediente}
      title="Liberar expediente"
      message={
        propio
          ? `El expediente N° ${expediente?.numero ?? ''} vuelve a «Sin revisar» y cualquier usuario de la oficina lo puede tomar. Lo cargado hasta ahora se conserva.`
          : `El expediente N° ${expediente?.numero ?? ''} lo tiene tomado ${expediente?.tomadoPor ?? ''}. Al liberarlo vuelve a «Sin revisar» y cualquier usuario de la oficina lo puede tomar. Lo cargado se conserva y queda registrado quién lo liberó.`
      }
      confirmLabel="Liberar"
      cancelLabel="Volver"
      loading={liberar.isPending}
      onCancel={cerrar}
      onConfirm={() => expediente && liberar.mutate(expediente.id, { onSuccess: cerrar })}
    >
      {liberar.isError && <Alert className="mt-3">{mensajeDeError(liberar.error)}</Alert>}
    </ConfirmDialog>
  )
}

/** Jefe de Catastro: pasa el alta a otro usuario de la oficina, con el motivo. */
function ReasignarAlta({ expediente, onCerrar }: { expediente: ExpedienteEnBandeja | null; onCerrar: () => void }) {
  const reasignar = useReasignarAlta()
  const usuarios = useReasignables(expediente?.id ?? null)
  const [destino, setDestino] = useState('')
  const [motivo, setMotivo] = useState('')
  const cerrar = () => {
    setDestino('')
    setMotivo('')
    reasignar.reset()
    onCerrar()
  }
  const listo = !!destino && motivo.trim().length >= 10
  return (
    <ConfirmDialog
      open={!!expediente}
      title="Reasignar expediente"
      message={`El expediente N° ${expediente?.numero ?? ''} lo tiene tomado ${expediente?.tomadoPor ?? 'nadie'}. Elija quién lo continúa: queda tomado por esa persona y el cambio se registra en el historial.`}
      confirmLabel="Reasignar"
      cancelLabel="Volver"
      loading={reasignar.isPending}
      onCancel={cerrar}
      onConfirm={() => {
        if (!expediente || !listo) return
        reasignar.mutate({ id: expediente.id, usuarioId: destino, observaciones: motivo.trim() }, { onSuccess: cerrar })
      }}
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Nuevo responsable
          <Select
            options={(usuarios.data ?? []).map((u) => ({ value: u.id, label: `${u.nombre} (${u.legajo})` }))}
            placeholder={usuarios.isPending ? 'Cargando…' : 'Seleccionar…'}
            disabled={!usuarios.data}
            value={destino}
            onChange={(ev) => setDestino(ev.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Motivo
          <textarea
            rows={3}
            value={motivo}
            onChange={(ev) => setMotivo(ev.target.value)}
            placeholder="Ej.: El responsable está de licencia."
            className={controlClass({ className: 'resize-y' })}
          />
        </label>
        {motivo.trim().length > 0 && motivo.trim().length < 10 && <p className="text-xs text-slate-500 dark:text-slate-400">Mínimo 10 caracteres.</p>}
        {usuarios.isError && <Alert>{mensajeDeError(usuarios.error)}</Alert>}
        {reasignar.isError && <Alert>{mensajeDeError(reasignar.error)}</Alert>}
      </div>
    </ConfirmDialog>
  )
}

function Tabla({ oficina, grupo, expedientes }: { oficina: OficinaBackend; grupo: Grupo; expedientes: ExpedienteEnBandeja[] }) {
  const navigate = useNavigate()
  const d = useDominio()
  const tomar = useTomarDeBandeja()
  const { puede, usuario } = useSesion()
  const [aCancelar, setACancelar] = useState<ExpedienteEnBandeja | null>(null)
  const [aLiberar, setALiberar] = useState<ExpedienteEnBandeja | null>(null)
  const [aReasignar, setAReasignar] = useState<ExpedienteEnBandeja | null>(null)
  // Jefe de Catastro (o administrador): anula, libera y reasigna altas que tiene tomadas otro.
  const supervisa = puede('ALTA_SUPERVISAR') && oficina === 'catastro'
  const nombreTramite = (codigo: string) => d.tramites.find((t) => t.codigo === codigo)?.nombre ?? codigo
  // Si el trámite se inició en esta oficina, la oficina anterior es ella misma.
  const nombreOficina = d.oficina(oficina)?.nombre ?? oficina
  const conPlazo = expedientes.some((e) => e.plazo)
  const conDistrito = expedientes.some((e) => e.distrito !== undefined)

  // Qué acciones secundarias puede ver el usuario en cada fila (Liberar, Reasignar, Anular).
  const acciones = (e: ExpedienteEnBandeja) => ({
    liberar: e.tipoTramite === 'ALTA_CONCESION' && (e.tomadoPorId === usuario?.id || supervisa),
    reasignar: e.tipoTramite === 'ALTA_CONCESION' && supervisa,
    anular: sePuedeCancelar(e) && puede('ALTA_INICIAR') && (e.tomadoPorId === usuario?.id || supervisa),
  })
  // Columnas de íconos que usa la tabla: si ninguna fila tiene una acción, no se reserva su lugar.
  const columnas = expedientes.reduce(
    (c, e) => {
      const a = acciones(e)
      return { liberar: c.liberar || a.liberar, reasignar: c.reasignar || a.reasignar, anular: c.anular || a.anular }
    },
    { liberar: false, reasignar: false, anular: false },
  )

  const th = 'px-3 py-3 first:pl-6 last:pr-6'
  const td = 'px-3 py-3 align-middle first:pl-6 last:pr-6'

  return (
    <>
      {tomar.isError && <Alert className="m-4">{mensajeDeError(tomar.error)}</Alert>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold tracking-wide whitespace-nowrap text-slate-500 uppercase dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className={th}>N° Exp.</th>
              <th className={th}>Titular</th>
              <th className={th}>Trámite</th>
              {conDistrito && <th className={th}>Distrito</th>}
              <th className={th}>Of. anterior</th>
              <th className={th}>Recepción</th>
              {conPlazo && <th className={th}>Plazo</th>}
              {grupo === 'pendientes' && <th className={th}>Responsable</th>}
              <th className={cn(th, 'text-right')}>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {expedientes.map((e) => {
              const ruta = RUTA_TRABAJO[e.tipoTramite]?.(e.id)
              const a = acciones(e)
              const estado = etiquetaEstado(e)
              return (
                <tr key={e.id} className={cn('hover:bg-slate-50 dark:hover:bg-slate-800/40', e.plazo?.semaforo === 'VENCIDO' && 'bg-red-50/60 dark:bg-red-500/5')}>
                  <td className={td}>
                    <span title={`Expediente ${e.numero}`} className="block font-semibold whitespace-nowrap text-slate-900 tabular-nums dark:text-white">
                      {soloNumero(e.numero)}
                    </span>
                    {(estado || e.cursoConDeuda) && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {estado && <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap', estado.color)}>{estado.texto}</span>}
                        {e.cursoConDeuda && (
                          <span title="Recaudación dio curso con deuda pendiente. Ver nota en el expediente." className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-red-700 dark:bg-red-500/15 dark:text-red-300">
                            <Icon name="warning" className="text-[13px]!" />
                            Deuda pendiente
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className={cn(td, 'min-w-36')}>{e.titular ?? <span className="text-slate-400 italic">No registrado</span>}</td>
                  <td className={td}>
                    <span className="block font-medium whitespace-nowrap text-slate-800 dark:text-slate-100">{nombreTramite(e.tipoTramite)}</span>
                    <span className="block text-xs whitespace-nowrap text-slate-500 dark:text-slate-400">{e.etapaNombre}</span>
                  </td>
                  {conDistrito && <td className={cn(td, 'whitespace-nowrap')}>{e.distrito ?? <span className="text-slate-400 italic">No registrado</span>}</td>}
                  <td className={td}>
                    {e.vieneDeNombre ? (
                      <>
                        <span className="whitespace-nowrap">{e.vieneDeNombre}</span>
                        {e.esDevolucion && <span className="block text-xs font-semibold text-amber-600">Devuelto con observaciones</span>}
                      </>
                    ) : (
                      <span className="whitespace-nowrap">{nombreOficina}</span>
                    )}
                  </td>
                  <td className={cn(td, 'whitespace-nowrap tabular-nums')}>
                    {e.enLaOficinaDesde ? (
                      <>
                        <span className="block">{new Date(e.enLaOficinaDesde).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">{new Date(e.enLaOficinaDesde).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} h</span>
                      </>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  {conPlazo && <td className={td}>{e.plazo ? <Plazo plazo={e.plazo} /> : <span className="text-slate-400">—</span>}</td>}
                  {grupo === 'pendientes' && <td className={cn(td, 'min-w-32')}>{e.tomadoPor}</td>}
                  <td className={cn(td, 'text-right whitespace-nowrap')}>
                    {!ruta ? (
                      <span className="text-xs text-slate-400">No disponible</span>
                    ) : grupo === 'sin-revisar' ? (
                      <Button size="sm" iconLeft="pan_tool" loading={tomar.isPending && tomar.variables === e.id} disabled={tomar.isPending} onClick={() => tomar.mutate(e.id, { onSuccess: () => navigate(ruta) })}>
                        Tomar
                      </Button>
                    ) : (
                      <div className="flex items-center justify-end gap-0.5">
                        {columnas.liberar && (a.liberar ? <AccionIcono icono="lock_open" etiqueta="Liberar" ayuda="vuelve a «sin revisar» y otro lo puede tomar" onClick={() => setALiberar(e)} /> : <HuecoAccion />)}
                        {columnas.reasignar && (a.reasignar ? <AccionIcono icono="swap_horiz" etiqueta="Reasignar" ayuda="pasar el expediente a otro usuario de Catastro" onClick={() => setAReasignar(e)} /> : <HuecoAccion />)}
                        {columnas.anular &&
                          (a.anular ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              iconLeft="cancel"
                              title="Anular expediente registrado por error"
                              className="ml-1 w-26 border-red-300 px-3 text-red-600 hover:border-red-400 hover:bg-red-50 focus-visible:ring-red-500/30 dark:border-red-500/40 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-500/10"
                              onClick={() => setACancelar(e)}
                            >
                              Anular
                            </Button>
                          ) : (
                            <span aria-hidden className="ml-1 w-26 shrink-0" />
                          ))}
                        <Button size="sm" iconRight="arrow_forward" className="ml-2 px-3" onClick={() => navigate(ruta)}>
                          Abrir
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <CancelarAlta expediente={aCancelar} onCerrar={() => setACancelar(null)} />
      <LiberarAlta expediente={aLiberar} propio={aLiberar?.tomadoPorId === usuario?.id} onCerrar={() => setALiberar(null)} />
      <ReasignarAlta expediente={aReasignar} onCerrar={() => setAReasignar(null)} />
    </>
  )
}

function Seccion({ oficina, grupo, titulo, descripcion, icono, expedientes, vacio }: { oficina: OficinaBackend; grupo: Grupo; titulo: string; descripcion: string; icono: string; expedientes: ExpedienteEnBandeja[]; vacio: string }) {
  return (
    <Card className="mb-6">
      <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
        <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary">
          <Icon name={icono} className="text-[18px]!" />
        </span>
        <div>
          <h2 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
            {titulo}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{expedientes.length}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{descripcion}</p>
        </div>
      </div>
      {expedientes.length ? <Tabla oficina={oficina} grupo={grupo} expedientes={expedientes} /> : <EmptyState icon="inbox" titulo={vacio} className="py-8" />}
    </Card>
  )
}

/**
 * Bandeja de la oficina (backend real): los expedientes que están en ella, de cualquier trámite,
 * divididos en los que todavía nadie revisó (sin tomar: se toman desde acá) y los pendientes
 * (ya los tiene alguien de la oficina y siguen acá).
 */
export function BandejaExpedientes({ oficina }: { oficina: OficinaBackend }) {
  const bandeja = useBandeja(oficina)
  const { usuario } = useSesion()

  if (bandeja.isPending) return <LoadingState mensaje="Cargando la bandeja…" className="py-10" />
  if (bandeja.isError) return <ErrorState error={bandeja.error} onRetry={() => void bandeja.refetch()} reintentando={bandeja.isFetching} className="mb-6" />

  // Las altas pendientes de padrón no son trabajo en curso: Catastro las tiene aparte (PendientesPadronPanel).
  const enCurso = bandeja.data.filter((e) => e.etapa !== 'ESPERA_PADRON')
  const sinRevisar = enCurso.filter((e) => !e.tomadoPor)
  const pendientes = enCurso.filter((e) => e.tomadoPor)
  return (
    <>
      {oficina === 'distrito' && usuario?.distrito && !usuario.esAdministrador && (
        <p className="mb-4 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <Icon name="location_on" className="text-[18px]! text-primary" />
          Expedientes correspondientes al <strong>{usuario.distrito.nombre}</strong> y aquellos sin ubicación registrada.
        </p>
      )}
      <AvisoPlazos expedientes={enCurso} />
      <Seccion oficina={oficina} grupo="sin-revisar" titulo="Ingresados sin asignar" descripcion="Expedientes recibidos en la oficina, pendientes de asignación." icono="move_to_inbox" expedientes={sinRevisar} vacio="No hay expedientes ingresados sin asignar." />
      <Seccion oficina={oficina} grupo="pendientes" titulo="Asignados" descripcion="Expedientes en trámite asignados a un agente de la oficina." icono="assignment_ind" expedientes={pendientes} vacio="No hay expedientes asignados." />
    </>
  )
}
