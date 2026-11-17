// Adaptador de axios del modo demo: en vez de mandar la petición por la red, se la pasa al
// backend emulado (./servidor). Lo que el emulador no atiende sigue su camino normal (ej: las
// colecciones de json-server en el cliente `api`).
//
// El servidor se carga recién en la primera petición (import dinámico): sin modo demo, ni el
// emulador ni sus datos entran en el bundle.
import axios, { AxiosError, AxiosHeaders, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { USUARIO_SISTEMA } from '../sesion'

/** Demora de cada respuesta, para que se vean los estados de carga como con el backend real. */
const DEMORA_MS = Number(import.meta.env.VITE_API_DELAY_MS ?? 300)

/**
 * @param atiende qué rutas responde el emulador (relativas al baseURL del cliente). Las demás
 *   van al adaptador normal de axios.
 */
export function adaptadorDemo(atiende: (url: string) => boolean): AxiosAdapter {
  const normal = axios.getAdapter(axios.defaults.adapter)

  return async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    const url = config.url ?? ''
    if (!atiende(url)) return normal(config)

    //1.- Se arma la petición tal como la vería el backend.
    const { responder, ErrorDemo } = await import('./servidor')
    let cuerpo: unknown = config.data
    if (typeof cuerpo === 'string') {
      try {
        cuerpo = JSON.parse(cuerpo)
      } catch {
        /* texto plano: queda como vino */
      }
    }
    const usuarioId = String(AxiosHeaders.from(config.headers).get('X-Usuario-Id') ?? USUARIO_SISTEMA)
    if (DEMORA_MS > 0) await new Promise((r) => setTimeout(r, DEMORA_MS))

    //2.- El emulador responde; sus errores salen igual que los del backend ({ message }, status).
    const respuesta = (status: number, data: unknown): AxiosResponse => ({ data, status, statusText: String(status), headers: {}, config, request: {} })
    try {
      const data = await responder({ metodo: (config.method ?? 'get').toUpperCase(), url, params: config.params ?? {}, cuerpo, usuarioId })
      return respuesta(200, data)
    } catch (e) {
      if (e instanceof ErrorDemo) {
        throw new AxiosError(e.message, e.status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST, config, {}, respuesta(e.status, { statusCode: e.status, message: e.message }))
      }
      throw e
    }
  }
}
