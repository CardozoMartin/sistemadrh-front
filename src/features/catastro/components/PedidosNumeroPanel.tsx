import { useState } from 'react'
import { Link } from 'react-router'
import { Alert } from '@/components/feedback/States'
import { Input } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { ROUTES } from '@/config/routes'
import { useSesion } from '@/features/auth/context'
import { useNotificaciones } from '@/features/notificaciones/context'
import { mensajeDeError } from '@/services/api/errors'
import { useAsignarNumero, usePedidosNumeroPendientes, useUltimoNumeroConcesion, type PedidoNumero } from '../pedidosNumero'

const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })

function FilaPedido({ pedido, puedeAsignar }: { pedido: PedidoNumero; puedeAsignar: boolean }) {
  const asignar = useAsignarNumero()
  const { mostrarAviso } = useNotificaciones()
  const etiquetas = pedido.etiquetas.length ? pedido.etiquetas : null
  const [numeros, setNumeros] = useState(() => Array.from({ length: etiquetas?.length ?? 1 }, () => ''))
  const completos = numeros.every(Boolean)
  const editar = (i: number, valor: string) => setNumeros((ns) => ns.map((n, k) => (k === i ? valor.replace(/\D/g, '') : n)))
  const enviar = () =>
    asignar.mutate(
      { pedido, numeros },
      {
        onSuccess: (p) =>
          mostrarAviso({
            titulo: `Número de concesión ${p.numeros.join(', ')} asignado`,
            detalle: `Expediente ${pedido.expediente.numero}: Secretaría General ya puede cargar la resolución.`,
            icono: 'verified',
            tono: 'exito',
          }),
      },
    )
  // El alta se abre en su pantalla del circuito; los demás trámites, desde la búsqueda general.
  const esAlta = pedido.expediente.tipoTramite === 'ALTA_CONCESION'

  return (
    <li className="flex flex-col gap-3 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Expediente {pedido.expediente.numero}
            {pedido.expediente.titular && <span className="font-normal text-slate-600 dark:text-slate-300"> · {pedido.expediente.titular}</span>}
            {etiquetas && <span className="font-normal text-slate-600 dark:text-slate-300"> · {etiquetas.length} concesiones nuevas</span>}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Lo pidió <strong className="font-semibold text-slate-700 dark:text-slate-200">{pedido.solicitadoPor}</strong> (Secretaría General) el {fechaHora(pedido.solicitadoEn)}
          </p>
        </div>
        {esAlta && (
          <Link to={ROUTES.tramites.altaConcesion.circuito(pedido.expediente.id)} className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline">
            <Icon name="open_in_new" className="text-[16px]!" />
            Ver expediente
          </Link>
        )}
      </div>

      {puedeAsignar ? (
        <div className="flex flex-wrap items-end gap-3">
          {numeros.map((n, i) => (
            <label key={etiquetas?.[i] ?? i} className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              {etiquetas?.[i] ?? 'N° de concesión (del libro)'}
              <Input
                value={n}
                onChange={(e) => editar(i, e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && completos && !asignar.isPending && enviar()}
                aria-label={etiquetas ? `Número de concesión de ${etiquetas[i]}` : `Número de concesión del expediente ${pedido.expediente.numero}`}
                placeholder="Ej: 4521"
                className="w-36"
                inputMode="numeric"
              />
            </label>
          ))}
          <Button iconLeft="check" loading={asignar.isPending} disabled={!completos} onClick={enviar}>
            {etiquetas ? `Asignar ${etiquetas.length} números` : 'Asignar número'}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">Para cargar el número hace falta el permiso «Asignar N° de concesión».</p>
      )}
      {asignar.isError && <Alert>{mensajeDeError(asignar.error)}</Alert>}
    </li>
  )
}

/**
 * Bandeja de Catastro (backend real): los pedidos de número de concesión que hizo Secretaría
 * General. Catastro toma el número de su libro de concesiones y lo carga acá. Se consultan cada
 * 30 segundos; cuando llega uno nuevo, AvisoPedidosNumero lo avisa en toda la app.
 */
export function PedidosNumeroPanel() {
  const { puede } = useSesion()
  const pedidos = usePedidosNumeroPendientes()
  const ultimo = useUltimoNumeroConcesion()
  const lista = pedidos.data ?? []
  if (pedidos.isError) return <Alert>No se pudieron consultar los pedidos de número de concesión: {mensajeDeError(pedidos.error)}</Alert>
  if (lista.length === 0) return null

  return (
    <Card className="mb-6 overflow-hidden border-amber-300 dark:border-amber-500/40">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-5 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
        <p className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
          <Icon name="pin" className="text-amber-600" />
          Secretaría General necesita {lista.length === 1 ? 'el número de concesión de 1 expediente' : `el número de concesión de ${lista.length} expedientes`}
        </p>
        {ultimo.data?.ultimoNumero && (
          <p className="text-xs text-amber-800 dark:text-amber-200">
            Último número registrado en el sistema: <strong>{ultimo.data.ultimoNumero}</strong>
          </p>
        )}
      </div>
      <ul className="divide-y divide-slate-200 px-5 dark:divide-slate-700">
        {lista.map((p) => (
          <FilaPedido key={p.id} pedido={p} puedeAsignar={puede('NUMERO_ASIGNAR')} />
        ))}
      </ul>
    </Card>
  )
}
