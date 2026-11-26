import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { nombres, numeroConcesion } from '../../../shared/formato'
import type { ReubicacionBackend } from '../../backend.types'
import { textoUbicacion } from '../../formato'
import { NotaInfo } from '../Avisos'

/** El expediente y la concesión que se reubica (que no cambia: número, magnitud, titular y padrón). */
export function DatosConcesion({ datos }: { datos: ReubicacionBackend }) {
  const { reubicacion, expediente } = datos
  const concesion = numeroConcesion(reubicacion.concesion)
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon name="move_location" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white">Expediente N° {expediente.numero}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Reubicación en la concesión {concesion}</p>
          </div>
        </div>
        <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 dark:bg-green-500/15 dark:text-green-300">Concesión vigente</span>
      </div>
      <dl className="grid gap-x-6 gap-y-3 p-6 sm:grid-cols-2 lg:grid-cols-3">
        <Dato label="Titular" valor={nombres(reubicacion.titulares)} />
        <Dato label="Ubicación" valor={textoUbicacion(reubicacion.concesion.ubicacion)} />
        <Dato label="Padrón" valor={reubicacion.concesion.padron} />
        <Dato label="Motivo" valor={reubicacion.motivoTexto} />
        <Dato label="Documentación presentada" valor={`${reubicacion.documentacionPresentada.length} papeles`} />
      </dl>
      <NotaInfo className="mx-6 mb-6">
        La concesión {concesion} no se mueve: conserva su número, magnitud, titular y padrón. Lo vigente sigue rigiendo hasta que la reubicación termine con la resolución.
      </NotaInfo>
    </Card>
  )
}

function Dato({ label, valor }: { label: string; valor: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-900 dark:text-white">{valor || <span className="text-slate-400">—</span>}</dd>
    </div>
  )
}
