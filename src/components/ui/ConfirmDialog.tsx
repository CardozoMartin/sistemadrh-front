import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Button } from './Button'
import { Icon } from './Icon'

type Tono = 'info' | 'success' | 'danger'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  tone?: Tono
  confirmLabel?: string
  /** Sin cancelLabel el diálogo es solo informativo (un botón). */
  cancelLabel?: string
  onConfirm: () => void
  onCancel?: () => void
  /** Muestra el botón de confirmar cargando (el diálogo queda abierto hasta que termine). */
  loading?: boolean
  /** Contenido extra debajo del mensaje (ej: un campo de observaciones). */
  children?: ReactNode
}

const TONOS: Record<Tono, { icon: string; color: string }> = {
  info: { icon: 'info', color: 'text-primary bg-primary/10' },
  success: { icon: 'check_circle', color: 'text-green-600 bg-green-100 dark:bg-green-500/15' },
  danger: { icon: 'warning', color: 'text-red-600 bg-red-100 dark:bg-red-500/15' },
}

/** Diálogo modal de confirmación (reemplaza a SweetAlert del prototipo). */
export function ConfirmDialog({
  open,
  title,
  message,
  tone = 'info',
  confirmLabel = 'Aceptar',
  cancelLabel,
  onConfirm,
  onCancel,
  loading,
  children,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const { icon, color } = TONOS[tone]

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        if (!loading) (onCancel ?? onConfirm)()
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/50 dark:bg-surface-dark dark:text-slate-100"
    >
      <div className="flex flex-col items-center gap-3 p-6 text-center">
        <div className={cn('flex size-14 items-center justify-center rounded-full', color)}>
          <Icon name={icon} className="text-3xl!" />
        </div>
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
        {children && <div className="mt-2 w-full text-left">{children}</div>}
      </div>
      <div className="flex justify-center gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
        {cancelLabel && (
          <Button variant="secondary" size="sm" disabled={loading} onClick={onCancel}>
            {cancelLabel}
          </Button>
        )}
        <Button size="sm" onClick={onConfirm} loading={loading} autoFocus={!children}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  )
}
