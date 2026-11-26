import { useState, type ReactNode } from 'react'
import { Alert } from '@/components/feedback/States'
import { controlClass } from '@/components/form/styles'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { mensajeDeError } from '@/services/api/errors'
import { Campo, Opciones } from '../circuito/campos'
import { ResumenEnvio } from './componentes'
import { useCircuito, useDictaminar } from './contexto'
import { faltaEnDictamen, MINIMO_OBSERVACIONES_TECNICAS } from './reglas'
import type { ResultadoDictamen, Terminado } from './tipos'

const SIGUIENTE = { distrito: 'Jurídico', juridico: 'Secretaría General' } as const

const OPCIONES: { valor: ResultadoDictamen; texto: string; icono: string; color: string }[] = [
  { valor: 'APTO', texto: 'Apto', icono: 'check_circle', color: 'border-green-500 bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300' },
  { valor: 'OBSERVADO', texto: 'Observado (vuelve a Catastro)', icono: 'undo', color: 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
  { valor: 'NO_APTO', texto: 'No apto (se rechaza)', icono: 'block', color: 'border-red-500 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' },
]

interface Props {
  expedienteId: string
  numeroExpediente: string
  numeroConcesion: string
  oficina: 'distrito' | 'juridico'
  /** Lo que la oficina mira para decidir (documentación en Jurídico, superficie en Distrito…). */
  children?: ReactNode
  onTerminado: (t: Terminado) => void
}

/**
 * Distrito y Jurídico: apto, observado o no apto, con observaciones y una confirmación con el resumen.
 *   - Apto: pasa a la oficina siguiente.
 *   - Observado: vuelve a Catastro para corregir o completar; Catastro lo reenvía a esta oficina.
 *   - No apto: el trámite se rechaza (motivo obligatorio).
 * En Distrito el informe técnico es obligatorio siempre.
 */
export function DictamenPanel({ expedienteId, numeroExpediente, numeroConcesion, oficina, children, onTerminado }: Props) {
  const { textos } = useCircuito()
  const dictaminar = useDictaminar(expedienteId, oficina)
  const [resultado, setResultado] = useState<ResultadoDictamen | ''>('')
  const [observaciones, setObservaciones] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const siguiente = SIGUIENTE[oficina]
  const tecnicas = oficina === 'distrito'
  const falta = faltaEnDictamen(resultado, observaciones, tecnicas)

  const destino = resultado === 'APTO' ? siguiente : resultado === 'OBSERVADO' ? 'Catastro (para corregir)' : 'Rechazado'

  function enviar() {
    setConfirmar(false)
    if (!resultado || falta) return
    dictaminar.mutate(
      { resultado, observaciones: observaciones.trim() || undefined },
      {
        onSuccess: () =>
          onTerminado(
            resultado === 'APTO'
              ? { titulo: 'Trámite enviado', mensaje: `El expediente ${numeroExpediente} fue enviado a ${siguiente}.` }
              : resultado === 'OBSERVADO'
                ? { titulo: 'Devuelto a Catastro', mensaje: `El expediente ${numeroExpediente} volvió a Catastro con las observaciones. Cuando lo corrijan, vuelve a esta oficina.` }
                : { titulo: 'Trámite rechazado', mensaje: `El expediente ${numeroExpediente} quedó rechazado: ${textos.alRechazar}.` },
          ),
      },
    )
  }

  const etiqueta = tecnicas ? 'Observaciones técnicas (obligatorio)' : resultado && resultado !== 'APTO' ? 'Observaciones (obligatorio)' : 'Observaciones'

  return (
    <div className="flex flex-col gap-4">
      {children}
      <p className="text-sm font-semibold text-slate-900 dark:text-white">¿Está apto?</p>
      <Opciones valor={resultado} onChange={setResultado} opciones={OPCIONES} />

      <Campo etiqueta={etiqueta} ayuda={tecnicas ? `Informe técnico (al menos ${MINIMO_OBSERVACIONES_TECNICAS} caracteres). Queda en el historial.` : undefined}>
        <textarea
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          rows={4}
          placeholder={
            tecnicas
              ? 'Ej: inspección realizada, el plano coincide con el alambrado, caudal disponible en el canal…'
              : resultado === 'OBSERVADO'
                ? 'Qué falta o hay que corregir (ej: falta el informe de registro inmobiliario actualizado)'
                : 'Si hace falta aclarar algo'
          }
          className={controlClass({ className: 'resize-y' })}
        />
      </Campo>

      {resultado && (
        <p className={resultado === 'NO_APTO' ? 'text-xs text-red-700 dark:text-red-300' : 'text-xs text-slate-500 dark:text-slate-400'}>
          {resultado === 'APTO'
            ? `Pasa a ${siguiente}.`
            : resultado === 'OBSERVADO'
              ? 'Vuelve a Catastro para corregir o completar; después regresa a esta oficina.'
              : `Se rechaza ${textos.tramite}: ${textos.alRechazar}. No se puede deshacer.`}
        </p>
      )}
      {falta && <p className="text-xs font-medium text-red-600 dark:text-red-400">{falta}</p>}
      {dictaminar.error && <Alert>{mensajeDeError(dictaminar.error)}</Alert>}
      <div>
        <Button
          iconRight={resultado === 'NO_APTO' ? 'block' : resultado === 'OBSERVADO' ? 'undo' : 'send'}
          variant={resultado && resultado !== 'APTO' ? 'secondary' : 'primary'}
          loading={dictaminar.isPending}
          disabled={!resultado || !!falta || dictaminar.isPending}
          onClick={() => setConfirmar(true)}
        >
          {resultado === 'NO_APTO' ? 'Rechazar el trámite' : resultado === 'OBSERVADO' ? 'Devolver a Catastro' : `Enviar a ${siguiente}`}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmar}
        tone={resultado === 'NO_APTO' ? 'danger' : 'info'}
        title={resultado === 'NO_APTO' ? '¿Rechazar el trámite?' : resultado === 'OBSERVADO' ? '¿Devolver el expediente a Catastro?' : `¿Enviar el trámite a ${siguiente}?`}
        message={resultado === 'NO_APTO' ? `El expediente queda rechazado: ${textos.alRechazar}. No se puede deshacer.` : 'Revise lo que se envía:'}
        confirmLabel={resultado === 'NO_APTO' ? 'Sí, rechazar' : resultado === 'OBSERVADO' ? 'Sí, devolver' : 'Sí, enviar'}
        cancelLabel="Cancelar"
        onConfirm={enviar}
        onCancel={() => setConfirmar(false)}
      >
        <ResumenEnvio
          filas={[
            ['Expediente', numeroExpediente],
            ['Concesión', numeroConcesion],
            ['Resultado', OPCIONES.find((o) => o.valor === resultado)?.texto],
            [tecnicas ? 'Observaciones técnicas' : 'Observaciones', observaciones.trim() || null],
            ['Destino', destino],
          ]}
        />
      </ConfirmDialog>
    </div>
  )
}
