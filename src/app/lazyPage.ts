import type { ComponentType } from 'react'

/**
 * Carga diferida de una página (code splitting por ruta).
 * Uso: { path: 'x', lazy: lazyPage(() => import('./pages/XPage')) }
 */
export function lazyPage(loader: () => Promise<{ default: ComponentType }>) {
  return async () => ({ Component: (await loader()).default })
}
