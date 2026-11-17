import { useState, type ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { formatearFecha } from '@/config/expedientes'
import { observacionVigente, ultimaAprobacion } from '@/features/expedientes/circuito'
import { HistorialExpediente } from '@/features/expedientes/components/HistorialExpediente'
import { useDominio } from '@/hooks/useDominio'
import type { Expediente } from '@/types/domain'
import { useConfigTramite } from './config'

function Dato({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-slate-900 dark:text-white">{children}</span>
    </div>
  )
}

/** Datos del expediente (solo lectura) + nota de la oficina anterior. Lo propio de cada trámite sale de su ConfigTramite. */
export function ResumenExpediente({ expediente }: { expediente: Expediente }) {
  const d = useDominio()
  const config = useConfigTramite()
  const [verHistorial, setVerHistorial] = useState(false)
  // Filas propias del trámite (titular, documento…); por defecto, el titular del expediente.
  const propios = config.datosResumen?.(expediente, d) ?? [{ label: 'Titular', valor: expediente.titular, ancho: true }]
  const nota = ultimaAprobacion(expediente)
  const observacion = observacionVigente(expediente)

  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3 dark:border-slate-700">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
          <Icon name="info" className="text-primary" /> Información del expediente
        </h3>
        <button type="button" onClick={() => setVerHistorial(!verHistorial)} className="text-xs font-semibold text-primary hover:underline">
          {verHistorial ? 'Ocultar historial' : 'Ver historial'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 p-5">
        <Dato label="Expediente">{expediente.numero}</Dato>
        <Dato label="N° de concesión">{expediente.numeroConcesion ?? '—'}</Dato>
        {propios.map((dato) => (
          <div key={dato.label} className={dato.ancho ? 'col-span-2' : undefined}>
            <Dato label={dato.label}>{dato.valor}</Dato>
          </div>
        ))}
        <div className="col-span-2">
          <Dato label="Ubicación">
            {expediente.ubicacion.localidad}, {expediente.ubicacion.departamento} · Distrito {expediente.ubicacion.distrito}
          </Dato>
        </div>
        <Dato label="Superficie">{expediente.poligono ? `${expediente.poligono.hectareas.toFixed(2)} ha` : '—'}</Dato>
        <Dato label="Caudal">{expediente.caudalAsignado != null ? `${expediente.caudalAsignado} l/s` : '—'}</Dato>
        <Dato label="Uso principal">{expediente.usoId ? (d.uso(expediente.usoId)?.nombre ?? expediente.usoId) : '—'}</Dato>
        <Dato label="Inicio">{formatearFecha(expediente.fechaInicio)}</Dato>
      </div>

      {observacion && (
        <div className="mx-5 mb-4 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
          <Icon name="priority_high" className="text-amber-600" />
          <div>
            <p className="font-semibold text-amber-800 dark:text-amber-200">Expediente observado en esta oficina</p>
            <p className="text-amber-700 dark:text-amber-300">“{observacion.observaciones ?? 'Sin detalle'}”</p>
            <p className="mt-1 text-xs text-amber-600">
              {d.usuario(observacion.usuarioId)?.nombre} · {formatearFecha(observacion.fecha)}. Puede volver a revisarlo cuando se regularice.
            </p>
          </div>
        </div>
      )}

      {nota && (
        <div className="mx-5 mb-5 flex gap-3 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
          <Icon name="history_edu" className="text-slate-400" />
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">
              {d.nombreOficina(nota.oficinaId)} · {d.etapa(nota.etapaId)?.nombre} (paso anterior)
            </p>
            <p className="text-slate-700 dark:text-slate-300">“{nota.observaciones ?? 'Aprobado sin observaciones.'}”</p>
            <p className="mt-1 text-xs text-slate-500">— {d.usuario(nota.usuarioId)?.nombre ?? nota.usuarioId}</p>
          </div>
        </div>
      )}

      {verHistorial && (
        <div className="border-t border-slate-200 px-5 pt-4 dark:border-slate-700">
          <HistorialExpediente expediente={expediente} />
        </div>
      )}
    </Card>
  )
}
