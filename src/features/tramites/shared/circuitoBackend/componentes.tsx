// Piezas chicas comunes a los paneles de las oficinas.
import { useQuery } from '@tanstack/react-query'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import { backend } from '@/services/api/backend'
import type { DocumentoChecklist } from '../components/ChecklistDocumentacion'
import { useCircuito } from './contexto'

/** Resumen de lo que se envía, dentro del diálogo de confirmación (caso de uso: «mensaje de confirmación»). */
export function ResumenEnvio({ filas }: { filas: [string, string | null | undefined][] }) {
  return (
    <dl className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 text-left text-sm dark:divide-slate-700 dark:border-slate-700">
      {filas
        .filter(([, valor]) => valor)
        .map(([etiqueta, valor]) => (
          <div key={etiqueta} className="flex gap-3 px-3 py-2">
            <dt className="w-32 shrink-0 text-slate-500 dark:text-slate-400">{etiqueta}</dt>
            <dd className="font-medium whitespace-pre-wrap text-slate-900 dark:text-white">{valor}</dd>
          </div>
        ))}
    </dl>
  )
}

/** El checklist de un tipo de trámite (casi no cambia: se pide una vez por sesión). */
export function useChecklist(tipoTramite: string) {
  return useQuery({
    queryKey: ['backend', 'checklist', tipoTramite],
    queryFn: async () => (await backend.get<DocumentoChecklist[]>(`/catalogos/documentos/${tipoTramite}`)).data,
    staleTime: Infinity,
  })
}

/**
 * Jurídico revisa los papeles: el checklist del trámite con lo que trajo el expediente al iniciarse
 * en Catastro. Solo lectura.
 */
export function DocumentacionRevision({ presentada }: { presentada: { id: number; descripcion: string }[] }) {
  const { tipoTramite } = useCircuito()
  const checklist = useChecklist(tipoTramite)
  const presentados = new Set(presentada.map((d) => d.id))
  // Sin el catálogo (o mientras carga), al menos lo presentado.
  const papeles = checklist.data ?? presentada

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
