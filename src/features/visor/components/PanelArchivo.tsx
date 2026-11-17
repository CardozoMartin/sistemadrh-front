import { useRef, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import type { AnalisisGeometria } from '@/services/sig'
import { PanelComparacion } from './PanelComparacion'

interface Props {
  comparacion: AnalisisGeometria | null
  comparando: boolean
  error: string | null
  onArchivo: (archivo: File) => void
  onQuitar: () => void
  onSeleccionar: (concesionId: number) => void
}

/**
 * «Comparar archivo»: se arrastra o elige un KML/GeoJSON y se dibuja en rojo sobre el mapa,
 * con su superficie y las concesiones con las que se superpone. Sirve para revisar un pedido
 * antes de iniciar el trámite. No guarda nada.
 */
export function PanelArchivo({ comparacion, comparando, error, onArchivo, onQuitar, onSeleccionar }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [encima, setEncima] = useState(false)

  return (
    <div className="flex flex-col gap-3 p-3">
      <input
        ref={input}
        type="file"
        accept=".kml,.geojson,.json"
        className="hidden"
        onChange={(e) => {
          const archivo = e.target.files?.[0]
          if (archivo) onArchivo(archivo)
          e.target.value = ''
        }}
      />
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setEncima(true)
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => {
          e.preventDefault()
          setEncima(false)
          const archivo = e.dataTransfer.files[0]
          if (archivo) onArchivo(archivo)
        }}
        className={cn(
          'flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors',
          encima ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-700',
        )}
      >
        {comparando ? <Spinner className="size-8 text-primary" /> : <Icon name="upload_file" className="text-[36px]! text-slate-400" />}
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {comparando ? 'Analizando con PostGIS…' : 'Arrastre un archivo acá o'}
        </p>
        {!comparando && (
          <button type="button" onClick={() => input.current?.click()} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary/90">
            Elegir archivo
          </button>
        )}
        <p className="text-[11px] text-slate-400">KML o GeoJSON, en POSGAR 2007 faja 3 o en latitud/longitud</p>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200 dark:bg-red-950 dark:text-red-300 dark:ring-red-500/30">
          <Icon name="error" className="text-[18px]!" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      {comparacion ? (
        <PanelComparacion analisis={comparacion} onSeleccionar={onSeleccionar} onCerrar={onQuitar} />
      ) : (
        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          El polígono se dibuja en rojo punteado y se compara con las concesiones cargadas: superficie oficial, punto interior en POSGAR, río o canal más cercano y
          superposiciones. <strong>No se guarda nada.</strong>
        </p>
      )}
    </div>
  )
}
