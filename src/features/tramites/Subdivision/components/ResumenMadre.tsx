import type { ReactNode } from 'react'
import { Icon } from '@/components/ui/Icon'
import type { MadreSubdivision } from '../types'

function Dato({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-900 dark:text-white">{children}</p>
    </div>
  )
}

interface Props {
  numeroConcesion: string
  numeroExpediente: string
  madre: MadreSubdivision
}

/** Banda con los datos de la concesión que se subdivide (prototipo: «Concesión a subdividir»). */
export function ResumenMadre({ numeroConcesion, numeroExpediente, madre }: Props) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center dark:border-slate-700 dark:bg-surface-dark">
      <div className="flex items-center gap-3 md:pr-6 md:border-r md:border-slate-200 dark:md:border-slate-700">
        <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon name="call_split" />
        </span>
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">Concesión a subdividir</p>
          <p className="text-lg font-bold text-slate-900 dark:text-white">N° {numeroConcesion}</p>
        </div>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Dato label="Expediente">{numeroExpediente}</Dato>
        <Dato label="Titular">{madre.titular}</Dato>
        <Dato label="Superficie total">{madre.hectareas.toFixed(2)} ha</Dato>
        <Dato label="Caudal total">{madre.caudal == null ? '—' : `${madre.caudal.toFixed(2)} l/s`}</Dato>
        <Dato label="Padrón">{madre.padron || '—'}</Dato>
      </div>
    </div>
  )
}
