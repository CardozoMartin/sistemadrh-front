import { Card } from '@/components/ui/Card'
import { EncabezadoTarjeta } from '@/components/ui/EncabezadoTarjeta'
import type { AltaBackend } from '../backend.types'

/** Datos del paso 1 y dónde está el trámite, como ficha fija arriba del formulario. */
export function ResumenBorrador({ alta }: { alta: AltaBackend }) {
  const items = [
    ['Expediente', alta.numeroExpediente],
    ['Situación legal', alta.situacionLegal?.nombre ?? '—'],
    ['Documentación presentada', `${alta.documentacionPresentada.length} documento(s)`],
    ['Etapa', alta.circuito.etapaNombre],
    ['Lo tiene', alta.circuito.tomadoPor?.nombre ?? 'Nadie (hay que tomarlo)'],
  ]

  return (
    <Card>
      <EncabezadoTarjeta titulo="Datos del expediente" icono="folder_open" className="py-3" />
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 px-6 py-4 md:px-8 lg:grid-cols-5">
        {items.map(([label, valor]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">{label}</dt>
            <dd className="mt-1 truncate text-base font-semibold text-slate-900 dark:text-white">{valor}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}
