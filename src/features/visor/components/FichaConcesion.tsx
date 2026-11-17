import { Icon } from '@/components/ui/Icon'
import { COLOR_POZO_A_REVISAR, colorEstado, colorPozo, formatoHa, formatoNumero, NOMBRE_OFICINA, nombreEstado, nombreEstadoPozo, SERVICIOS, tituloConcesion } from '../estilos'
import type { ConcesionGeo, PozoGeo } from '../types'

interface Props {
  concesion: ConcesionGeo
  /** Pozos que abastecen a la concesión. */
  pozos?: PozoGeo[]
  onCerrar: () => void
}

function Dato({ etiqueta, valor, ancho }: { etiqueta: string; valor: string | number | null | undefined; ancho?: boolean }) {
  return (
    <div className={ancho ? 'col-span-2' : undefined}>
      <dt className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{etiqueta}</dt>
      <dd className="text-sm text-slate-800 dark:text-slate-100">{valor === null || valor === undefined || valor === '' ? '—' : valor}</dd>
    </div>
  )
}

/** Descarga el polígono como GeoJSON (se abre en QGIS, geojson.io, Google Earth Pro…). */
function descargarGeoJSON(concesion: ConcesionGeo) {
  const p = concesion.properties
  const blob = new Blob([JSON.stringify(concesion, null, 2)], { type: 'application/geo+json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `concesion-${(p.numero ?? p.expediente ?? String(p.concesion_id)).replace(/\W+/g, '-')}.geojson`
  a.click()
  URL.revokeObjectURL(url)
}

/** Ficha flotante con los datos de la concesión seleccionada en el mapa. */
export function FichaConcesion({ concesion, pozos = [], onCerrar }: Props) {
  const p = concesion.properties
  const suministro = [p.fuente, p.sistema, p.canal_principal].filter(Boolean).join(' → ')
  return (
    <div className="w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-start gap-2 border-b border-slate-100 p-3 dark:border-slate-700">
        <span className="mt-1 size-3 shrink-0 rounded-sm" style={{ backgroundColor: colorEstado(p.estado) }} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900 dark:text-white">{tituloConcesion(p)}</p>
          <p className="text-xs text-slate-500">
            {nombreEstado(p.estado)}
            {p.estado === 'EN_TRAMITE' && p.oficina_actual && ` · en ${NOMBRE_OFICINA[p.oficina_actual] ?? p.oficina_actual}`}
            {p.origen === 'MIGRACION' && ' · padrón anterior'}
            {p.tipo_derecho === 'DERECHO_TRADICIONAL' && ' · derecho tradicional'}
          </p>
          {p.publicacion !== 'PUBLICADO' && (
            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300">
              <Icon name="visibility_off" className="text-[14px]!" />
              {p.publicacion === 'OBSERVADO' ? 'Observado: no se ve en el mapa público' : 'Solo interno: todavía no se publicó en Argenmap'}
            </p>
          )}
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700">
          <Icon name="close" className="text-[18px]!" />
        </button>
      </div>

      <dl className="grid max-h-[45vh] grid-cols-2 gap-x-4 gap-y-3 overflow-y-auto p-3">
        <Dato ancho etiqueta={p.cantidad_titulares && p.cantidad_titulares > 1 ? `Titulares (${p.cantidad_titulares})` : 'Titular'} valor={p.titular} />
        <Dato etiqueta="Documento" valor={p.documento} />
        <Dato etiqueta={p.expediente ? 'Expediente' : 'Año de otorgamiento'} valor={p.expediente ?? p.anio_otorgamiento} />
        <Dato etiqueta="Superficie (PostGIS)" valor={formatoHa(p.superficie_ha)} />
        <Dato etiqueta="Caudal" valor={p.caudal_lps !== null ? `${p.caudal_lps.toLocaleString('es-AR')} l/s` : null} />
        <Dato etiqueta="Usos" valor={p.usos} />
        <Dato etiqueta="Carácter" valor={p.caracter && p.caracter.charAt(0) + p.caracter.slice(1).toLowerCase()} />
        <Dato ancho etiqueta="Servicio" valor={p.codigo_servicio !== null ? `${p.codigo_servicio} · ${SERVICIOS[p.codigo_servicio] ?? ''}` : null} />
        <Dato ancho etiqueta="Suministro" valor={suministro} />
        <Dato etiqueta="Departamento" valor={p.departamento} />
        <Dato etiqueta="Localidad" valor={p.localidad} />
        <Dato etiqueta="Distrito" valor={p.distrito} />
        <Dato etiqueta="Cuenca" valor={p.cuenca} />
        <Dato etiqueta="Padrón" valor={p.padron} />
        <Dato etiqueta="Matrícula" valor={p.matricula_catastral} />
        {pozos.length > 0 && (
          <div className="col-span-2">
            <dt className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Pozos ({pozos.length})</dt>
            <dd>
              <ul className="mt-1 divide-y divide-slate-100 dark:divide-slate-700">
                {pozos.map(({ properties: z }) => (
                  <li key={z.pozo_id} className="flex items-start gap-2 py-1.5 text-sm">
                    <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorPozo(z.estado) }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-slate-800 dark:text-slate-100">
                        {z.alias ?? 'Pozo'} <span className="text-xs text-slate-400">· {z.id_interno}</span>
                      </p>
                      <p className="text-xs text-slate-500">
                        {[
                          nombreEstadoPozo(z.estado),
                          z.profundidad_m !== null && `${formatoNumero(z.profundidad_m)} m`,
                          z.caudal_lps !== null && `${formatoNumero(z.caudal_lps)} l/s`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      {z.dentro_de_concesion === false && (
                        <p className="text-xs font-medium" style={{ color: COLOR_POZO_A_REVISAR }}>
                          Cae fuera del polígono: revisar coordenadas
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
      </dl>

      <div className="flex justify-end border-t border-slate-100 p-2 dark:border-slate-700">
        <button
          type="button"
          onClick={() => descargarGeoJSON(concesion)}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
        >
          <Icon name="download" className="text-[16px]!" />
          Descargar GeoJSON
        </button>
      </div>
    </div>
  )
}
