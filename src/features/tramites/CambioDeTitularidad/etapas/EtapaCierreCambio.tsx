import { useMemo } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Alert } from '@/components/feedback/States'
import { FormSection, FormTextField } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Spinner } from '@/components/ui/Spinner'
import { formatearFecha } from '@/config/expedientes'
import { concesionesApi } from '@/features/concesiones/api'
import { datosConcesion, titularPrincipal } from '@/features/concesiones/datos'
import { concesionKeys, useConcesion } from '@/features/concesiones/hooks'
import { useDominio } from '@/hooks/useDominio'
import { mensajeDeError } from '@/services/api/errors'
import type { Expediente } from '@/types/domain'
import { TitularesDomiciliosFields } from '../../shared'
import { ChecksCircuito, EtapaLayout, useAccionEtapa } from '../../shared/etapas'
import { bloqueoDeCierre } from '../../shared/etapas/cierre'
import { nombreTitular } from '../../shared/schemas/titular'
import { descripcionCambio } from '../api'
import { crearCierreCambioSchema, nuevoTitularVacio, type CierreCambioForm } from '../schemas'
import type { DatosExpedienteCambioTitularidad } from '../types'
import { datosCambio } from './config'

/**
 * Catastro (cierre), prototipo CatastroFinalizacion.html — «Finalización carga de titular».
 * Recién acá, con la resolución firmada y todas las oficinas de acuerdo, se cargan los
 * datos definitivos del nuevo titular y la concesión cambia de manos. Hasta ese momento
 * el titular sigue siendo el actual.
 */
export function EtapaCierreCambio({ expediente }: { expediente: Expediente }) {
  const qc = useQueryClient()
  const d = useDominio()
  const { pedir, dialogos } = useAccionEtapa(expediente)
  const datos = datosCambio(expediente)
  const concesion = useConcesion(expediente.concesionOrigenId ?? undefined)
  const anteriores = useMemo(() => datos?.titularesAnteriores ?? [], [datos])
  const resolucion = expediente.resolucion
  const schema = useMemo(() => crearCierreCambioSchema(anteriores.map((t) => t.documento), resolucion?.numero ?? null), [anteriores, resolucion])

  const bloqueo = bloqueoDeCierre(expediente, d)

  const form = useForm<CierreCambioForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...(datos ? { titulares: datos.titulares, domicilios: datos.domicilios } : nuevoTitularVacio()),
      numeroResolucion: resolucion?.numero ?? '',
    },
    mode: 'onTouched',
  })

  const catastral = concesion.data ? datosConcesion(concesion.data)?.catastral : null
  const nomenclatura = catastral ? [catastral.circunscripcion, catastral.seccion, catastral.parcela, catastral.lamina].filter(Boolean).join('-') : null

  const finalizar = form.handleSubmit((v) => {
    const c = concesion.data
    if (!c || bloqueo) return
    const { numeroResolucion: tipeada, ...definitivo } = v
    // Ya validado que coincide: se guarda tal como la registró Secretaría General.
    const numeroResolucion = resolucion?.numero ?? tipeada.toUpperCase()
    const nombreNuevo = nombreTitular(definitivo.titulares[0])
    const cargaFinal: DatosExpedienteCambioTitularidad['cargaFinal'] = {
      numeroResolucion,
      fecha: new Date().toISOString(),
      propuesto: { titulares: datos?.titulares ?? [], domicilios: datos?.domicilios ?? [] },
    }
    pedir({
      titulo: '¿Finalizar el trámite?',
      mensaje: `Con la resolución ${numeroResolucion}, la concesión N° ${c.numeroConcesion} pasa de ${titularPrincipal(c)} a ${nombreNuevo}. Los titulares anteriores quedan registrados en el historial de la concesión.`,
      confirmar: 'Sí, finalizar',
      exito: { titulo: 'Trámite finalizado', mensaje: 'El cambio de titularidad ha sido registrado con éxito.' },
      // Primero se actualiza la concesión: si falla, el expediente no se cierra.
      antes: () => concesionesApi.cambiarTitulares({ concesion: c, ...definitivo, expediente }),
      revision: {
        resultado: 'aprobado',
        observaciones: `Carga final del titular con la resolución ${numeroResolucion}. Concesión N° ${c.numeroConcesion} transferida a ${nombreNuevo}.`,
        detalle: { numeroResolucion },
        cambios: {
          padronRentasPendiente: true,
          titular: descripcionCambio(anteriores[0] ? nombreTitular(anteriores[0]) : expediente.titular, nombreNuevo),
          datos: { ...(datos ?? {}), ...definitivo, cargaFinal },
        },
      },
      despues: () => qc.invalidateQueries({ queryKey: concesionKeys.all }),
    })
  })

  return (
    <FormProvider {...form}>
      <EtapaLayout
        expediente={expediente}
        titulo="Finalización carga de titular"
        icono="person_check"
        descripcion="Con la resolución firmada, cargue los datos definitivos del nuevo titular. Recién al finalizar la concesión cambia de titular."
        ancho
        accion={
          <Button size="sm" iconRight="check_circle" disabled={!!bloqueo || !concesion.data} onClick={() => void finalizar()}>
            Finalizar
          </Button>
        }
      >
        <form noValidate onSubmit={finalizar} className="flex flex-col gap-8">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800/50">
            {nomenclatura && (
              <span className="flex items-center gap-1.5">
                <Icon name="info" className="text-base! text-primary" /> Nomenclatura: <strong>{nomenclatura}</strong>
              </span>
            )}
            <span>
              Concesión N° <strong>{expediente.numeroConcesion ?? '—'}</strong>
            </span>
            <span>
              Titular hasta finalizar: <strong>{concesion.data ? titularPrincipal(concesion.data) : expediente.titular.split(' → ')[0]}</strong>
            </span>
            {resolucion && (
              <span>
                Resolución <strong>{resolucion.numero}</strong> del {formatearFecha(resolucion.fecha)}
              </span>
            )}
          </div>

          <ChecksCircuito expediente={expediente} mensaje="El trámite pasó por todas las oficinas y está aprobado. Falta la carga final del titular." />

          {bloqueo && <Alert>{bloqueo} No se puede finalizar el trámite.</Alert>}
          {concesion.isPending && expediente.concesionOrigenId && (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Spinner className="size-4" /> Cargando la concesión…
            </p>
          )}
          {concesion.isError && <Alert>{mensajeDeError(concesion.error)} No se puede finalizar sin la concesión.</Alert>}

          <FormSection title="Resolución" icon="gavel">
            <div className="grid gap-6 md:grid-cols-2">
              <FormTextField
                name="numeroResolucion"
                label="N° de resolución"
                required
                placeholder="Ej: RES-2026-001"
                hint="Tal como figura en la resolución firmada que registró Secretaría General."
              />
            </div>
          </FormSection>

          <TitularesDomiciliosFields tituloTitular="Titular 1" />

          <div className="flex gap-3 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm dark:border-sky-500/30 dark:bg-sky-500/10">
            <Icon name="info" className="text-sky-600" />
            <div>
              <p className="mb-1 font-semibold text-sky-800 dark:text-sky-200">Información importante</p>
              <p className="text-sky-700 dark:text-sky-300">
                Recuerde que para continuar, deberá tener toda la documentación respaldatoria. Los datos vienen de la pre-carga del inicio: revíselos
                contra la documentación antes de finalizar.
              </p>
            </div>
          </div>
        </form>
      </EtapaLayout>
      {dialogos}
    </FormProvider>
  )
}
