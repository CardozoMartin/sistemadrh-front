// Servidor de eventos en tiempo real (SSE) para la demo.
//
// json-server no emite eventos, así que este proceso vigila mock-server/db.json y, cuando
// un expediente aparece o cambia de oficina/estado, lo avisa a todos los navegadores
// conectados. Funciona sin importar desde qué pestaña o equipo se hizo el cambio.
//
//   GET http://localhost:3002/events   (el front lo usa vía el proxy /api/events)
//
// El backend real puede reemplazar esto por SSE o WebSocket emitiendo los mismos eventos.

import { createServer } from 'node:http'
import { existsSync, readFileSync, watch } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PORT = Number(process.env.EVENTS_PORT ?? 3002)
const DIR = dirname(fileURLToPath(import.meta.url))
const DB = join(DIR, 'db.json')

/** @type {Set<import('node:http').ServerResponse>} */
const clientes = new Set()
let previo = new Map() // expediente id → { oficinaId, estadoId }
let solicitudesPrevias = new Map() // solicitud id → estado
let secuencia = 0

function leerDb() {
  try {
    const db = JSON.parse(readFileSync(DB, 'utf8'))
    return { expedientes: db.expedientes ?? [], solicitudes: db.solicitudesNumero ?? [] }
  } catch {
    return null // archivo a medio escribir: se ignora esta lectura
  }
}

const resumen = (e) => ({ id: e.id, numero: e.numero, tramiteId: e.tramiteId, titular: e.titular, oficinaId: e.oficinaId, estadoId: e.estadoId })
const clave = (e) => ({ oficinaId: e.oficinaId, estadoId: e.estadoId })

function emitir(evento) {
  const data = JSON.stringify({ ...evento, fecha: new Date().toISOString() })
  secuencia += 1
  for (const res of clientes) res.write(`id: ${secuencia}\nevent: expediente\ndata: ${data}\n\n`)
  console.log(`→ ${evento.tipo.padEnd(16)} ${evento.expediente.numero} ${evento.oficinaOrigenId ?? ''} → ${evento.expediente.oficinaId} (${clientes.size} clientes)`)
}

function revisarCambios() {
  const db = leerDb()
  if (!db) return
  const { expedientes, solicitudes } = db
  const porId = new Map(expedientes.map((e) => [e.id, e]))

  for (const e of expedientes) {
    const antes = previo.get(e.id)
    if (!antes) emitir({ tipo: 'nuevo', expediente: resumen(e) })
    else if (antes.estadoId !== e.estadoId && e.estadoId === 'finalizado') emitir({ tipo: 'finalizado', expediente: resumen(e), oficinaOrigenId: antes.oficinaId })
    else if (antes.oficinaId !== e.oficinaId) emitir({ tipo: 'derivado', expediente: resumen(e), oficinaOrigenId: antes.oficinaId })
    else if (antes.estadoId !== e.estadoId && e.estadoId === 'observado') emitir({ tipo: 'observado', expediente: resumen(e) })
  }

  // Pedido de número de concesión (Secretaría → Catastro) y su asignación (Catastro → Secretaría)
  for (const s of solicitudes) {
    const antes = solicitudesPrevias.get(s.id)
    const exp = porId.get(s.expedienteId)
    if (!exp) continue
    if (!antes) emitir({ tipo: 'solicitud_numero', expediente: resumen(exp), oficinaOrigenId: s.oficinaId })
    else if (antes !== 'asignada' && s.estado === 'asignada') emitir({ tipo: 'numero_asignado', expediente: resumen(exp), numeroConcesion: s.numeroConcesion ?? s.numerosConcesion?.join(', ') })
  }

  previo = new Map(expedientes.map((e) => [e.id, clave(e)]))
  solicitudesPrevias = new Map(solicitudes.map((s) => [s.id, s.estado]))
}

// Estado inicial (sin emitir)
const inicial = existsSync(DB) ? leerDb() : null
previo = new Map((inicial?.expedientes ?? []).map((e) => [e.id, clave(e)]))
solicitudesPrevias = new Map((inicial?.solicitudes ?? []).map((s) => [s.id, s.estado]))

// Se vigila la carpeta (no el archivo): json-server reescribe db.json con un archivo
// temporal + rename, y un watch sobre el archivo se perdería.
let espera = null
watch(DIR, (_evento, archivo) => {
  if (archivo !== 'db.json') return
  clearTimeout(espera)
  espera = setTimeout(revisarCambios, 150)
})

createServer((req, res) => {
  if (!req.url?.startsWith('/events')) {
    res.writeHead(404).end()
    return
  }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  })
  res.write('retry: 3000\n\n') // el navegador reintenta cada 3 s si se corta
  clientes.add(res)
  const latido = setInterval(() => res.write(': ping\n\n'), 25000) // evita cortes por inactividad
  req.on('close', () => {
    clearInterval(latido)
    clientes.delete(res)
  })
}).listen(PORT, () => console.log(`Eventos en vivo (SSE) en http://localhost:${PORT}/events — vigilando mock-server/db.json`))
