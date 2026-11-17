// Mecánica del expediente, común a todos los trámites (como backend/src/expedientes):
// crear, tomar, pasar a otra oficina, registrar lo que resolvió cada oficina, historial y bandejas.
// Mismas reglas: cada acción en su etapa, solo la oficina donde está y tomar antes de actuar.
import type { DisponibilidadExpediente, ExpedienteEnBandeja } from '@/features/tramites/AltaDeConcesion/backend.types'
import { ahora, nuevoId, type Db, type ExpedienteDemo, type OficinaDemo, type UsuarioDemo } from './db'
import { error400, error403, error404, error409, type Ruta } from './http'

export const NOMBRE_OFICINA: Record<OficinaDemo, string> = {
  catastro: 'Catastro',
  recaudacion: 'Recaudación',
  distrito: 'Distrito',
  juridico: 'Jurídico',
  secretaria_general: 'Secretaría General',
  pozos: 'Pozos',
}

export const NOMBRE_ETAPA: Record<string, string> = {
  CARGA: 'Carga de datos',
  CORRECCION: 'Corrección de observaciones',
  RECAUDACION: 'Verificación de deuda',
  DISTRITO: 'Informe técnico de Distrito',
  JURIDICO: 'Dictamen jurídico',
  SECRETARIA_GENERAL: 'Resolución',
  CIERRE: 'Verificación final',
  ESPERA_PADRON: 'Espera del padrón de Rentas',
  INICIO_POZOS: 'Mesa de entrada: documentación',
  ANTECEDENTES_POZOS: 'Verificación de antecedentes',
  EVALUACION_TECNICA_POZOS: 'Evaluación técnica',
  CORRECCION_POZOS: 'Corrección de observaciones',
  CLAUSURA_POZOS: 'Clausura física',
  CARGA_POZO: 'Alta del pozo',
  CATASTRO_POZO: 'Registro de la concesión',
  TOMA_CONOCIMIENTO_DISTRITO: 'Toma de conocimiento',
  CIERRE_POZO: 'Cierre del expediente',
}

/** Oficina que trabaja cada etapa. */
export const OFICINA_DE_ETAPA: Record<string, OficinaDemo> = {
  CARGA: 'catastro',
  CORRECCION: 'catastro',
  RECAUDACION: 'recaudacion',
  DISTRITO: 'distrito',
  JURIDICO: 'juridico',
  SECRETARIA_GENERAL: 'secretaria_general',
  CIERRE: 'catastro',
  ESPERA_PADRON: 'catastro',
  INICIO_POZOS: 'pozos',
  ANTECEDENTES_POZOS: 'pozos',
  EVALUACION_TECNICA_POZOS: 'pozos',
  CORRECCION_POZOS: 'pozos',
  CLAUSURA_POZOS: 'pozos',
  CARGA_POZO: 'pozos',
  CATASTRO_POZO: 'catastro',
  TOMA_CONOCIMIENTO_DISTRITO: 'distrito',
  CIERRE_POZO: 'pozos',
}

export const nombreUsuario = (u: Pick<UsuarioDemo, 'apellido' | 'nombre'>) => `${u.apellido}, ${u.nombre}`
export const formatearNumero = (e: Pick<ExpedienteDemo, 'numero' | 'reparticion' | 'anio' | 'etiqueta'>) => e.etiqueta ?? `${Number(e.numero)}/${Number(e.reparticion)}-${e.anio}`
const TERMINADOS = ['FINALIZADO', 'RECHAZADO', 'ANULADO', 'ARCHIVADO']

export function usuarioDe(db: Db, id: string | null): UsuarioDemo | undefined {
  return id === null ? undefined : db.usuarios.find((u) => u.id === id)
}

export function exigirExpediente(db: Db, id: string, tipo?: ExpedienteDemo['tipoTramite']): ExpedienteDemo {
  const e = db.expedientes.find((x) => x.id === id && (!tipo || x.tipoTramite === tipo))
  if (!e) throw error404('No se encontró el expediente.')
  return e
}

/** Carátula nueva: el número es único y el expediente queda tomado por quien lo registra. */
export function crearExpediente(
  db: Db,
  datos: { numero: string; reparticion: string; anio: number; tipoTramite: ExpedienteDemo['tipoTramite']; etapa: string; etiqueta?: string },
  usuario: UsuarioDemo,
): ExpedienteDemo {
  const repetido = db.expedientes.find((e) => Number(e.numero) === Number(datos.numero) && Number(e.reparticion) === Number(datos.reparticion) && e.anio === datos.anio)
  if (repetido) throw error409(`El expediente ${formatearNumero(repetido)} ya está registrado.`)
  const fecha = ahora()
  const e: ExpedienteDemo = {
    id: nuevoId(db),
    ...datos,
    estado: 'EN_TRAMITE',
    oficina: OFICINA_DE_ETAPA[datos.etapa],
    tomadoPor: usuario.id,
    tomadoEn: fecha,
    oficinaDesde: fecha,
    fechaIngreso: fecha.slice(0, 10),
    actualizado: fecha,
    vuelveA: null,
  }
  db.expedientes.push(e)
  return e
}

/**
 * Controla que el usuario pueda actuar: la etapa es una de las esperadas, es de la oficina
 * donde está el expediente (o administrador) y lo tiene tomado.
 */
export function exigirActuar(e: ExpedienteDemo, usuario: UsuarioDemo, etapas: string[]): void {
  if (TERMINADOS.includes(e.estado)) throw error409('El trámite ya terminó: no admite más acciones.')
  if (!etapas.includes(e.etapa)) throw error409(`El expediente está en «${NOMBRE_ETAPA[e.etapa] ?? e.etapa}»: esta acción no corresponde a esa etapa.`)
  if (!usuario.esAdministrador && usuario.oficina !== e.oficina) {
    throw error403(`El expediente está en ${NOMBRE_OFICINA[e.oficina]}: solo esa oficina puede actuar.`)
  }
  if (!usuario.esAdministrador && e.tomadoPor !== usuario.id) throw error409('Primero tome el expediente: así queda registrado quién lo trabaja.')
}

/** Tomar: queda registrado quién lo recibió y cuándo (en el último pase). */
export function tomar(db: Db, e: ExpedienteDemo, usuario: UsuarioDemo): void {
  if (TERMINADOS.includes(e.estado)) throw error409('El trámite ya terminó.')
  if (!usuario.esAdministrador && usuario.oficina !== e.oficina) throw error403(`El expediente está en ${NOMBRE_OFICINA[e.oficina]}: solo esa oficina puede tomarlo.`)
  if (e.tomadoPor && e.tomadoPor !== usuario.id) {
    throw error409(`Lo tiene ${nombreUsuario(usuarioDe(db, e.tomadoPor) ?? { apellido: 'otra', nombre: 'persona' })}.`)
  }
  const fecha = ahora()
  e.tomadoPor = usuario.id
  e.tomadoEn = fecha
  e.actualizado = fecha
  const pase = [...db.historial].reverse().find((h) => h.expedienteId === e.id && h.tipo === 'PASE')
  if (pase && pase.tipo === 'PASE' && !pase.recibidoPor) {
    pase.recibidoPor = nombreUsuario(usuario)
    pase.recibidoEn = fecha
  }
}

/** Pase a la etapa siguiente. Si cambia de oficina, llega sin tomar. */
export function pasar(
  db: Db,
  e: ExpedienteDemo,
  etapa: string,
  usuario: UsuarioDemo,
  opciones: { dictamen?: string; esDevolucion?: boolean; observaciones?: string | null; estado?: ExpedienteDemo['estado'] } = {},
): void {
  const destino = OFICINA_DE_ETAPA[etapa]
  const fecha = ahora()
  if (destino !== e.oficina) {
    db.historial.push({
      expedienteId: e.id,
      tipo: 'PASE',
      fecha,
      oficinaOrigen: NOMBRE_OFICINA[e.oficina],
      oficinaDestino: NOMBRE_OFICINA[destino],
      etapa: NOMBRE_ETAPA[etapa] ?? etapa,
      enviadoPor: nombreUsuario(usuario),
      recibidoPor: null,
      recibidoEn: null,
      dictamen: opciones.dictamen ?? 'SIN_DICTAMEN',
      esDevolucion: !!opciones.esDevolucion,
      observaciones: opciones.observaciones ?? null,
    })
    e.oficina = destino
    e.tomadoPor = null
    e.tomadoEn = null
    e.oficinaDesde = fecha
  }
  e.etapa = etapa
  e.estado = opciones.estado ?? 'EN_TRAMITE'
  e.actualizado = fecha
}

/** Lo que resolvió la oficina (apto, con deuda, resolución, padrón…). */
export function actuar(
  db: Db,
  e: ExpedienteDemo,
  usuario: UsuarioDemo,
  actuacion: string,
  resultado: string,
  observaciones?: string | null,
  datos: Record<string, unknown> | null = null,
  oficina: OficinaDemo = e.oficina,
): void {
  db.historial.push({
    expedienteId: e.id,
    tipo: 'ACTUACION',
    fecha: ahora(),
    oficina: NOMBRE_OFICINA[oficina],
    etapa: NOMBRE_ETAPA[e.etapa] ?? e.etapa,
    actuacion,
    resultado,
    usuario: nombreUsuario(usuario),
    observaciones: observaciones ?? null,
    datos,
  })
  e.actualizado = ahora()
}

/** Termina el trámite (finalizado o rechazado): nadie lo tiene tomado. */
export function terminar(e: ExpedienteDemo, estado: 'FINALIZADO' | 'RECHAZADO'): void {
  e.estado = estado
  e.tomadoPor = null
  e.tomadoEn = null
  e.actualizado = ahora()
}

export function circuitoDe(db: Db, e: ExpedienteDemo) {
  const tomadoPor = usuarioDe(db, e.tomadoPor)
  return {
    estado: e.estado,
    etapa: e.etapa,
    etapaNombre: NOMBRE_ETAPA[e.etapa] ?? e.etapa,
    oficinaActual: e.oficina,
    oficinaNombre: NOMBRE_OFICINA[e.oficina],
    tomadoPor: tomadoPor ? { id: tomadoPor.id, nombre: nombreUsuario(tomadoPor) } : null,
    tomadoEn: e.tomadoEn,
  }
}

/** Titular que se muestra en las bandejas (lo define cada trámite). */
export type TitularDeExpediente = (db: Db, e: ExpedienteDemo) => string | null

const NOMBRE_TIPO_TRAMITE: Record<ExpedienteDemo['tipoTramite'], string> = {
  ALTA_CONCESION: 'Alta de concesión',
  BAJA_POZO: 'Baja de pozo',
  REGISTRO_POZO: 'Registro de pozo',
}

export function rutasExpedientes(titularDe: TitularDeExpediente): Ruta[] {
  return [
    [
      'GET',
      '/expedientes/disponibilidad',
      ({ db, query }): DisponibilidadExpediente => {
        // Mismas reglas que el backend (NumeroExpedienteQuery y ExpedientesService.disponibilidad).
        if (!/^\d{1,6}$/.test(query.numero ?? '')) throw error400('Ingrese el número de expediente (hasta 6 dígitos).')
        if (!/^\d{1,4}$/.test(query.reparticion ?? '')) throw error400('Ingrese la repartición (hasta 4 dígitos).')
        const anio = Number(query.anio)
        if (!Number.isInteger(anio)) throw error400('Ingrese el año del expediente.')
        const numero = String(Number(query.numero))
        const reparticion = String(Number(query.reparticion))
        const e = db.expedientes.find((x) => Number(x.numero) === Number(numero) && Number(x.reparticion) === Number(reparticion) && x.anio === anio)
        return {
          numero: `${numero}/${reparticion}-${anio}`,
          disponible: !e,
          expediente: e
            ? {
                id: e.id,
                tipoTramite: e.tipoTramite,
                tipoTramiteNombre: NOMBRE_TIPO_TRAMITE[e.tipoTramite],
                estado: e.estado,
                etapaNombre: NOMBRE_ETAPA[e.etapa] ?? e.etapa,
                oficinaNombre: NOMBRE_OFICINA[e.oficina],
                fechaIngreso: e.fechaIngreso,
              }
            : null,
        }
      },
    ],
    [
      'POST',
      '/expedientes/:id/tomar',
      ({ db, ruta, usuario }) => {
        const e = exigirExpediente(db, ruta.id)
        tomar(db, e, usuario)
        return { id: e.id, tomadoPor: nombreUsuario(usuario), tomadoEn: e.tomadoEn }
      },
    ],
    [
      'GET',
      '/expedientes/:id/historial',
      ({ db, ruta }) => {
        exigirExpediente(db, ruta.id)
        return db.historial.filter((h) => h.expedienteId === ruta.id).map(({ expedienteId: _, ...h }) => h)
      },
    ],
    [
      'GET',
      '/expedientes/bandeja/:oficina',
      ({ db, ruta }): ExpedienteEnBandeja[] =>
        db.expedientes
          .filter((e) => e.oficina === ruta.oficina && !TERMINADOS.includes(e.estado))
          .sort((a, b) => b.oficinaDesde.localeCompare(a.oficinaDesde))
          .map((e) => ({
            id: e.id,
            numero: formatearNumero(e),
            tipoTramite: e.tipoTramite,
            estado: e.estado,
            etapa: e.etapa as ExpedienteEnBandeja['etapa'],
            etapaNombre: NOMBRE_ETAPA[e.etapa] ?? e.etapa,
            titular: titularDe(db, e),
            tomadoPor: e.tomadoPor ? nombreUsuario(usuarioDe(db, e.tomadoPor)!) : null,
            enLaOficinaDesde: e.oficinaDesde,
          })),
    ],
    ['GET', '/usuarios', ({ db }) => db.usuarios],
  ]
}
