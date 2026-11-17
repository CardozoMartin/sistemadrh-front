// Sesión con el backend real: el token del login. Se guarda en localStorage (sobrevive al
// recargar y se comparte entre pestañas) y viaja en cada pedido como «Authorization: Bearer».
// Si el backend responde 401 (venció o se cerró), se borra y la app vuelve al login.
//
// Modo demo (npm run demo): no hay login; se elige el usuario en la barra superior
// (SelectorUsuario) y el emulador del navegador lo lee del encabezado X-Usuario-Id.
import { useSyncExternalStore } from 'react'

const CLAVE_TOKEN = 'drh_token'
const CLAVE_USUARIO_DEMO = 'drh_usuario_actual'
/** Modo demo sin usuario elegido: «Sistema» (administrador). */
export const USUARIO_SISTEMA = '1'

const leer = (clave: string) => {
  try {
    return localStorage.getItem(clave)
  } catch {
    return null
  }
}
const escribir = (clave: string, valor: string | null) => {
  try {
    if (valor === null) localStorage.removeItem(clave)
    else localStorage.setItem(clave, valor)
  } catch {
    /* sin almacenamiento: queda solo en memoria */
  }
}

// --- Token del login (backend real) ---------------------------------------------------

let token = leer(CLAVE_TOKEN)
const alCambiarToken = new Set<() => void>()

export const tokenActual = () => token

export function guardarToken(nuevo: string | null) {
  token = nuevo
  escribir(CLAVE_TOKEN, nuevo)
  alCambiarToken.forEach((avisar) => avisar())
}

/** Se llama cuando cambia el token (login, logout, sesión vencida, o desde otra pestaña). */
export function suscribirToken(avisar: () => void) {
  alCambiarToken.add(avisar)
  return () => void alCambiarToken.delete(avisar)
}

// Otra pestaña entró o salió: esta se entera.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== CLAVE_TOKEN) return
    token = e.newValue
    alCambiarToken.forEach((avisar) => avisar())
  })
}

// --- Usuario elegido (solo modo demo) ---------------------------------------------------

let usuarioDemo = leer(CLAVE_USUARIO_DEMO) ?? USUARIO_SISTEMA
const alCambiarUsuarioDemo = new Set<() => void>()

export const usuarioActualId = () => usuarioDemo

export function cambiarUsuario(id: string): void {
  usuarioDemo = id
  escribir(CLAVE_USUARIO_DEMO, id)
  alCambiarUsuarioDemo.forEach((avisar) => avisar())
}

/** Id del usuario elegido en el modo demo; el componente se vuelve a dibujar cuando cambia. */
export function useUsuarioActualId(): string {
  return useSyncExternalStore((avisar) => {
    alCambiarUsuarioDemo.add(avisar)
    return () => void alCambiarUsuarioDemo.delete(avisar)
  }, usuarioActualId)
}
