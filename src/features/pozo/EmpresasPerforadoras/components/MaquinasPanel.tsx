import { useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Alert } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { formatearFecha } from '@/config/expedientes'
import { cn } from '@/lib/cn'
import { mensajeDeError, toApiError } from '@/services/api/errors'
import { useAgregarMaquina, useBajaMaquina, useModificarMaquina, useReactivarMaquina } from '../hooks'
import { datosMaquinaDe, esEditable, estadoDetallado, maquinaVacia, maquinasValidas } from '../reglas'
import { maquinaSchema, type MaquinaForm } from '../schemas'
import type { DatosMaquina, EmpresaPerforadora, Maquina } from '../types'
import { DialogoMotivo } from './DialogoMotivo'
import { MaquinaFields } from './MaquinaFields'

type Edicion = { tipo: 'nueva' } | { tipo: 'editar'; maquina: Maquina } | null

/** Formulario de una máquina (alta o modificación) en una ventana modal. */
function MaquinaModal({ empresa, edicion, onCerrar }: { empresa: EmpresaPerforadora; edicion: NonNullable<Edicion>; onCerrar: () => void }) {
  const agregar = useAgregarMaquina()
  const modificar = useModificarMaquina()
  const [motivo, setMotivo] = useState('')
  const editando = edicion.tipo === 'editar' ? edicion.maquina : null
  const form = useForm<MaquinaForm, unknown, DatosMaquina>({
    resolver: zodResolver(maquinaSchema),
    defaultValues: editando ? datosMaquinaDe(editando) : maquinaVacia(),
    mode: 'onTouched',
  })
  const mutacion = editando ? modificar : agregar
  const error = mutacion.error && toApiError(mutacion.error).code !== 'CODIGO_EXISTENTE' ? mutacion.error : null

  const guardar = form.handleSubmit(async (datos) => {
    try {
      if (editando) await modificar.mutateAsync({ empresa, maquinaId: editando.id, datos, observacion: motivo.trim() })
      else await agregar.mutateAsync({ empresa, datos })
      onCerrar()
    } catch (e) {
      // Código ya usado: se muestra en el campo.
      if (toApiError(e).code === 'CODIGO_EXISTENTE') form.setError('codigo', { message: toApiError(e).message }, { shouldFocus: true })
    }
  })

  return (
    <Modal
      open
      size="md"
      icon="precision_manufacturing"
      title={editando ? `Modificar máquina ${editando.codigo}` : 'Agregar máquina'}
      description={editando ? 'Los cambios quedan asentados en el historial con fecha y responsable.' : 'Registre la máquina con su código de referencia y una foto (RN-10).'}
      onClose={onCerrar}
      bloqueado={mutacion.isPending}
      footer={
        <>
          <Button size="sm" variant="secondary" disabled={mutacion.isPending} onClick={onCerrar}>
            Cancelar
          </Button>
          <Button size="sm" iconLeft="save" loading={mutacion.isPending} onClick={() => void guardar()}>
            {editando ? 'Guardar cambios' : 'Agregar máquina'}
          </Button>
        </>
      }
    >
      <FormProvider {...form}>
        <form noValidate onSubmit={guardar} className="flex flex-col gap-5">
          <MaquinaFields prefix="" />
          {editando && (
            <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
              Motivo del cambio (opcional)
              <input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                maxLength={200}
                placeholder="Ej: cambio de vehículo de traslado"
                className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none dark:border-slate-600 dark:bg-slate-800"
              />
            </label>
          )}
          {!!error && <Alert>{mensajeDeError(error)}</Alert>}
        </form>
      </FormProvider>
    </Modal>
  )
}

function Dato({ label, valor }: { label: string; valor: string }) {
  if (!valor) return null
  return (
    <span className="text-xs text-slate-500 dark:text-slate-400">
      {label}: <strong className="font-semibold text-slate-700 dark:text-slate-200">{valor}</strong>
    </span>
  )
}

/**
 * Parque de máquinas de la empresa: alta, modificación, baja y reactivación de cada
 * máquina (cada una queda en el historial). Una máquina de baja no se borra ni libera
 * su código.
 */
export function MaquinasPanel({ empresa }: { empresa: EmpresaPerforadora }) {
  const [edicion, setEdicion] = useState<Edicion>(null)
  const [aDarDeBaja, setADarDeBaja] = useState<Maquina | null>(null)
  const [aReactivar, setAReactivar] = useState<Maquina | null>(null)
  const baja = useBajaMaquina()
  const reactivar = useReactivarMaquina()
  const validas = maquinasValidas(empresa.maquinas)
  const activas = empresa.maquinas.filter((m) => m.activa)
  // Sin cambios mientras una oficina la revisa, si fue rechazada o si está de baja.
  const bloqueada = empresa.estado === 'BAJA' || !esEditable(empresa)
  const motivoBloqueo = bloqueada ? `No se pueden cambiar las máquinas: ${estadoDetallado(empresa).toLowerCase()}.` : undefined
  // Ordenadas: activas primero.
  const maquinas = [...empresa.maquinas].sort((a, b) => Number(b.activa) - Number(a.activa))
  const ultimaValida = aDarDeBaja && validas.length === 1 && validas[0].id === aDarDeBaja.id

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
        <div>
          <h3 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
            <Icon name="precision_manufacturing" className="text-primary" /> Parque de máquinas
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {activas.length} activa{activas.length === 1 ? '' : 's'} de {empresa.maquinas.length} registrada{empresa.maquinas.length === 1 ? '' : 's'}
          </p>
        </div>
        <Button size="sm" iconLeft="add" disabled={bloqueada} title={motivoBloqueo} onClick={() => setEdicion({ tipo: 'nueva' })}>
          Agregar máquina
        </Button>
      </div>

      <div className="flex flex-col gap-4 p-6">
        {validas.length === 0 && (
          <Alert>La empresa no tiene ninguna máquina activa con código y foto: no puede solicitar autorizaciones de perforación (RN-10).</Alert>
        )}
        {(baja.error || reactivar.error) && !aDarDeBaja && !aReactivar && <Alert>{mensajeDeError(baja.error ?? reactivar.error)}</Alert>}

        <ul className="grid gap-4 lg:grid-cols-2">
          {maquinas.map((m) => (
            <li
              key={m.id}
              className={cn('flex gap-4 rounded-xl border p-4', m.activa ? 'border-slate-200 dark:border-slate-700' : 'border-dashed border-slate-300 bg-slate-50 opacity-80 dark:border-slate-600 dark:bg-slate-800/40')}
            >
              <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                {m.foto ? <img src={m.foto.dataUrl} alt={`Foto de la máquina ${m.codigo}`} className={cn('h-full w-full object-cover', !m.activa && 'grayscale')} /> : <Icon name="image_not_supported" className="text-3xl! text-slate-400" />}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white dark:bg-slate-100 dark:text-slate-900">{m.codigo}</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                      m.activa ? 'bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
                    )}
                  >
                    {m.activa ? 'Activa' : 'De baja'}
                  </span>
                </div>
                <p className="truncate font-semibold text-slate-900 dark:text-white">{m.modelo}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                  <Dato label="Diámetro" valor={m.capacidadDiametro} />
                  <Dato label="Profundidad" valor={m.capacidadProfundidad && `${m.capacidadProfundidad} m`} />
                  <Dato label="Torre" valor={m.alturaTorre && `${m.alturaTorre} m`} />
                  <Dato label="Vehículo" valor={[m.vehiculoModelo, m.vehiculoPatente].filter(Boolean).join(' · ')} />
                </div>
                {m.baja && (
                  <p className="text-xs text-red-700 dark:text-red-300">
                    Baja del {formatearFecha(m.baja.fecha)}: {m.baja.motivo}
                  </p>
                )}
                {!bloqueada && (
                  <div className="mt-1 flex gap-3 text-sm">
                    {m.activa ? (
                      <>
                        <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setEdicion({ tipo: 'editar', maquina: m })}>
                          Modificar
                        </button>
                        <button type="button" className="font-semibold text-red-600 hover:underline" onClick={() => setADarDeBaja(m)}>
                          Dar de baja
                        </button>
                      </>
                    ) : (
                      <button type="button" className="font-semibold text-green-700 hover:underline dark:text-green-400" onClick={() => setAReactivar(m)}>
                        Reactivar
                      </button>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {edicion && <MaquinaModal key={edicion.tipo === 'editar' ? edicion.maquina.id : 'nueva'} empresa={empresa} edicion={edicion} onCerrar={() => setEdicion(null)} />}

      <DialogoMotivo
        open={!!aDarDeBaja}
        tono="danger"
        titulo={`Dar de baja la máquina ${aDarDeBaja?.codigo ?? ''}`}
        mensaje="La máquina deja de contar para las autorizaciones nuevas. No se borra: su código queda reservado y se ve en el historial."
        confirmar="Dar de baja"
        obligatorio
        placeholder="Ej: venta del equipo, fuera de servicio"
        cargando={baja.isPending}
        error={baja.error}
        onCancelar={() => {
          setADarDeBaja(null)
          baja.reset()
        }}
        onConfirmar={(motivo) => aDarDeBaja && baja.mutate({ empresa, maquinaId: aDarDeBaja.id, motivo }, { onSuccess: () => setADarDeBaja(null) })}
      >
        {ultimaValida && (
          <Alert>Es la única máquina activa con código y foto: la empresa no podrá solicitar autorizaciones hasta registrar otra (RN-10).</Alert>
        )}
      </DialogoMotivo>

      <DialogoMotivo
        open={!!aReactivar}
        titulo={`Reactivar la máquina ${aReactivar?.codigo ?? ''}`}
        mensaje="La máquina vuelve a contar como activa para la empresa."
        confirmar="Reactivar"
        cargando={reactivar.isPending}
        error={reactivar.error}
        onCancelar={() => {
          setAReactivar(null)
          reactivar.reset()
        }}
        onConfirmar={(observacion) => aReactivar && reactivar.mutate({ empresa, maquinaId: aReactivar.id, observacion }, { onSuccess: () => setAReactivar(null) })}
      />
    </Card>
  )
}
