import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { MODO_DEMO } from '@/services/demo/modo'
import { guardarToken, suscribirToken, tokenActual } from '@/services/sesion'
import { authApi, type UsuarioSesion } from './api'
import { SesionContext, type SesionContextValue } from './context'

/** Modo demo: no hay login; se actúa como administrador y se elige el usuario en la barra superior. */
const USUARIO_DEMO: UsuarioSesion = {
  id: '1',
  legajo: 'DEMO',
  apellido: 'Demo',
  nombre: 'Usuario',
  email: 'demo@drh.local',
  oficina: null,
  rol: null,
  distrito: null,
  esAdministrador: true,
  debeCambiarClave: false,
  permisos: [],
}

/**
 * Sesión del usuario: al abrir la app verifica el token guardado (GET /auth/sesion); si no
 * hay o venció, queda «anónimo» y las rutas protegidas llevan al login.
 */
export function SesionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(MODO_DEMO ? USUARIO_DEMO : null)
  const [estado, setEstado] = useState<SesionContextValue['estado']>(MODO_DEMO ? 'conectado' : tokenActual() ? 'cargando' : 'anonimo')
  /** Token cuya sesión ya se tiene (el del login recién hecho): no se vuelve a pedir. */
  const verificado = useRef<string | null>(null)

  // Verifica el token guardado al abrir; y si se borra (401, salir en otra pestaña) vuelve al login.
  useEffect(() => {
    if (MODO_DEMO) return
    let vigente = true
    const verificar = () => {
      if (tokenActual() && tokenActual() === verificado.current) return
      verificado.current = null
      if (!tokenActual()) {
        setUsuario(null)
        setEstado('anonimo')
        qc.clear()
        return
      }
      setEstado('cargando')
      authApi
        .sesion()
        .then((u) => {
          if (!vigente) return
          verificado.current = tokenActual()
          setUsuario(u)
          setEstado('conectado')
        })
        .catch(() => vigente && (guardarToken(null), setUsuario(null), setEstado('anonimo')))
    }
    verificar()
    const desuscribir = suscribirToken(verificar)
    return () => {
      vigente = false
      desuscribir()
    }
  }, [qc])

  const ingresar = useCallback(async (identificador: string, clave: string) => {
    const { token, usuario: u } = await authApi.login(identificador, clave)
    setUsuario(u)
    setEstado('conectado')
    // La sesión ya vino con el login: al guardar el token no se vuelve a pedir.
    verificado.current = token
    guardarToken(token)
    return u
  }, [])

  const salir = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      guardarToken(null)
    }
  }, [])

  const valor = useMemo<SesionContextValue>(
    () => ({
      estado,
      usuario,
      puede: (permiso) => !!usuario && (usuario.esAdministrador || usuario.permisos.includes(permiso)),
      ingresar,
      salir,
      actualizar: setUsuario,
    }),
    [estado, usuario, ingresar, salir],
  )

  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>
}
