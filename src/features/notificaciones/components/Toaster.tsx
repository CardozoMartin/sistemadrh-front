import { useEffect } from 'react'
import { Link } from 'react-router'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import { useNotificaciones, type Aviso } from '../context'

const DURACION_MS = 7000

function AvisoItem({ aviso, onClose }: { aviso: Aviso; onClose: (id: string) => void }) {
  const cerrar = () => onClose(aviso.id)

  useEffect(() => {
    const t = setTimeout(() => onClose(aviso.id), DURACION_MS)
    return () => clearTimeout(t)
  }, [aviso.id, onClose])

  const exito = aviso.tono === 'exito'
  return (
    <div
      role="status"
      className="pointer-events-auto flex w-full max-w-sm animate-[aparecer_.25s_ease-out] items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-surface-dark"
    >
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full',
          exito ? 'bg-green-100 text-green-600 dark:bg-green-500/15' : 'bg-primary/10 text-primary',
        )}
      >
        <Icon name={aviso.icono} className="text-xl!" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{aviso.titulo}</p>
        {aviso.detalle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{aviso.detalle}</p>}
        {aviso.ruta && (
          <Link to={aviso.ruta} onClick={cerrar} className="mt-2 inline-block text-xs font-semibold text-primary hover:underline">
            Ver bandeja
          </Link>
        )}
      </div>
      <button type="button" onClick={cerrar} aria-label="Cerrar aviso" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
        <Icon name="close" className="text-lg!" />
      </button>
    </div>
  )
}

/** Avisos emergentes (abajo a la derecha): expedientes que llegan en vivo y confirmaciones de acciones. */
export function Toaster() {
  const { avisos, cerrarAviso } = useNotificaciones()
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[calc(100%-2rem)] flex-col items-end gap-3 sm:w-auto">
      {avisos.map((a) => (
        <AvisoItem key={a.id} aviso={a} onClose={cerrarAviso} />
      ))}
    </div>
  )
}
