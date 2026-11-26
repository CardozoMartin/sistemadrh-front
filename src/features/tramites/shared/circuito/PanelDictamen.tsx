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
import { AMBAR, opcionesAptoNoApto, type OpcionTarjeta } from './opciones'
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
  /** Suma «Observado»: vuelve a Catastro para corregir o completar y Catastro lo reenvía a esta oficina. */
  conObservado?: boolean
  onTerminado: (t: Terminado) => void
}

/** Las tarjetas del dictamen: apto / no apto y, si el trámite lo admite, observado en el medio. */
function opcionesDictamen(conObservado: boolean): OpcionTarjeta<ResultadoDictamen>[] {
  if (!conObservado) return opcionesAptoNoApto('Apto', 'No apto')
  const [apto, noApto] = opcionesAptoNoApto('Apto', 'No apto (se rechaza)')
  return [apto, { valor: 'OBSERVADO', texto: 'Observado (vuelve a Catastro)', icono: 'undo', ...AMBAR }, noApto]
}

/**
 * Distrito y Jurídico (común a los trámites sobre una concesión): «¿Está apto?» sí / no (y, con
 * `conObservado`, observado), observaciones y una confirmación con el resumen de lo que se envía;
 * al confirmar, «Trámite enviado». Apto: pasa a la oficina siguiente. Observado: vuelve a Catastro.
 * No apto: el trámite se rechaza. En Distrito las observaciones técnicas son obligatorias siempre.
 */
export function PanelDictamen({ expediente, concesion, oficina, useDictaminar, textos, revision, conObservado = false, onTerminado }: Props) {
  const dictaminar = useDictaminar(expediente.id, oficina)
  const [resultado, setResultado] = useState<ResultadoDictamen | ''>('')
  const [observaciones, setObservaciones] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const siguiente = SIGUIENTE[oficina]
  const tecnicas = oficina === 'distrito'
  const falta = faltaEnDictamen(resultado, observaciones, tecnicas)
  const numero = expediente.numero
  const opciones = opcionesDictamen(conObservado)
  const observado = resultado === 'OBSERVADO'
  const destino = resultado === 'APTO' ? siguiente : observado ? 'Catastro (para corregir)' : 'Rechazado'

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
              : observado
                ? { titulo: 'Devuelto a Catastro', mensaje: `El expediente ${numero} volvió a Catastro con las observaciones. Cuando lo corrijan, vuelve a esta oficina.` }
                : { titulo: textos.tituloRechazado, mensaje: textos.mensajeRechazado(numero) },
          ),
      },
    )
  }

  const etiqueta = tecnicas ? 'Observaciones técnicas (obligatorio)' : resultado && resultado !== 'APTO' ? 'Observaciones (obligatorio)' : 'Observaciones'

  return (
    <div className="flex flex-col gap-4">
      {revision}
      <p className="text-sm font-semibold text-slate-900 dark:text-white">¿Está apto?</p>
      <Opciones valor={resultado} onChange={setResultado} opciones={opciones} />

      <Campo etiqueta={etiqueta} ayuda={tecnicas ? `${textos.informeTecnico} (al menos ${MINIMO_OBSERVACIONES_TECNICAS} caracteres). Queda en el historial.` : undefined}>
        <textarea
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          rows={4}
          placeholder={
            tecnicas
              ? 'Ej: caudal disponible en el canal, estado del suministro, inspección realizada…'
              : observado
                ? 'Qué falta o hay que corregir (ej: falta el informe de registro inmobiliario actualizado)'
                : 'Si hace falta aclarar algo'
          }
          className={controlClass({ className: 'resize-y' })}
        />
      </Campo>

      {resultado && (
        <p className={resultado === 'NO_APTO' ? 'text-xs text-red-700 dark:text-red-300' : 'text-xs text-slate-500 dark:text-slate-400'}>
          {resultado === 'APTO' ? `Pasa a ${siguiente}.` : observado ? 'Vuelve a Catastro para corregir o completar; después regresa a esta oficina.' : textos.avisoRechazo}
        </p>
      )}
      {falta && <p className="text-xs font-medium text-red-600 dark:text-red-400">{falta}</p>}
      {dictaminar.error && <Alert>{mensajeDeError(dictaminar.error)}</Alert>}
      <div>
        <Button
          iconRight={resultado === 'NO_APTO' ? 'block' : observado ? 'undo' : 'send'}
          variant={resultado && resultado !== 'APTO' ? 'secondary' : 'primary'}
          loading={dictaminar.isPending}
          disabled={!resultado || !!falta || dictaminar.isPending}
          onClick={() => setConfirmar(true)}
        >
          {resultado === 'NO_APTO' ? textos.botonRechazo : observado ? 'Devolver a Catastro' : `Enviar a ${siguiente}`}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmar}
        tone={resultado === 'NO_APTO' ? 'danger' : 'info'}
        title={resultado === 'NO_APTO' ? textos.tituloConfirmarRechazo : observado ? '¿Devolver el expediente a Catastro?' : `¿Enviar el trámite a ${siguiente}?`}
        message={resultado === 'NO_APTO' ? textos.mensajeConfirmarRechazo : 'Revise lo que se envía:'}
        confirmLabel={resultado === 'NO_APTO' ? 'Sí, rechazar' : observado ? 'Sí, devolver' : 'Sí, enviar'}
        cancelLabel="Cancelar"
        onConfirm={enviar}
        onCancel={() => setConfirmar(false)}
      >
        <ResumenEnvio
          filas={[
            ['Expediente', numero],
            ['Concesión', concesion],
            ['Resultado', opciones.find((o) => o.valor === resultado)?.texto],
            [tecnicas ? 'Observaciones técnicas' : 'Observaciones', observaciones.trim() || null],
            ['Destino', destino],
          ]}
        />
      </ConfirmDialog>
    </div>
  )
}
