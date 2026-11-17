// Listas fijas del alta de pozo, tal como están en el prototipo (shared/state.js y
// pozo/AltadePozo/FormularioAltaDePozo.html). Cuando haya backend pasan a catálogos.

/** Por qué Pozos registra un pozo sin autorización previa (registro de oficio). */
export const MOTIVOS_OFICIO = ['POZO PREEXISTENTE', 'RELEVAMIENTO DE CAMPO', 'REGULARIZACION', 'DENUNCIA DE TERCEROS', 'ORDEN DE SERVICIO'] as const

/** Estado inicial del pozo (los mismos del padrón de pozos). */
export const ESTADOS_POZO_ALTA = [
  { value: 'EN_USO', label: 'En uso' },
  { value: 'PARADO', label: 'Parado' },
  { value: 'FUERA_DE_SERVICIO', label: 'Fuera de servicio' },
] as const

export const CUENCAS_SUPERFICIALES = [
  'CUENCA ARROYO AGUAS BLANCAS',
  'CUENCA ARROYO MATAZAMBI',
  'CUENCA ARROYO MISTA',
  'CUENCA DEL DIQUE ESCABA',
  'CUENCA PARCIAL RIO HUACRA',
  'CUENCA PARCIAL RIO SANTA MARIA',
  'CUENCA RIO AMAICHA',
  'CUENCA RIO AMPIMPA',
  'CUENCA RIO CALERA',
  'CUENCA RIO CANDELARIA',
  'CUENCA RIO CASPICHANGO',
  'CUENCA RIO CHICO',
  'CUENCA RIO CHOROMORO',
  'CUENCA RIO COLORADO',
  'CUENCA RIO EL CHURQUI',
  'CUENCA RIO EL MOGOTE',
  'CUENCA RIO EL RINCON',
  'CUENCA RIO FAMAILLA',
  'CUENCA RIO GASTONA',
  'CUENCA RIO INDIA MUERTA',
  'CUENCA RIO INFIERNILLO',
  'CUENCA RIO LA OVEJERIA',
  'CUENCA RIO LAS PUERTAS',
  'CUENCA RIO LOS ALISOS',
  'CUENCA RIO LOS PINOS',
  'CUENCA RIO LULES',
  'CUENCA RIO MANAGUA',
  'CUENCA RIO MARAPA',
  'CUENCA RIO MEDINA',
  'CUENCA RIO MOLLAR',
  'CUENCA RIO MOLLE SOLO',
  'CUENCA RIO MUÑOZ',
  'CUENCA RIO PICHAO',
  'CUENCA RIO ROMANO',
  'CUENCA RIO SALI',
  'CUENCA RIO SALI Y ARROYO TALA',
  'CUENCA RIO SAN FRANCISCO',
  'CUENCA RIO SAN IGNACIO',
  'CUENCA RIO SANTA MARIA',
  'CUENCA RIO SECO',
  'CUENCA RIO TACANAS',
  'CUENCA RIO TAJAMAR',
  'CUENCA RIO TALA',
  'CUENCA RIO TAPIA',
  'CUENCA RIO UREÑA',
  'CUENCA RIO VIPOS',
  'CUENCA RIO ZARATE O ACEQUIENES',
  'CUENCA RIOS PUEBLO VIEJO - BALDERRAMA',
  'CUENCA TAFI DEL VALLE',
  'CUENCA VERTIENTE EL UNQUILLAL',
  'CUENCA VERTIENTE OCCIDENTAL SIERRA DE MEDINA',
  'CUENCA VERTIENTE ORIENTAL SIERRA SAN JAVIER',
  'CUENCA VERTIENTE Y RIO LOS PINOS',
] as const

export const CUENCAS_SUBTERRANEAS = [
  'CUENCA BURRUYACU (SEMI-SURGENTE)',
  'CUENCA BURRUYACU (SURGENTE)',
  'CUENCA RIO SALI (SEMI-SURGENTE)',
  'CUENCA RIO SALI (SURGENTE)',
  'CUENCA RIO SANTA MARIA',
  'CUENCA TAFI DEL VALLE',
  'CUENCA TAPIA - TRANCAS',
] as const

/** Tipos de capa de la litología, con el color de la columna estratigráfica. */
export const TIPOS_LITOLOGIA: Record<string, string> = {
  ARENA: '#fcd34d',
  ARCILLA: '#c084fc',
  BASAMENTO: '#64748b',
  BLOQUE: '#78716c',
  GRAVA: '#fb923c',
  LIMO: '#a3e635',
  SUELO: '#a16207',
  'SIN TIPO': '#e2e8f0',
}

export const USOS_AGUA = ['INDUSTRIAL', 'AGRICOLA', 'CONSUMO HUMANO', 'PECUARIO', 'MINERO'] as const
export const UNIDADES_USO = ['M3', 'LTS', 'M3/H'] as const

/** Parámetros del informe químico: cada uno sugiere su símbolo y su unidad habitual. */
export const CATALOGO_QUIMICO = [
  { nombre: 'COLOR PT/CO', simbolo: '', unidad: 'UPt-Co' },
  { nombre: 'OLOR', simbolo: '', unidad: '' },
  { nombre: 'TURBIDEZ', simbolo: '', unidad: 'NTU' },
  { nombre: 'PH', simbolo: 'pH', unidad: '' },
  { nombre: 'CONDUCTIVIDAD ELECT. (25C)', simbolo: 'CE', unidad: 'uS/cm' },
  { nombre: 'RESIDUO SECO (105C)', simbolo: 'RS', unidad: 'mg/l' },
  { nombre: 'ALCALINIDAD TOTAL', simbolo: '', unidad: 'mg/l' },
  { nombre: 'DUREZA TOTAL EN P.P.M. DE CO3', simbolo: 'CO3', unidad: 'mg/l' },
  { nombre: 'CALCIO', simbolo: 'Ca', unidad: 'mg/l' },
  { nombre: 'MAGNESIO', simbolo: 'Mg', unidad: 'mg/l' },
  { nombre: 'SODIO', simbolo: 'Na', unidad: 'mg/l' },
  { nombre: 'POTASIO', simbolo: 'K', unidad: 'mg/l' },
  { nombre: 'CLORUROS', simbolo: 'Cl', unidad: 'mg/l' },
  { nombre: 'SULFATOS', simbolo: 'SO4', unidad: 'mg/l' },
  { nombre: 'BICARBONATOS', simbolo: 'HCO3', unidad: 'mg/l' },
  { nombre: 'CARBONATOS', simbolo: 'CO3', unidad: 'mg/l' },
  { nombre: 'NITRATOS', simbolo: 'NO3', unidad: 'mg/l' },
  { nombre: 'NITRITOS', simbolo: 'NO2', unidad: 'mg/l' },
  { nombre: 'AMONIO', simbolo: 'NH4', unidad: 'mg/l' },
  { nombre: 'FLUORUROS', simbolo: 'F', unidad: 'mg/l' },
  { nombre: 'HIERRO TOTAL', simbolo: 'Fe', unidad: 'mg/l' },
  { nombre: 'MANGANESO', simbolo: 'Mn', unidad: 'mg/l' },
  { nombre: 'ARSENICO', simbolo: 'As', unidad: 'mg/l' },
  { nombre: 'BORO', simbolo: 'B', unidad: 'mg/l' },
  { nombre: 'R.A.S.', simbolo: 'RAS', unidad: '' },
  { nombre: 'SOLIDOS DISUELTOS TOTALES', simbolo: 'SDT', unidad: 'mg/l' },
  { nombre: 'COLIFORMES TOTALES', simbolo: '', unidad: '' },
  { nombre: 'ESCHERICHIA COLI', simbolo: 'E. coli', unidad: '' },
] as const

export const UNIDADES_QUIMICAS = ['mg/l', 'NTU', 'uS/cm', 'UPt-Co', 'meq/l', '%'] as const

/** «<VALOR»: el laboratorio informa «menor que» (debajo del límite de detección). */
export const TIPOS_RESULTADO = [
  { value: 'VALOR', label: 'VALOR' },
  { value: 'MENOR', label: '<VALOR (menor que)' },
] as const
