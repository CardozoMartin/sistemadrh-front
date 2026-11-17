import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import { origenDe } from '../estilos'

/** Marca de cómo entró el pozo al padrón (de oficio, con autorización, padrón anterior). */
export function MarcaOrigen({ origen }: { origen: string }) {
  const o = origenDe(origen)
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap', o.color)} title={o.texto}>
      <Icon name={o.icono} className="text-[14px]!" />
      {o.corto}
    </span>
  )
}
