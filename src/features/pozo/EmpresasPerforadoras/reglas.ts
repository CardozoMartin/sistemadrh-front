// Reglas de las empresas perforadoras (CU Gestión de Empresa Perforadora, RF05-RF10,
// RN-10 y RN-11). Funciones puras, sin API.
import type { CambioCampo, DatosEmpresa, DatosMaquina, EmpresaPerforadora, EmpresaRegistro, EstadoEmpresa, Maquina, OficinaEmpresa } from './types'

export const NOMBRE_ESTADO: Record<EstadoEmpresa, string> = {
  EN_TRAMITE: 'En trámite',
  OBSERVADA: 'Observada',
  RECHAZADA: 'Rechazada',
  ACTIVA: 'Activa',
  BAJA: 'De baja',
}

export const NOMBRE_OFICINA: Record<OficinaEmpresa, string> = {
  juridico: 'Jurídico',
  secretaria_general: 'Secretaría General',
}

/** «En Jurídico», «En Secretaría General (pendiente de resolución)», «Observada por Jurídico»… */
export function estadoDetallado(e: Pick<EmpresaRegistro, 'estado' | 'tramite' | 'observacion'>): string {
  if (e.estado === 'EN_TRAMITE' && e.tramite) {
    return e.tramite.oficina === 'secretaria_general' ? 'En Secretaría General · pendiente de resolución' : `En ${NOMBRE_OFICINA[e.tramite.oficina]}`
  }
  if (e.estado === 'OBSERVADA' && e.observacion) return `Observada por ${NOMBRE_OFICINA[e.observacion.oficina]}`
  return NOMBRE_ESTADO[e.estado]
}

/**
 * Datos y máquinas se pueden modificar salvo mientras una oficina la está revisando
 * (EN_TRAMITE) o si fue rechazada. Observada: se corrige y se reenvía.
 */
export const esEditable = (e: Pick<EmpresaRegistro, 'estado'>) => e.estado !== 'EN_TRAMITE' && e.estado !== 'RECHAZADA'

/** Control legal de Jurídico (prototipo pozo/Circuito/juridicoPozo.html, adaptado a empresas). */
export const CONTROLES_JURIDICO = [
  'Identidad y CUIT/CUIL verificados',
  'Documentación legal completa (estatuto, nota de solicitud)',
  'Inscripción en Ingresos Brutos / Convenio Multilateral acreditada',
  'Dirección técnica a cargo de un profesional habilitado',
]

/** Control previo a la resolución (prototipo pozo/Circuito/secretariaPozo.html). */
export const CONTROLES_SECRETARIA = [
  'Dictamen jurídico incorporado',
  'Expediente foliado y completo',
  'Resolución firmada por la Dirección',
]

/** Nombre para mostrar: razón social (jurídica) o «Apellido, Nombre» (física). */
export function nombreEmpresa(e: Pick<DatosEmpresa, 'tipoPersona' | 'razonSocial' | 'nombre' | 'apellido'>): string {
  if (e.tipoPersona === 'juridica') return e.razonSocial.trim()
  return [e.apellido, e.nombre].map((x) => x.trim()).filter(Boolean).join(', ')
}

/** CUIT con guiones (30-71234567-1). */
export const cuitConFormato = (c: string) => (c.length === 11 ? `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10)}` : c)

/** Máquinas que cuentan para RN-10/RN-11: activas, con código y foto. */
export const maquinasValidas = <T extends Pick<Maquina, 'activa' | 'codigo' | 'foto'>>(maquinas: T[]): T[] => maquinas.filter((m) => m.activa && m.codigo.trim() && m.foto)

/**
 * RN-10: puede solicitar autorizaciones de perforación si está activa (con resolución) y
 * tiene al menos una máquina activa con código y foto. Devuelve el motivo si no puede.
 */
export function motivoNoHabilitada(e: EmpresaPerforadora): string | null {
  if (e.estado === 'BAJA') return 'Empresa dada de baja.'
  if (e.estado === 'RECHAZADA') return 'El alta fue rechazada.'
  if (e.estado === 'OBSERVADA') return `${estadoDetallado(e)}: falta corregir y reenviar.`
  if (e.estado === 'EN_TRAMITE') return `Trámite de alta en curso (${estadoDetallado(e).toLowerCase()}).`
  if (maquinasValidas(e.maquinas).length === 0) return 'No tiene máquinas activas con código y foto (RN-10).'
  return null
}

/** Código de máquina normalizado (mayúsculas, sin espacios). */
export const normalizarCodigo = (codigo: string) => codigo.trim().toUpperCase().replace(/\s+/g, '')

/** Valores iniciales del alta, como el prototipo: casilla «Persona jurídica» sin tildar, sin provincia y una fila de ingreso multilateral. */
export const datosEmpresaVacios = (): DatosEmpresa => ({
  tipoPersona: 'fisica',
  cuit: '',
  razonSocial: '',
  nombre: '',
  apellido: '',
  documento: '',
  ingresosBrutos: '',
  convenioMultilateral: false,
  jurisdicciones: [{ jurisdiccion: '', numero: '', condicion: '' }],
  registroComercio: '',
  domicilio: '',
  telefono: '',
  provincia: '',
  departamento: '',
  localidad: '',
  resolucion: { numero: '', anio: '' },
  observaciones: '',
  direccionTecnica: { nombre: '', apellido: '', profesion: '', matricula: '', email: '', domicilio: '' },
  notaSolicitud: [],
  documentacionLegal: [],
})

export const maquinaVacia = (): DatosMaquina => ({
  codigo: '',
  modelo: '',
  capacidadDiametro: '',
  capacidadProfundidad: '',
  alturaTorre: '',
  vehiculoPatente: '',
  vehiculoModelo: '',
  observacion: '',
  foto: null,
})

/** Los datos editables de una empresa guardada (para precargar el formulario). */
export function datosDe(e: EmpresaPerforadora): DatosEmpresa {
  const vacios = datosEmpresaVacios()
  return Object.fromEntries(Object.keys(vacios).map((k) => [k, e[k as keyof DatosEmpresa] ?? vacios[k as keyof DatosEmpresa]])) as unknown as DatosEmpresa
}

export const datosMaquinaDe = (m: Maquina): DatosMaquina => {
  const { id: _id, empresaId: _empresa, activa: _activa, alta: _alta, baja: _baja, ...datos } = m
  return { ...maquinaVacia(), ...datos }
}

// --- Comparación (historial de modificaciones, RF22) -------------------------------

const CAMPOS_EMPRESA: [keyof DatosEmpresa, string][] = [
  ['tipoPersona', 'Tipo de persona'],
  ['cuit', 'CUIT / CUIL'],
  ['razonSocial', 'Razón social'],
  ['nombre', 'Nombre'],
  ['apellido', 'Apellido'],
  ['documento', 'Num. documento'],
  ['ingresosBrutos', 'Ingresos Brutos'],
  ['registroComercio', 'Registro de comercio'],
  ['domicilio', 'Domicilio fiscal'],
  ['telefono', 'Teléfono fiscal'],
  ['provincia', 'Provincia'],
  ['departamento', 'Departamento'],
  ['localidad', 'Localidad'],
  ['observaciones', 'Observaciones'],
]

const CAMPOS_DIRECCION: [keyof DatosEmpresa['direccionTecnica'], string][] = [
  ['nombre', 'Director técnico — nombre'],
  ['apellido', 'Director técnico — apellido'],
  ['profesion', 'Director técnico — profesión'],
  ['matricula', 'Director técnico — matrícula'],
  ['email', 'Director técnico — email'],
  ['domicilio', 'Director técnico — dirección'],
]

const CAMPOS_MAQUINA: [keyof DatosMaquina, string][] = [
  ['codigo', 'Código'],
  ['modelo', 'Nombre de la máquina'],
  ['capacidadDiametro', 'Diámetro de perforación'],
  ['capacidadProfundidad', 'Profundidad máxima (m)'],
  ['alturaTorre', 'Altura de torre (m)'],
  ['vehiculoPatente', 'Patente del vehículo'],
  ['vehiculoModelo', 'Modelo del vehículo'],
  ['observacion', 'Observación'],
]

function texto(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (v === 'juridica') return 'Persona jurídica'
  if (v === 'fisica') return 'Persona física'
  return String(v).trim()
}

const resumenLista = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`

/** Qué cambió entre los datos guardados y los nuevos (solo lo distinto). */
export function compararEmpresa(antes: DatosEmpresa, ahora: DatosEmpresa): CambioCampo[] {
  const cambios: CambioCampo[] = []
  const agregar = (etiqueta: string, a: unknown, b: unknown) => {
    if (texto(a) !== texto(b)) cambios.push({ etiqueta, antes: texto(a), ahora: texto(b) })
  }
  for (const [campo, etiqueta] of CAMPOS_EMPRESA) agregar(etiqueta, antes[campo], ahora[campo])
  const res = (r: DatosEmpresa['resolucion']) => (r.numero.trim() ? `${r.numero.trim()}${r.anio.trim() ? `/${r.anio.trim()}` : ''}` : '')
  agregar('Resolución', res(antes.resolucion), res(ahora.resolucion))
  for (const [campo, etiqueta] of CAMPOS_DIRECCION) agregar(etiqueta, antes.direccionTecnica[campo], ahora.direccionTecnica[campo])

  // Las listas se comparan enteras: interesa que cambiaron y cuántas quedaron.
  const clave = (j: DatosEmpresa['jurisdicciones'][number]) => [j.jurisdiccion, j.numero, j.condicion].join('|')
  if (antes.jurisdicciones.map(clave).join(';') !== ahora.jurisdicciones.map(clave).join(';')) {
    cambios.push({
      etiqueta: 'Ingresos multilaterales',
      antes: resumenLista(antes.jurisdicciones.length, 'inscripción', 'inscripciones'),
      ahora: resumenLista(ahora.jurisdicciones.length, 'inscripción', 'inscripciones'),
    })
  }
  const archivos = (xs: { nombre: string }[]) => xs.map((x) => x.nombre).join(', ')
  agregar('Nota de solicitud', archivos(antes.notaSolicitud), archivos(ahora.notaSolicitud))
  agregar('Documentación legal', archivos(antes.documentacionLegal), archivos(ahora.documentacionLegal))
  return cambios
}

export function compararMaquina(antes: DatosMaquina, ahora: DatosMaquina): CambioCampo[] {
  const cambios: CambioCampo[] = []
  for (const [campo, etiqueta] of CAMPOS_MAQUINA) {
    if (texto(antes[campo]) !== texto(ahora[campo])) cambios.push({ etiqueta, antes: texto(antes[campo]), ahora: texto(ahora[campo]) })
  }
  if ((antes.foto?.nombre ?? '') !== (ahora.foto?.nombre ?? '') || (antes.foto?.dataUrl ?? '') !== (ahora.foto?.dataUrl ?? '')) {
    cambios.push({ etiqueta: 'Foto', antes: antes.foto?.nombre ?? '', ahora: ahora.foto?.nombre ?? '' })
  }
  return cambios
}

// --- Búsqueda en el padrón ----------------------------------------------------------

const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/** Busca por nombre, CUIT, localidad, director técnico o código de máquina (como la recuerda el operador). */
export function coincide(e: EmpresaPerforadora, texto: string): boolean {
  const q = normalizar(texto.trim())
  if (!q) return true
  const d = e.direccionTecnica
  const digitos = q.replace(/\D/g, '')
  return (
    [nombreEmpresa(e), e.localidad, e.departamento, e.domicilio, d.nombre, d.apellido, ...e.maquinas.map((m) => m.codigo)].some((c) => normalizar(c ?? '').includes(q)) ||
    (digitos.length >= 3 && e.cuit.includes(digitos))
  )
}
