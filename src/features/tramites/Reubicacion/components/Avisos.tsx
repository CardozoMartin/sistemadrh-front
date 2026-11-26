import type { ReactNode } from 'react'
import { formatearFecha } from '@/config/expedientes'
import { Icon } from '@/components/ui/Icon'
import type { ReubicacionBackend } from '../backend.types'

const TONOS = {
  warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
  info: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200',
} as const

/** Una lista de avisos con título (los de Catastro, los de la lectura del KML…). No se muestra si está vacía. */
export function ListaAvisos({ titulo, avisos, tono = 'warning' }: { titulo: string; avisos: string[]; tono?: keyof typeof TONOS }) {
  if (avisos.length === 0) return null
  return (
    <div className={`rounded-lg border p-4 text-sm ${TONOS[tono]}`}>
      <p className="mb-1 font-semibold">{titulo}</p>
      <ul className="list-disc pl-5">
        {avisos.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
    </div>
  )
}

/** Lo que pidió Jurídico al observar la reubicación (con una aclaración opcional debajo). */
export function ObservacionJuridico({ observacion, children }: { observacion: NonNullable<ReubicacionBackend['reubicacion']['observacion']>; children?: ReactNode }) {
  return (
    <div className={`flex w-full gap-3 rounded-lg border p-4 text-sm ${TONOS.warning}`}>
      <Icon name="rate_review" className="shrink-0" />
      <div>
        <p className="font-semibold">
          Observado por {observacion.oficina} el {formatearFecha(observacion.fecha)}
        </p>
        <p className="whitespace-pre-line">{observacion.texto ?? 'Sin detalle.'}</p>
        {children && <p className="mt-1 text-xs">{children}</p>}
      </div>
    </div>
  )
}

/** Un recuadro informativo celeste con ícono. */
export function NotaInfo({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex gap-3 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm dark:border-sky-500/30 dark:bg-sky-500/10 ${className}`}>
      <Icon name="info" className="text-sky-600" />
      <p className="text-sky-700 dark:text-sky-300">{children}</p>
    </div>
  )
}
