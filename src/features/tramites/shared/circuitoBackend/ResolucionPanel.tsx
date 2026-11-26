import { useState } from 'react'
import { Alert } from '@/components/feedback/States'
import { controlClass } from '@/components/form/styles'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Icon } from '@/components/ui/Icon'
import { formatearFecha } from '@/config/expedientes'
import { mensajeDeError } from '@/services/api/errors'
import { Campo } from '../circuito/campos'
import { ResumenEnvio } from './componentes'
import { useCircuito, useRegistrarResolucion } from './contexto'
import { anioDeFecha, faltaEnResolucion, MAX_MB_RESOLUCION, tamanio } from './reglas'
import type { ResolucionBackend, Terminado } from './tipos'

const hoy = () => new Date().toLocaleDateString('en-CA') // AAAA-MM-DD en hora local

/**
 * Secretaría General: número de resolución, fecha de firma, el PDF escaneado y observaciones.
 * Confirmación con el resumen; el expediente pasa a Catastro para la verificación final.
 */
export function ResolucionPanel({
  expedienteId,
  numeroExpediente,
  numeroConcesion,
  onTerminado,
}: {
  expedienteId: string
  numeroExpediente: string
  numeroConcesion: string
  onTerminado: (t: Terminado) => void
}) {
  const registrar = useRegistrarResolucion(expedienteId)
  const [numero, setNumero] = useState('')
  const [fecha, setFecha] = useState(hoy())
  const [observaciones, setObservaciones] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const [tocado, setTocado] = useState(false)
  const falta = faltaEnResolucion({ numero, fecha, archivo }, hoy())

  function enviar() {
    setConfirmar(false)
    if (falta || !archivo) return
    registrar.mutate(
      { numero: numero.trim(), anio: anioDeFecha(fecha), fecha, observaciones: observaciones.trim() || undefined, archivo },
      {
        onSuccess: () =>
          onTerminado({
            titulo: 'Resolución registrada',
            mensaje: `Resolución ${Number(numero)}/${anioDeFecha(fecha)} registrada. El expediente ${numeroExpediente} pasó a Catastro para la verificación final.`,
          }),
      },
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Número de resolución" ayuda={fecha ? `Queda ${numero ? Number(numero) : '…'}/${anioDeFecha(fecha)}.` : undefined}>
          <input value={numero} inputMode="numeric" onChange={(e) => setNumero(e.target.value.replace(/\D/g, '').slice(0, 6))} className={controlClass({})} />
        </Campo>
        <Campo etiqueta="Fecha de firma">
          <input type="date" value={fecha} max={hoy()} onChange={(e) => setFecha(e.target.value)} className={controlClass({})} />
        </Campo>
      </div>

      <Campo etiqueta="Resolución escaneada (PDF)" ayuda={`Obligatorio. Solo PDF, hasta ${MAX_MB_RESOLUCION} MB.`}>
        <input
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => {
            setArchivo(e.target.files?.[0] ?? null)
            setTocado(true)
          }}
          className="text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:font-semibold file:text-primary dark:text-slate-200"
        />
      </Campo>
      {archivo && (
        <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Icon name="picture_as_pdf" className="text-[18px]!" />
          {archivo.name} · {tamanio(archivo.size)}
        </p>
      )}

      <Campo etiqueta="Observaciones">
        <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={3} placeholder="Si hace falta aclarar algo" className={controlClass({ className: 'resize-y' })} />
      </Campo>

      {falta && (tocado || numero) && <p className="text-xs font-medium text-red-600 dark:text-red-400">{falta}</p>}
      {registrar.error && <Alert>{mensajeDeError(registrar.error)}</Alert>}
      <div>
        <Button iconRight="send" loading={registrar.isPending} disabled={!!falta || registrar.isPending} onClick={() => setConfirmar(true)}>
          Registrar resolución y pasar a Catastro
        </Button>
      </div>

      <ConfirmDialog
        open={confirmar}
        tone="info"
        title="¿Registrar la resolución?"
        message="Revise lo que se envía. Una vez registrada no se puede cargar otra para este expediente."
        confirmLabel="Sí, registrar"
        cancelLabel="Cancelar"
        onConfirm={enviar}
        onCancel={() => setConfirmar(false)}
      >
        <ResumenEnvio
          filas={[
            ['Expediente', numeroExpediente],
            ['Concesión', numeroConcesion],
            ['Resolución', numero && fecha ? `${Number(numero)}/${anioDeFecha(fecha)}` : null],
            ['Fecha de firma', fecha ? formatearFecha(fecha) : null],
            ['PDF', archivo ? `${archivo.name} (${tamanio(archivo.size)})` : null],
            ['Observaciones', observaciones.trim() || null],
            ['Destino', 'Catastro · verificación final'],
          ]}
        />
      </ConfirmDialog>
    </div>
  )
}

/** La resolución ya cargada, con el PDF para abrir (se baja con la sesión y se abre en otra pestaña). */
export function ResolucionCargada({ expedienteId, resolucion }: { expedienteId: string; resolucion: ResolucionBackend | null }) {
  const { api } = useCircuito()
  const [abriendo, setAbriendo] = useState(false)
  const [error, setError] = useState<unknown>(null)
  if (!resolucion) return null

  async function abrir() {
    setAbriendo(true)
    setError(null)
    try {
      const blob = await api.archivoResolucion(expedienteId)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      setError(e)
    } finally {
      setAbriendo(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 text-sm dark:bg-slate-900/40">
        <span>
          <span className="text-slate-500 dark:text-slate-400">Resolución </span>
          <strong className="text-slate-900 dark:text-white">{resolucion.numero}</strong>
          <span className="text-slate-500 dark:text-slate-400"> · firmada el {formatearFecha(resolucion.fecha)}</span>
          {resolucion.observaciones && <span className="block text-xs text-slate-500 dark:text-slate-400">{resolucion.observaciones}</span>}
        </span>
        {resolucion.conArchivo ? (
          <Button variant="secondary" iconLeft="picture_as_pdf" loading={abriendo} onClick={() => void abrir()}>
            Ver PDF
          </Button>
        ) : (
          <span className="text-xs text-slate-500 dark:text-slate-400">Sin PDF adjunto</span>
        )}
      </div>
      {error ? <Alert>{mensajeDeError(error)}</Alert> : null}
    </div>
  )
}
