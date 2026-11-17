// Funciones que limpian lo que el usuario escribe en un input, carácter a carácter.

export const soloDigitos = (valor: string) => valor.replace(/\D/g, '')

/** Número decimal con signo: coma → punto, un solo '-' al inicio y un solo '.'. */
export function decimalConSigno(valor: string): string {
  let v = valor.replace(/,/g, '.').replace(/[^0-9.-]/g, '')
  const negativo = v.startsWith('-')
  v = (negativo ? '-' : '') + v.replace(/-/g, '')
  const partes = v.split('.')
  if (partes.length > 2) v = `${partes.shift()}.${partes.join('')}`
  return v
}

/** Número decimal positivo (caudales, superficies…). */
export function decimalPositivo(valor: string): string {
  return decimalConSigno(valor).replace(/-/g, '')
}
