import { useRef, useState, type DragEvent } from 'react'
import { useController } from 'react-hook-form'
import { PolygonPreviewMap } from '@/components/map/PolygonPreviewMap'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Spinner } from '@/components/ui/Spinner'
import { useFieldError } from '@/components/form'
import { calcularHectareas, parsearPoligono, type LatLng } from '@/lib/geo'
import { cn } from '@/lib/cn'
import { toApiError } from '@/services/api/errors'
import { analizarArchivoGeografico } from '@/services/sig'
import type { PoligonoForm } from '../schemas/poligono'

const ACEPTADOS = '.kml,.geojson,.json'

interface Props {
  /** Campo del formulario donde se guarda el polígono (PoligonoForm | null). */
  name: string
  titulo?: string
}

const formatearTamanio = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`)
const formatearHa = (ha: number) => ha.toLocaleString('es-AR', { maximumFractionDigits: 2 })

/** Anillo exterior GeoJSON ([lng, lat], cerrado) → vértices [lat, lng] sin repetir el primero. */
function aVertices(anillo: number[][]): LatLng[] {
  const vertices = anillo.map(([lng, lat]) => [lat, lng] as LatLng)
  const [primero, ultimo] = [vertices[0], vertices[vertices.length - 1]]
  return primero && ultimo && primero[0] === ultimo[0] && primero[1] === ultimo[1] ? vertices.slice(0, -1) : vertices
}

/**
 * Carga de un KML/GeoJSON con la concesión dibujada.
 *
 * 1. El archivo se manda al backend: PostGIS lo lee, valida la geometría (que no se cruce,
 *    que esté en Tucumán), calcula la superficie oficial y busca superposiciones.
 * 2. Si el archivo tiene un problema, se muestra el motivo que da el backend.
 * 3. Si el backend no está disponible, se lee en el navegador (como antes) y se avisa
 *    que no pasó por la validación de PostGIS.
 */
export function KmlUploadField({ name, titulo = 'KML de la concesión' }: Props) {
  const { field } = useController({ name })
  const errorForm = useFieldError(name)
  const poligono = field.value as PoligonoForm | null
  const input = useRef<HTMLInputElement>(null)
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null)
  const [avisos, setAvisos] = useState<string[]>([])
  const [analizando, setAnalizando] = useState(false)
  const [arrastrando, setArrastrando] = useState(false)

  async function procesar(archivo: File | undefined) {
    if (!archivo) return
    setErrorArchivo(null)
    setAvisos([])
    setAnalizando(true)
    try {
      // Paso 1: validación y medición en PostGIS.
      const analisis = await analizarArchivoGeografico(archivo)
      const partes = analisis.geojson.coordinates.length
      field.onChange({
        nombreArchivo: archivo.name,
        tamanioBytes: archivo.size,
        coordenadas: aVertices(analisis.geojson.coordinates[0][0]),
        hectareas: analisis.superficieHa,
        validadoPostgis: true,
        sistemaOrigen: analisis.sistemaOrigen === 'POSGAR_FAJA3' ? 'POSGAR 2007 faja 3' : 'Lat/long WGS84',
        partes,
        superposiciones: analisis.superposiciones,
        // El original viaja con el formulario hasta que se guarda la sección (pocos KB).
        contenido: await archivo.text(),
      } satisfies PoligonoForm)
      setAvisos([
        ...analisis.avisos,
        ...(partes > 1 ? ['Por ahora el formulario conserva solo la primera parte; la superficie mostrada es la del total.'] : []),
      ])
    } catch (e) {
      const error = toApiError(e)
      // Paso 2: el backend rechazó el archivo (polígono inválido, fuera de Tucumán…).
      if (error.status !== null && error.status < 500) {
        setErrorArchivo(error.message)
        return
      }
      // Paso 3: sin backend, lectura local sin validación.
      const coordenadas = parsearPoligono(await archivo.text(), archivo.name)
      if (!coordenadas || coordenadas.length < 3) {
        setErrorArchivo('No se pudo leer el polígono. Verifique que el archivo sea un KML o GeoJSON válido con un polígono.')
        return
      }
      field.onChange({
        nombreArchivo: archivo.name,
        tamanioBytes: archivo.size,
        coordenadas,
        hectareas: calcularHectareas(coordenadas),
        validadoPostgis: false,
      } satisfies PoligonoForm)
      setAvisos(['No se pudo validar con el servidor (¿está corriendo el backend?). El polígono se leyó en el navegador, sin controlar la geometría; la superficie es aproximada.'])
    } finally {
      setAnalizando(false)
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setArrastrando(false)
    void procesar(e.dataTransfer.files[0])
  }

  const error = errorArchivo ?? errorForm
  const superposiciones = poligono?.superposiciones ?? []

  return (
    <div className="flex flex-col gap-4">
      <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
        <Icon name="upload_file" className="text-primary" />
        {titulo}
      </h3>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setArrastrando(true)
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-6 text-center transition-colors',
          arrastrando ? 'border-primary bg-primary/5' : error ? 'border-red-300 dark:border-red-500/50' : 'border-slate-300 dark:border-slate-600',
        )}
      >
        {analizando ? <Spinner className="size-9 text-primary" /> : <Icon name="map" className="text-4xl! text-slate-400" />}
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {analizando ? (
            'Validando el polígono con PostGIS…'
          ) : (
            <>
              Arrastre el archivo acá o <span className="font-semibold">selecciónelo</span> desde su equipo.
            </>
          )}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">KML o GeoJSON en POSGAR 2007 faja 3 (EPSG:5345) o en latitud/longitud.</p>
        <input
          ref={input}
          type="file"
          accept={ACEPTADOS}
          className="hidden"
          onChange={(e) => {
            void procesar(e.target.files?.[0])
            e.target.value = '' // permite volver a elegir el mismo archivo
          }}
        />
        <Button size="sm" variant="secondary" iconLeft="upload" disabled={analizando} onClick={() => input.current?.click()} ref={field.ref}>
          {poligono ? 'Reemplazar archivo' : 'Seleccionar archivo'}
        </Button>
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
          <Icon name="error" className="text-[18px]!" />
          {error}
        </p>
      )}

      {avisos.map((aviso) => (
        <p key={aviso} className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          <Icon name="info" className="text-[18px]!" />
          {aviso}
        </p>
      ))}

      {poligono && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800/60">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Icon name="check_circle" filled className="text-green-600" />
              <span className="truncate font-semibold">{poligono.nombreArchivo}</span>
              <span className="text-slate-500 dark:text-slate-400">
                · {formatearTamanio(poligono.tamanioBytes)} · {poligono.coordenadas.length} vértices ·{' '}
                <strong className="text-slate-700 dark:text-slate-200">{formatearHa(poligono.hectareas)} ha</strong>
              </span>
              {poligono.validadoPostgis ? (
                <>
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-500/15 dark:text-green-300">Validado con PostGIS</span>
                  {poligono.sistemaOrigen && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">{poligono.sistemaOrigen}</span>
                  )}
                </>
              ) : (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">Sin validar</span>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              iconLeft="delete"
              onClick={() => {
                field.onChange(null)
                setAvisos([])
              }}
            >
              Quitar
            </Button>
          </div>

          {superposiciones.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
              <p className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
                <Icon name="layers" className="text-[18px]!" />
                Se superpone con {superposiciones.length === 1 ? 'otra concesión' : `${superposiciones.length} concesiones`}
              </p>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300/80">No impide seguir: queda registrado para que lo revisen Catastro y Distrito.</p>
              <ul className="mt-2 flex flex-col gap-1 text-amber-900 dark:text-amber-200">
                {superposiciones.map((s) => (
                  <li key={s.concesionId} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate">
                      {s.numero ? `Concesión ${s.numero}` : `Exp. ${s.expediente ?? '—'}`} · {s.titular ?? 'sin titular'}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">{formatearHa(s.superficieHa)} ha en común</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <PolygonPreviewMap coordenadas={poligono.coordenadas} etiqueta={`Concesión · ${formatearHa(poligono.hectareas)} ha`} />
        </div>
      )}
    </div>
  )
}
