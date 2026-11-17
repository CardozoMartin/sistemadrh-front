import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Icon } from '@/components/ui/Icon'
import { ROUTES } from '@/config/routes'
import { useSesion } from '../context'

/** Usuario conectado (barra superior): oficina y rol, cambiar la contraseña y salir. */
export function MenuUsuario() {
  const { usuario, salir } = useSesion()
  const [abierto, setAbierto] = useState(false)
  const caja = useRef<HTMLDivElement>(null)

  // Cerrar al hacer clic afuera.
  useEffect(() => {
    if (!abierto) return
    const cerrar = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [abierto])

  if (!usuario) return null
  const cargo = usuario.esAdministrador
    ? usuario.oficina
      ? `Administrador · ${usuario.oficina.nombre}`
      : 'Administrador'
    : `${usuario.rol?.nombre ?? 'Sin rol'} · ${usuario.oficina?.nombre ?? 'Sin oficina'}`

  return (
    <div ref={caja} className="relative border-l border-slate-200 dark:border-white/20 pl-1.5 sm:pl-3 md:pl-4">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        className="flex items-center gap-3 rounded py-1 pr-1 pl-1 text-left hover:bg-slate-100 dark:hover:bg-white/10 sm:pl-2"
      >
        <div className="hidden text-right sm:block">
          <p className="text-sm leading-none font-semibold text-slate-800 dark:text-white">
            {usuario.nombre} {usuario.apellido}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-white/70">{cargo}</p>
        </div>
        <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20 dark:bg-white/15 dark:ring-white/25">
          <Icon name={usuario.esAdministrador ? 'admin_panel_settings' : 'person'} className="text-xl! text-primary dark:text-white" />
        </div>
        <span className="hidden sm:flex">
          <Icon name="expand_more" className="text-[18px]! text-slate-400 dark:text-white/70" />
        </span>
      </button>

      {abierto && (
        <div role="menu" className="absolute top-full right-0 z-50 mt-2 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-slate-700 shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <div className="border-b border-slate-100 px-3 pt-1 pb-2 dark:border-slate-700">
            <p className="truncate text-sm font-semibold">
              {usuario.apellido}, {usuario.nombre}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              Legajo {usuario.legajo} · {cargo}
            </p>
          </div>
          <Link role="menuitem" to={ROUTES.cambiarClave} onClick={() => setAbierto(false)} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50">
            <Icon name="key" className="text-lg! text-slate-400" /> Cambiar contraseña
          </Link>
          {usuario.esAdministrador && (
            <Link role="menuitem" to={ROUTES.informatica.root} onClick={() => setAbierto(false)} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50">
              <Icon name="computer" className="text-lg! text-slate-400" /> Informática
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => void salir()}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            <Icon name="logout" className="text-lg!" /> Salir
          </button>
        </div>
      )}
    </div>
  )
}
