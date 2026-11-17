// Genera mock-server/db.json para json-server a partir de los catálogos y datos de ejemplo.
//
//   node mock-server/build-db.mjs          → crea db.json solo si no existe (conserva los datos de la demo)
//   node mock-server/build-db.mjs --force  → lo regenera desde cero
//   node mock-server/build-db.mjs --out=/tmp/x.json → lo genera en otro archivo (para probar la semilla
//                                                     sin tocar el db.json que está usando json-server)
//
// Los catálogos se normalizan acá (mayúsculas, sin duplicados, ordenados): es lo que
// debería devolver el backend real, así el front no tiene que limpiarlos.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { empresasDemo, normalizarEmpresas } from './empresasDemo.mjs'

const DIR = dirname(fileURLToPath(import.meta.url))
const salida = process.argv.find((a) => a.startsWith('--out='))?.slice(6)
const DB = salida ?? join(DIR, 'db.json')
const force = process.argv.includes('--force') || !!salida

/**
 * Colecciones que arrancan vacías y la app llena (json-server responde 404 a un POST sobre
 * una colección que no existe en db.json). Al sumar un trámite con borradores, agregarla acá.
 */
const COLECCIONES_VACIAS = [
  'borradoresAlta',
  'borradoresCambioTitularidad',
  'borradoresSubdivision',
  /** Pedidos de número de concesión (Secretaría General → Catastro). */
  'solicitudesNumero',
  /** Bandeja de salida de emails simulados (avisos al titular, al jefe de distrito…). */
  'emails',
]

/** Repartición de la DRH (la misma que precarga el formulario). */
const REPARTICION_DRH = '332'

/**
 * Pasa los números de expediente viejos (6 dígitos) al formato número/repartición-año,
 * en el expediente y en todo lo que lo nombra (borradores, historial de la concesión…).
 * Devuelve cuántos cambió.
 */
function migrarNumerosExpediente(db) {
  const viejo = (v) => typeof v === 'string' && /^\d{6}$/.test(v)
  const nuevos = new Map()
  for (const x of db.expedientes ?? []) {
    if (viejo(x.numero)) nuevos.set(x.numero, `${Number(x.numero)}/${REPARTICION_DRH}-${x.fechaInicio.slice(0, 4)}`)
  }
  const formatear = (v) => nuevos.get(v) ?? `${Number(v)}/${REPARTICION_DRH}-${new Date().getFullYear()}`
  let cambiados = 0
  const recorrer = (nodo) => {
    if (Array.isArray(nodo)) return nodo.forEach(recorrer)
    if (!nodo || typeof nodo !== 'object') return
    for (const [k, v] of Object.entries(nodo)) {
      if (k === 'numeroExpediente' && viejo(v)) {
        nodo[k] = formatear(v)
        cambiados++
      } else recorrer(v)
    }
  }
  for (const x of db.expedientes ?? []) {
    if (viejo(x.numero)) {
      x.numero = formatear(x.numero)
      cambiados++
    }
  }
  for (const c of ['expedientes', 'borradoresAlta', 'borradoresCambioTitularidad', 'solicitudesNumero']) recorrer(db[c])
  return cambiados
}

if (existsSync(DB) && !force) {
  // Se conservan los datos de la demo; solo se completa lo que falte (colecciones nuevas e índices).
  const existente = JSON.parse(readFileSync(DB, 'utf8'))
  const nuevas = COLECCIONES_VACIAS.filter((c) => !Array.isArray(existente[c]))
  nuevas.forEach((c) => (existente[c] = []))
  // Empresas perforadoras: /empresas + /maquinas + /movimientosEmpresas. Una base que las
  // tenía todas juntas (máquinas e historial dentro de /empresasPerforadoras) se separa.
  if (Array.isArray(existente.empresasPerforadoras)) {
    Object.assign(existente, normalizarEmpresas(existente.empresasPerforadoras))
    delete existente.empresasPerforadoras
    nuevas.push('empresas, maquinas y movimientosEmpresas (separadas de empresasPerforadoras)')
  } else if (!Array.isArray(existente.empresas)) {
    Object.assign(existente, empresasDemo())
    nuevas.push('empresas, maquinas y movimientosEmpresas (con ejemplos)')
  } else {
    // Circuito del alta (Jurídico → Secretaría General): «pendiente de resolución» es estar en Secretaría.
    const pendientes = existente.empresas.filter((e) => e.estado === 'PENDIENTE_RESOLUCION')
    pendientes.forEach((e) => Object.assign(e, { estado: 'EN_TRAMITE', tramite: { oficina: 'secretaria_general', desde: e.creado } }))
    if (pendientes.length) nuevas.push(`${pendientes.length} empresa(s) pendiente(s) de resolución pasadas a Secretaría General`)
    // Empresas de ejemplo que se agregaron después (ej: altas en curso en Jurídico, observadas).
    const demo = empresasDemo()
    const faltan = demo.empresas.filter((d) => !existente.empresas.some((e) => e.id === d.id))
    for (const d of faltan) {
      existente.empresas.push(d)
      existente.maquinas.push(...demo.maquinas.filter((m) => m.empresaId === d.id))
      existente.movimientosEmpresas.push(...demo.movimientosEmpresas.filter((m) => m.empresaId === d.id))
    }
    if (faltan.length) nuevas.push(`empresas de ejemplo: ${faltan.map((d) => d.id).join(', ')}`)
  }
  // Datos de referencia que se sumaron al seed después (se agregan, no se pisan los existentes).
  const referencia = JSON.parse(readFileSync(join(DIR, 'seed', 'dominio.json'), 'utf8'))
  let referencias = 0
  for (const [coleccion, items] of Object.entries(referencia)) {
    if (!Array.isArray(items)) continue
    existente[coleccion] ??= []
    for (const item of items) {
      if (item?.id != null && !existente[coleccion].some((x) => x.id === item.id)) {
        existente[coleccion].push(item)
        referencias++
      }
    }
  }
  const indexadas = indexarConcesiones(existente.expedientes ?? [])
  const numeros = migrarNumerosExpediente(existente)
  if (nuevas.length || referencias || indexadas || numeros) writeFileSync(DB, JSON.stringify(existente, null, 2))
  const avisos = [
    nuevas.length && `Colecciones agregadas: ${nuevas.join(', ')}.`,
    referencias && `Datos de referencia nuevos: ${referencias}.`,
    indexadas && `Índices de búsqueda completados en ${indexadas} concesiones.`,
    numeros && `Números de expediente pasados al formato número/repartición-año: ${numeros}.`,
  ].filter(Boolean)
  console.log(`mock-server/db.json ya existe (usá "npm run mock:reset" para regenerarlo). ${avisos.join(' ')}`.trim())
  process.exit(0)
}

/**
 * Índices de búsqueda de las concesiones (altas finalizadas o anuladas): fecha de
 * otorgamiento y documentos de los titulares actuales. Así json-server puede filtrarlas
 * sin que el front descargue todas (ver concesionesApi.buscarVigentes). Devuelve cuántas cambió.
 */
function indexarConcesiones(expedientes) {
  let cambiadas = 0
  for (const x of expedientes) {
    if (x.tramiteId !== 'alta_concesion' || !x.numeroConcesion || !['finalizado', 'anulado'].includes(x.estadoId)) continue
    const fechaOtorgamiento = x.fechaOtorgamiento ?? x.historial.at(-1)?.fecha ?? x.fechaActualizacion
    const documentosTitulares = (x.datos?.titulares ?? []).map((t) => String(t.documento ?? '').replace(/\D/g, '')).join(' ')
    if (x.fechaOtorgamiento === fechaOtorgamiento && x.documentosTitulares === documentosTitulares) continue
    Object.assign(x, { fechaOtorgamiento, documentosTitulares })
    cambiadas++
  }
  return cambiadas
}

const leer = (archivo) => JSON.parse(readFileSync(join(DIR, 'seed', archivo), 'utf8'))
const up = (s) => String(s ?? '').trim().toUpperCase()
const collator = new Intl.Collator('es')
const ordenar = (xs) => [...xs].sort(collator.compare)

// --- Catálogo de localidades -----------------------------------------------

function normalizarLocalidades(fuente) {
  const tmp = {}
  for (const [depto, localidades] of Object.entries(fuente)) {
    const d = (tmp[up(depto)] ??= {})
    for (const [loc, distritos] of Object.entries(localidades)) {
      const set = (d[up(loc)] ??= new Set())
      distritos.forEach((x) => set.add(up(x)))
    }
  }
  const out = {}
  for (const depto of ordenar(Object.keys(tmp))) {
    out[depto] = {}
    for (const loc of ordenar(Object.keys(tmp[depto]))) out[depto][loc] = ordenar(tmp[depto][loc])
  }
  return out
}

// --- Catálogo de suministro ------------------------------------------------

const lista = (xs) => ordenar(new Set((xs ?? []).map(up).filter(Boolean)))

function normalizarCascada(nodo) {
  const out = {}
  for (const [k, v] of Object.entries(nodo ?? {})) out[up(k)] = Array.isArray(v) ? lista(v) : normalizarCascada(v)
  return out
}

function normalizarSuministro(fuente) {
  const out = {}
  for (const [depto, localidades] of Object.entries(fuente)) {
    const d = (out[up(depto)] ??= {})
    for (const [loc, distritos] of Object.entries(localidades)) {
      const l = (d[up(loc)] ??= {})
      for (const [dist, datos] of Object.entries(distritos)) {
        l[up(dist)] = {
          fuentesAgua: lista(datos.fuentesAgua),
          sistemasDistribucion: lista(datos.sistemasDistribucion),
          canalesPrincipales: Object.fromEntries(Object.entries(datos.canalesPrincipales ?? {}).map(([cp, sec]) => [up(cp), lista(sec)])),
          cascada: normalizarCascada(datos.cascada),
          desagues: lista(datos.desagies), // (sic) en el JSON original
        }
      }
    }
  }
  return out
}

// --- Expedientes de ejemplo --------------------------------------------------
// Ubicaciones reales de Tucumán con datos de suministro. Coordenadas aproximadas
// (zona rural próxima a cada localidad) para poblar el visor.

let semilla = 7
const azar = () => ((semilla = (semilla * 16807) % 2147483647) - 1) / 2147483646
const entre = (min, max) => min + azar() * (max - min)
const elegir = (xs) => xs[Math.floor(azar() * xs.length)]

/** Rectángulo rotado de `ha` hectáreas centrado en [lat, lng]. */
function poligono([lat, lng], ha) {
  const lado = Math.sqrt(ha * 10000) // metros
  const ancho = lado * entre(0.7, 1.4)
  const alto = (ha * 10000) / ancho
  const ang = entre(0, Math.PI / 2)
  const mLat = 111320
  const mLng = 111320 * Math.cos((lat * Math.PI) / 180)
  const esquinas = [
    [-ancho / 2, -alto / 2],
    [ancho / 2, -alto / 2],
    [ancho / 2, alto / 2],
    [-ancho / 2, alto / 2],
  ]
  return esquinas.map(([x, y]) => {
    const xr = x * Math.cos(ang) - y * Math.sin(ang)
    const yr = x * Math.sin(ang) + y * Math.cos(ang)
    return [+(lat + yr / mLat).toFixed(6), +(lng + xr / mLng).toFixed(6)]
  })
}

const UBICACIONES = [
  ['BURRUYACU', '7 DE ABRIL', 'II', [-26.29, -64.49]],
  ['CAPITAL', 'SAN MIGUEL DE TUCUMAN', 'III', [-26.795, -65.245]],
  ['CHICLIGASTA', 'ALTO VERDE', 'V', [-27.37, -65.57]],
  ['CRUZ ALTA', 'ALDERETES', 'III', [-26.81, -65.12]],
  ['FAMAILLA', 'MONTE GRANDE', 'IV', [-27.08, -65.34]],
  ['GRANEROS', 'GRANEROS', 'VI', [-27.66, -65.42]],
  ['JUAN B. ALBERDI', 'DONATO ALVAREZ', 'VI', [-27.61, -65.57]],
  ['LA COCHA', 'EL NOGAL', 'VI', [-27.79, -65.63]],
  ['LEALES', 'AGUA DULCE', 'III', [-27.04, -65.03]],
  ['LULES', 'LA REDUCCION', 'IV', [-26.95, -65.32]],
  ['MONTEROS', 'ACHERAL', 'IV', [-27.11, -65.46]],
  ['RIO CHICO', 'AGUILARES', 'V', [-27.44, -65.63]],
  ['SIMOCA', 'MONTEAGUDO', 'V', [-27.51, -65.27]],
  ['TAFI DEL VALLE', 'AMAICHA DEL VALLE', 'VII', [-26.6, -65.9]],
  ['TAFI VIEJO', 'LA AGUADITA', 'VII', [-26.71, -65.28]],
  ['TRANCAS', 'BENJAMIN PAZ', 'I', [-26.34, -65.31]],
]

const TITULARES = [
  'Juan Carlos Medina',
  'María Laura Díaz',
  'Agropecuaria El Ceibo S.A.',
  'Roberto Ángel Frías',
  'Ingenio La Florida S.A.',
  'Ana Beatriz Paz',
  'Citrícola San Miguel S.R.L.',
  'Luis Alberto Sosa',
  'Establecimiento Los Nogales S.A.',
  'Carmen Rosa Ledesma',
  'Finca Doña Elvira S.R.L.',
  'Héctor Manuel Juárez',
  'Cooperativa Tabacalera del Sur',
  'Silvia Noemí Acosta',
  'Frutícola Tafí S.A.',
  'Pedro Ramón Gómez',
]

// Todo lo de referencia (oficinas, etapas, estados, usuarios…) sale de seed/dominio.json:
// los expedientes solo guardan ids y se relacionan con esas colecciones.
const dominio = leer('dominio.json')
const TRAMITES_DEMO = ['alta_concesion', 'alta_concesion', 'alta_concesion', 'cambio_titularidad', 'reduccion_ampliacion', 'subdivision', 'reubicacion', 'anulacion']
const ETAPAS = [...dominio.etapas].sort((a, b) => a.orden - b.orden) // el circuito
const usuarioDe = (oficinaId) => dominio.usuarios.find((u) => u.oficinaId === oficinaId).id

const fechaISO = (base, dias) => new Date(base.getTime() + dias * 86400000).toISOString()

// --- Formulario completo de un alta de ejemplo (para que las pantallas de cada oficina
// y la finalización en Catastro tengan datos reales precargados) ---------------------

const PESOS_CUIT = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
/** CUIT válido (con dígito verificador correcto) a partir de prefijo + 8 dígitos. */
function cuitValido(prefijo, numero) {
  for (let n = numero; ; n++) {
    const base = `${prefijo}${String(n).padStart(8, '0')}`
    const resto = 11 - (PESOS_CUIT.reduce((acc, p, i) => acc + p * Number(base[i]), 0) % 11)
    const dv = resto === 11 ? 0 : resto
    if (dv !== 10) return `${base}${dv}`
  }
}

const esEmpresa = (nombre) => /S\.A\.|S\.R\.L\.|Cooperativa/.test(nombre)

function titularDemo(nombre, i) {
  if (esEmpresa(nombre)) {
    return {
      tipoPersona: 'juridica', tipoDocumento: 'cuit', documento: cuitValido('30', 71000000 + i * 1373),
      correo: `contacto${i}@ejemplo.com.ar`, telefono: '(0381) 422-' + String(1000 + i * 37).slice(0, 4),
      apellido: '', nombre: '', fechaNacimiento: '', razonSocial: nombre, fechaConstitucion: `19${80 + (i % 19)}-0${1 + (i % 9)}-15`,
    }
  }
  const partes = nombre.split(' ')
  return {
    tipoPersona: 'fisica', tipoDocumento: 'dni', documento: String(20000000 + i * 734521).slice(0, 8),
    correo: `${partes[0].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()}${i}@ejemplo.com.ar`, telefono: '(0381) 15-' + String(4000000 + i * 5311).slice(0, 7),
    apellido: partes.at(-1), nombre: partes.slice(0, -1).join(' '), fechaNacimiento: `19${60 + (i % 30)}-0${1 + (i % 9)}-1${i % 9}`,
    razonSocial: '', fechaConstitucion: '',
  }
}

function suministroDemo(ubic, caudal) {
  const d = suministro[ubic.departamento][ubic.localidad][ubic.distrito]
  const cp = Object.keys(d.canalesPrincipales)[0] ?? ''
  return {
    fuentes: [{ valor: d.fuentesAgua[0] ?? '' }],
    sistemaDistribucion: d.sistemasDistribucion[0] ?? '',
    canalPrincipal: cp,
    canalSecundario: (cp && d.canalesPrincipales[cp][0]) || '',
    canalesAdicionales: [],
    desague: d.desagues[0] ?? '',
    observacion: '',
    caudalAsignado: String(caudal),
  }
}

/** N° de expediente de ejemplo con el formato número/repartición-año (ver src/features/tramites/shared/schemas/expediente.ts). */
const numeroDemo = (i) => `${1000 + i * 37}/${REPARTICION_DRH}-2026`

function datosAltaDemo({ titular, ubicacion, coordenadas, hectareas, usoId, caudal, i }) {
  const [lat, lng] = coordenadas[0]
  const uso = dominio.usos.find((u) => u.id === usoId)
  const magnitud = uso.unidad === 'cabeza' ? String(Math.round(caudal / uso.dotacion)) : String(hectareas)
  return {
    numeroExpediente: numeroDemo(i),
    situacionLegalId: 'titular',
    documentacionPresentada: dominio.situacionesLegales.find((s) => s.id === 'titular').documentacion,
    titulares: [titularDemo(titular, i)],
    domicilios: [{ calle: 'Av. San Martín', numero: String(100 + i * 23), ...ubicacion }],
    ubicacion: { ...ubicacion, poligono: { nombreArchivo: `concesion-${1000 + i * 37}.kml`, tamanioBytes: 1840, coordenadas, hectareas } },
    catastral: { padron: String(500000 + i * 811), matricula: `${String(i + 1).padStart(3, '0')}-${20000 + i * 97}`, circunscripcion: 'II', seccion: 'B', parcela: `${i + 1}-${10 + i}`, lamina: String(200 + i), orden: '' },
    registral: { libro: String(100 + i), folio: String(300 + i * 7), anio: String(1990 + (i % 30)), matricula: `M-${4000 + i}`, serie: '' },
    usos: {
      caracter: 'permanente', codigoServicio: String(1 + (i % 5)), periodoInicio: '2026-01-01', periodoFin: '2030-12-31',
      desague: { sistema: 'grados', x: '', y: '', latitud: lat.toFixed(6), longitud: lng.toFixed(6) },
      items: [{ uso: usoId, magnitud }],
      pecuario: uso.requierePuntoEntrega
        ? { sistema: 'grados', x: '', y: '', latitud: lat.toFixed(6), longitud: lng.toFixed(6), referencia: 'Represa del potrero norte' }
        : { sistema: 'posgar', x: '', y: '', latitud: '', longitud: '', referencia: '' },
    },
    suministro: suministroDemo(ubicacion, caudal),
  }
}

const MOTIVOS_OBSERVADO = {
  recaudacion: 'Registra deuda del período 2025 ($ 184.500). Se notificó al titular.',
  distrito: 'Caudal insuficiente en el canal secundario durante el estiaje; se requiere nueva inspección.',
  juridico: 'Falta documentación: plano catastral actualizado.',
  secretaria_general: 'Resolución pendiente de firma del Director.',
  catastro: 'Pendiente de verificación del padrón de rentas.',
}

function expedienteDemo([departamento, localidad, distrito, centro], i, { finalizado = i % 7 === 6 } = {}) {
  // El historial guarda las revisiones de cada oficina. Las 'aprobado' marcan el avance
  // en el circuito; una 'observado' deja el expediente detenido en esa oficina.
  // 1..5 → el expediente está en la etapa ETAPAS[pasosCompletos] (de Recaudación al cierre en Catastro).
  const pasosCompletos = 1 + (i % 5)
  const observado = !finalizado && i % 5 === 3
  const inicio = new Date(Date.UTC(2026, 2 + (i % 6), 1 + ((i * 5) % 27)))
  const hectareas = +entre(4, 180).toFixed(2)
  const coordenadas = poligono([centro[0] + entre(-0.02, 0.02), centro[1] + entre(-0.02, 0.02)], hectareas)
  const pasos = finalizado ? ETAPAS.length : pasosCompletos
  // Los finalizados son altas: son las concesiones vigentes sobre las que se inician los demás trámites.
  const tramiteId = finalizado ? 'alta_concesion' : TRAMITES_DEMO[i % TRAMITES_DEMO.length]
  const titular = TITULARES[i % TITULARES.length]
  const usoId = elegir(['agricola-riego', 'agricola-riego', 'industrial', 'pecuario', 'piscicola'])
  const caudal = +(hectareas * 0.75).toFixed(2)
  const ubicacion = { departamento, localidad, distrito }
  const oficinaId = finalizado ? 'catastro' : ETAPAS[pasosCompletos].oficinaId
  const numeroConcesion = pasos >= 5 ? String(900 + i) : null // Catastro lo asigna antes de la resolución

  const historial = ETAPAS.slice(0, pasos).map((etapa, p) => ({
    oficinaId: etapa.oficinaId,
    etapaId: etapa.id,
    resultado: 'aprobado',
    fecha: fechaISO(inicio, p * 9 + Math.round(entre(0, 5))),
    usuarioId: usuarioDe(etapa.oficinaId),
    ...(p === 2 && i % 4 === 0 ? { observaciones: 'Se verificó la toma en campo; sin observaciones.' } : {}),
  }))
  if (observado) {
    historial.push({
      oficinaId,
      etapaId: ETAPAS[pasosCompletos].id,
      resultado: 'observado',
      fecha: fechaISO(new Date(historial.at(-1).fecha), 3),
      usuarioId: usuarioDe(oficinaId),
      observaciones: MOTIVOS_OBSERVADO[oficinaId],
    })
  }

  return {
    id: `demo-${String(i + 1).padStart(2, '0')}`,
    numero: numeroDemo(i),
    tramiteId,
    estadoId: finalizado ? 'finalizado' : observado ? 'observado' : 'en_tramite',
    oficinaId,
    fechaInicio: inicio.toISOString(),
    fechaActualizacion: historial.at(-1).fecha,
    titular,
    ubicacion,
    poligono: { coordenadas, hectareas },
    usoId,
    caudalAsignado: caudal,
    numeroConcesion,
    resolucion: pasos >= 5 ? { numero: `RES-2026-${String(100 + i).padStart(4, '0')}`, fecha: historial[4]?.fecha.slice(0, 10) } : null,
    padronRentasPendiente: finalizado,
    historial,
    // Unos expedientes ya los tomó la oficina donde están; otros esperan que los tomen.
    recepciones: recepcionesDemo(historial, finalizado ? null : ETAPAS[pasosCompletos], oficinaId, i % 2 === 1),
    // Las altas de ejemplo tienen el formulario completo; los demás trámites todavía no tienen pantallas.
    datos: tramiteId === 'alta_concesion' ? datosAltaDemo({ titular, ubicacion, coordenadas, hectareas, usoId, caudal, i }) : null,
  }
}

// --- Recepciones: quién tomó el expediente en cada oficina -------------------------------

/**
 * Cada oficina toma el expediente antes de revisarlo. Se arma a partir del historial: la
 * toma queda entre la llegada (revisión anterior) y la revisión de esa oficina.
 * `tomarActual`: si la oficina donde está ahora (sin revisión todavía) ya lo tomó.
 */
function recepcionesDemo(historial, etapaActual, oficinaActual, tomarActual) {
  const recepciones = []
  const tomadas = new Set()
  historial.forEach((paso, k) => {
    if (k === 0 || tomadas.has(paso.etapaId)) return // la carga inicial no se toma
    const llegada = new Date(historial[k - 1].fecha).getTime()
    const fecha = new Date(llegada + (new Date(paso.fecha).getTime() - llegada) * 0.3).toISOString()
    recepciones.push({ oficinaId: paso.oficinaId, etapaId: paso.etapaId, usuarioId: paso.usuarioId, fecha })
    tomadas.add(paso.etapaId)
  })
  if (tomarActual && etapaActual && !tomadas.has(etapaActual.id)) {
    const llegada = new Date(historial.at(-1).fecha).getTime()
    recepciones.push({ oficinaId: oficinaActual, etapaId: etapaActual.id, usuarioId: usuarioDe(oficinaActual), fecha: new Date(llegada + 3600000 * 5).toISOString() })
  }
  return recepciones
}

// --- Trámites sobre una concesión vigente --------------------------------------------

const NUEVOS_TITULARES = ['Marcela Inés Robles', 'Agroindustrias del Valle S.A.', 'Gustavo Daniel Paz']

/** Vincula un cambio de titularidad de ejemplo con una concesión vigente y le arma los datos. */
function cambioTitularidadDemo(exp, concesion, k) {
  const i = Number(exp.id.slice(5)) - 1
  const nuevo = titularDemo(NUEVOS_TITULARES[k % NUEVOS_TITULARES.length], 40 + i)
  // Mismo formato que el front (nombreTitular): "Apellido, Nombre" o la razón social.
  const nombre = (t) => t.razonSocial || `${t.apellido}, ${t.nombre}`
  return {
    ...exp,
    titular: `${nombre(concesion.datos.titulares[0])} → ${nombre(nuevo)}`,
    // La concesión no cambia de lugar ni de caudal: se copian sus datos.
    ubicacion: concesion.ubicacion,
    poligono: concesion.poligono,
    usoId: concesion.usoId,
    caudalAsignado: concesion.caudalAsignado,
    numeroConcesion: concesion.numeroConcesion,
    concesionOrigenId: concesion.id,
    datos: {
      numeroExpediente: exp.numero,
      concesionId: concesion.id,
      numeroConcesion: concesion.numeroConcesion,
      titularesAnteriores: concesion.datos.titulares,
      domiciliosAnteriores: concesion.datos.domicilios,
      titulares: [nuevo],
      domicilios: [{ calle: 'Calle 24 de Septiembre', numero: String(500 + i), ...concesion.ubicacion }],
    },
  }
}

const MOTIVOS_ANULACION = [
  'Renuncia expresa del titular a la concesión por cese de la actividad agrícola.',
  'Abandono del uso del agua por más de dos períodos consecutivos, constatado por Distrito.',
  'Fusión del inmueble con una parcela lindera que ya cuenta con concesión vigente.',
]

/** Vincula una anulación de ejemplo con una concesión vigente y le arma los datos. */
function anulacionDemo(exp, concesion, k) {
  const t = concesion.datos.titulares[0]
  return {
    ...exp,
    titular: t.razonSocial || `${t.apellido}, ${t.nombre}`,
    ubicacion: concesion.ubicacion,
    poligono: concesion.poligono,
    usoId: concesion.usoId,
    caudalAsignado: concesion.caudalAsignado,
    numeroConcesion: concesion.numeroConcesion,
    concesionOrigenId: concesion.id,
    datos: {
      numeroExpediente: exp.numero,
      concesionId: concesion.id,
      numeroConcesion: concesion.numeroConcesion,
      titulares: concesion.datos.titulares,
      domicilios: concesion.datos.domicilios,
      motivo: MOTIVOS_ANULACION[k % MOTIVOS_ANULACION.length],
      documentacionConfirmada: true,
    },
  }
}

/** Hectáreas de un polígono (misma fórmula que el front: lib/geo.ts → calcularHectareas). */
function hectareasDe(puntos) {
  const latRef = puntos.reduce((a, [lat]) => a + lat, 0) / puntos.length
  const mLng = 111320 * Math.cos((latRef * Math.PI) / 180)
  const pp = puntos.map(([lat, lng]) => [lng * mLng, lat * 111320])
  let area = 0
  for (let i = 0; i < pp.length; i++) {
    const [x1, y1] = pp[i]
    const [x2, y2] = pp[(i + 1) % pp.length]
    area += x1 * y2 - x2 * y1
  }
  return +(Math.abs(area / 2) / 10000).toFixed(2)
}

/** Escala un polígono respecto de su centroide (como el editor del front). */
function escalar(puntos, factor) {
  const cLat = puntos.reduce((a, [lat]) => a + lat, 0) / puntos.length
  const cLng = puntos.reduce((a, [, lng]) => a + lng, 0) / puntos.length
  return puntos.map(([lat, lng]) => [+(cLat + (lat - cLat) * factor).toFixed(7), +(cLng + (lng - cLng) * factor).toFixed(7)])
}

/**
 * Vincula una subdivisión de ejemplo con una concesión vigente: dos lotes (mitades del
 * rectángulo de la concesión); el lote A sigue con el titular y el B pasa a otro.
 */
function subdivisionDemo(exp, concesion, k) {
  const [p0, p1, p2, p3] = concesion.poligono.coordenadas
  const medio = (a, b) => [+((a[0] + b[0]) / 2).toFixed(7), +((a[1] + b[1]) / 2).toFixed(7)]
  const [m01, m23] = [medio(p0, p1), medio(p2, p3)]
  const partes = [
    [p0, m01, m23, p3],
    [m01, p1, p2, m23],
  ]
  const madre = {
    coordenadas: concesion.poligono.coordenadas,
    hectareas: concesion.poligono.hectareas,
    caudal: concesion.caudalAsignado,
    usoId: concesion.usoId,
    usos: concesion.datos.usos.items,
    titular: concesion.titular,
    padron: concesion.datos.catastral.padron,
  }
  const conResolucion = !!exp.resolucion
  const comprador = [...TITULARES.slice((k + 4) % TITULARES.length), ...TITULARES].find((n) => n !== concesion.titular)
  const fracciones = partes.map((coordenadas, j) => {
    const clave = String.fromCharCode(65 + j)
    const hectareas = hectareasDe(coordenadas)
    const proporcion = hectareas / madre.hectareas
    const caudal = +(madre.caudal * proporcion).toFixed(2)
    const items = madre.usos.map((i) => (dominio.usos.find((u) => u.id === i.uso)?.unidad.startsWith('ha') ? { ...i, magnitud: String(+(Number(i.magnitud) * proporcion).toFixed(2)) } : i))
    const titulares = j === 0 ? concesion.datos.titulares : [titularDemo(comprador, 60 + k)]
    return {
      clave,
      nombre: `Lote ${clave}`,
      color: ['#2563eb', '#16a34a'][j],
      objetivo: hectareas,
      coordenadas,
      hectareas,
      caudal,
      carga: {
        titulares,
        domicilios: concesion.datos.domicilios,
        ubicacion: { ...concesion.ubicacion, poligono: { nombreArchivo: `fraccion-${clave}.kml`, tamanioBytes: 0, coordenadas, hectareas } },
        catastral: { ...concesion.datos.catastral, padron: '', matricula: `${concesion.datos.catastral.matricula}-${clave}`, parcela: `${concesion.datos.catastral.parcela}-${clave}` },
        registral: concesion.datos.registral,
        usos: { ...concesion.datos.usos, items },
        suministro: { ...concesion.datos.suministro, caudalAsignado: String(caudal) },
      },
      seccionAlcanzada: 5,
      // Si ya pasó por Secretaría General, Catastro ya asignó los números.
      ...(conResolucion ? { numeroConcesion: String(2000 + k * 2 + j) } : {}),
    }
  })
  return {
    ...exp,
    titular: concesion.titular,
    ubicacion: concesion.ubicacion,
    poligono: concesion.poligono,
    usoId: concesion.usoId,
    caudalAsignado: concesion.caudalAsignado,
    numeroConcesion: concesion.numeroConcesion,
    concesionOrigenId: concesion.id,
    datos: {
      numeroExpediente: exp.numero,
      concesionId: concesion.id,
      numeroConcesion: concesion.numeroConcesion,
      titulares: concesion.datos.titulares,
      domicilios: concesion.datos.domicilios,
      madre,
      fracciones,
    },
  }
}

/** Vincula una reducción / ampliación de ejemplo con una concesión vigente y le arma la propuesta. */
function reduccionAmpliacionDemo(exp, concesion, k) {
  const tipo = k % 2 === 0 ? 'reduccion' : 'ampliacion'
  const coordenadas = escalar(concesion.poligono.coordenadas, tipo === 'reduccion' ? 0.9 : 1.06)
  const hectareasActual = hectareasDe(concesion.poligono.coordenadas)
  const hectareas = hectareasDe(coordenadas)
  const proporcion = hectareas / hectareasActual
  const usosActuales = concesion.datos.usos.items
  const usos = usosActuales.map((i) => (dominio.usos.find((u) => u.id === i.uso)?.unidad.startsWith('ha') ? { ...i, magnitud: String(+(Number(i.magnitud) * proporcion).toFixed(2)) } : i))
  const caudal = +(concesion.caudalAsignado * proporcion).toFixed(2)
  const t = concesion.datos.titulares[0]
  return {
    ...exp,
    titular: t.razonSocial || `${t.apellido}, ${t.nombre}`,
    ubicacion: concesion.ubicacion,
    poligono: { coordenadas, hectareas },
    usoId: concesion.usoId,
    caudalAsignado: caudal,
    numeroConcesion: concesion.numeroConcesion,
    concesionOrigenId: concesion.id,
    datos: {
      numeroExpediente: exp.numero,
      concesionId: concesion.id,
      numeroConcesion: concesion.numeroConcesion,
      titulares: concesion.datos.titulares,
      domicilios: concesion.datos.domicilios,
      tipo,
      actual: { coordenadas: concesion.poligono.coordenadas, hectareas: concesion.poligono.hectareas, caudal: concesion.caudalAsignado, usos: usosActuales },
      propuesta: { coordenadas, hectareas, caudal, usos },
    },
  }
}

/** Verifica que cada id referenciado exista en su colección (integridad referencial). */
function verificarRelaciones(db) {
  const ids = (col) => new Set(db[col].map((x) => x.id))
  const existe = { oficinas: ids('oficinas'), etapas: ids('etapas'), tramites: ids('tramites'), estados: ids('estados'), usuarios: ids('usuarios'), usos: ids('usos') }
  const errores = []
  const check = (col, id, donde) => {
    if (id != null && !existe[col].has(id)) errores.push(`${donde}: ${col} '${id}' no existe`)
  }
  db.etapas.forEach((e) => check('oficinas', e.oficinaId, `etapa ${e.id}`))
  db.usuarios.forEach((u) => check('oficinas', u.oficinaId, `usuario ${u.id}`))
  db.expedientes.forEach((x) => {
    const donde = `expediente ${x.numero}`
    check('oficinas', x.oficinaId, donde)
    check('tramites', x.tramiteId, donde)
    check('estados', x.estadoId, donde)
    check('usos', x.usoId, donde)
    if (x.concesionOrigenId && !db.expedientes.some((c) => c.id === x.concesionOrigenId && c.tramiteId === 'alta_concesion' && ['finalizado', 'anulado', 'subdividido'].includes(c.estadoId))) {
      errores.push(`${donde}: la concesión '${x.concesionOrigenId}' no existe o no está vigente`)
    }
    x.historial.forEach((h) => {
      check('oficinas', h.oficinaId, `historial de ${x.numero}`)
      check('etapas', h.etapaId, `historial de ${x.numero}`)
      check('usuarios', h.usuarioId, `historial de ${x.numero}`)
    })
  })
  if (errores.length) throw new Error(`Relaciones rotas en el seed:\n${errores.join('\n')}`)
}

// --- Armado ------------------------------------------------------------------

const localidades = normalizarLocalidades(leer('localidadesDistritos.json'))
const suministro = normalizarSuministro(leer('suministroCatalogo.json'))

for (const [d, l, dist] of UBICACIONES) {
  if (!localidades[d]?.[l]?.includes(dist) || !suministro[d]?.[l]?.[dist]) throw new Error(`Ubicación de ejemplo inválida: ${d} / ${l} / ${dist}`)
}

// 16 expedientes en distintas etapas + 8 concesiones vigentes (altas finalizadas).
const enCircuito = UBICACIONES.map((u, i) => expedienteDemo(u, i))
const concesiones = Array.from({ length: 8 }, (_, k) => expedienteDemo(UBICACIONES[(k * 2 + 1) % UBICACIONES.length], 16 + k, { finalizado: true }))
const vigentes = [...enCircuito, ...concesiones].filter((e) => e.estadoId === 'finalizado')
// Cada trámite sobre una concesión toma una concesión vigente distinta, otorgada antes de
// que empiece el trámite (si no hay, la otorgada hace más tiempo).
const otorgada = (c) => c.historial.at(-1).fecha
const libres = [...vigentes].sort((a, b) => otorgada(a).localeCompare(otorgada(b)))
function tomarConcesion(exp) {
  const i = Math.max(0, libres.findLastIndex((c) => otorgada(c) < exp.fechaInicio))
  return libres.splice(i, 1)[0]
}
/** Corre todas las fechas del expediente `ms` milisegundos (para que empiece después del otorgamiento). */
function desplazar(exp, ms) {
  if (ms <= 0) return exp
  const mover = (iso) => new Date(new Date(iso).getTime() + ms).toISOString()
  return {
    ...exp,
    fechaInicio: mover(exp.fechaInicio),
    fechaActualizacion: mover(exp.fechaActualizacion),
    historial: exp.historial.map((h) => ({ ...h, fecha: mover(h.fecha) })),
    recepciones: exp.recepciones.map((r) => ({ ...r, fecha: mover(r.fecha) })),
    resolucion: exp.resolucion && { ...exp.resolucion, fecha: mover(exp.resolucion.fecha).slice(0, 10) },
  }
}
function sobreConcesion(exp, armar) {
  const concesion = tomarConcesion(exp)
  const atraso = new Date(otorgada(concesion)).getTime() + 5 * 86400000 - new Date(exp.fechaInicio).getTime()
  return armar(desplazar(exp, atraso), concesion, k++)
}
// La anulación terminada de ejemplo (más abajo) usa la concesión otorgada hace más tiempo: se reserva antes.
const concesionAnulada = libres.shift()
let k = 0
const expedientes = [...enCircuito, ...concesiones].map((e) =>
  e.tramiteId === 'cambio_titularidad'
    ? sobreConcesion(e, cambioTitularidadDemo)
    : e.tramiteId === 'anulacion'
      ? sobreConcesion(e, anulacionDemo)
      : e.tramiteId === 'reduccion_ampliacion'
        ? sobreConcesion(e, reduccionAmpliacionDemo)
        : e.tramiteId === 'subdivision'
          ? sobreConcesion(e, subdivisionDemo)
          : e,
)

// Una anulación ya terminada: la concesión queda anulada (baja lógica), no se borra.
// Se usa la concesión libre otorgada hace más tiempo, y la anulación empieza 10 días después.
{
  const concesion = concesionAnulada
  const base = expedienteDemo(UBICACIONES[0], 24, { finalizado: true })
  const inicio = new Date(new Date(otorgada(concesion)).getTime() + 10 * 86400000)
  const historial = base.historial.map((h, p) => ({ ...h, fecha: fechaISO(inicio, 1 + p * 4) }))
  const fechado = {
    ...base,
    fechaInicio: inicio.toISOString(),
    fechaActualizacion: historial.at(-1).fecha,
    historial,
    resolucion: { ...base.resolucion, fecha: historial[4].fecha.slice(0, 10) },
    recepciones: recepcionesDemo(historial, null, 'catastro', false),
  }
  const anulacion = anulacionDemo({ ...fechado, tramiteId: 'anulacion', padronRentasPendiente: true }, concesion, k)
  const fin = anulacion.historial.at(-1)
  if (fin.fecha > new Date().toISOString()) throw new Error('La anulación de ejemplo quedó con fechas futuras.')
  Object.assign(concesion, {
    estadoId: 'anulado',
    fechaActualizacion: fin.fecha,
    bajaConcesion: {
      fecha: fin.fecha,
      expedienteId: anulacion.id,
      numeroExpediente: anulacion.numero,
      resolucion: anulacion.resolucion,
      motivo: anulacion.datos.motivo,
    },
  })
  expedientes.push(anulacion)
}

const db = {
  ...dominio,
  catalogoLocalidades: localidades,
  catalogoSuministro: suministro,
  expedientes,
  ...Object.fromEntries(COLECCIONES_VACIAS.map((c) => [c, []])),
  /** Empresas perforadoras (módulo Pozo): /empresas, /maquinas y /movimientosEmpresas. */
  ...empresasDemo(),
}

indexarConcesiones(db.expedientes)
verificarRelaciones(db)

writeFileSync(DB, JSON.stringify(db, null, 2))
console.log(`${salida ?? 'mock-server/db.json'} generado: ${db.expedientes.length} expedientes de ejemplo, ${Object.keys(dominio).length} colecciones de referencia.`)
