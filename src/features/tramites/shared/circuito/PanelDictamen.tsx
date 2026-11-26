import { useState, type ReactNode } from 'react'
import type { UseMutationResult } from '@tanstack/react-query'
import { Alert } from '@/components/feedback/States'
import { controlClass } from '@/components/form/styles'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { mensajeDeError } from '@/services/api/errors'
import { Campo, Opciones } from './campos'
import { faltaEnDictamen, MINIMO_OBSERVACIONES_TECNICAS, type ResultadoDictamen } from './dictamen'
import type { Terminado } from './terminado'
import { opcionesAptoNoApto } from './opciones'
import { ResumenEnvio } from './ResumenEnvio'

const SIGUIENTE = { distrito: 'Jurídico', juridico: 'Secretaría General' } as const

export type OficinaDictamen = keyof typeof SIGUIENTE

/** Cuerpo de POST …/distrito y …/juridico (común a los trámites). */
export interface Dictamen {
  resultado: ResultadoDictamen
  observaciones?: string
}

/** Lo que dice cada trámite cuando se rechaza (ej: «la concesión sigue con el titular actual»). */
export interface TextosDictamen {
  /** «Informe técnico del cambio»: ayuda de las observaciones técnicas de Distrito. */
  informeTecnico: string
  /** Debajo de las opciones, al elegir «No apto». */
  avisoRechazo: string
  botonRechazo: string
  tituloConfirmarRechazo: string
  mensajeConfirmarRechazo: string
  /** «Trámite enviado» del rechazo. */
  tituloRechazado: string
  mensajeRechazado: (numero: string) => string
}

interface Props {
  expediente: { id: string; numero: string }
  /** «N° 906»: para el resumen de lo que se envía. */
  concesion: string
  oficina: OficinaDictamen
  useDictaminar: (id: string, oficina: OficinaDictamen) => UseMutationResult<unknown, Error, Dictamen>
  textos: TextosDictamen
  /** Lo que se muestra arriba del dictamen (ej: Jurídico revisa la documentación). */
  revision?: ReactNode
  onTerminado: (t: Terminado) => void
}

/**
 * Distrito y Jurídico (común a los trámites sobre una concesión): «¿Está apto?» sí / no,
 * observaciones y una confirmación con el resumen de lo que se envía; al confirmar, «Trámite
 * enviado». Apto: pasa a la oficina siguiente. No apto: el trámite se rechaza.
 * En Distrito las observaciones técnicas son obligatorias siempre.
 */
export function PanelDictamen({ expediente, concesion, oficina, useDictaminar, textos, revision, onTerminado }: Props) {
  const dictaminar = useDictaminar(expediente.id, oficina)
  const [resultado, setResultado] = useState<ResultadoDictamen | ''>('')
  const [observaciones, setObservaciones] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const siguiente = SIGUIENTE[oficina]
  const tecnicas = oficina === 'distrito'
  const falta = faltaEnDictamen(resultado, observaciones, tecnicas)
  const numero = expediente.numero

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
              : { titulo: textos.tituloRechazado, mensaje: textos.mensajeRechazado(numero) },
          ),
      },
    )
  }

  const etiqueta = tecnicas ? 'Observaciones técnicas (obligatorio)' : resultado === 'NO_APTO' ? 'Observaciones (obligatorio)' : 'Observaciones'

  return (
    <div className="flex flex-col gap-4">
      {revision}
      <p className="text-sm font-semibold text-slate-900 dark:text-white">¿Está apto?</p>
      <Opciones
        valor={resultado}
        onChange={setResultado}
        opciones={opcionesAptoNoApto('Apto', 'No apto')}
      />

      <Campo etiqueta={etiqueta} ayuda={tecnicas ? `${textos.informeTecnico} (al menos ${MINIMO_OBSERVACIONES_TECNICAS} caracteres). Queda en el historial.` : undefined}>
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
          {resultado === 'APTO' ? `Pasa a ${siguiente}.` : textos.avisoRechazo}
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
          {resultado === 'NO_APTO' ? textos.botonRechazo : `Enviar a ${siguiente}`}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmar}
        tone={resultado === 'NO_APTO' ? 'danger' : 'info'}
        title={resultado === 'NO_APTO' ? textos.tituloConfirmarRechazo : `¿Enviar el trámite a ${siguiente}?`}
        message={resultado === 'NO_APTO' ? textos.mensajeConfirmarRechazo : 'Revise lo que se envía:'}
        confirmLabel={resultado === 'NO_APTO' ? 'Sí, rechazar' : 'Sí, enviar'}
        cancelLabel="Cancelar"
        onConfirm={enviar}
        onCancel={() => setConfirmar(false)}
      >
        <ResumenEnvio
          filas={[
            ['Expediente', numero],
            ['Concesión', concesion],
            ['Resultado', resultado === 'APTO' ? 'Apto' : 'No apto'],
            [tecnicas ? 'Observaciones técnicas' : 'Observaciones', observaciones.trim() || null],
            ['Destino', resultado === 'APTO' ? siguiente : 'Rechazado'],
          ]}
        />
      </ConfirmDialog>
    </div>
  )
}
