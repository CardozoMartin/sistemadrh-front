import { useState } from 'react'
import { Alert } from '@/components/feedback/States'
import { controlClass } from '@/components/form/styles'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { mensajeDeError } from '@/services/api/errors'
import { Campo, Opciones } from '../../../AltaDeConcesion/components/circuito/AccionesOficina'
import type { CambioBackend } from '../../backend.types'
import { faltaEnDictamen, MINIMO_OBSERVACIONES_TECNICAS, type ResultadoDictamen } from '../../dictamen'
import { numeroConcesion } from '../../formato'
import { useDictaminarCambio } from '../../hooks'
import type { Terminado } from './terminado'
import { DocumentacionRevision } from './DocumentacionRevision'
import { opcionesAptoNoApto } from './opciones'
import { ResumenEnvio } from './ResumenEnvio'

const SIGUIENTE = { distrito: 'Jurídico', juridico: 'Secretaría General' } as const

/**
 * Distrito (pasos 18-24) y Jurídico (pasos 25-31): «¿Está apto?» sí / no, observaciones y una
 * confirmación con el resumen de lo que se envía; al confirmar, «Trámite enviado». Apto: pasa a la
 * oficina siguiente. No apto: el cambio se rechaza y la concesión sigue con el titular actual.
 * En Distrito las observaciones técnicas son obligatorias siempre (paso 20).
 */
export function DictamenCambio({ datos, oficina, onTerminado }: { datos: CambioBackend; oficina: 'distrito' | 'juridico'; onTerminado: (t: Terminado) => void }) {
  const dictaminar = useDictaminarCambio(datos.expediente.id, oficina)
  const [resultado, setResultado] = useState<ResultadoDictamen | ''>('')
  const [observaciones, setObservaciones] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const siguiente = SIGUIENTE[oficina]
  const tecnicas = oficina === 'distrito'
  const falta = faltaEnDictamen(resultado, observaciones, tecnicas)
  const numero = datos.expediente.numero

  function enviar() {
    setConfirmar(false)
    if (!resultado || falta) return
    dictaminar.mutate(
      { resultado, observaciones: observaciones.trim() || undefined },
      {
        onSuccess: () =>
          onTerminado(
            resultado === 'APTO'
              ? { titulo: 'Trámite enviado', mensaje: `El expediente ${numero} fue enviado a ${siguiente}.` }
              : { titulo: 'Cambio rechazado', mensaje: `El expediente ${numero} quedó rechazado: la concesión sigue con el titular actual.` },
          ),
      },
    )
  }

  const etiqueta = tecnicas ? 'Observaciones técnicas (obligatorio)' : resultado === 'NO_APTO' ? 'Observaciones (obligatorio)' : 'Observaciones'

  return (
    <div className="flex flex-col gap-4">
      {oficina === 'juridico' && <DocumentacionRevision datos={datos} />}
      <p className="text-sm font-semibold text-slate-900 dark:text-white">¿Está apto?</p>
      <Opciones
        valor={resultado}
        onChange={setResultado}
        opciones={opcionesAptoNoApto('Apto', 'No apto')}
      />

      <Campo etiqueta={etiqueta} ayuda={tecnicas ? `Informe técnico del cambio (al menos ${MINIMO_OBSERVACIONES_TECNICAS} caracteres). Queda en el historial.` : undefined}>
        <textarea
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          rows={4}
          placeholder={tecnicas ? 'Ej: caudal disponible en el canal, estado del suministro, inspección realizada…' : 'Si hace falta aclarar algo'}
          className={controlClass({ className: 'resize-y' })}
        />
      </Campo>

      {resultado && (
        <p className={resultado === 'APTO' ? 'text-xs text-slate-500 dark:text-slate-400' : 'text-xs text-red-700 dark:text-red-300'}>
          {resultado === 'APTO' ? `Pasa a ${siguiente}.` : 'El cambio de titularidad se rechaza: la concesión sigue a nombre del titular actual. No se puede deshacer.'}
        </p>
      )}
      {falta && <p className="text-xs font-medium text-red-600 dark:text-red-400">{falta}</p>}
      {dictaminar.error && <Alert>{mensajeDeError(dictaminar.error)}</Alert>}
      <div>
        <Button
          iconRight={resultado === 'NO_APTO' ? 'block' : 'send'}
          variant={resultado === 'NO_APTO' ? 'secondary' : 'primary'}
          loading={dictaminar.isPending}
          disabled={!resultado || !!falta || dictaminar.isPending}
          onClick={() => setConfirmar(true)}
        >
          {resultado === 'NO_APTO' ? 'Rechazar el cambio' : `Enviar a ${siguiente}`}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmar}
        tone={resultado === 'NO_APTO' ? 'danger' : 'info'}
        title={resultado === 'NO_APTO' ? '¿Rechazar el cambio de titularidad?' : `¿Enviar el trámite a ${siguiente}?`}
        message={resultado === 'NO_APTO' ? 'El expediente queda rechazado y la concesión sigue con el titular actual. No se puede deshacer.' : 'Revise lo que se envía:'}
        confirmLabel={resultado === 'NO_APTO' ? 'Sí, rechazar' : 'Sí, enviar'}
        cancelLabel="Cancelar"
        onConfirm={enviar}
        onCancel={() => setConfirmar(false)}
      >
        <ResumenEnvio
          filas={[
            ['Expediente', numero],
            ['Concesión', numeroConcesion(datos.cambio.concesion)],
            ['Resultado', resultado === 'APTO' ? 'Apto' : 'No apto'],
            [tecnicas ? 'Observaciones técnicas' : 'Observaciones', observaciones.trim() || null],
            ['Destino', resultado === 'APTO' ? siguiente : 'Rechazado'],
          ]}
        />
      </ConfirmDialog>
    </div>
  )
}
