// Acceso seguro a localStorage (puede fallar en modo privado o con datos bloqueados).

export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? fallback : (JSON.parse(raw) as T)
    } catch {
      return fallback
    }
  },
  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* sin persistencia disponible */
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch {
      /* sin persistencia disponible */
    }
  },
}

export const STORAGE_KEYS = {
  theme: 'drh_theme',
} as const
