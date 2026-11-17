import { useMemo, useState, type ComponentType } from 'react'
import { FormProvider, useForm, type FieldErrors, type FieldPath } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormSelectField, FormTextField } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Stepper } from '@/components/ui/Stepper'
import { indiceDocumentos } from '@/features/concesiones/datos'
import { useDominio } from '@/hooks/useDominio'
import type { Expediente } from '@/types/domain'
import { opcionesDe } from '../../shared/opciones'
import { nombreTitular } from '../../shared/schemas/titular'
import { SECCIONES_CON_COMPONENTE, seccionDeCampo } from '../components/secciones'
import { completarPreCarga } from '../schemas'
import type { DatosExpedienteAlta } from '../types'
import { ChecksCircuito, EtapaLayout, useAccionEtapa } from '../../shared/etapas'
import { crearFinalizacionSchema, type FinalizacionForm } from './schemas'

function SeccionOtorgamiento() {
  const { tiposConcesion } = useDominio()
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <FormTextField name="otorgamiento.numeroConcesion" label="Número de concesión" required placeholder="Ej: 12345" hint="Asignado a pedido de Secretaría General." />
      <FormTextField name="otorgamiento.subconcesion" label="Número de subconcesión" placeholder="Opcional" />
      <FormSelectField name="otorgamiento.tipoConcesionId" label="Tipo de concesión" required placeholder="Seleccione una opción" options={opcionesDe(tiposConcesion)} />
      <FormTextField name="otorgamiento.resolucion" label="Resolución" placeholder="RES-XXXX" hint="Cargada por Secretaría General." />
    </div>
  )
}

/** Resumen final: visto bueno de cada oficina del circuito (según el historial). */
function crearSeccionChecks(expediente: Expediente): ComponentType {
  return function SeccionChecks() {
    return (
      <div className="flex flex-col gap-5">
        <ChecksCircuito expediente={expediente} mensaje="Todas las oficinas aprobaron el trámite de alta de concesión." />
        <div className="flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 p-4 dark:border-sky-500/30 dark:bg-sky-500/10">
          <Icon name="info" className="text-sky-600" />
          <div>
            <p className="font-semibold text-sky-800 dark:text-sky-200">Aviso importante</p>
            <p className="text-sm text-sky-700 dark:text-sky-300">Al finalizar, el trámite quedará pendiente de carga en el padrón de Rentas.</p>
          </div>
        </div>
      </div>
    )
  }
}

interface Pestania {
  key: string
  label: string
  campos: FieldPath<FinalizacionForm>[]
  Component: ComponentType
}

/** Primer path con error dentro de un objeto de errores de react-hook-form. */
function primerError(errors: FieldErrors, base = ''): string | null {
  for (const [key, value] of Object.entries(errors)) {
    if (!value || typeof value !== 'object') continue
    const path = base ? `${base}.${key}` : key
    if ('message' in value && typeof value.message === 'string') return path
    const hijo = primerError(value as FieldErrors, path)
    if (hijo) return hijo
  }
  return null
}

/** Catastro (cierre): otorgamiento, revisión final de los datos del alta y finalización. */
export function EtapaFinalizacion({ expediente }: { expediente: Expediente }) {
  const dominio = useDominio()
  const { pedir, dialogos } = useAccionEtapa(expediente)
  const datos = expediente.datos as DatosExpedienteAlta | null
  const schema = useMemo(() => crearFinalizacionSchema(dominio), [dominio])

  const pestanias: Pestania[] = useMemo(
    () => [
      { key: 'otorgamiento', label: 'Otorgamiento', campos: ['otorgamiento'], Component: SeccionOtorgamiento },
      ...SECCIONES_CON_COMPONENTE,
      { key: 'finalizacion', label: 'Finalización', campos: [], Component: crearSeccionChecks(expediente) },
    ],
    [expediente],
  )

  const form = useForm<FinalizacionForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...completarPreCarga(datos ?? undefined),
      otorgamiento: {
        numeroConcesion: expediente.numeroConcesion ?? '',
        subconcesion: '',
        tipoConcesionId: '',
        resolucion: expediente.resolucion?.numero ?? '',
      },
    },
    mode: 'onTouched',
  })

  const [actual, setActual] = useState(0)
  const pestania = pestanias[actual]
  const esUltima = actual === pestanias.length - 1

  function irA(i: number) {
    setActual(i)
    window.scrollTo({ top: 0 })
  }

  async function siguiente() {
    if (pestania.campos.length && !(await form.trigger(pestania.campos, { shouldFocus: true }))) return
    irA(actual + 1)
  }

  const finalizar = form.handleSubmit(
    (v) => {
      const { otorgamiento, ...preCarga } = v
      const caudal = Number(preCarga.suministro.caudalAsignado)
      pedir({
        titulo: '¿Desea finalizar el trámite?',
        mensaje: 'La concesión quedará otorgada y pendiente de carga en el padrón de Rentas.',
        confirmar: 'Sí, finalizar',
        exito: { titulo: 'Trámite finalizado', mensaje: `La concesión N° ${otorgamiento.numeroConcesion} fue otorgada. Pendiente de carga en el padrón de Rentas.` },
        revision: {
          resultado: 'aprobado',
          observaciones: `Concesión N° ${otorgamiento.numeroConcesion} otorgada (${dominio.tiposConcesion.find((t) => t.id === otorgamiento.tipoConcesionId)?.nombre ?? ''}).`,
          detalle: otorgamiento,
          // Los datos corregidos en el cierre actualizan el expediente.
          cambios: {
            numeroConcesion: otorgamiento.numeroConcesion,
            // Índices para buscar la concesión en el servidor (ver features/concesiones).
            fechaOtorgamiento: new Date().toISOString(),
            documentosTitulares: indiceDocumentos(preCarga.titulares),
            padronRentasPendiente: true,
            titular: nombreTitular(preCarga.titulares[0]),
            ubicacion: { departamento: preCarga.ubicacion.departamento, localidad: preCarga.ubicacion.localidad, distrito: preCarga.ubicacion.distrito },
            poligono: preCarga.ubicacion.poligono
              ? { coordenadas: preCarga.ubicacion.poligono.coordenadas, hectareas: preCarga.ubicacion.poligono.hectareas }
              : expediente.poligono,
            caudalAsignado: Number.isFinite(caudal) && preCarga.suministro.caudalAsignado ? caudal : expediente.caudalAsignado,
            datos: { ...(datos ?? {}), ...preCarga, otorgamiento },
          },
        },
      })
    },
    (errors) => {
      const path = primerError(errors)
      if (!path) return
      const i = path.startsWith('otorgamiento') ? 0 : seccionDeCampo(path) + 1
      if (i >= 0 && i !== actual) irA(i)
    },
  )

  return (
    <FormProvider {...form}>
      <EtapaLayout
        expediente={expediente}
        titulo="Finalización del trámite"
        icono="task_alt"
        descripcion="Revise los datos del alta, complete el otorgamiento y finalice el trámite."
        ancho
        accion={
          <div className="flex gap-3">
            <Button variant="secondary" size="sm" iconLeft="arrow_back" disabled={actual === 0} onClick={() => irA(actual - 1)}>
              Anterior
            </Button>
            {esUltima ? (
              <Button size="sm" iconRight="task_alt" onClick={() => void finalizar()}>
                Finalizar trámite
              </Button>
            ) : (
              <Button size="sm" iconRight="arrow_forward" onClick={() => void siguiente()}>
                Siguiente
              </Button>
            )}
          </div>
        }
      >
        <div className="flex flex-col gap-6">
          {!datos && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              Este expediente no tiene los datos de la carga inicial: complételos antes de finalizar.
            </p>
          )}
          {/* Todas las pestañas habilitadas: los datos ya vienen cargados desde la pre carga. */}
          <Stepper steps={pestanias} current={actual} maxReached={pestanias.length - 1} onSelect={irA} />
          <form noValidate onSubmit={finalizar}>
            <pestania.Component />
          </form>
        </div>
      </EtapaLayout>
      {dialogos}
    </FormProvider>
  )
}
