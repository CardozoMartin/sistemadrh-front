import { Icon } from '@/components/ui/Icon'

/** El encabezado de cada tarjeta de la propuesta (polígono, forma de servicio). */
export function EncabezadoSeccion({ icono, titulo, descripcion }: { icono: string; titulo: string; descripcion: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
      <Icon name={icono} className="text-primary" />
      <div>
        <h3 className="font-bold text-slate-900 dark:text-white">{titulo}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">{descripcion}</p>
      </div>
    </div>
  )
}
