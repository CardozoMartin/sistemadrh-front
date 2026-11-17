import type { ReactNode } from 'react'
import { PolygonPreviewMap } from '@/components/map/PolygonPreviewMap'
import type { AltaBackend } from '../../backend.types'

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">{titulo}</h3>
      {children}
    </section>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500 dark:text-slate-400">{etiqueta}</dt>
      <dd className="text-sm font-medium text-slate-900 dark:text-white">{valor === null || valor === undefined || valor === '' ? '—' : valor}</dd>
    </div>
  )
}

const nombre = (t: AltaBackend['titulares'][number]) => (t.tipoPersona === 'JURIDICA' ? t.razonSocial : `${t.apellido}, ${t.nombre}`)
const documento = (t: AltaBackend['titulares'][number]) => (t.documento ? `${t.tipoDocumento} ${t.documento}` : 'Sin documento')

/** Lo que cargó Catastro, de solo lectura, para que cada oficina revise el expediente. */
export function DatosAlta({ alta }: { alta: AltaBackend }) {
  const p = alta.ubicacion?.poligono
  const vertices = (p?.geojson.coordinates[0]?.[0] ?? []).map(([lng, lat]) => [lat, lng] as [number, number])

  return (
    <div className="flex flex-col gap-6">
      <Bloque titulo={alta.titulares.length > 1 ? `Titulares (${alta.titulares.length})` : 'Titular'}>
        <ul className="flex flex-col gap-1">
          {alta.titulares.map((t) => (
            <li key={t.personaId} className="text-sm">
              <strong className="text-slate-900 dark:text-white">{nombre(t)}</strong>
              <span className="text-slate-500 dark:text-slate-400"> · {documento(t)}</span>
            </li>
          ))}
          {!alta.titulares.length && <li className="text-sm text-slate-400">Sin cargar</li>}
        </ul>
      </Bloque>

      <Bloque titulo="Ubicación">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Dato etiqueta="Departamento" valor={alta.ubicacion?.departamento} />
          <Dato etiqueta="Localidad" valor={alta.ubicacion?.localidad} />
          <Dato etiqueta="Distrito" valor={alta.ubicacion?.distrito} />
          <Dato etiqueta="Superficie (PostGIS)" valor={p ? `${p.superficieHa.toLocaleString('es-AR', { maximumFractionDigits: 2 })} ha` : null} />
        </dl>
        {alta.ubicacion?.superposiciones.length ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            Se superpone con:{' '}
            {alta.ubicacion.superposiciones.map((s) => `${s.numero ? `concesión ${s.numero}` : `exp. ${s.expediente}`} (${s.superficieHa.toLocaleString('es-AR')} ha)`).join(', ')}
          </p>
        ) : null}
        {vertices.length >= 3 && <PolygonPreviewMap coordenadas={vertices} etiqueta={alta.numeroExpediente} className="h-64" />}
      </Bloque>

      <Bloque titulo="Inmueble">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Dato etiqueta="Matrícula catastral" valor={alta.inmueble?.catastral.matricula} />
          <Dato etiqueta="Parcela" valor={alta.inmueble?.catastral.parcela} />
          <Dato etiqueta="Circunscripción / Sección" valor={[alta.inmueble?.catastral.circunscripcion, alta.inmueble?.catastral.seccion].filter(Boolean).join(' / ')} />
          <Dato etiqueta="Padrón" valor={alta.inmueble?.catastral.padron} />
        </dl>
      </Bloque>

      <Bloque titulo="Usos y suministro">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Dato etiqueta="Usos" valor={alta.usos?.items.map((i) => `${i.nombre} (${i.magnitud} ${i.unidad})`).join(', ')} />
          <Dato etiqueta="Carácter" valor={alta.usos?.caracter} />
          <Dato etiqueta="Caudal asignado" valor={alta.concesion.caudalAsignado !== null ? `${alta.concesion.caudalAsignado} l/s` : null} />
          <Dato etiqueta="Fuente" valor={alta.suministro ? [alta.suministro.fuentes[0], alta.suministro.sistemaDistribucion, alta.suministro.canalPrincipal].filter(Boolean).join(' → ') : null} />
        </dl>
      </Bloque>
    </div>
  )
}
