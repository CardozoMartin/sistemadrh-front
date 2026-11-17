import type { ReactNode } from 'react'
import { LogoInstitucional, NombreCorto } from '@/components/layout/LogoInstitucional'

/** Marco de las pantallas sin menú (login, cambio de contraseña): barra institucional y una tarjeta al centro. */
export function PantallaAcceso({ titulo, descripcion, children }: { titulo: string; descripcion?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-slate-100 dark:bg-background-dark">
      <header className="border-b-[3px] border-celeste bg-white shadow-sm dark:bg-surface-dark">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4">
          <LogoInstitucional />
          <NombreCorto />
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-10 md:items-center">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:p-8 dark:border-slate-700 dark:bg-surface-dark">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{titulo}</h1>
          {descripcion && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{descripcion}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  )
}
