import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { useNavigate } from 'react-router'
import { Alert } from '@/components/feedback/States'
import { Field } from '@/components/form'
import { controlClass } from '@/components/form/styles'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ROUTES } from '@/config/routes'
import { mensajeDeError } from '@/services/api/errors'
import { numeroConcesion } from '../../../shared/formato'
import { errorMotivoCancelacion, MIN_MOTIVO_CANCELACION, motivoCancelacionValido } from '../../../shared/circuito/motivo'
import type { ReubicacionBackend } from '../../backend.types'
import { pasosPropuesta } from '../../formato'
import { useCancelarReubicacion, useEnviarReubicacion, useReenviarReubicacion } from '../../hooks'

type Dialogo = 'cancelar' | 'enviar' | null

interface Props {
  datos: ReubicacionBackend
  enCorreccion: boolean
  destino: string
  /** Ya se derivó: la página muestra el aviso (esta pantalla deja de ser editable). */
  onEnviada: () => void
}

/**
 * Enviar a Recaudación (en la carga) o reenviar a Jurídico (en la corrección), cancelar el trámite
 * (solo en la carga) y volver al inicio.
 */
export function AccionesPropuesta({ datos, enCorreccion, destino, onEnviada }: Props) {
  const navigate = useNavigate()
  const { reubicacion, expediente } = datos
  const enviarNuevo = useEnviarReubicacion(expediente.id)
  const reenviar = useReenviarReubicacion(expediente.id)
  const enviar = enCorreccion ? reenviar : enviarNuevo
  const cancelar = useCancelarReubicacion(expediente.id)
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const [motivoCancelacion, setMotivoCancelacion] = useState('')

  const ocupado = enviar.isPending || cancelar.isPending
  const errorMutacion = enviar.error ?? cancelar.error
  const concesion = numeroConcesion(reubicacion.concesion)
  const irAlInicio = () => navigate(ROUTES.tramites.reubicacion.inicio)
  // Lo que falta para enviarla (los pasos 1 y 2 sin terminar).
  const faltan = pasosPropuesta(reubicacion, destino).filter((p) => p.id !== 'enviar' && !p.listo)

  function confirmarEnvio() {
    enviar.mutate(undefined, {
      onSuccess: () => {
        setDialogo(null)
        onEnviada()
      },
      onError: () => setDialogo(null),
    })
  }

  function confirmarCancelacion() {
    if (!motivoCancelacionValido(motivoCancelacion)) return
    cancelar.mutate(motivoCancelacion.trim(), {
      onSuccess: () => {
        setDialogo(null)
        irAlInicio()
      },
    })
  }

  return (
    <>
      <section id="paso-enviar" className="scroll-mt-24">
        <Card>
          <div className="flex flex-col gap-4 p-6">
            <h3 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <Icon name="send" className="text-primary" /> Revisar y enviar a {destino}
            </h3>
            {faltan.length > 0 ? (
              <div className="text-sm">
                <p className="mb-1 font-semibold text-slate-700 dark:text-slate-200">Qué falta para enviarla:</p>
                <ul className="flex flex-col gap-1">
                  {faltan.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <Icon name="radio_button_unchecked" className="text-base! text-slate-400" /> {p.titulo}: {p.falta}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                <Icon name="check_circle" className="text-base!" /> Está todo cargado. Revise la comparación de arriba y envíela a {destino}.
              </p>
            )}
            {errorMutacion && <Alert>{mensajeDeError(errorMutacion)}</Alert>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-800/40">
            {/* En la corrección ya no se puede cancelar: se reenvía a Jurídico. */}
            {enCorreccion ? (
              <span />
            ) : (
              <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => setDialogo('cancelar')}>
                Cancelar trámite
              </Button>
            )}
            <div className="flex gap-3">
              <Button variant="secondary" size="sm" iconLeft="arrow_back" disabled={ocupado} onClick={irAlInicio}>
                Volver
              </Button>
              <Button size="sm" iconRight="send" loading={enviar.isPending} disabled={ocupado || !reubicacion.cargaCompleta} onClick={() => setDialogo('enviar')}>
                {enCorreccion ? 'Reenviar a Jurídico' : 'Enviar a Recaudación'}
              </Button>
            </div>
          </div>
        </Card>
      </section>

      <ConfirmDialog
        open={dialogo === 'cancelar'}
        tone="danger"
        title="¿Cancelar el trámite?"
        message="La reubicación queda cancelada (no se borra: queda en el historial con el motivo) y la concesión sigue como estaba."
        confirmLabel="Sí, cancelar trámite"
        cancelLabel="Volver"
        loading={cancelar.isPending}
        onConfirm={confirmarCancelacion}
        onCancel={() => setDialogo(null)}
      >
        <Field id="motivo-cancelacion" label="Motivo" required hint={`Al menos ${MIN_MOTIVO_CANCELACION} caracteres.`} error={errorMotivoCancelacion(motivoCancelacion)}>
          <textarea
            id="motivo-cancelacion"
            rows={3}
            value={motivoCancelacion}
            onChange={(e) => setMotivoCancelacion(e.target.value)}
            className={controlClass({ className: 'resize-y' })}
          />
        </Field>
      </ConfirmDialog>
      <ConfirmDialog
        open={dialogo === 'enviar'}
        title={`¿${enCorreccion ? 'Reenviar' : 'Enviar'} la reubicación a ${destino}?`}
        message={`El expediente ${expediente.numero} se derivará a ${destino}. La concesión ${concesion} sigue como está hasta que la reubicación termine.`}
        confirmLabel="Sí, enviar"
        cancelLabel="Cancelar"
        loading={enviar.isPending}
        onConfirm={confirmarEnvio}
        onCancel={() => setDialogo(null)}
      />
    </>
  )
}
