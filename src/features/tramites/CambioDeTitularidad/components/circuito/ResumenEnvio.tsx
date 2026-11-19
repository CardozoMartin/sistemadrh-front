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
