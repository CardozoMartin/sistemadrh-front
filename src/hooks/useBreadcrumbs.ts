import { useMatches } from 'react-router'
import type { RouteHandle } from '@/types/navigation'

export interface Crumb {
  label: string
  path: string
}

/** Arma los breadcrumbs a partir del `handle.crumb` de cada ruta activa. */
export function useBreadcrumbs(): Crumb[] {
  const matches = useMatches()
  const crumbs: Crumb[] = []

  for (const match of matches) {
    const handle = match.handle as RouteHandle | undefined
    if (!handle?.crumb) continue
    // Una ruta index repite el path del padre: nos quedamos con el último label.
    if (crumbs.at(-1)?.path === match.pathname) crumbs.pop()
    crumbs.push({ label: handle.crumb, path: match.pathname })
  }

  return crumbs
}
