import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Alert } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Spinner } from '@/components/ui/Spinner'
import { formatearFecha } from '@/config/expedientes'
import { concesionesApi } from '@/features/concesiones/api'
import { FichaConcesion } from '@/features/concesiones/components/FichaConcesion'
import { concesionKeys, useConcesion } from '@/features/concesiones/hooks'
import { useDominio } from '@/hooks/useDominio'
import { mensajeDeError } from '@/services/api/errors'
import type { Expediente } from '@/types/domain'
import { ChecksCircuito, EtapaLayout, useAccionEtapa } from '../../shared/etapas'
import { bloqueoDeCierre } from '../../shared/etapas/cierre'
import { cierreAnulacionSchema, type CierreAnulacionForm } from '../schemas'
import { datosAnulacion } from './config'

/**
 * Catastro (cierre), prototipo FinalizarAnulacion.html: con la resolución firmada y todas
 * las oficinas de acuerdo, se hace la baja lógica de la concesión. No se borra nada: la
 * concesión queda «Anulada» y se sigue viendo en búsquedas e historial.
 */
export function EtapaCierreAnulacion({ expediente }: { expediente: Expediente }) {
  const qc = useQueryClient()
  const d = useDominio()
  const { pedir, dialogos } = useAccionEtapa(expediente)
  const datos = datosAnulacion(expediente)
  const concesion = useConcesion(expediente.concesionOrigenId ?? undefined)
  const bloqueo = bloqueoDeCierre(expediente, d)
  const form = useForm<CierreAnulacionForm>({
    resolver: zodResolver(cierreAnulacionSchema),
    defaultValues: { confirmaIrreversible: false },
  })
  const confirmada = useWatch({ control: form.control, name: 'confirmaIrreversible' })
  const numero = expediente.numeroConcesion ?? datos?.numeroConcesion ?? '—'

  const finalizar = form.handleSubmit(() => {
    const c = concesion.data
    if (!c || bloqueo) return
    const motivo = datos?.motivo ?? ''
    pedir({
      titulo: '¿Desea finalizar la anulación?',
      mensaje: `Esta acción no se puede deshacer. La concesión N° ${numero} quedará anulada (baja lógica) por la resolución ${expediente.resolucion?.numero ?? ''}.`,
      tono: 'danger',
      confirmar: 'Sí, finalizar anulación',
      exito: { titulo: 'Anulación finalizada', mensaje: 'El trámite de anulación ha sido finalizado correctamente.' },
      // Primero la baja de la concesión: si falla, el expediente no se cierra.
      antes: () =>
        concesionesApi.anular({
          concesion: c,
          baja: {
            fecha: new Date().toISOString(),
            expedienteId: expediente.id,
            numeroExpediente: expediente.numero,
            resolucion: expediente.resolucion,
            motivo,
          },
        }),
      revision: {
        resultado: 'aprobado',
        observaciones: `Concesión N° ${numero} anulada (baja lógica). Motivo: ${motivo}`,
        // Rentas tiene que dejar de liquidar la tasa: queda pendiente la baja en el padrón.
        cambios: { padronRentasPendiente: true },
      },
      despues: () => qc.invalidateQueries({ queryKey: concesionKeys.all }),
    })
  })

  return (
    <FormProvider {...form}>
      <EtapaLayout
        expediente={expediente}
        titulo="Finalizar anulación"
        icono="block"
        descripcion="Revise los datos de la concesión. Al finalizar se da de baja (baja lógica): no se borra, queda anulada en el historial."
        ancho
        accion={
          <Button size="sm" variant="danger" iconRight="block" disabled={!!bloqueo || !concesion.data || !confirmada} onClick={() => void finalizar()}>
            Finalizar anulación
          </Button>
        }
      >
        <form noValidate onSubmit={finalizar} className="flex flex-col gap-6">
          <ChecksCircuito expediente={expediente} mensaje="El trámite pasó por todas las oficinas y está aprobado. Falta la baja de la concesión." />

          {bloqueo && <Alert>{bloqueo} No se puede finalizar la anulación.</Alert>}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                <Icon name="gavel" className="text-base!" /> Resolución
              </p>
              {expediente.resolucion ? (
                <p className="mt-1 text-sm">
                  <strong className="text-base text-slate-900 dark:text-white">{expediente.resolucion.numero}</strong> · firmada el{' '}
                  {formatearFecha(expediente.resolucion.fecha)}
                </p>
              ) : (
                <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">Sin resolución registrada.</p>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                <Icon name="notes" className="text-base!" /> Motivo de la anulación
              </p>
              <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">{datos?.motivo ?? '—'}</p>
            </div>
          </div>

          {concesion.isPending && expediente.concesionOrigenId && (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Spinner className="size-4" /> Cargando la concesión…
            </p>
          )}
          {concesion.isError && <Alert>{mensajeDeError(concesion.error)} No se puede finalizar sin la concesión.</Alert>}
          {concesion.data && (
            <div className="rounded-xl border border-slate-200 p-5 dark:border-slate-700">
              <p className="mb-4 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                <Icon name="folder_shared" className="text-primary" /> Concesión N° {concesion.data.numeroConcesion}
                <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-500/15 dark:text-green-300">
                  Estado: Vigente
                </span>
              </p>
              <FichaConcesion concesion={concesion.data} />
            </div>
          )}

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
            <input type="checkbox" {...form.register('confirmaIrreversible')} className="mt-0.5 size-4 shrink-0 accent-red-600" />
            <span className="text-sm">
              <span className="block font-semibold text-red-800 dark:text-red-200">Confirmar que todo está completo, porque no se podrá revertir</span>
              <span className="text-red-700 dark:text-red-300">Al marcar esta casilla, se anulará por completo la concesión con N° {numero}.</span>
            </span>
          </label>
        </form>
      </EtapaLayout>
      {dialogos}
    </FormProvider>
  )
}
