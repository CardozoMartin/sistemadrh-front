import { Link } from 'react-router'
import { ROUTES } from '@/config/routes'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import { MarcaOrigen } from '../../Padron/components/MarcaOrigen'
import { ESTADO_POZO, formatoNumero } from '../estilos'
import type { PozoBackend } from '../types'

function Dato({ etiqueta, valor, ancho }: { etiqueta: string; valor: string | number | null | undefined; ancho?: boolean }) {
  return (
    <div className={ancho ? 'sm:col-span-2' : undefined}>
      <dt className="text-xs font-semibold tracking-wide text-slate-400 uppercase">{etiqueta}</dt>
      <dd className="text-sm text-slate-800 dark:text-slate-100">{valor === null || valor === undefined || valor === '' ? '—' : valor}</dd>
    </div>
  )
}

/** Datos del pozo y de la concesión que abastece (CU paso 2: «datos del pozo y estado de la concesión»). */
export function FichaPozo({ pozo }: { pozo: PozoBackend }) {
  const c = pozo.concesion
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg font-bold text-slate-900 dark:text-white">{pozo.idInterno}</span>
        {pozo.alias && <span className="text-slate-500 dark:text-slate-400">· {pozo.alias}</span>}
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', ESTADO_POZO[pozo.estado].color)}>{ESTADO_POZO[pozo.estado].texto}</span>
      </div>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-4">
        <div>
          <dt className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Origen</dt>
          <dd className="mt-0.5">
            <MarcaOrigen origen={pozo.origen} />
          </dd>
        </div>
        <Dato etiqueta="Profundidad" valor={pozo.profundidadM !== null ? `${formatoNumero(pozo.profundidadM)} m` : null} />
        <Dato etiqueta="Caudal" valor={pozo.caudalLps !== null ? `${formatoNumero(pozo.caudalLps)} l/s (${formatoNumero(pozo.caudalM3h ?? 0)} m³/h)` : null} />
        <Dato etiqueta="Jurisdicción DRH" valor={pozo.jurisdiccionDrh ? 'Sí' : 'No'} />
        <Dato ancho etiqueta="Coordenadas POSGAR 07" valor={`X ${formatoNumero(pozo.coordX, 2)} · Y ${formatoNumero(pozo.coordY, 2)}`} />
        <Dato ancho etiqueta="Latitud / longitud" valor={`${pozo.latitud.toFixed(6)}, ${pozo.longitud.toFixed(6)}`} />
      </dl>
      <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
        <p className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">Concesión que abastece</p>
        {c ? (
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-4">
            <Dato etiqueta="Número" valor={c.numero} />
            <Dato etiqueta="Estado" valor={c.estado.charAt(0) + c.estado.slice(1).toLowerCase().replace('_', ' ')} />
            <Dato ancho etiqueta="Titular" valor={c.titular} />
            <Dato etiqueta="Departamento" valor={c.departamento} />
            <Dato etiqueta="Localidad" valor={c.localidad} />
            <div className="flex items-end sm:col-span-2">
              <Link to={`${ROUTES.visor}?concesion=${c.id}`} className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                <Icon name="map" className="text-[18px]!" /> Ver en el visor
              </Link>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">El pozo no está vinculado a ninguna concesión.</p>
        )}
      </div>
    </div>
  )
}
