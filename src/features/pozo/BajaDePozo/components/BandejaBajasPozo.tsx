import { Card } from '@/components/ui/Card'
import type { OficinaBaja } from '../types'
import { ListaBajas } from './ListaBajas'

/**
 * Bajas de pozo que están en la oficina (backend real). Va arriba de la bandeja de la
 * oficina, que todavía muestra los demás trámites con los datos de demostración.
 */
export function BandejaBajasPozo({ oficina }: { oficina: OficinaBaja }) {
  return (
    <Card className="mb-6 p-6">
      <h2 className="mb-3 text-base font-bold text-slate-900 dark:text-white">Bajas de pozo</h2>
      <ListaBajas oficina={oficina} />
    </Card>
  )
}
