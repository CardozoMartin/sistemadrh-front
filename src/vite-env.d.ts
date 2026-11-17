/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_API_DELAY_MS?: string
  readonly VITE_BACKEND_URL?: string
  /** 'true': la app funciona sin el backend real (backend emulado en el navegador). */
  readonly VITE_MODO_DEMO?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
