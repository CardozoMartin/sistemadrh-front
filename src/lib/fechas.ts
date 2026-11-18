/** Hoy en la hora local, como 'AAAA-MM-DD' (el valor de un <input type="date">). */
export function hoyISO(ahora = new Date()): string {
  const dos = (n: number) => String(n).padStart(2, '0')
  return `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}`
}

/**
 * Fin de un período de `anios` años que empieza en `inicio` ('AAAA-MM-DD'): termina el día anterior
 * al mismo día de ese año (01/01/2026 + 1 año = 31/12/2026). Misma regla que el backend.
 */
export function finDePeriodo(inicio: string, anios: number): string {
  const [a, m, d] = inicio.split('-').map(Number)
  // En UTC para que el cambio de horario no corra el día. Un 29/02 sin bisiesto pasa al 01/03.
  return new Date(Date.UTC(a + anios, m - 1, d - 1)).toISOString().slice(0, 10)
}

/** 'AAAA-MM-DD' → 'DD/MM/AAAA'. */
export const fechaCorta = (iso: string): string => iso.split('-').reverse().join('/')

const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })

/** "hace 5 minutos", "ayer"… (para avisos y notificaciones). */
export function haceCuanto(iso: string, ahora = Date.now()): string {
  const seg = Math.round((new Date(iso).getTime() - ahora) / 1000)
  const abs = Math.abs(seg)
  if (abs < 45) return 'recién'
  if (abs < 3600) return rtf.format(Math.round(seg / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(seg / 3600), 'hour')
  return rtf.format(Math.round(seg / 86400), 'day')
}
