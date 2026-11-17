import { useRef, useState, type ReactNode } from 'react'
import { useController } from 'react-hook-form'
import { useFieldError } from '@/components/form'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import type { FotoMaquina } from '../types'

const TIPOS = ['image/jpeg', 'image/png', 'image/webp']
const MAX_MB = 5
/** Lado mayor de la imagen guardada (px). */
const LADO_MAX = 800

/** Reduce la foto para guardarla en el registro (en la demo no hay almacenamiento de archivos). */
function reducir(archivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(archivo)
    img.onload = () => {
      const escala = Math.min(1, LADO_MAX / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * escala)
      canvas.height = Math.round(img.height * escala)
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo leer la imagen.'))
    }
    img.src = url
  })
}

/**
 * Foto de referencia de la máquina (RN-07), como en el prototipo: vista previa arriba y
 * el campo «Foto» con el selector de archivo. Flujo 7.2 del CU: formato o tamaño no permitido.
 */
export function FotoMaquinaField({ name, id = name, children }: { name: string; id?: string; /** Campos entre la vista previa y «Foto» (orden del prototipo). */ children?: ReactNode }) {
  const { field } = useController({ name })
  const errorForm = useFieldError(name)
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null)
  const [procesando, setProcesando] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const foto = field.value as FotoMaquina | null
  const error = errorArchivo ?? errorForm

  async function elegir(archivo: File | undefined) {
    if (!archivo) return
    setErrorArchivo(null)
    if (!TIPOS.includes(archivo.type) || archivo.size > MAX_MB * 1024 * 1024) {
      setErrorArchivo(`El archivo no es válido o supera el tamaño permitido (JPG, PNG o WEBP de hasta ${MAX_MB} MB).`)
      return
    }
    setProcesando(true)
    try {
      const dataUrl = await reducir(archivo)
      field.onChange({ nombre: archivo.name, tamanioBytes: archivo.size, tipo: archivo.type, dataUrl } satisfies FotoMaquina)
    } catch (e) {
      setErrorArchivo((e as Error).message)
    } finally {
      setProcesando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Vista previa (clic para elegir la foto) */}
      <button
        type="button"
        ref={field.ref}
        onClick={() => input.current?.click()}
        aria-label={foto ? 'Cambiar la foto' : 'Cargar una foto'}
        className={cn(
          'flex h-44 items-center justify-center overflow-hidden rounded-lg border border-dashed bg-slate-50 transition-colors hover:border-primary dark:bg-slate-800/60',
          error ? 'border-red-300 dark:border-red-500/50' : 'border-slate-300 dark:border-slate-600',
        )}
      >
        {foto ? (
          <img src={foto.dataUrl} alt={`Foto de ${foto.nombre}`} className="h-full w-full object-cover" />
        ) : (
          <Icon name={procesando ? 'hourglass_top' : 'image'} className="text-5xl! text-slate-300" />
        )}
      </button>

      {children}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-sm font-medium text-slate-900 dark:text-slate-200">
          Foto<span className="ml-0.5 text-red-500">*</span>
        </label>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="rounded border border-slate-300 bg-slate-100 px-3 py-1 font-medium text-slate-700 hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
          >
            Seleccionar archivo
          </button>
          <span className="min-w-0 truncate text-slate-600 dark:text-slate-300">{foto ? foto.nombre : 'Sin archivos seleccionados'}</span>
          {foto && (
            <button type="button" className="font-semibold text-red-600 hover:underline" onClick={() => field.onChange(null)}>
              Quitar
            </button>
          )}
        </div>
        <input
          id={id}
          ref={input}
          type="file"
          accept={TIPOS.join(',')}
          className="hidden"
          onChange={(e) => {
            void elegir(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </div>
  )
}
