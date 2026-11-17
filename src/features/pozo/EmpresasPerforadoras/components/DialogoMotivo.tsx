import { useState, type ReactNode } from 'react'
import { Alert } from '@/components/feedback/States'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { mensajeDeError } from '@/services/api/errors'

interface Props {
  open: boolean
  titulo: string
  mensaje: string
  confirmar: string
  tono?: 'info' | 'danger'
  /** Las bajas exigen motivo: después hay que poder explicar por qué. */
  obligatorio?: boolean
  placeholder?: string
  cargando?: boolean
  error?: unknown
  onConfirmar: (motivo: string) => void
  onCancelar: () => void
  children?: ReactNode
}

/** Confirmación con un campo de motivo (bajas, reactivaciones, modificaciones). */
export function DialogoMotivo({ open, titulo, mensaje, confirmar, tono = 'info', obligatorio, placeholder, cargando, error, onConfirmar, onCancelar, children }: Props) {
  const [motivo, setMotivo] = useState('')
  const [falta, setFalta] = useState(false)

  function confirmarConMotivo() {
    if (obligatorio && motivo.trim().length < 5) {
      setFalta(true)
      return
    }
    onConfirmar(motivo.trim())
  }

  function cancelar() {
    setMotivo('')
    setFalta(false)
    onCancelar()
  }

  return (
    <ConfirmDialog open={open} tone={tono} title={titulo} message={mensaje} confirmLabel={confirmar} cancelLabel="Cancelar" loading={cargando} onConfirm={confirmarConMotivo} onCancel={cancelar}>
      <div className="flex flex-col gap-3">
        {children}
        <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
          <span>
            Motivo{obligatorio ? <span className="ml-0.5 text-red-500">*</span> : ' (opcional)'}
          </span>
          <textarea
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value)
              setFalta(false)
            }}
            rows={3}
            maxLength={300}
            placeholder={placeholder}
            aria-invalid={falta || undefined}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none aria-invalid:border-red-400 dark:border-slate-600 dark:bg-slate-800"
          />
          {falta && <span className="text-xs font-normal text-red-600">Indique el motivo (al menos 5 caracteres).</span>}
        </label>
        {!!error && <Alert>{mensajeDeError(error)}</Alert>}
      </div>
    </ConfirmDialog>
  )
}
