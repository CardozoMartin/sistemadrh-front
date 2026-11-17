import { useMemo } from 'react'
import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Alert } from '@/components/feedback/States'
import { FormTextareaField, FormTextField } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Spinner } from '@/components/ui/Spinner'
import { formatearFecha } from '@/config/expedientes'
import { concesionesApi } from '@/features/concesiones/api'
import { concesionKeys, useConcesion } from '@/features/concesiones/hooks'
import { useDominio } from '@/hooks/useDominio'
import { mensajeDeError } from '@/services/api/errors'
import type { Expediente } from '@/types/domain'
import { ChecksCircuito, EtapaLayout, useAccionEtapa } from '../../shared/etapas'
import { bloqueoDeCierre } from '../../shared/etapas/cierre'
import { crearCierreSubdivisionSchema, type CierreSubdivisionForm } from '../schemas'
import { datosSubdivision } from './config'

/**
 * Catastro (cierre), prototipo subdivision/resumenFinalizacion.html: con la resolución y
 * todas las oficinas de acuerdo se otorga una concesión nueva por fracción y la concesión
 * madre queda «Subdividida» (no se borra: conserva su historial y apunta a las nuevas).
 */
export function EtapaCierreSubdivision({ expediente }: { expediente: Expediente }) {
  const qc = useQueryClient()
  const d = useDominio()
  const { pedir, dialogos, paso, usuario } = useAccionEtapa(expediente)
  const datos = datosSubdivision(expediente)
  const madre = useConcesion(expediente.concesionOrigenId ?? undefined)
  const resolucion = expediente.resolucion?.numero ?? null
  const schema = useMemo(() => crearCierreSubdivisionSchema(resolucion), [resolucion])
  const form = useForm<CierreSubdivisionForm>({
    resolver: zodResolver(schema),
    defaultValues: { numeroResolucion: '', observaciones: '', confirmaIrreversible: false },
    mode: 'onTouched',
  })
  const confirmada = useWatch({ control: form.control, name: 'confirmaIrreversible' })
  const fracciones = datos?.fracciones ?? []
  const sinNumero = fracciones.filter((f) => !f.numeroConcesion)
  const sinDatos = fracciones.filter((f) => !f.carga)
  const bloqueo =
    bloqueoDeCierre(expediente, d) ??
    (!datos ? 'El expediente no tiene los datos de la subdivisión.' : null) ??
    (sinNumero.length ? `Falta el número de concesión de: ${sinNumero.map((f) => f.nombre).join(', ')}.` : null) ??
    (sinDatos.length ? `Faltan los datos de: ${sinDatos.map((f) => f.nombre).join(', ')}.` : null)
  const numeroMadre = expediente.numeroConcesion ?? datos?.numeroConcesion ?? '—'

  const finalizar = form.handleSubmit((v) => {
    const m = madre.data
    if (!m || !datos || bloqueo || !paso || !usuario) return
    const nuevas = fracciones.map((f) => `N° ${f.numeroConcesion} (${f.nombre})`).join(', ')
    pedir({
      titulo: '¿Registrar y cerrar el expediente?',
      mensaje: `Esta acción es irreversible. La concesión N° ${numeroMadre} quedará «Subdividida» y se otorgarán ${fracciones.length} concesiones nuevas: ${nuevas}.`,
      tono: 'danger',
      confirmar: 'Sí, registrar y cerrar',
      exito: { titulo: 'Subdivisión finalizada', mensaje: `Se otorgaron ${fracciones.length} concesiones nuevas y la N° ${numeroMadre} quedó subdividida.` },
      // Primero las concesiones nuevas y la madre: si falla, el expediente no se cierra.
      antes: () =>
        concesionesApi.subdividir({
          madre: m,
          expediente,
          fracciones: fracciones.map((f) => ({
            fraccion: f.nombre,
            numeroConcesion: f.numeroConcesion!,
            coordenadas: f.coordenadas,
            hectareas: f.hectareas,
            carga: f.carga!,
          })),
          etapaId: paso.etapaId,
          oficinaId: expediente.oficinaId,
          usuarioId: usuario.id,
        }),
      revision: {
        resultado: 'aprobado',
        observaciones: `Concesión N° ${numeroMadre} subdividida en ${nuevas}.${v.observaciones ? ` ${v.observaciones}` : ''}`,
        detalle: v,
        // Rentas tiene que dar de baja la madre y empadronar las nuevas.
        cambios: { padronRentasPendiente: true },
      },
      despues: () => qc.invalidateQueries({ queryKey: concesionKeys.all }),
    })
  })

  return (
    <FormProvider {...form}>
      <EtapaLayout
        expediente={expediente}
        titulo="Cierre de la subdivisión"
        icono="call_split"
        descripcion="Revise las fracciones, la resolución y los números de concesión. Al cerrar se otorgan las concesiones nuevas y la madre queda subdividida."
        ancho
        accion={
          <Button size="sm" variant="danger" iconRight="task_alt" disabled={!!bloqueo || !madre.data || !confirmada} onClick={() => void finalizar()}>
            Registrar y cerrar expediente
          </Button>
        }
      >
        <form noValidate onSubmit={finalizar} className="flex flex-col gap-6">
          <ChecksCircuito expediente={expediente} mensaje="El trámite pasó por todas las oficinas y está aprobado. Falta otorgar las concesiones nuevas." />

          {bloqueo && <Alert>{bloqueo} No se puede cerrar la subdivisión.</Alert>}
          {madre.isPending && expediente.concesionOrigenId && (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Spinner className="size-4" /> Cargando la concesión madre…
            </p>
          )}
          {madre.isError && <Alert>{mensajeDeError(madre.error)} No se puede cerrar sin la concesión madre vigente.</Alert>}

          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
            <Icon name="info" className="text-amber-600" />
            <p className="text-amber-800 dark:text-amber-200">
              La concesión madre N° <strong>{numeroMadre}</strong> ({datos?.madre.hectareas.toFixed(2) ?? '—'} ha, {datos?.madre.titular ?? expediente.titular}) pasará a{' '}
              <strong>Subdividida</strong> y se crearán <strong>{fracciones.length}</strong> concesiones nuevas.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                <Icon name="gavel" className="text-base!" /> Resolución de Secretaría General
              </p>
              {expediente.resolucion ? (
                <p className="mt-1 text-sm">
                  <strong className="text-base text-slate-900 dark:text-white">{expediente.resolucion.numero}</strong> · firmada el {formatearFecha(expediente.resolucion.fecha)}
                </p>
              ) : (
                <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">Sin resolución registrada.</p>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                <Icon name="pin" className="text-base!" /> N° de concesión por fracción (informados por Catastro)
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {fracciones.map((f) => (
                  <li key={f.clave} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ background: f.color }} /> {f.nombre}
                    </span>
                    <strong className={f.numeroConcesion ? 'text-slate-900 dark:text-white' : 'text-amber-600'}>{f.numeroConcesion ? `N° ${f.numeroConcesion}` : 'Sin asignar'}</strong>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <FormTextField
              name="numeroResolucion"
              label="N° de resolución (confirmar)"
              required
              icon="gavel"
              placeholder="Ingrese el N° para confirmar"
              hint="Debe coincidir con el informado por Secretaría General."
            />
            <FormTextareaField name="observaciones" label="Observaciones de cierre (opcional)" rows={3} placeholder="Notas adicionales para el expediente archivado…" />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
            <input type="checkbox" {...form.register('confirmaIrreversible')} className="mt-0.5 size-4 shrink-0 accent-red-600" />
            <span className="text-sm">
              <span className="block font-semibold text-red-800 dark:text-red-200">Esta acción es irreversible</span>
              <span className="text-red-700 dark:text-red-300">
                La concesión madre N° {numeroMadre} quedará como Subdividida y se crearán {fracciones.length} nuevas concesiones.
              </span>
            </span>
          </label>
        </form>
      </EtapaLayout>
      {dialogos}
    </FormProvider>
  )
}
