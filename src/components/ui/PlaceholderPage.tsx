import { PageHeader } from './PageHeader'
import { Icon } from './Icon'

interface PlaceholderPageProps {
  title: string
  description?: string
  /** Archivo del prototipo HTML que sirve de referencia para migrar esta pantalla. */
  prototipo?: string
}

/** Pantalla temporal para rutas que todavía no se migraron del prototipo. */
export function PlaceholderPage({ title, description, prototipo }: PlaceholderPageProps) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-white/50 px-6 py-16 text-center dark:border-slate-700 dark:bg-surface-dark/50">
        <Icon name="construction" className="text-5xl! text-slate-400" />
        <p className="font-semibold text-slate-700 dark:text-slate-200">Pantalla en construcción</p>
        {prototipo && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Referencia en el prototipo: <code className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">{prototipo}</code>
          </p>
        )}
      </div>
    </>
  )
}
