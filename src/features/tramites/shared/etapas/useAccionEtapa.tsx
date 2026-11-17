import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Alert } from '@/components/feedback/States'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { RUTA_BANDEJA } from '@/config/routes'
import type { RevisionInput } from '@/features/expedientes/api'
import { pasoSiguiente } from '@/features/expedientes/circuito'
import { useRegistrarRevision, useUsuarioDeOficina } from '@/features/expedientes/hooks'
import { useNotificaciones } from '@/features/notificaciones/context'
import { useDominio } from '@/hooks/useDominio'
import { mensajeDeError } from '@/services/api/errors'
import type { Expediente } from '@/types/domain'

export interface ConfiguracionAccion {
  titulo: string
  mensaje: string
  tono?: 'info' | 'danger'
  confirmar: string
  /** Aviso que se muestra al terminar (ya en la bandeja). */
  exito: { titulo: string; mensaje: string }
  /** Datos de la revisión (resultado, observaciones, detalle, cambios). */
  revision: Omit<RevisionInput, 'expediente' | 'paso' | 'usuarioId'>
  /**
   * Tareas previas a registrar la revisión (ej: actualizar la concesión en el cierre).
   * Si fallan, el expediente no avanza. Con el backend real va todo en una transacción.
   */
  antes?: () => Promise<unknown>
  /** Tareas extra después de registrar (ej: emails simulados). */
  despues?: () => Promise<unknown>
}

/**
 * Flujo común a todas las oficinas: confirmar → registrar la revisión (aprueba y
 * avanza, u observa y detiene) → volver a la bandeja con un aviso de éxito.
 */
export function useAccionEtapa(expediente: Expediente) {
  const navigate = useNavigate()
  const dominio = useDominio()
  const { mostrarAviso } = useNotificaciones()
  const registrar = useRegistrarRevision()
  const usuario = useUsuarioDeOficina(expediente.oficinaId)
  const paso = pasoSiguiente(expediente, dominio)
  const [pendiente, setPendiente] = useState<ConfiguracionAccion | null>(null)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<unknown>(null)

  async function ejecutar() {
    if (!pendiente || !paso || !usuario) return
    setTrabajando(true)
    setError(null)
    try {
      await pendiente.antes?.()
      await registrar.mutateAsync({ ...pendiente.revision, expediente, paso, usuarioId: usuario.id })
      await pendiente.despues?.()
      mostrarAviso({ titulo: pendiente.exito.titulo, detalle: pendiente.exito.mensaje, icono: 'check_circle', tono: 'exito' })
      navigate(RUTA_BANDEJA[expediente.oficinaId])
    } catch (e) {
      setError(e)
      setTrabajando(false)
    }
  }

  const dialogos = (
    <ConfirmDialog
      open={!!pendiente}
      tone={pendiente?.tono ?? 'info'}
      title={pendiente?.titulo ?? ''}
      message={pendiente?.mensaje ?? ''}
      confirmLabel={pendiente?.confirmar}
      cancelLabel="Cancelar"
      loading={trabajando}
      onCancel={() => {
        setPendiente(null)
        setError(null)
      }}
      onConfirm={() => void ejecutar()}
    >
      {usuario && <p className="text-xs text-slate-500 dark:text-slate-400">Queda registrado a nombre de {usuario.nombre}.</p>}
      {!!error && <Alert className="mt-2">{mensajeDeError(error)}</Alert>}
    </ConfirmDialog>
  )

  return { paso, usuario, pedir: setPendiente, dialogos }
}
