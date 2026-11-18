import { useEffect, useState } from 'react'
import { Alert, ErrorState, LoadingState } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/cn'
import { exportarConcesiones, useColumnasExportables, type ColumnaExportable, type FiltrosConcesiones } from '../consultaConcesiones'

/** Lo último que eligió el usuario (solo en este navegador; si no se puede leer, se usa el padrón). */
const GUARDADO = 'drh.exportarConcesiones'
interface Eleccion {
  columnas: string[]
  detalle: boolean
}
function leerEleccion(): Eleccion | null {
  try {
    const e = JSON.parse(localStorage.getItem(GUARDADO) ?? 'null') as Eleccion | null
    return e && Array.isArray(e.columnas) ? e : null
  } catch {
    return null
  }
}
function guardarEleccion(e: Eleccion) {
  try {
    localStorage.setItem(GUARDADO, JSON.stringify(e))
  } catch {
    // sin almacenamiento: la próxima vez arranca con el padrón
  }
}

const GRUPOS: { grupo: ColumnaExportable['grupo']; titulo: string; descripcion: string }[] = [
  { grupo: 'PADRON', titulo: 'Columnas del padrón', descripcion: 'Las mismas de la planilla del sistema anterior (BASE_DE_DATOS_FINAL), en el mismo orden.' },
  { grupo: 'SISTEMA', titulo: 'Más datos del sistema', descripcion: 'Expediente, resolución, inmueble, polígono, caudal, deudas…' },
]

interface Props {
  open: boolean
  onClose: () => void
  /** Los filtros de la búsqueda: se exportan TODAS las concesiones que los cumplen. */
  filtros: FiltrosConcesiones
  total: number
}

/**
 * Exportar la consulta a Excel eligiendo las columnas. Por defecto salen las del padrón del
 * sistema anterior, para que la planilla se vea igual a la que ya usan; se pueden quitar o
 * agregar columnas y sumar las hojas de detalle (titulares, domicilios, usos y deudas).
 */
export function ExportarConcesionesDialog({ open, onClose, filtros, total }: Props) {
  const columnas = useColumnasExportables(open)
  const [elegidas, setElegidas] = useState<Set<string>>(new Set())
  const [detalle, setDetalle] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const delPadron = () => new Set((columnas.data ?? []).filter((c) => c.porDefecto).map((c) => c.clave))

  // Al abrir: lo último que eligió (solo las columnas que siguen existiendo) o las del padrón.
  useEffect(() => {
    if (!open || !columnas.data) return
    const validas = new Set(columnas.data.map((c) => c.clave))
    const guardada = leerEleccion()
    const previas = guardada?.columnas.filter((c) => validas.has(c)) ?? []
    setElegidas(previas.length ? new Set(previas) : new Set(columnas.data.filter((c) => c.porDefecto).map((c) => c.clave)))
    setDetalle(guardada?.detalle ?? false)
    setError(null)
  }, [open, columnas.data])

  const alternar = (clave: string) =>
    setElegidas((s) => {
      const n = new Set(s)
      if (n.has(clave)) n.delete(clave)
      else n.add(clave)
      return n
    })
  const alternarGrupo = (grupo: ColumnaExportable['grupo'], marcar: boolean) =>
    setElegidas((s) => {
      const n = new Set(s)
      for (const c of columnas.data ?? []) if (c.grupo === grupo) (marcar ? n.add(c.clave) : n.delete(c.clave))
      return n
    })

  async function descargar() {
    // En el orden del catálogo (el backend las ordena igual).
    const lista = (columnas.data ?? []).map((c) => c.clave).filter((c) => elegidas.has(c))
    setExportando(true)
    setError(null)
    try {
      await exportarConcesiones(filtros, { columnas: lista, detalle })
      guardarEleccion({ columnas: lista, detalle })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo exportar la planilla.')
    } finally {
      setExportando(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      bloqueado={exportando}
      icon="download"
      title="Exportar a Excel"
      description={`${total} concesi${total === 1 ? 'ón' : 'ones'} de la búsqueda (todas, no solo esta página). Elija qué columnas lleva la planilla.`}
      size="xl"
      footer={
        <>
          <Button variant="secondary" disabled={exportando} onClick={onClose}>
            Cancelar
          </Button>
          <Button iconLeft="download" loading={exportando} disabled={!elegidas.size || exportando} onClick={() => void descargar()}>
            Descargar planilla
          </Button>
        </>
      }
    >
      {columnas.isPending && <LoadingState mensaje="Cargando columnas…" className="py-8" />}
      {columnas.isError && <ErrorState error={columnas.error} onRetry={() => void columnas.refetch()} className="py-8" />}
      {columnas.data && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-500 dark:text-slate-400">Elegir:</span>
            <Button size="sm" variant="secondary" onClick={() => setElegidas(delPadron())}>
              Como el padrón
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setElegidas(new Set(columnas.data.map((c) => c.clave)))}>
              Todas
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setElegidas(new Set())}>
              Ninguna
            </Button>
            <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">{elegidas.size} columnas elegidas</span>
          </div>

          {GRUPOS.map(({ grupo, titulo, descripcion }) => {
            const delGrupo = columnas.data.filter((c) => c.grupo === grupo)
            const todas = delGrupo.every((c) => elegidas.has(c.clave))
            return (
              <fieldset key={grupo} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                <legend className="px-1 text-sm font-semibold text-slate-900 dark:text-white">{titulo}</legend>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{descripcion}</p>
                  <button type="button" onClick={() => alternarGrupo(grupo, !todas)} className="text-xs font-medium text-primary hover:underline">
                    {todas ? 'Quitar todas' : 'Marcar todas'}
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {delGrupo.map((c) => (
                    <label
                      key={c.clave}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/60',
                        elegidas.has(c.clave) ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400',
                      )}
                    >
                      <input type="checkbox" className="size-4 accent-primary" checked={elegidas.has(c.clave)} onChange={() => alternar(c.clave)} />
                      {c.titulo}
                    </label>
                  ))}
                </div>
              </fieldset>
            )
          })}

          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={detalle} onChange={(e) => setDetalle(e.target.checked)} />
            <span>
              <span className="font-medium text-slate-900 dark:text-white">Agregar hojas de detalle</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">Una hoja más por cada titular, domicilio, uso y deuda pendiente (una fila por cada uno).</span>
            </span>
          </label>

          {!elegidas.size && <Alert tone="info">Elija al menos una columna.</Alert>}
          {error && <Alert>{error}</Alert>}
        </div>
      )}
    </Modal>
  )
}
