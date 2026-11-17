import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import { backend } from '@/services/api/backend'
import { cambiarUsuario, useUsuarioActualId } from '@/services/sesion'

interface UsuarioBackend {
  id: string
  apellido: string
  nombre: string
  oficina: string | null
  esAdministrador: boolean
}

const NOMBRE_OFICINA: Record<string, string> = {
  catastro: 'Catastro',
  recaudacion: 'Recaudación',
  distrito: 'Distrito',
  juridico: 'Jurídico',
  secretaria_general: 'Secretaría General',
  pozos: 'Pozos',
}

const descripcion = (u: UsuarioBackend) => (u.esAdministrador ? 'Administrador' : (NOMBRE_OFICINA[u.oficina ?? ''] ?? 'Sin oficina'))

/**
 * Usuario con el que se actúa (barra superior), solo en el MODO DEMO: se elige entre los
 * usuarios emulados. Con el backend real se entra con login y se muestra MenuUsuario.
 */
export function SelectorUsuario() {
  const actualId = useUsuarioActualId()
  const [abierto, setAbierto] = useState(false)
  const caja = useRef<HTMLDivElement>(null)
  const usuarios = useQuery({
    queryKey: ['backend', 'usuarios'],
    queryFn: async () => (await backend.get<UsuarioBackend[]>('/usuarios')).data,
    staleTime: Infinity,
    retry: false,
  })
  const actual = usuarios.data?.find((u) => u.id === actualId)

  // Cerrar al hacer clic afuera.
  useEffect(() => {
    if (!abierto) return
    const cerrar = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [abierto])

  return (
    <div ref={caja} className="relative border-l border-slate-200 dark:border-white/20 pl-1.5 sm:pl-3 md:pl-4">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        title="Usuario con el que se actúa (prueba, hasta que haya login)"
        className="flex items-center gap-3 rounded py-1 pr-1 pl-1 text-left hover:bg-slate-100 dark:hover:bg-white/10 sm:pl-2"
      >
        <div className="hidden text-right sm:block">
          <p className="text-sm leading-none font-semibold text-slate-800 dark:text-white">
            {actual ? `${actual.nombre} ${actual.apellido}` : usuarios.isError ? 'Sin conexión' : 'Usuario'}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-white/70">{actual ? descripcion(actual) : 'Backend no disponible'}</p>
        </div>
        <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20 dark:bg-white/15 dark:ring-white/25">
          <Icon name="person" className="text-xl! text-primary dark:text-white" />
        </div>
        <span className="hidden sm:flex">
          <Icon name="expand_more" className="text-[18px]! text-slate-400 dark:text-white/70" />
        </span>
      </button>

      {abierto && usuarios.data && (
        <div role="listbox" className="absolute top-full right-0 z-50 mt-2 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
          <p className="px-3 pt-1 pb-2 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Actuar como (prueba)</p>
          {usuarios.data.map((u) => (
            <button
              key={u.id}
              type="button"
              role="option"
              aria-selected={u.id === actualId}
              onClick={() => {
                cambiarUsuario(u.id)
                setAbierto(false)
              }}
              className={cn(
                'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50',
                u.id === actualId && 'bg-primary/5 font-semibold text-primary',
              )}
            >
              <span className="truncate">
                {u.nombre} {u.apellido}
              </span>
              <span className="shrink-0 text-xs text-slate-400">{descripcion(u)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
