import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import type { CambioBackend } from '../../backend.types'
import { useChecklistCambio } from '../../hooks'

/**
 * Jurídico revisa los papeles (caso de uso, paso 25): el checklist del cambio con lo que trajo el
 * expediente al iniciarse en Catastro. Solo lectura.
 */
export function DocumentacionRevision({ datos }: { datos: CambioBackend }) {
  const checklist = useChecklistCambio()
  const presentados = new Set(datos.cambio.documentacionPresentada.map((d) => d.id))
  // Sin el catálogo (o mientras carga), al menos lo presentado.
  const papeles = checklist.data ?? datos.cambio.documentacionPresentada.map((d) => ({ ...d, obligatorio: false, orden: 0, activo: true }))

  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <p className="text-sm font-semibold text-slate-900 dark:text-white">Documentación presentada</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">Lo que marcó Catastro al iniciar el trámite. Los obligatorios ya se controlaron al iniciar.</p>
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {papeles.map((p) => {
          const esta = presentados.has(p.id)
          return (
            <li key={p.id} className={cn('flex items-start gap-2 text-sm', esta ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400')}>
              <Icon name={esta ? 'check_box' : 'check_box_outline_blank'} className={cn('text-[18px]!', esta ? 'text-green-600' : 'text-slate-300')} />
              <span>
                {p.descripcion}
                {!esta && ' (no presentado)'}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
