import type { ReactNode } from 'react'
import { Icon } from '@/components/ui/Icon'
import { ROUTES } from '@/config/routes'
import { ubicacionConcesion, nombres, numeroConcesion } from '../../../shared/formato'
import { ResolucionCargada } from '../../../shared/circuito/PanelResolucion'
import { reubicacionApi } from '../../api'
import type { ReubicacionBackend } from '../../backend.types'
import { ListaAvisos } from '../Avisos'
import { ComparacionPoligono, ComparacionServicio } from '../ComparacionReubicacion'

/** La concesión (que no se mueve), el motivo, los papeles y lo vigente contra lo propuesto. */
export function DatosReubicacion({ datos }: { datos: ReubicacionBackend }) {
  const { concesion, titulares, motivoTexto, documentacionPresentada, vigente, propuesta, avisos, resolucion } = datos.reubicacion
  const ubicacion = ubicacionConcesion(concesion.ubicacion)
  return (
    <div className="flex flex-col gap-5">
      <ResolucionCargada expedienteId={datos.expediente.id} resolucion={resolucion} descargar={reubicacionApi.archivoResolucion} />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 text-sm dark:bg-slate-900/40">
        <span>
          <span className="text-slate-500 dark:text-slate-400">Concesión {numeroConcesion(concesion)}: </span>
          <strong className="text-slate-900 dark:text-white">{ubicacion || 'ubicación no registrada'}</strong>
          {concesion.padron && <span className="text-slate-500 dark:text-slate-400"> · Padrón {concesion.padron}</span>}
        </span>
        <a href={ROUTES.visorConcesion(concesion.id)} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline">
          <Icon name="map" className="text-[18px]!" />
          Ver en el visor
        </a>
      </div>

      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Titulares (no cambian)</dt>
          <dd className="text-slate-900 dark:text-white">{nombres(titulares) || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Motivo de la reubicación</dt>
          <dd className="whitespace-pre-line text-slate-900 dark:text-white">{motivoTexto}</dd>
        </div>
      </dl>

      <Seccion titulo="Nuevo lugar al que llega el agua">
        {propuesta.poligono ? <ComparacionPoligono vigente={vigente.poligono} propuesto={propuesta.poligono} /> : <p className="text-sm text-slate-500">Todavía no se cargó.</p>}
      </Seccion>

      <Seccion titulo="Forma de servicio">
        <ComparacionServicio vigente={vigente} propuesto={propuesta.servicio} />
      </Seccion>

      <ListaAvisos titulo="Avisos de Catastro" avisos={avisos} />

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Documentación presentada en Catastro: {documentacionPresentada.map((d) => d.descripcion).join(' · ') || 'no registrada'}.
      </p>
    </div>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{titulo}</h3>
      {children}
    </section>
  )
}
