import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Icon } from './Icon'

interface ModalProps {
  open: boolean
  title: string
  description?: string
  icon?: string
  /** Escape o la ✕. Mientras `bloqueado`, no se puede cerrar. */
  onClose: () => void
  bloqueado?: boolean
  /** Botones del pie (alineados a la derecha). */
  footer?: ReactNode
  size?: 'md' | 'lg' | 'xl'
  children: ReactNode
}

const ANCHOS = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

/** Ventana modal para formularios (el ConfirmDialog es para confirmaciones cortas). */
export function Modal({ open, title, description, icon, onClose, bloqueado, footer, size = 'lg', children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        if (!bloqueado) onClose()
      }}
      className={cn(
        'm-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] flex-col rounded-xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/50 open:flex dark:bg-surface-dark dark:text-slate-100',
        ANCHOS[size],
      )}
    >
      <div className="flex items-start gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
        {icon && (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon name={icon} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold">{title}</h2>
          {description && <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>}
        </div>
        <button
          type="button"
          aria-label="Cerrar"
          disabled={bloqueado}
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 dark:hover:bg-slate-700"
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      {footer && <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-700">{footer}</div>}
    </dialog>
  )
}
