// REGLA COMPARTIDA FRONT / BACK: coordenadas X/Y POSGAR 2007 faja 3 (EPSG:5345) en Tucumán.
//
// Este archivo es IDÉNTICO, letra por letra, en:
//   backend/src/comun/validadores/posgar-faja3.ts
//   Proyecto En React - Full/src/lib/posgar-faja3.ts
// El test backend/src/comun/validadores/posgar-faja3.spec.ts falla si las dos copias difieren:
// se cambia una y se copia tal cual a la otra. Sin imports, para que sirva en los dos lados.
//
// Formato: metros, 7 cifras enteras y hasta 2 decimales, con punto decimal y sin separador de
// miles (ej: X 3577293.45, Y 7035340.12). Lo que no cumple el formato no se acepta ni se
// «arregla» solo: una cifra de más cambia el punto en kilómetros.

/** Rectángulo de Tucumán en POSGAR faja 3 (metros). */
export const RANGO_POSGAR_FAJA3 = { x: { min: 3_400_000, max: 3_750_000 }, y: { min: 6_800_000, max: 7_200_000 } } as const;

/** Rectángulo de Tucumán en grados (latitud / longitud). */
export const LIMITES_TUCUMAN_GRADOS = { oeste: -66.3, sur: -28.1, este: -64.4, norte: -25.95 } as const;

export const CIFRAS_ENTERAS_POSGAR = 7;
export const DECIMALES_POSGAR = 2;

export type EjePosgar = 'x' | 'y';

const EJEMPLO: Record<EjePosgar, string> = { x: '3577293.45', y: '7035340.12' };
const FORMATO = /^\d+(\.\d+)?$/;
// Lo que se puede ir tipeando: hasta 7 cifras, y el punto decimal recién con las 7 enteras.
const PREFIJO_VALIDO = new RegExp(`^(\\d{0,${CIFRAS_ENTERAS_POSGAR}}|\\d{${CIFRAS_ENTERAS_POSGAR}}\\.\\d{0,${DECIMALES_POSGAR}})$`);
const miles = (n: number) => n.toLocaleString('es-AR');
const conContexto = (texto: string, contexto: string) => (contexto ? `${texto} ${contexto}` : texto);

/**
 * Limpia lo que se escribe en un campo X o Y. La coma decimal pasa a punto; si viene con
 * separador de miles (3.577.293,45) se le saca. Si lo nuevo ya no entra en el formato (una
 * cifra entera o un decimal de más, o un punto antes de las 7 cifras enteras, como el de miles
 * al tipear 3.577.293) y es una tecla más que `anterior`, se ignora la tecla.
 * Si se pegó un valor largo se deja tal cual, para que la validación diga qué está mal.
 */
export function mascaraPosgar(texto: string, anterior = ''): string {
  let t = texto.replace(/\s/g, '');
  if (t.includes(',') && t.includes('.')) t = t.replace(/\./g, '').replace(',', '.');
  else if ((t.match(/\./g) ?? []).length > 1) t = t.replace(/\./g, '');
  t = t.replace(/,/g, '.').replace(/[^\d.]/g, '');
  const [entera, ...resto] = t.split('.');
  if (resto.length) t = `${entera}.${resto.join('')}`;
  if (!PREFIJO_VALIDO.test(t) && t.length === anterior.length + 1) return anterior;
  return t;
}

/**
 * Valida una X o una Y POSGAR faja 3: formato (7 cifras enteras, hasta 2 decimales) y rango de
 * Tucumán. Acepta el texto del formulario o el número que llega a la API. `contexto`: «del desagüe».
 * Devuelve el mensaje de error o null.
 */
export function errorEjePosgar(valor: string | number | null | undefined, eje: EjePosgar, contexto = ''): string | null {
  const nombre = `La ${eje.toUpperCase()} POSGAR`;
  if (valor === null || valor === undefined || valor === '') return conContexto(`Ingrese la ${eje.toUpperCase()} POSGAR`, contexto) + '.';
  if (typeof valor === 'number' && !Number.isFinite(valor)) return `${nombre} no es un número válido.`;
  const texto = typeof valor === 'number' ? String(valor) : valor.trim();

  //1.- Solo cifras y un punto decimal.
  if (!FORMATO.test(texto)) return `${nombre} va en metros, solo con números y punto decimal (ej: ${EJEMPLO[eje]}).`;

  //2.- 7 cifras enteras: una de más o de menos es un punto a kilómetros del real.
  const [entera, decimales = ''] = texto.split('.');
  if (entera.length !== CIFRAS_ENTERAS_POSGAR) {
    const sobran = entera.length > CIFRAS_ENTERAS_POSGAR ? ': ¿falta el punto decimal?' : '.';
    return `${nombre} faja 3 lleva ${CIFRAS_ENTERAS_POSGAR} cifras antes del punto decimal (ej: ${EJEMPLO[eje]}) y tiene ${entera.length}${sobran}`;
  }
  if (decimales.length > DECIMALES_POSGAR) return `${nombre} admite hasta ${DECIMALES_POSGAR} decimales (centímetros).`;

  //3.- Dentro de Tucumán (avisa si parece la otra coordenada).
  const n = Number(texto);
  const { min, max } = RANGO_POSGAR_FAJA3[eje];
  if (n < min || n > max) {
    const otra = RANGO_POSGAR_FAJA3[eje === 'x' ? 'y' : 'x'];
    if (n >= otra.min && n <= otra.max) return `Ese valor parece la ${eje === 'x' ? 'Y' : 'X'}: ¿están invertidas?`;
    return `${nombre} (faja 3) en Tucumán va de ${miles(min)} a ${miles(max)}.`;
  }
  return null;
}

/**
 * Después de convertir X/Y a latitud/longitud (proj4 en el front, PostGIS en el back): el punto
 * tiene que caer en Tucumán. El rectángulo POSGAR es más grande que la provincia; esto descarta
 * los puntos que entran en el rango pero no se pueden llevar a un lugar de Tucumán.
 */
export function errorPuntoConvertido(latitud: number, longitud: number, contexto = ''): string | null {
  const { oeste, sur, este, norte } = LIMITES_TUCUMAN_GRADOS;
  if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) return conContexto('No se pudo convertir la coordenada', contexto) + ' a latitud/longitud.';
  if (latitud < sur || latitud > norte || longitud < oeste || longitud > este) {
    return conContexto('El punto', contexto) + ` cae fuera de Tucumán (latitud ${latitud.toFixed(4)}, longitud ${longitud.toFixed(4)}): revise la X y la Y.`;
  }
  return null;
}
