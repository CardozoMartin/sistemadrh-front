import { lazy, Suspense, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Spinner } from '@/components/ui/Spinner'
import { formatearFecha } from '@/config/expedientes'
import { ROUTES } from '@/config/routes'
import { personaDeTitular } from '@/features/tramites/shared/etapas/config'
import { useDominio } from '@/hooks/useDominio'
import { datosConcesion, titularesDe, type Concesion } from '../datos'

// El mapa (Leaflet) se carga recién cuando se muestra una ficha.
const PolygonPreviewMap = lazy(() => import('@/components/map/PolygonPreviewMap').then((m) => ({ default: m.PolygonPreviewMap })))

function Dato({ label, children, ancho }: { label: string; children: ReactNode; ancho?: boolean }) {
  return (
    <div className={ancho ? 'col-span-2' : undefined}>
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-900 dark:text-white">{children}</p>
    </div>
  )
}

/** Ficha de solo lectura de una concesión vigente (titulares, ubicación, catastro, polígono). */
export function FichaConcesion({ concesion, mapa = true, enlaceHistorial = true }: { concesion: Concesion; mapa?: boolean; enlaceHistorial?: boolean }) {
  const d = useDominio()
  const datos = datosConcesion(concesion)
  const titulares = titularesDe(concesion).map((t, i) => personaDeTitular(t, String(i), 'Titular'))
  const anteriores = datos?.titularesAnteriores?.length ?? 0

  return (
    <div className={mapa && concesion.poligono ? 'grid gap-5 lg:grid-cols-2' : undefined}>
      <div className="grid grid-cols-2 content-start gap-4">
        <Dato label="N° de concesión">{concesion.numeroConcesion}</Dato>
        <Dato label={datos?.origen ? 'Expediente de subdivisión' : 'Expediente de alta'}>{concesion.numero}</Dato>
        <Dato
          label={
            concesion.bajaConcesion
              ? 'Último titular (concesión anulada)'
              : concesion.subdivisionConcesion
                ? 'Último titular (concesión subdividida)'
                : titulares.length > 1
                  ? 'Titulares actuales'
                  : 'Titular actual'
          }
          ancho
        >
          {titulares.length
            ? titulares.map((t) => (
                <span key={t.clave} className="block">
                  {t.nombre} <span className="font-normal text-slate-500 dark:text-slate-400">· {t.documento}</span>
                </span>
              ))
            : concesion.titular}
        </Dato>
        <Dato label="Ubicación" ancho>
          {concesion.ubicacion.localidad}, {concesion.ubicacion.departamento} · Distrito {concesion.ubicacion.distrito}
        </Dato>
        <Dato label="Superficie">{concesion.poligono ? `${concesion.poligono.hectareas.toFixed(2)} ha` : '—'}</Dato>
        <Dato label="Caudal">{concesion.caudalAsignado != null ? `${concesion.caudalAsignado} l/s` : '—'}</Dato>
        <Dato label="Uso principal">{concesion.usoId ? (d.uso(concesion.usoId)?.nombre ?? concesion.usoId) : '—'}</Dato>
        <Dato label="Resolución">{concesion.resolucion ? `${concesion.resolucion.numero} (${formatearFecha(concesion.resolucion.fecha)})` : '—'}</Dato>
        <Dato label="Padrón">{datos?.catastral.padron || '—'}</Dato>
        <Dato label="Matrícula">{datos?.catastral.matricula || '—'}</Dato>
        {anteriores > 0 && (
          <Dato label="Cambios de titularidad" ancho>
            {anteriores} anterior{anteriores === 1 ? '' : 'es'}
          </Dato>
        )}
        {enlaceHistorial && (
          <div className="col-span-2">
            <Link to={ROUTES.concesion(concesion.id)} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              Ver historial completo de la concesión
            </Link>
          </div>
        )}
      </div>
      {mapa && concesion.poligono && (
        <Suspense fallback={<div className="flex h-60 items-center justify-center"><Spinner className="size-5 text-primary" /></div>}>
          <PolygonPreviewMap coordenadas={concesion.poligono.coordenadas} etiqueta={`Concesión ${concesion.numeroConcesion}`} className="h-60" />
        </Suspense>
      )}
    </div>
  )
}
