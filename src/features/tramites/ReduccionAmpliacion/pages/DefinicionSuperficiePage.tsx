import { useMemo, useState, type ReactNode } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { ROUTES } from '@/config/routes'
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { EditorPoligonoMap } from '@/components/map/EditorPoligonoMap'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { datosConcesion, titularPrincipal, type Concesion } from '@/features/concesiones/datos'
import { useConcesion, useConcesionesDelDepartamento } from '@/features/concesiones/hooks'
import { useDominio } from '@/hooks/useDominio'
import { centroide, escalarPoligono, perimetroMetros, type LatLng } from '@/lib/geo'
import { cn } from '@/lib/cn'
import { esNoEncontrado, mensajeDeError } from '@/services/api/errors'
import { PasosTramite } from '../../shared/components/PasosTramite'
import { esNumeroExpediente } from '../../shared/schemas/expediente'
import { useIniciarModificacion } from '../hooks'
import { evaluarPropuesta, NOMBRE_TIPO, recalcularCaudal } from '../superficie'
import type { TipoModificacion } from '../types'

const TITULO = 'Definición de Superficie'
/** Escala del polígono (como en el prototipo: 60 % a 140 %). */
const ESCALA = { min: 60, max: 140, paso: 10 }
/** Concesiones a menos de ~8 km se dibujan como vecinas y se controlan superposiciones. */
const RADIO_VECINAS = 0.08

/** Paso 2 (Catastro), prototipo reducionampliacion.html: nueva superficie sobre el mapa. */
export default function DefinicionSuperficiePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const concesionId = params.get('concesion') ?? ''
  const numeroExpediente = params.get('expediente') ?? ''
  const concesion = useConcesion(concesionId || undefined)

  if (!concesionId || !esNumeroExpediente(numeroExpediente)) return <Navigate to={ROUTES.tramites.reduccionAmpliacion.inicio} replace />

  if (concesion.isPending) {
    return (
      <>
        <PageHeader title={TITULO} />
        <LoadingState mensaje="Cargando la concesión…" />
      </>
    )
  }
  if (concesion.isError || !concesion.data.poligono) {
    return (
      <>
        <PageHeader title={TITULO} />
        {concesion.isError && !esNoEncontrado(concesion.error) ? (
          <ErrorState error={concesion.error} onRetry={() => void concesion.refetch()} reintentando={concesion.isFetching} />
        ) : (
          <EmptyState
            icon="search_off"
            titulo={concesion.isError ? 'La concesión no está vigente' : 'La concesión no tiene polígono cargado'}
            descripcion="Vuelva a la búsqueda y elija otra concesión."
          >
            <Button size="sm" onClick={() => navigate(ROUTES.tramites.reduccionAmpliacion.inicio)}>
              Volver a la búsqueda
            </Button>
          </EmptyState>
        )}
      </>
    )
  }

  return <Definicion concesion={concesion.data} numeroExpediente={numeroExpediente} />
}

function Dato({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">{label}</p>
      <div className="text-base font-bold text-slate-900 dark:text-white">{children}</div>
    </div>
  )
}

type Dialogo = 'invalida' | 'confirmar' | 'creada' | null

function Definicion({ concesion, numeroExpediente }: { concesion: Concesion; numeroExpediente: string }) {
  const navigate = useNavigate()
  const d = useDominio()
  // Solo las del mismo departamento: no se descargan todas las concesiones.
  const vigentes = useConcesionesDelDepartamento(concesion.ubicacion.departamento)
  const iniciar = useIniciarModificacion()
  const original = concesion.poligono!.coordenadas
  const hectareasActual = concesion.poligono!.hectareas
  const centro = useMemo(() => centroide(original), [original])

  const [tipo, setTipo] = useState<TipoModificacion>('reduccion')
  const [escala, setEscala] = useState(100)
  const [propuesta, setPropuesta] = useState<LatLng[]>(original)
  const [dialogo, setDialogo] = useState<Dialogo>(null)

  const vecinos = useMemo(
    () =>
      (vigentes.data ?? [])
        .filter((c) => c.id !== concesion.id && c.poligono)
        .map((c) => c.poligono!.coordenadas)
        .filter((p) => {
          const [lat, lng] = centroide(p)
          return Math.abs(lat - centro[0]) < RADIO_VECINAS && Math.abs(lng - centro[1]) < RADIO_VECINAS
        }),
    [vigentes.data, concesion.id, centro],
  )

  const estado = useMemo(() => evaluarPropuesta(tipo, original, propuesta, hectareasActual, vecinos), [tipo, original, propuesta, hectareasActual, vecinos])
  const usosActuales = useMemo(() => datosConcesion(concesion)?.usos.items ?? [], [concesion])
  const recalculo = useMemo(
    () => recalcularCaudal(usosActuales, concesion.caudalAsignado, hectareasActual, estado.hectareas, d.uso),
    [usosActuales, concesion.caudalAsignado, hectareasActual, estado.hectareas, d.uso],
  )

  function aplicarEscala(valor: number) {
    const v = Math.min(ESCALA.max, Math.max(ESCALA.min, valor))
    setEscala(v)
    setPropuesta(escalarPoligono(original, v / 100, centro))
  }

  function ejemplo(t: TipoModificacion) {
    setTipo(t)
    aplicarEscala(t === 'reduccion' ? 86 : 110)
  }

  function guardar() {
    setDialogo(estado.valido ? 'confirmar' : 'invalida')
  }

  function confirmar() {
    iniciar.mutate(
      {
        inicio: { concesionId: concesion.id, numeroExpediente },
        tipo,
        propuesta: { coordenadas: propuesta, hectareas: estado.hectareas, caudal: recalculo.caudal, usos: recalculo.usos },
      },
      { onSuccess: () => setDialogo('creada'), onError: () => setDialogo(null) },
    )
  }

  const oficinaDestino = d.nombreOficina(d.etapas[1]?.oficinaId ?? 'recaudacion')
  const diferenciaCaudal = recalculo.caudal != null && concesion.caudalAsignado != null ? recalculo.caudal - concesion.caudalAsignado : null

  return (
    <>
      <PageHeader title={TITULO} description="Seleccione el tipo de trámite y utilice las herramientas del mapa para trazar los nuevos límites de la concesión." />

      <div className="flex flex-col gap-6">
        <PasosTramite previos={['Búsqueda']} actual={1} titulo="Definición de superficie" />

        <Card className="flex flex-wrap gap-x-8 gap-y-2 p-4 text-sm">
          {[
            ['Expediente', numeroExpediente],
            ['Concesión', concesion.numeroConcesion ?? '—'],
            ['Titular', titularPrincipal(concesion)],
            ['Ubicación', `${concesion.ubicacion.localidad}, ${concesion.ubicacion.departamento} · Distrito ${concesion.ubicacion.distrito}`],
          ].map(([label, valor]) => (
            <span key={label}>
              <span className="text-slate-500 dark:text-slate-400">{label}: </span>
              <strong className="text-slate-900 dark:text-white">{valor}</strong>
            </span>
          ))}
        </Card>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          {/* Panel lateral */}
          <Card className="flex flex-col gap-5 p-5">
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Tipo de modificación</legend>
              <div className="grid grid-cols-2 gap-2">
                {(['reduccion', 'ampliacion'] as const).map((t) => (
                  <label
                    key={t}
                    className={cn(
                      'flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-semibold transition',
                      tipo === t ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300',
                    )}
                  >
                    <input type="radio" name="mod_type" className="sr-only" checked={tipo === t} onChange={() => setTipo(t)} />
                    <Icon name={t === 'reduccion' ? 'zoom_in_map' : 'zoom_out_map'} className="text-lg!" /> {NOMBRE_TIPO[t]}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid grid-cols-2 gap-4">
              <Dato label="Superficie actual">{hectareasActual.toFixed(2)} ha</Dato>
              <Dato label="Nueva superficie">{estado.hectareas.toFixed(2)} ha</Dato>
              <p className="col-span-2 -mt-2 text-xs text-slate-500 dark:text-slate-400">La superficie se recalcula automáticamente a partir del polígono editado.</p>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Escala del polígono</p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => aplicarEscala(escala - ESCALA.paso)} disabled={escala <= ESCALA.min}>
                  −10%
                </Button>
                <input
                  type="range"
                  min={ESCALA.min}
                  max={ESCALA.max}
                  value={escala}
                  onChange={(e) => aplicarEscala(Number(e.target.value))}
                  aria-label="Escala del polígono"
                  className="flex-1 accent-primary"
                />
                <Button size="sm" variant="secondary" onClick={() => aplicarEscala(escala + ESCALA.paso)} disabled={escala >= ESCALA.max}>
                  +10%
                </Button>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Escala actual: <strong>{escala}%</strong>
              </p>
            </div>

            <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Simulación geográfica</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Arrastre los vértices del mapa o cargue un ejemplo para visualizar cómo quedaría la modificación.</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => ejemplo('reduccion')}>
                  Cargar reducción
                </Button>
                <Button size="sm" variant="secondary" onClick={() => ejemplo('ampliacion')}>
                  Cargar ampliación
                </Button>
                <Button size="sm" variant="ghost" iconLeft="restart_alt" onClick={() => aplicarEscala(100)}>
                  Restablecer polígono original
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Dato label="Superficie permitida">{estado.limite}</Dato>
              <Dato label="Estado geométrico">
                <span className={estado.valido ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>{estado.valido ? 'Válido' : 'Revisar'}</span>
              </Dato>
              <Dato label="Perímetro">{Math.round(perimetroMetros(propuesta))} m</Dato>
              <Dato label="Vértices">{propuesta.length}</Dato>
            </div>

            <div className="flex flex-col gap-1 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/50">
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">Forma de servicio</p>
              {usosActuales.length ? (
                usosActuales.map((u) => {
                  const info = d.uso(u.uso)
                  return (
                    <p key={u.uso}>
                      {info?.nombre ?? u.uso} <span className="text-slate-500">· {info?.dotacion} l/s por {info?.unidad}</span>
                    </p>
                  )
                })
              ) : (
                <p>{concesion.usoId ? d.uso(concesion.usoId)?.nombre : '—'}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Dato label="Caudal asignado (recalculado)">{recalculo.caudal == null ? '—' : `${recalculo.caudal.toFixed(2)} l/s`}</Dato>
              <Dato label="Diferencia estimada">
                <span className={cn(estado.diferencia > 0 ? 'text-emerald-600' : estado.diferencia < 0 ? 'text-red-600' : '')}>
                  {estado.diferencia > 0 ? '+' : ''}
                  {estado.diferencia.toFixed(2)} ha
                </span>
                {diferenciaCaudal != null && (
                  <span className="block text-xs font-medium text-slate-500">
                    {diferenciaCaudal > 0 ? '+' : ''}
                    {diferenciaCaudal.toFixed(2)} l/s
                  </span>
                )}
              </Dato>
            </div>

            <div
              className={cn(
                'flex gap-3 rounded-lg p-3 text-sm',
                estado.valido ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300',
              )}
            >
              <Icon name={estado.valido ? 'info' : 'error'} />
              <p>{estado.mensaje}</p>
            </div>
          </Card>

          {/* Mapa */}
          <div className="flex flex-col gap-3">
            <EditorPoligonoMap original={original} propuesta={propuesta} vecinos={vecinos} valido={estado.valido} onChange={setPropuesta} className="h-[36rem]" />
            {iniciar.isError && <Alert>{mensajeDeError(iniciar.error)}</Alert>}
          </div>
        </div>

        <Card className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <Button variant="ghost" size="sm" iconLeft="close" onClick={() => navigate(ROUTES.catastro.tramites)}>
            Cancelar trámite
          </Button>
          <div className="flex gap-3">
            <Button variant="secondary" size="sm" iconLeft="arrow_back" onClick={() => navigate(ROUTES.tramites.reduccionAmpliacion.inicio)}>
              Atrás
            </Button>
            <Button size="sm" iconRight="arrow_forward" loading={iniciar.isPending} onClick={guardar}>
              Guardar y siguiente
            </Button>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={dialogo === 'invalida'}
        tone="danger"
        title="Superficie inválida"
        message={`Revise la nueva superficie antes de continuar. ${estado.mensaje}`}
        confirmLabel="Entendido"
        onConfirm={() => setDialogo(null)}
      />
      <ConfirmDialog
        open={dialogo === 'confirmar'}
        title="Guardar modificación"
        message={`${NOMBRE_TIPO[tipo]} de ${hectareasActual.toFixed(2)} ha a ${estado.hectareas.toFixed(2)} ha. Se creará el expediente ${numeroExpediente} y pasará a ${oficinaDestino}. La concesión mantiene su superficie actual hasta que el trámite termine con resolución.`}
        confirmLabel="Sí, guardar"
        cancelLabel="Cancelar"
        loading={iniciar.isPending}
        onConfirm={confirmar}
        onCancel={() => setDialogo(null)}
      />
      <ConfirmDialog
        open={dialogo === 'creada'}
        tone="success"
        title="Modificación iniciada"
        message={`El expediente ${numeroExpediente} se registró y fue derivado a ${oficinaDestino}.`}
        confirmLabel="Ver seguimiento"
        onConfirm={() => navigate(ROUTES.catastro.pendientes)}
      />
    </>
  )
}
