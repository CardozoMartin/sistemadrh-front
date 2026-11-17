// Registro de pozo de oficio emulado (PROTOTIPO: el backend real todavía no lo tiene).
//
// Pozos carga la ficha completa de un pozo que no tiene autorización de perforación previa
// (pozo preexistente, relevamiento de campo, regularización…). El sistema numera el registro,
// le da el ID interno y guarda el primer monitoreo hidráulico y químico con su fecha.
// Al registrarlo se abre el expediente y pasa a Catastro (ver registroPozo.ts: el circuito).
import type { AltaPozoOficioDto, AltaPozoOficioRespuesta } from '@/features/pozo/AltaDePozo/types'
import type { CampoFecha, FiltrosPozos, OrigenPozo, PadronPozos, PozoEnPadron } from '@/features/pozo/Padron/types'
import { ahora, nuevoId } from './db'
import { leerPunto } from './alta'
import { datosConcesion, fichaPozo } from './baja'
import { actuar, crearExpediente, formatearNumero, NOMBRE_ETAPA, NOMBRE_OFICINA, nombreUsuario, pasar } from './expedientes'
import { error400, error403, error404, error409, exigirTexto, type Peticion, type Ruta } from './http'

/** Dos pozos a menos de esto son la misma perforación (coordenada única, paso 5 del CU). */
const DISTANCIA_MISMO_POZO_M = 5

function registrarDeOficio({ db, usuario, cuerpo }: Peticion): AltaPozoOficioRespuesta {
  //1.- Lo registra la oficina de Pozos.
  if (!usuario.esAdministrador && usuario.oficina !== 'pozos') throw error403('El registro de pozos lo hace la oficina de Pozos (Perforaciones).')
  const d = (cuerpo ?? {}) as AltaPozoOficioDto
  exigirTexto(d.motivo, 'Elija el motivo del registro de oficio.')
  exigirTexto(d.causante, 'Ingrese el causante.')
  exigirTexto(d.ubicacion?.departamento, 'Seleccione el departamento.')

  //2.- Coordenada: las dos formas (criterio único) y que no haya otro pozo en el mismo lugar.
  const punto = leerPunto(d.coordenada as unknown as Record<string, unknown>, 'del pozo')
  const repetido = db.pozos.find((p) => p.estado !== 'ANULADO' && Math.hypot(p.x - punto.x, p.y - punto.y) < DISTANCIA_MISMO_POZO_M)
  if (repetido) throw error409(`Ya hay un pozo registrado en esa coordenada: ${repetido.idInterno}${repetido.alias ? ` (${repetido.alias})` : ''}. Verifique que no sea el mismo.`)

  //3.- Monitoreos con fecha.
  if (d.hidraulico && !d.hidraulico.fecha) throw error400('Ingrese la fecha del monitoreo hidráulico.')
  if (d.quimico && !d.quimico.fecha) throw error400('Ingrese la fecha del monitoreo químico.')

  //4.- Número del registro e ID interno, correlativos por año.
  const anio = new Date().getFullYear()
  const n = db.pozos.filter((p) => p.registro?.expediente.endsWith(`/${anio}`)).length + 1
  const expediente = `OF-${String(n).padStart(4, '0')}/${anio}`
  const fecha = ahora()
  const { coordenada: _c, hidraulico, quimico, ...ficha } = d
  //5.- El expediente del registro: lo abre Pozos y pasa a Catastro, que registra la concesión.
  const e = crearExpediente(db, { numero: String(n), reparticion: 'OF', anio, tipoTramite: 'REGISTRO_POZO', etapa: 'CARGA_POZO', etiqueta: expediente }, usuario)
  e.fechaIngreso = d.fechaIngreso
  const pozo = {
    id: nuevoId(db),
    idInterno: `POF-${anio}-${String(n).padStart(3, '0')}`,
    alias: d.nombrePozo ?? d.alias,
    estado: d.estado,
    origen: 'OFICIO' as const,
    tipoPozo: null,
    jurisdiccionDrh: d.jurisdiccionDrh,
    profundidadM: d.construccion.profundidad,
    nivelEstaticoM: hidraulico?.nivelEstatico ?? null,
    nivelDinamicoM: hidraulico?.nivelDinamico ?? null,
    caudalM3h: hidraulico?.caudalM3h ?? null,
    latitud: punto.latitud,
    longitud: punto.longitud,
    x: punto.x,
    y: punto.y,
    concesionId: null,
    registro: { ...ficha, expediente, expedienteId: e.id, catastro: null, resolucion: null, sistemaCoordenada: punto.sistema, registradoPor: nombreUsuario(usuario), registradoEn: fecha },
  }
  db.pozos.push(pozo)
  if (hidraulico) db.monitoreos.push({ id: nuevoId(db), pozoId: pozo.id, tipo: 'hidraulico', fecha: hidraulico.fecha, registrado: fecha, usuario: nombreUsuario(usuario), datos: { ...hidraulico, regimenM3h: d.equipo.regimenM3h } })
  if (quimico) db.monitoreos.push({ id: nuevoId(db), pozoId: pozo.id, tipo: 'quimico', fecha: quimico.fecha, registrado: fecha, usuario: nombreUsuario(usuario), datos: { parametros: quimico.parametros } })
  actuar(db, e, usuario, 'REGISTRO_POZO', 'REGISTRADO', `${d.motivo}: ${d.causante}.`)
  pasar(db, e, 'CATASTRO_POZO', usuario)
  return { expediente, expedienteId: e.id, pozo: fichaPozo(db, pozo) }
}

const sinAcentos = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** Todas las palabras del filtro aparecen en alguno de los textos (sin acentos ni mayúsculas). */
function contiene(textos: (string | null | undefined)[], filtro: string | undefined): boolean {
  const palabras = sinAcentos(filtro?.trim() ?? '').split(/\s+/).filter(Boolean)
  if (!palabras.length) return true
  const texto = sinAcentos(textos.filter(Boolean).join(' '))
  return palabras.every((w) => texto.includes(w))
}

/** N° de concesión sin ceros a la izquierda ni mayúsculas, para comparar «0906» con «906» y «D-0001» con «d-1». */
const sinCeros = (n: string | null | undefined) => (n ?? '').trim().toUpperCase().replace(/\b0+(?=\d)/g, '')

/** Una fecha (ISO) dentro del rango desde/hasta (YYYY-MM-DD, los dos incluidos). */
const enRango = (fecha: string | null | undefined, desde?: string, hasta?: string) => !!fecha && (!desde || fecha.slice(0, 10) >= desde) && (!hasta || fecha.slice(0, 10) <= hasta)

/** Número de un filtro (acepta coma decimal); undefined si está vacío o no es un número. */
function numeroDe(texto: string | undefined): number | undefined {
  if (!texto?.trim()) return undefined
  const n = Number(texto.replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}

/** Valor dentro de [min, max]; sin dato no pasa si se pidió algún límite. */
const entre = (v: number | null, min?: number, max?: number) => (min === undefined && max === undefined) || (v !== null && (min === undefined || v >= min) && (max === undefined || v <= max))

const BAJAS_ABIERTAS = ['EN_TRAMITE', 'EN_ESPERA', 'OBSERVADA']
const CIRCUITO_TERMINADO = ['FINALIZADO', 'RECHAZADO', 'ANULADO', 'ARCHIVADO']

/** Lo que se usa para filtrar cada fila y no viaja en la respuesta. */
interface Extra {
  /** Expedientes del pozo: registro de oficio, alta de la concesión y baja. */
  expedientes: string[]
  /** Nombres y documentos de titular, causante y solicitante de la baja. */
  clientes: string[]
  fechasMonitoreo: string[]
  estadoCircuito: string | null
}

/**
 * Padrón de pozos con todos los filtros de la consulta (FiltrosPozos): origen del alta (de oficio,
 * con autorización, migrado), baja (de oficio, a solicitud, en trámite), concesión, expediente,
 * cliente, ubicación, fechas, circuito, monitoreos, profundidad y caudal.
 * Los filtros se combinan: un pozo aparece si cumple todos los completados.
 */
function padron({ db, query }: Peticion): PadronPozos {
  const documentoDe = (personaId: string | undefined) => (personaId ? (db.personas.find((x) => x.id === personaId)?.documento ?? null) : null)
  const expedienteDe = (id: string | null | undefined) => (id ? db.expedientes.find((x) => x.id === id) : undefined)

  //1.- Una fila por pozo (los anulados no son parte del padrón), con su baja y sus expedientes.
  const filas = db.pozos
    .filter((p) => p.estado !== 'ANULADO')
    .map((p): PozoEnPadron & { extra: Extra } => {
      const conc = datosConcesion(db, p.concesionId)
      const r = p.registro
      const monitoreos = db.monitoreos.filter((m) => m.pozoId === p.id)
      const expRegistro = expedienteDe(r?.expedienteId)
      const expConcesion = expedienteDe(conc?.c.expedienteId)
      const documentoConcesion = conc ? (conc.c.migrada?.documento ?? documentoDe(conc.titulares[0])) : null
      // La baja más reciente que no fue rechazada (en trámite o aprobada).
      const b = db.bajas.filter((x) => x.pozoId === p.id && x.estado !== 'RECHAZADA').sort((x, y) => y.creadoEn.localeCompare(x.creadoEn))[0]
      const expBaja = expedienteDe(b?.expedienteId)
      const anterior = b ? datosConcesion(db, b.concesionAnteriorId) : null
      return {
        id: p.id,
        idInterno: p.idInterno,
        alias: p.alias,
        estado: p.estado,
        origen: p.origen,
        jurisdiccionDrh: p.jurisdiccionDrh,
        profundidadM: p.profundidadM,
        caudalLps: p.caudalM3h === null ? null : +(p.caudalM3h / 3.6).toFixed(3),
        coordX: p.x,
        coordY: p.y,
        latitud: p.latitud,
        longitud: p.longitud,
        departamento: r?.ubicacion.departamento ?? conc?.departamento ?? anterior?.departamento ?? null,
        localidad: r?.ubicacion.localidad ?? conc?.localidad ?? anterior?.localidad ?? null,
        distrito: r?.ubicacion.distrito ?? conc?.distrito ?? anterior?.distrito ?? null,
        concesion: conc ? { id: conc.c.id, numero: conc.c.numero, titular: conc.titular, documento: documentoConcesion, expediente: expConcesion ? formatearNumero(expConcesion) : null } : null,
        fechaAlta: r ? (r.fechaIngreso || r.registradoEn) : null,
        baja: b
          ? {
              origen: b.origen,
              estado: b.estado,
              motivo: b.motivo,
              fechaBaja: b.fechaBaja,
              iniciada: b.creadoEn,
              expediente: expBaja ? formatearNumero(expBaja) : null,
              solicitante: b.solicitanteNombre,
              concesionAnterior: anterior?.c.numero ?? null,
            }
          : null,
        registro: r
          ? {
              expediente: r.expediente,
              expedienteId: r.expedienteId,
              circuito: { estado: expRegistro?.estado ?? '', etapaNombre: expRegistro ? NOMBRE_ETAPA[expRegistro.etapa] : '', oficinaNombre: expRegistro ? NOMBRE_OFICINA[expRegistro.oficina] : '' },
              motivo: r.motivo,
              causante: r.causante,
              documento: r.documento,
              fechaIngreso: r.fechaIngreso,
              asunto: r.asunto,
              registradoPor: r.registradoPor,
              registradoEn: r.registradoEn,
              sistemaCoordenada: r.sistemaCoordenada,
              monitoreos: { hidraulicos: monitoreos.filter((m) => m.tipo === 'hidraulico').length, quimicos: monitoreos.filter((m) => m.tipo === 'quimico').length },
            }
          : null,
        extra: {
          expedientes: [r?.expediente, expConcesion && formatearNumero(expConcesion), expBaja && formatearNumero(expBaja)].filter((x): x is string => !!x),
          clientes: [conc?.titular, documentoConcesion, r?.causante, r?.documento, b?.solicitanteNombre, b?.solicitanteDocumento, anterior?.titular].filter((x): x is string => !!x),
          fechasMonitoreo: monitoreos.map((m) => m.fecha),
          estadoCircuito: expRegistro?.estado ?? null,
        },
      }
    })

  //2.- Cada filtro completado tiene que cumplirse (Y). El origen va aparte: arma las solapas.
  const f = query as Partial<Record<keyof FiltrosPozos, string>>
  const [profMin, profMax, caudalMin, caudalMax] = [numeroDe(f.profundidadMin), numeroDe(f.profundidadMax), numeroDe(f.caudalMin), numeroDe(f.caudalMax)]
  const cumple = (p: (typeof filas)[number]): boolean => {
    const { baja: b, extra: x } = p
    if (!contiene([p.idInterno, p.alias, p.registro?.motivo, p.registro?.asunto, p.concesion?.numero, p.baja?.concesionAnterior, p.departamento, p.localidad, p.distrito, ...x.expedientes, ...x.clientes], f.q)) return false
    if (f.estado && p.estado !== f.estado) return false
    if (f.baja === 'SIN_BAJA' && b) return false
    if (f.baja === 'BAJA_DE_OFICIO' && b?.origen !== 'DE_OFICIO') return false
    if (f.baja === 'BAJA_A_SOLICITUD' && b?.origen !== 'A_SOLICITUD') return false
    if (f.baja === 'BAJA_EN_TRAMITE' && !(b && BAJAS_ABIERTAS.includes(b.estado))) return false
    if (f.baja === 'DADO_DE_BAJA' && p.estado !== 'BAJA') return false
    if (f.concesion && ![p.concesion?.numero, b?.concesionAnterior].some((n) => n && sinCeros(n) === sinCeros(f.concesion))) return false
    if (f.conConcesion === 'SI' && !p.concesion) return false
    if (f.conConcesion === 'NO' && p.concesion) return false
    if (!contiene(x.expedientes, f.expediente)) return false
    if (!contiene(x.clientes, f.cliente)) return false
    if (f.departamento && p.departamento !== f.departamento) return false
    if (f.localidad && p.localidad !== f.localidad) return false
    if (f.distrito && p.distrito !== f.distrito) return false
    if (f.motivo && p.registro?.motivo !== f.motivo) return false
    if (f.circuito === 'EN_CURSO' && !(x.estadoCircuito && !CIRCUITO_TERMINADO.includes(x.estadoCircuito))) return false
    if (f.circuito === 'FINALIZADO' && x.estadoCircuito !== 'FINALIZADO') return false
    if (f.circuito === 'RECHAZADO' && x.estadoCircuito !== 'RECHAZADO') return false
    if (f.jurisdiccion === 'SI' && !p.jurisdiccionDrh) return false
    if (f.jurisdiccion === 'NO' && p.jurisdiccionDrh) return false
    if (f.monitoreos === 'CON' && !x.fechasMonitoreo.length) return false
    if (f.monitoreos === 'SIN' && x.fechasMonitoreo.length) return false
    // Fechas: de alta, de baja (o de inicio, si está en trámite) o de algún monitoreo.
    if (f.desde || f.hasta) {
      const campo = (f.campoFecha ?? 'ALTA') as CampoFecha
      const fechas = campo === 'ALTA' ? [p.fechaAlta] : campo === 'BAJA' ? [b ? (b.fechaBaja ?? b.iniciada) : null] : x.fechasMonitoreo
      if (!fechas.some((d) => enRango(d, f.desde, f.hasta))) return false
    }
    return entre(p.profundidadM, profMin, profMax) && entre(p.caudalLps, caudalMin, caudalMax)
  }
  const filtradas = filas.filter(cumple)

  //3.- Totales por origen con los demás filtros aplicados (las solapas muestran cuántos hay en cada una).
  const totales = { OFICIO: 0, AUTORIZACION: 0, MIGRACION: 0, TODOS: filtradas.length }
  filtradas.forEach((p) => totales[p.origen]++)

  //4.- Origen y orden: los de oficio más nuevos primero; después el resto por ID.
  const origen = f.origen as OrigenPozo | undefined
  const pozos = filtradas
    .filter((p) => !origen || p.origen === origen)
    .sort((a, b) => (b.registro?.registradoEn ?? '').localeCompare(a.registro?.registradoEn ?? '') || a.idInterno.localeCompare(b.idInterno))
    .map(({ extra: _x, ...p }) => p)

  //5.- Valores para las listas de los filtros (de todo el padrón, no solo de lo filtrado).
  const valores = (lista: (string | null | undefined)[]) => [...new Set(lista.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
  const opciones = {
    departamentos: valores(filas.map((p) => p.departamento)),
    localidades: valores(filas.filter((p) => !f.departamento || p.departamento === f.departamento).map((p) => p.localidad)),
    distritos: valores(filas.map((p) => p.distrito)),
    motivos: valores(filas.map((p) => p.registro?.motivo)),
  }
  return { pozos, totales, opciones }
}

// ---------------------------------------------------------------------------
// Monitoreos: cada medición con SU fecha; no se pisan entre sí
// ---------------------------------------------------------------------------

function exigirPozo(db: Peticion['db'], id: string) {
  const p = db.pozos.find((x) => x.id === id)
  if (!p) throw error404('No se encontró el pozo.')
  return p
}

/** Los monitoreos del pozo, del más reciente al más viejo (a igual fecha, el último registrado). */
function monitoreos({ db, ruta }: Peticion) {
  const pozo = exigirPozo(db, ruta.id)
  return {
    pozo: fichaPozo(db, pozo),
    monitoreos: db.monitoreos
      .filter((m) => m.pozoId === pozo.id)
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.registrado.localeCompare(a.registrado))
      .map(({ pozoId: _p, ...m }) => m),
  }
}

/**
 * Registrar un monitoreo: la fecha es la de la medición (puede ser vieja: una medición de 2019 se
 * puede cargar hoy). Si es el hidráulico más reciente, pasa a ser el dato vigente del pozo.
 */
function registrarMonitoreo({ db, usuario, ruta, cuerpo }: Peticion) {
  if (!usuario.esAdministrador && usuario.oficina !== 'pozos') throw error403('Los monitoreos los registra la oficina de Pozos.')
  const pozo = exigirPozo(db, ruta.id)
  if (pozo.estado === 'ANULADO') throw error409('El pozo está anulado.')
  const d = (cuerpo ?? {}) as { tipo?: string; fecha?: string; datos?: Record<string, unknown> }
  if (d.tipo !== 'hidraulico' && d.tipo !== 'quimico') throw error400('El tipo de monitoreo debe ser hidráulico o químico.')
  const fecha = exigirTexto(d.fecha, 'Ingrese la fecha del monitoreo (la de la medición, no la de carga).')
  if (fecha > ahora().slice(0, 10)) throw error400('La fecha del monitoreo no puede ser futura.')
  const datos = d.datos ?? {}
  const vacio = d.tipo === 'quimico' ? !(datos.parametros as unknown[] | undefined)?.length : !['nivelEstatico', 'nivelDinamico', 'caudalM3h'].some((k) => datos[k] !== null && datos[k] !== undefined)
  if (vacio) throw error400(d.tipo === 'quimico' ? 'Agregue al menos un parámetro al informe químico.' : 'Cargue al menos un dato hidráulico (niveles o caudal).')
  const m = { id: nuevoId(db), pozoId: pozo.id, tipo: d.tipo as 'hidraulico' | 'quimico', fecha, registrado: ahora(), usuario: nombreUsuario(usuario), datos }
  db.monitoreos.push(m)
  //1.- El hidráulico de fecha más reciente es el vigente: actualiza niveles y caudal del pozo.
  if (d.tipo === 'hidraulico') {
    const ultimo = db.monitoreos.filter((x) => x.pozoId === pozo.id && x.tipo === 'hidraulico').sort((a, b) => b.fecha.localeCompare(a.fecha) || b.registrado.localeCompare(a.registrado))[0]
    if (ultimo.id === m.id) {
      pozo.nivelEstaticoM = (datos.nivelEstatico as number | null) ?? pozo.nivelEstaticoM
      pozo.nivelDinamicoM = (datos.nivelDinamico as number | null) ?? pozo.nivelDinamicoM
      pozo.caudalM3h = (datos.caudalM3h as number | null) ?? pozo.caudalM3h
      if (pozo.registro && datos.regimenM3h !== undefined) pozo.registro.equipo.regimenM3h = datos.regimenM3h as number | null
    }
  }
  return monitoreos({ db, usuario, ruta, cuerpo: null, query: {} })
}

export const rutasPozos: Ruta[] = [
  ['GET', '/pozos/:id/monitoreos', monitoreos],
  ['POST', '/pozos/:id/monitoreos', registrarMonitoreo],
  ['POST', '/pozos/oficio', registrarDeOficio],
  ['GET', '/pozos/padron', padron],
]
