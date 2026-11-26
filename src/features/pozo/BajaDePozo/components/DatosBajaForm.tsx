import { LoadingState } from '@/components/feedback/States'
import { controlClass } from '@/components/form/styles'
import { Icon } from '@/components/ui/Icon'
import { Campo } from '@/features/tramites/shared/circuito/campos'
import { cn } from '@/lib/cn'
import { useDocumentosBaja } from '../hooks'
import type { DatosBajaDto, DocumentoBaja } from '../types'

/** Valores del formulario de la solicitud (mesa de entrada). */
export interface DatosSolicitudForm {
  motivo: string
  solicitanteNombre: string
  solicitanteDocumento: string
  documentacionPresentada: string[]
}

export const solicitudVacia = (): DatosSolicitudForm => ({ motivo: '', solicitanteNombre: '', solicitanteDocumento: '', documentacionPresentada: [] })

/** Para la API: recorta y no manda los campos vacíos. */
export function aDatosBajaDto(d: DatosSolicitudForm): DatosBajaDto {
  return {
    motivo: d.motivo.trim(),
    solicitanteNombre: d.solicitanteNombre.trim(),
    solicitanteDocumento: d.solicitanteDocumento.trim() || undefined,
    documentacionPresentada: d.documentacionPresentada,
  }
}

/** Lo que falta para poder guardar (el backend lo valida igual). La documentación incompleta NO impide guardar. */
export function faltaEnSolicitud(d: DatosSolicitudForm): string | null {
  if (d.motivo.trim().length < 10) return 'Explique el motivo de la baja (al menos 10 caracteres).'
  if (!d.solicitanteNombre.trim()) return 'Ingrese el nombre del solicitante.'
  if (d.solicitanteDocumento && !/^\d{7,11}$/.test(d.solicitanteDocumento)) return 'El documento tiene que tener entre 7 y 11 dígitos.'
  return null
}

/** Documentos obligatorios que todavía no se marcaron. */
export const obligatoriosFaltantes = (documentos: DocumentoBaja[], presentados: string[]) => documentos.filter((d) => d.obligatorio && !presentados.includes(d.codigo))

/** Checklist de la documentación presentada (los obligatorios, marcados). */
export function ChecklistDocumentacion({ valor, onChange, soloLectura }: { valor: string[]; onChange?: (v: string[]) => void; soloLectura?: boolean }) {
  const documentos = useDocumentosBaja()
  if (documentos.isPending) return <LoadingState mensaje="Cargando la documentación…" className="py-4" />
  if (documentos.isError) return <p className="text-sm text-red-600">No se pudo cargar la lista de documentación.</p>
  const alternar = (codigo: string) => onChange?.(valor.includes(codigo) ? valor.filter((c) => c !== codigo) : [...valor, codigo])

  return (
    <ul className="flex flex-col gap-1.5">
      {documentos.data.map((d) => {
        const marcado = valor.includes(d.codigo)
        return (
          <li key={d.codigo}>
            <label className={cn('flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm', !soloLectura && 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800')}>
              {soloLectura ? (
                <Icon name={marcado ? 'check_circle' : 'radio_button_unchecked'} className={cn('text-[20px]!', marcado ? 'text-green-600' : d.obligatorio ? 'text-amber-500' : 'text-slate-300')} />
              ) : (
                <input type="checkbox" checked={marcado} onChange={() => alternar(d.codigo)} className="mt-0.5 size-4 rounded border-slate-300" />
              )}
              <span className="text-slate-700 dark:text-slate-200">
                {d.descripcion}
                {d.obligatorio && <span className="ml-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">obligatorio</span>}
              </span>
            </label>
          </li>
        )
      })}
    </ul>
  )
}

/** Motivo, solicitante y documentación presentada. Lo usan el inicio y la corrección. */
export function DatosSolicitudCampos({ valor, onChange }: { valor: DatosSolicitudForm; onChange: (v: DatosSolicitudForm) => void }) {
  const set = (campo: 'motivo' | 'solicitanteNombre') => (e: { target: { value: string } }) => onChange({ ...valor, [campo]: e.target.value })
  return (
    <div className="flex flex-col gap-4">
      <Campo etiqueta="Motivo de la baja" ayuda="Ej: pozo seco, sin uso, reemplazado por otra perforación.">
        <textarea value={valor.motivo} onChange={set('motivo')} rows={3} className={controlClass({ className: 'resize-y' })} />
      </Campo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Solicitante (titular o apoderado)">
          <input value={valor.solicitanteNombre} onChange={set('solicitanteNombre')} className={controlClass({})} />
        </Campo>
        <Campo etiqueta="Documento (DNI o CUIT, sin guiones)">
          <input
            value={valor.solicitanteDocumento}
            inputMode="numeric"
            onChange={(e) => onChange({ ...valor, solicitanteDocumento: e.target.value.replace(/\D/g, '').slice(0, 11) })}
            className={controlClass({})}
          />
        </Campo>
      </div>
      <fieldset className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
        <legend className="px-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Documentación presentada</legend>
        <ChecklistDocumentacion valor={valor.documentacionPresentada} onChange={(v) => onChange({ ...valor, documentacionPresentada: v })} />
      </fieldset>
    </div>
  )
}
