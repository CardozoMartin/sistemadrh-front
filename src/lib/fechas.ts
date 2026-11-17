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
