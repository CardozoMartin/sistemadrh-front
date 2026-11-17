import { useRef, useState, type DragEvent } from 'react'
import { useController } from 'react-hook-form'
import { Icon } from '@/components/ui/Icon'
import { IconButton } from '@/components/ui/IconButton'
import { cn } from '@/lib/cn'
import type { Adjunto } from '@/types/domain'
import { useFieldError } from './rhf'

interface Props {
  /** Campo del formulario: Adjunto[] */
  name: string
  label: string
  required?: boolean
  /** Extensiones aceptadas, ej: ['.pdf'] */
  extensiones: string[]
  maxMB: number
  multiple?: boolean
  className?: string
}

const tamanio = (b: number) => (b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`)

/**
 * Carga de archivos con validación de tipo y tamaño. En la demo se guardan solo los
 * metadatos (json-server no almacena archivos); con el backend real se sube el archivo.
 */
export function FormAdjuntosField({ name, label, required, extensiones, maxMB, multiple, className }: Props) {
  const { field } = useController({ name })
  const errorForm = useFieldError(name)
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const adjuntos = (field.value as Adjunto[] | undefined) ?? []

  function agregar(files: FileList | null) {
    if (!files?.length) return
    setErrorArchivo(null)
    const nuevos: Adjunto[] = []
    for (const f of Array.from(files)) {
      const ext = `.${f.name.split('.').pop()?.toLowerCase()}`
      if (!extensiones.includes(ext)) {
        setErrorArchivo(`«${f.name}»: formato no permitido (${extensiones.join(', ')}).`)
        continue
      }
      if (f.size > maxMB * 1024 * 1024) {
        setErrorArchivo(`«${f.name}» supera los ${maxMB} MB.`)
        continue
      }
      nuevos.push({ nombre: f.name, tamanioBytes: f.size, tipo: f.type || ext })
    }
    if (nuevos.length) field.onChange(multiple ? [...adjuntos, ...nuevos] : nuevos.slice(0, 1))
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setArrastrando(false)
    agregar(e.dataTransfer.files)
  }

  const error = errorArchivo ?? errorForm

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-sm font-medium text-slate-900 dark:text-slate-200">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      <button
        type="button"
        ref={field.ref}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setArrastrando(true)
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center gap-1 rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors hover:border-primary hover:bg-primary/5',
          arrastrando ? 'border-primary bg-primary/5' : error ? 'border-red-300 dark:border-red-500/50' : 'border-slate-300 dark:border-slate-600',
        )}
      >
        <Icon name="upload_file" className="text-3xl! text-slate-400" />
        <span className="text-sm text-slate-600 dark:text-slate-300">
          Arrastrá {multiple ? 'los archivos' : 'el archivo'} o <span className="font-semibold text-primary">hacé clic para subir</span>
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {extensiones.map((e) => e.slice(1).toUpperCase()).join(', ')} — máx. {maxMB} MB{multiple ? ' por archivo' : ''}
        </span>
      </button>
      <input
        ref={input}
        type="file"
        className="hidden"
        accept={extensiones.join(',')}
        multiple={multiple}
        onChange={(e) => {
          agregar(e.target.files)
          e.target.value = ''
        }}
      />

      {adjuntos.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {adjuntos.map((a, i) => (
            <li key={`${a.nombre}-${i}`} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-sm dark:bg-slate-800/60">
              <Icon name="description" className="text-lg! text-primary" />
              <span className="min-w-0 flex-1 truncate">{a.nombre}</span>
              <span className="text-xs text-slate-500">{tamanio(a.tamanioBytes)}</span>
              <IconButton icon="close" label={`Quitar ${a.nombre}`} tone="danger" className="p-1" onClick={() => field.onChange(adjuntos.filter((_, j) => j !== i))} />
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
