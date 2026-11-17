// Circuito del registro de pozo emulado (PROTOTIPO: el backend real todavía no lo tiene).
//
//   Pozos (alta) → CATASTRO (concesión y N°) → DISTRITO (toma conocimiento) → RECAUDACIÓN → JURÍDICO
//     → SECRETARÍA GENERAL (resolución) → POZOS (cierre: FINALIZADO, concesión VIGENTE)
//
// Observado (Catastro o Jurídico): vuelve a Pozos para corregir y, al reenviarse, a la oficina
// que observó. Mismas reglas que el resto: cada acción en su etapa, tomar antes de actuar y
// solo la oficina donde está el expediente.
import type { DatosCatastroPozo, RegistroPozoBackend } from '@/features/pozo/CircuitoPozo/types'
import { calcularCaudales, codigoServicioDe } from '@/features/pozo/CircuitoPozo/caudales'
import { ahora, nuevoId, type Db, type ExpedienteDemo, type PozoDemo } from './db'
import { pendientesDe, resolucionUsada, titularesDe } from './alta'
import { fichaPozo } from './baja'
import { actuar, circuitoDe, exigirActuar, exigirExpediente, formatearNumero, pasar, terminar } from './expedientes'
import { cuerpoDe, error400, error409, exigirTexto, type Peticion, type Ruta } from './http'

const BASE = '/tramites/registro-pozo'

function exigirRegistro(db: Db, id: string): { e: ExpedienteDemo; pozo: PozoDemo; r: NonNullable<PozoDemo['registro']> } {
  const e = exigirExpediente(db, id, 'REGISTRO_POZO')
  const pozo = db.pozos.find((p) => p.registro?.expedienteId === e.id)!
  return { e, pozo, r: pozo.registro! }
}

/** Siguiente número de concesión libre: el mayor numérico + 1 (Catastro lo toma de su libro). */
const numeroSiguiente = (db: Db) => String(Math.max(4500, ...db.concesiones.map((c) => Number(c.numero)).filter((n) => Number.isInteger(n))) + 1)

export function armarRegistro(db: Db, id: string): RegistroPozoBackend {
  const { e, pozo, r } = exigirRegistro(db, id)
  const { expediente: _n, expedienteId: _e, catastro, resolucion, ...ficha } = r
  const hidraulico = [...db.monitoreos].filter((m) => m.pozoId === pozo.id && m.tipo === 'hidraulico').sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
  const conc = pozo.concesionId ? db.concesiones.find((c) => c.id === pozo.concesionId) : undefined
  const deudas = pendientesDe(db, titularesDe(db, e))
  return {
    expediente: { id: e.id, numero: formatearNumero(e), ...(circuitoDe(db, e) as Omit<RegistroPozoBackend['expediente'], 'id' | 'numero' | 'fechaIngreso'>), fechaIngreso: e.fechaIngreso },
    ficha,
    pozo: fichaPozo(db, pozo),
    caudalM3h: (hidraulico?.datos.caudalM3h as number | null | undefined) ?? pozo.caudalM3h,
    regimenM3h: r.equipo.regimenM3h,
    catastro,
    numeroSugerido: numeroSiguiente(db),
    resolucion,
    concesion: conc ? { id: conc.id, numero: conc.numero, estado: conc.estado } : null,
    deudasPendientes: deudas.map((d) => {
      const p = db.personas.find((x) => x.id === d.personaId)
      return { id: d.id, persona: p?.razonSocial ?? `${p?.apellido ?? ''}`, detalle: d.detalle, monto: d.monto }
    }),
  }
}

const obs = (p: Peticion) => (cuerpoDe<{ observaciones?: string }>(p).observaciones?.trim() || null) as string | null

// ---------------------------------------------------------------------------
// Catastro
// ---------------------------------------------------------------------------

/** Guarda lo que carga Catastro (borrador). Cada titular queda como persona única por documento. */
function guardarCatastro(p: Peticion) {
  const { db, usuario } = p
  const { e, r } = exigirRegistro(db, p.ruta.id)
  exigirActuar(e, usuario, ['CATASTRO_POZO'])
  const d = (p.cuerpo ?? {}) as DatosCatastroPozo
  const titulares = (d.titulares ?? []).map((t) => {
    const documento = exigirTexto(t.documento, 'Ingrese el documento de cada titular.').replace(/\D/g, '')
    const nombre = exigirTexto(t.nombre, 'Ingrese el nombre o razón social de cada titular.')
    const juridica = documento.length === 11 && documento.startsWith('3')
    let persona = db.personas.find((x) => x.documento === documento)
    if (!persona) {
      persona = { id: nuevoId(db), tipoPersona: juridica ? 'JURIDICA' : 'FISICA', tipoDocumento: documento.length === 11 ? 'CUIT' : 'DNI', documento, apellido: juridica ? null : nombre, nombre: juridica ? null : '', fechaNacimiento: null, razonSocial: juridica ? nombre : null, fechaConstitucion: null, email: null, telefono: null }
      db.personas.push(persona)
    }
    return { ...t, documento, nombre, personaId: persona.id }
  })
  if (new Set(titulares.map((t) => t.documento)).size !== titulares.length) throw error400('Hay titulares con el mismo documento.')
  r.catastro = { ...d, titulares }
  e.actualizado = ahora()
  return armarRegistro(db, e.id)
}

/** Lo que tiene que estar completo para aprobar (si el pozo es de jurisdicción DRH, la concesión). */
function exigirCatastroCompleto(db: Db, r: NonNullable<PozoDemo['registro']>, pozoId: string) {
  const c = r.catastro
  if (!c) throw error400('Guarde primero los datos de Catastro.')
  if (!c.uso) throw error400('Elija el uso de la concesión.')
  if (!r.jurisdiccionDrh) return
  const faltan = [!c.tipoConcesion && 'tipo de concesión', !c.numeroConcesion && 'número de concesión', !c.rigeDesde && 'fecha desde la que rige', !c.titulares.length && 'al menos un titular'].filter(Boolean)
  if (faltan.length) throw error400(`Falta: ${faltan.join(', ')}.`)
  if (!/^\d+$/.test(c.numeroConcesion!)) throw error400('El número de concesión va solo con dígitos.')
  const otra = db.concesiones.find((x) => Number(x.numero) === Number(c.numeroConcesion) && x.estado !== 'DENEGADA')
  const otroPozo = db.pozos.find((x) => x.id !== pozoId && x.registro?.catastro?.numeroConcesion && Number(x.registro.catastro.numeroConcesion) === Number(c.numeroConcesion))
  if (otra || otroPozo) throw error409(`El número de concesión ${c.numeroConcesion} ya está usado.`)
  if (c.rigeHasta && c.rigeHasta < c.rigeDesde!) throw error400('«Hasta» no puede ser anterior a «rige desde».')
}

/** Aprobar, observar (vuelve a Pozos) o rechazar. Sirve para Catastro y para Jurídico. */
function dictamen(etapa: 'CATASTRO_POZO' | 'JURIDICO') {
  return (p: Peticion) => {
    const { db, usuario } = p
    const { e, pozo, r } = exigirRegistro(db, p.ruta.id)
    exigirActuar(e, usuario, [etapa])
    const resultado = cuerpoDe<{ resultado?: string }>(p).resultado
    const o = obs(p)
    if ((resultado === 'OBSERVADO' || resultado === 'NO_APTO') && !o) throw error400('Indique el motivo en las observaciones.')
    const actuacion = etapa === 'CATASTRO_POZO' ? 'REGISTRO_CONCESION' : 'DICTAMEN_JURIDICO'
    if (resultado === 'APTO') {
      if (etapa === 'CATASTRO_POZO') exigirCatastroCompleto(db, r, pozo.id)
      actuar(db, e, usuario, actuacion, 'APTO', o, etapa === 'CATASTRO_POZO' && r.catastro?.numeroConcesion ? { numero: r.catastro.numeroConcesion } : null)
      pasar(db, e, etapa === 'CATASTRO_POZO' ? 'TOMA_CONOCIMIENTO_DISTRITO' : 'SECRETARIA_GENERAL', usuario, { dictamen: 'APROBADO', observaciones: o })
    } else if (resultado === 'OBSERVADO') {
      actuar(db, e, usuario, actuacion, 'OBSERVADO', o)
      e.vuelveA = etapa
      pasar(db, e, 'CORRECCION_POZOS', usuario, { dictamen: 'OBSERVADO', esDevolucion: true, observaciones: o, estado: 'OBSERVADO' })
    } else if (resultado === 'NO_APTO') {
      actuar(db, e, usuario, actuacion, 'NO_APTO', o)
      terminar(e, 'RECHAZADO')
    } else {
      throw error400('El resultado debe ser APTO, OBSERVADO o NO_APTO.')
    }
    return armarRegistro(db, e.id)
  }
}

// ---------------------------------------------------------------------------
// Distrito, Recaudación, Secretaría, Pozos
// ---------------------------------------------------------------------------

/** Distrito no dictamina: deja constancia de que lo recibió y lo pasa a Recaudación. */
function tomaConocimiento(p: Peticion) {
  const { e } = exigirRegistro(p.db, p.ruta.id)
  exigirActuar(e, p.usuario, ['TOMA_CONOCIMIENTO_DISTRITO'])
  actuar(p.db, e, p.usuario, 'TOMA_CONOCIMIENTO', 'REGISTRADO', obs(p))
  pasar(p.db, e, 'RECAUDACION', p.usuario, { observaciones: obs(p) })
  return armarRegistro(p.db, e.id)
}

function recaudacion(p: Peticion) {
  const { db, usuario } = p
  const { e } = exigirRegistro(db, p.ruta.id)
  exigirActuar(e, usuario, ['RECAUDACION'])
  if (e.estado === 'EN_ESPERA') throw error409('El expediente está en espera por deuda: se reanuda cuando se registre el pago.')
  const titulares = titularesDe(db, e)
  const d = cuerpoDe<{ resultado?: string; deudas?: { personaId: string; detalle: string; monto?: number }[] }>(p)
  if (d.resultado === 'SIN_DEUDA') {
    if (pendientesDe(db, titulares).length) throw error409('Hay titulares con deudas pendientes registradas: no se puede dar el «sin deuda».')
    actuar(db, e, usuario, 'VERIFICACION_DEUDA', 'SIN_DEUDA', obs(p))
    pasar(db, e, 'JURIDICO', usuario, { dictamen: 'APROBADO', observaciones: obs(p) })
  } else if (d.resultado === 'CON_DEUDA') {
    if (!d.deudas?.length) throw error400('Cargue la deuda: titular y detalle.')
    for (const x of d.deudas) {
      if (!titulares.includes(x.personaId)) throw error400('La deuda tiene que ser de un titular del pozo.')
      db.deudas.push({ id: nuevoId(db), personaId: x.personaId, detalle: exigirTexto(x.detalle, 'Ingrese el detalle de la deuda.'), monto: x.monto ?? null, estado: 'PENDIENTE', creadoEn: ahora(), canceladoEn: null, comprobantePago: null })
    }
    actuar(db, e, usuario, 'VERIFICACION_DEUDA', 'CON_DEUDA', obs(p), { deudas: d.deudas })
    e.estado = 'EN_ESPERA'
  } else {
    throw error400('El resultado debe ser SIN_DEUDA o CON_DEUDA.')
  }
  return armarRegistro(db, e.id)
}

/** Secretaría General carga la resolución que otorga la concesión (o rechaza el registro). */
function resolucion(p: Peticion) {
  const { db, usuario } = p
  const { e, r } = exigirRegistro(db, p.ruta.id)
  exigirActuar(e, usuario, ['SECRETARIA_GENERAL'])
  const d = cuerpoDe<{ decision?: string; numero?: string; anio?: number; fecha?: string }>(p)
  if (d.decision === 'RECHAZAR') {
    if (!obs(p)) throw error400('Indique el motivo del rechazo.')
    actuar(db, e, usuario, 'RESOLUCION', 'NO_APTO', obs(p), { decision: 'RECHAZAR' })
    terminar(e, 'RECHAZADO')
    return armarRegistro(db, e.id)
  }
  const numero = exigirTexto(d.numero, 'Ingrese el número de resolución.')
  if (!d.anio || !d.fecha) throw error400('Ingrese el año y la fecha de la resolución.')
  const usadaEnPozo = db.pozos.some((x) => x.registro?.resolucion && Number(x.registro.resolucion.numero) === Number(numero) && x.registro.resolucion.anio === d.anio)
  if (resolucionUsada(db, numero, d.anio) || usadaEnPozo) throw error409(`La resolución ${numero}/${d.anio} ya está registrada.`)
  r.resolucion = { numero, anio: d.anio, fecha: d.fecha }
  actuar(db, e, usuario, 'RESOLUCION', 'REGISTRADO', obs(p), { resolucion: `${numero}/${d.anio}`, fecha: d.fecha })
  pasar(db, e, 'CIERRE_POZO', usuario, { dictamen: 'APROBADO', observaciones: obs(p) })
  return armarRegistro(db, e.id)
}

/** Pozos corrigió lo observado: vuelve a la oficina que observó. */
function reenviar(p: Peticion) {
  const { e } = exigirRegistro(p.db, p.ruta.id)
  exigirActuar(e, p.usuario, ['CORRECCION_POZOS'])
  const o = exigirTexto(obs(p) ?? '', 'Cuente qué se corrigió (queda en el historial).')
  actuar(p.db, e, p.usuario, 'CORRECCION', 'REGISTRADO', o)
  pasar(p.db, e, e.vuelveA ?? 'CATASTRO_POZO', p.usuario, { observaciones: o })
  e.vuelveA = null
  return armarRegistro(p.db, e.id)
}

/**
 * Cierre en Pozos: el expediente queda FINALIZADO, el pozo en el estado que fijó Catastro y,
 * si es de jurisdicción DRH, nace la concesión VIGENTE con el número, la resolución, los
 * titulares y el caudal tributario.
 */
function cierre(p: Peticion) {
  const { db, usuario } = p
  const { e, pozo, r } = exigirRegistro(db, p.ruta.id)
  exigirActuar(e, usuario, ['CIERRE_POZO'])
  const c = r.catastro!
  pozo.estado = c.estadoPozo
  if (r.jurisdiccionDrh && c.numeroConcesion && r.resolucion) {
    const caudales = calcularCaudales(pozo.caudalM3h, r.equipo.regimenM3h, c.uso)
    const concesion = {
      id: nuevoId(db),
      numero: c.numeroConcesion,
      estado: 'VIGENTE' as const,
      origen: 'SISTEMA' as const,
      expedienteId: e.id,
      anio: r.resolucion.anio,
      fechaOtorgamiento: r.resolucion.fecha,
      resolucion: r.resolucion,
      // Concesión de agua subterránea: sin polígono; los datos salen del registro del pozo.
      migrada: {
        titular: c.titulares.map((t) => t.nombre).join(' / ') || null,
        documento: c.titulares[0]?.documento ?? null,
        departamento: r.ubicacion.departamento,
        localidad: r.ubicacion.localidad,
        distrito: r.ubicacion.distrito,
        cuenca: r.ubicacion.cuencaSubterranea,
        caudalLps: caudales.tributarioLps,
        caracter: c.tipoConcesion,
        codigoServicio: codigoServicioDe(c.uso),
        usos: c.uso,
        fuente: `Pozo ${pozo.idInterno}`,
        sistema: null,
        canalPrincipal: null,
        geom: null,
        superficieHa: caudales.equivalenteHa,
      },
    }
    db.concesiones.push(concesion)
    pozo.concesionId = concesion.id
  }
  actuar(db, e, usuario, 'CIERRE', 'REGISTRADO', obs(p), pozo.concesionId ? { numero: c.numeroConcesion } : null)
  terminar(e, 'FINALIZADO')
  return armarRegistro(db, e.id)
}

export const rutasRegistroPozo: Ruta[] = [
  ['GET', `${BASE}/:id`, ({ db, ruta }) => armarRegistro(db, ruta.id)],
  ['PUT', `${BASE}/:id/catastro`, guardarCatastro],
  ['POST', `${BASE}/:id/catastro`, dictamen('CATASTRO_POZO')],
  ['POST', `${BASE}/:id/distrito`, tomaConocimiento],
  ['POST', `${BASE}/:id/recaudacion`, recaudacion],
  ['POST', `${BASE}/:id/juridico`, dictamen('JURIDICO')],
  ['POST', `${BASE}/:id/resolucion`, resolucion],
  ['POST', `${BASE}/:id/reenviar`, reenviar],
  ['POST', `${BASE}/:id/cierre`, cierre],
]

/** Titular para las bandejas: el causante del registro. */
export const titularDeRegistroPozo = (db: Db, e: ExpedienteDemo) => db.pozos.find((p) => p.registro?.expedienteId === e.id)?.registro?.causante ?? null
