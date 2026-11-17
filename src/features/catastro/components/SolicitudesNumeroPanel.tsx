import { useState } from 'react'
import { Alert } from '@/components/feedback/States'
import { Input } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Spinner } from '@/components/ui/Spinner'
import { formatearFecha } from '@/config/expedientes'
import {
  useAsignarNumero,
  useProximoNumeroConcesion,
  useSolicitudesNumero,
  type SolicitudConExpediente,
} from '@/features/expedientes/solicitudesNumero'
import { useDominio } from '@/hooks/useDominio'
import { mensajeDeError } from '@/services/api/errors'

/** Cuántos números pide la solicitud (varios en una subdivisión: uno por fracción). */
const cantidadDe = (s: SolicitudConExpediente) => s.etiquetas?.length || 1

function FilaSolicitud({ solicitud, sugerido }: { solicitud: SolicitudConExpediente; sugerido: number }) {
  const d = useDominio()
  const asignar = useAsignarNumero()
  const etiquetas = solicitud.etiquetas?.length ? solicitud.etiquetas : null
  const [numeros, setNumeros] = useState(() => Array.from({ length: cantidadDe(solicitud) }, (_, i) => String(sugerido + i)))
  const completos = numeros.every(Boolean)

  const editar = (i: number, valor: string) => setNumeros((ns) => ns.map((n, k) => (k === i ? valor.replace(/\D/g, '') : n)))

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Expediente {solicitud.expediente?.numero ?? solicitud.expedienteId} · {solicitud.expediente?.titular}
            {etiquetas && ` · ${d.nombreTramite(solicitud.expediente?.tramiteId ?? 'subdivision')}: ${etiquetas.length} concesiones nuevas`}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Pedido por {d.nombreOficina(solicitud.oficinaId)} ({d.usuario(solicitud.usuarioId)?.nombre}) el {formatearFecha(solicitud.fecha)}
          </p>
        </div>
        {!etiquetas && (
          <div className="flex items-center gap-2">
            <Input value={numeros[0]} onChange={(e) => editar(0, e.target.value)} aria-label="Número de concesión" className="w-32" inputMode="numeric" />
            <Button size="sm" iconLeft="check" loading={asignar.isPending} disabled={!completos} onClick={() => asignar.mutate({ solicitud, numeros })}>
              Asignar
            </Button>
          </div>
        )}
      </div>
      {etiquetas && (
        <div className="flex flex-wrap items-end gap-3">
          {etiquetas.map((etiqueta, i) => (
            <label key={etiqueta} className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              {etiqueta}
              <Input value={numeros[i]} onChange={(e) => editar(i, e.target.value)} aria-label={`Número de concesión de ${etiqueta}`} className="w-28" inputMode="numeric" />
            </label>
          ))}
          <Button size="sm" iconLeft="check" loading={asignar.isPending} disabled={!completos} onClick={() => asignar.mutate({ solicitud, numeros })}>
            Asignar {etiquetas.length} números
          </Button>
        </div>
      )}
      {asignar.isError && <Alert>{mensajeDeError(asignar.error)}</Alert>}
    </li>
  )
}

/**
 * Pedidos de número de concesión que hizo Secretaría General. Llegan en vivo y, al
 * asignar, Secretaría ve el número en su pantalla sin recargar.
 */
export function SolicitudesNumeroPanel() {
  const solicitudes = useSolicitudesNumero({ estado: 'pendiente' })
  const proximo = useProximoNumeroConcesion()
  const lista = solicitudes.data ?? []
  if (lista.length === 0) return null

  const base = Number(proximo.data ?? 1)
  return (
    <Card className="mb-6 border-amber-300 dark:border-amber-500/40">
      <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-5 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
        <Icon name="pin" className="text-amber-600" />
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
          {lista.length} pedido{lista.length === 1 ? '' : 's'} de número de concesión
        </p>
      </div>
      {proximo.isPending ? (
        // Las filas toman el número sugerido al montarse: se espera a conocer el próximo libre.
        <p className="flex items-center gap-2 px-5 py-4 text-sm text-slate-500">
          <Spinner className="size-4" /> Buscando el próximo número libre…
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 px-5 dark:divide-slate-700">
          {lista.map((s, i) => (
            // Números sugeridos correlativos, sin repetir entre pedidos.
            <FilaSolicitud key={s.id} solicitud={s} sugerido={base + lista.slice(0, i).reduce((n, x) => n + cantidadDe(x), 0)} />
          ))}
        </ul>
      )}
    </Card>
  )
}
