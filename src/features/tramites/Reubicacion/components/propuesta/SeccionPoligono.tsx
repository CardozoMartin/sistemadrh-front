import { lazy, Suspense, useEffect, useState } from 'react'
import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { Alert } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Spinner } from '@/components/ui/Spinner'
import type { LatLng } from '@/lib/geo'
import { mensajeDeError } from '@/services/api/errors'
import { KmlUploadField } from '../../../shared/components/KmlUploadField'
import type { PoligonoForm } from '../../../shared/schemas/poligono'
import type { ReubicacionBackend } from '../../backend.types'
import { anilloAGeoJson, anilloExterior, ladoDeAnillo, ladoDeForm, ladoDePoligono, textoAjuste, verticesMovidos } from '../../formato'
import { useGuardarPoligonoReubicacion } from '../../hooks'
import { ListaAvisos } from '../Avisos'
import { ComparacionLugar } from '../ComparacionReubicacion'
import { EncabezadoSeccion } from './EncabezadoSeccion'

// El editor (Leaflet) se carga recién cuando se ajusta.
const EditorPoligonoMap = lazy(() => import('@/components/map/EditorPoligonoMap').then((m) => ({ default: m.EditorPoligonoMap })))

/** El ajuste en el mapa: de qué polígono se partió y cómo quedó (null mientras no se ajusta). */
interface Ajuste {
  /** true: se partió del KML elegido; false: del polígono vigente. */
  desdeKml: boolean
  base: LatLng[]
  ajustado: LatLng[]
}

/**
 * El nuevo lugar al que llega el agua (caso de uso, pasos 10-12). Dos formas, que se pueden combinar:
 *   - subir el KML / GeoJSON del plano de reubicación;
 *   - ajustar el polígono en el mapa, arrastrando sus vértices: el del KML elegido o, si no hay KML,
 *     una copia del vigente.
 * Mientras no se guarda se ve la comparación con el vigente (vista previa). Al guardar se manda el
 * archivo y/o la geometría ajustada; el backend registra de dónde salió (KML, KML ajustado o ajustado
 * sobre el vigente) y deja el KML de respaldo.
 */
export function SeccionPoligono({ datos }: { datos: ReubicacionBackend }) {
  const { reubicacion } = datos
  const { vigente, propuesta } = reubicacion
  const guardar = useGuardarPoligonoReubicacion(datos.expediente.id)
  const [avisosArchivo, setAvisosArchivo] = useState<string[]>([])
  const [ajuste, setAjuste] = useState<Ajuste | null>(null)
  const [editando, setEditando] = useState(false)
  const form = useForm<{ poligono: PoligonoForm | null }>({ defaultValues: { poligono: null } })
  const elegido = useWatch({ control: form.control, name: 'poligono' })

  const anilloVigente = anilloExterior(vigente.poligono)
  const ladoVigente = vigente.poligono && ladoDePoligono(vigente.poligono)
  // Un KML con varias partes no se ajusta en el mapa (el editor trabaja con un solo anillo).
  const kmlAjustable = !!elegido && (elegido.partes ?? 1) <= 1
  const movidos = ajuste ? verticesMovidos(ajuste.base, ajuste.ajustado) : []
  const cantidadMovidos = movidos.filter(Boolean).length

  // Si se elige otro KML (o se lo quita), el ajuste anterior ya no vale: se parte de cero.
  useEffect(() => {
    setAjuste(null)
    setEditando(false)
  }, [elegido])

  /** Empezar a ajustar: desde el KML elegido o, si no hay, desde una copia del vigente. */
  function ajustar() {
    if (!ajuste) {
      const base = elegido ? elegido.coordenadas : anilloVigente
      setAjuste({ desdeKml: !!elegido, base, ajustado: base })
    }
    setEditando(true)
  }

  function deshacer() {
    setAjuste((a) => a && { ...a, ajustado: a.base })
  }

  function descartar() {
    setAjuste(null)
    setEditando(false)
    form.reset({ poligono: null })
  }

  // Lo que se mandaría: el archivo (si hay) y la geometría ajustada (si se ajustó o si se parte del vigente).
  const conGeometria = !!ajuste && (cantidadMovidos > 0 || !ajuste.desdeKml)
  const hayAlgo = !!elegido?.contenido || conGeometria

  function onGuardar() {
    if (!hayAlgo) return
    guardar.mutate(
      {
        archivo: elegido?.contenido ? { nombre: elegido.nombreArchivo, contenido: elegido.contenido } : undefined,
        geometria: conGeometria && ajuste ? anilloAGeoJson(ajuste.ajustado) : undefined,
      },
      {
        onSuccess: (r) => {
          setAvisosArchivo(r.avisosArchivo)
          setAjuste(null)
          setEditando(false)
          form.reset({ poligono: null })
        },
      },
    )
  }

  // Lo que se ve como «Cómo queda»: lo ajustado, el KML elegido o lo guardado.
  const enPrevia = ajuste
    ? ladoDeAnillo(ajuste.ajustado, elegido?.nombreArchivo ?? null, textoAjuste(ajuste.desdeKml, cantidadMovidos))
    : elegido
      ? { ...ladoDeForm(elegido), origen: 'KML del plano (sin ajustes)' }
      : null

  return (
    <section id="paso-poligono" className="scroll-mt-24">
      <Card>
        <EncabezadoSeccion icono="polyline" titulo="Nuevo lugar al que llega el agua" descripcion="Suba el KML del plano de reubicación y/o ajuste el polígono en el mapa." />
        <div className="flex flex-col gap-5 p-6">
          <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <Icon name="warning" className="shrink-0" />
            <p>
              El nuevo polígono tiene que quedar <strong>dentro de la propiedad del solicitante</strong>
              {reubicacion.concesion.padron ? ` (padrón ${reubicacion.concesion.padron})` : ''}: verifíquelo con el plano de reubicación. La magnitud no cambia, así que la superficie debería ser la misma.
            </p>
          </div>

          <FormProvider {...form}>
            <KmlUploadField name="poligono" titulo={propuesta.poligono ? 'Reemplazar con el KML del plano' : 'KML del plano (optativo si lo ajusta en el mapa)'} sinMapa />
          </FormProvider>

          {/* Ajustar en el mapa: sobre el KML elegido o, sin KML, sobre una copia del vigente. */}
          {!editando && (
            <div className="flex flex-wrap items-center gap-3">
              {elegido ? (
                <Button size="sm" variant="secondary" iconLeft="edit_location_alt" disabled={!kmlAjustable} onClick={ajustar}>
                  {ajuste ? 'Seguir ajustando en el mapa' : 'Ajustar este KML en el mapa'}
                </Button>
              ) : (
                anilloVigente.length >= 3 && (
                  <Button size="sm" variant="secondary" iconLeft="edit_location_alt" onClick={ajustar}>
                    {ajuste ? 'Seguir ajustando en el mapa' : 'Ajustar sobre el polígono vigente'}
                  </Button>
                )
              )}
              {elegido && !kmlAjustable && <span className="text-xs text-slate-500 dark:text-slate-400">El KML tiene varias partes: no se puede ajustar en el mapa.</span>}
              {!elegido && anilloVigente.length < 3 && <span className="text-xs text-slate-500 dark:text-slate-400">La concesión no tiene polígono vigente: suba el KML del plano.</span>}
            </div>
          )}

          {editando && ajuste && (
            <div className="flex flex-col gap-3 rounded-lg border border-primary/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <Icon name="edit_location_alt" className="text-primary" /> {textoAjuste(ajuste.desdeKml, cantidadMovidos)}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" iconLeft="undo" disabled={cantidadMovidos === 0} onClick={deshacer}>
                    Deshacer cambios
                  </Button>
                  <Button size="sm" iconLeft="check" onClick={() => setEditando(false)}>
                    Listo, ver la comparación
                  </Button>
                </div>
              </div>
              <Suspense
                fallback={
                  <div className="flex h-96 items-center justify-center">
                    <Spinner className="size-5 text-primary" />
                  </div>
                }
              >
                <EditorPoligonoMap
                  original={anilloVigente}
                  propuesta={ajuste.ajustado}
                  movidos={movidos}
                  onChange={(coords) => setAjuste((a) => a && { ...a, ajustado: coords })}
                  className="h-[30rem]"
                />
              </Suspense>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Arrastre los vértices hasta el nuevo lugar. Punteado: el lugar de hoy. Los vértices que movió quedan en naranja. La superficie es estimada: PostGIS la mide al guardar.
              </p>
            </div>
          )}

          {hayAlgo && (
            <div className="flex flex-wrap justify-end gap-2">
              <Button size="sm" variant="ghost" disabled={guardar.isPending} onClick={descartar}>
                Descartar
              </Button>
              <Button size="sm" iconLeft="save" loading={guardar.isPending} onClick={onGuardar}>
                Guardar polígono
              </Button>
            </div>
          )}
          {guardar.error && <Alert>{mensajeDeError(guardar.error)}</Alert>}
          <ListaAvisos titulo="Lectura del polígono" avisos={avisosArchivo} tono="info" />

          {!editando &&
            (enPrevia ? (
              <ComparacionLugar vigente={ladoVigente} propuesto={enPrevia} previa />
            ) : (
              propuesta.poligono && <ComparacionLugar vigente={ladoVigente} propuesto={ladoDePoligono(propuesta.poligono)} />
            ))}
          <ListaAvisos titulo="Revise antes de enviar" avisos={reubicacion.avisos} />
        </div>
      </Card>
    </section>
  )
}
