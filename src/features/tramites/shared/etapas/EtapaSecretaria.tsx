import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Alert } from '@/components/feedback/States'
import { FormAdjuntosField, FormTextareaField, FormTextField } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Spinner } from '@/components/ui/Spinner'
import { formatearFecha } from '@/config/expedientes'
import { expedientesApi } from '@/features/expedientes/api'
import { useUsuarioDeOficina } from '@/features/expedientes/hooks'
import { useSolicitarNumero, useSolicitudesNumero } from '@/features/expedientes/solicitudesNumero'
import { useDominio } from '@/hooks/useDominio'
import { mensajeDeError } from '@/services/api/errors'
import type { Expediente } from '@/types/domain'
import { useConfigTramite } from './config'
import { EtapaLayout } from './EtapaLayout'
import { secretariaSchema, type SecretariaForm } from './schemas'
import { useAccionEtapa } from './useAccionEtapa'

/**
 * Pedido del número de concesión a Catastro (o de varios, uno por cada `etiqueta`, en
 * los trámites que crean concesiones nuevas). La respuesta llega en vivo (evento
 * numero_asignado) y refresca esta pantalla sola.
 */
function SolicitudNumeroConcesion({ expediente, etiquetas }: { expediente: Expediente; etiquetas?: string[] }) {
  const d = useDominio()
  const usuario = useUsuarioDeOficina(expediente.oficinaId)
  const solicitudes = useSolicitudesNumero({ expedienteId: expediente.id })
  const solicitar = useSolicitarNumero()
  const multiple = !!etiquetas?.length
  const ultima = solicitudes.data?.find((s) => !!s.etiquetas?.length === multiple)
  // Trámites sobre una concesión existente ya traen el número desde el inicio.
  const asignado = ultima?.estado === 'asignada' ? ultima.numeroConcesion : undefined
  const numero = multiple ? undefined : (expediente.numeroConcesion ?? asignado)
  const numeros = multiple && ultima?.estado === 'asignada' ? ultima.numerosConcesion : undefined
  // La oficina que asigna números es la que inicia el circuito (Catastro).
  const oficinaAsigna = d.nombreOficina(d.etapas[0]?.oficinaId ?? 'catastro')

  if (numeros?.length) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-500/30 dark:bg-green-500/10">
        <p className="flex items-center gap-2 text-sm text-green-800 dark:text-green-200">
          <Icon name="verified" filled className="text-green-600" /> Números de concesión asignados por {oficinaAsigna}:
        </p>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {etiquetas!.map((etiqueta, i) => (
            <li key={etiqueta} className="flex items-center justify-between rounded-md bg-white/70 px-3 py-2 text-sm dark:bg-slate-900/40">
              <span className="text-slate-600 dark:text-slate-300">{etiqueta}</span>
              <strong className="text-base text-slate-900 dark:text-white">N° {numeros[i] ?? '—'}</strong>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (numero) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-500/30 dark:bg-green-500/10">
        <Icon name="verified" filled className="text-green-600" />
        <p className="text-sm text-green-800 dark:text-green-200">
          {asignado ? `Número de concesión asignado por ${oficinaAsigna}: ` : 'Número de concesión: '}
          <strong className="text-base">{numero}</strong>
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
      <div className="flex items-start gap-3">
        <Icon name="notification_important" className="text-amber-600" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">{multiple ? 'Solicitar números de concesión' : 'Solicitar número de concesión'}</p>
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {multiple
              ? `Antes de cargar la resolución, ${oficinaAsigna} debe asignar un número de concesión para cada una de las ${etiquetas!.length} concesiones nuevas (${etiquetas!.join(', ')}).`
              : `Antes de cargar la resolución, ${oficinaAsigna} debe asignar el número de concesión del expediente.`}
          </p>
        </div>
        {ultima?.estado === 'pendiente' ? (
          <span className="flex items-center gap-2 text-xs font-semibold text-amber-700">
            <Spinner className="size-3.5" /> Esperando a {oficinaAsigna}…
          </span>
        ) : (
          <Button
            size="sm"
            iconLeft="send"
            loading={solicitar.isPending || solicitudes.isPending}
            onClick={() => usuario && solicitar.mutate({ expedienteId: expediente.id, oficinaId: expediente.oficinaId, usuarioId: usuario.id, etiquetas })}
          >
            {multiple ? `Pedir ${etiquetas!.length} números a ${oficinaAsigna}` : `Pedir a ${oficinaAsigna}`}
          </Button>
        )}
      </div>
      {ultima?.estado === 'pendiente' && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Solicitado el {formatearFecha(ultima.fecha)}. Se avisará aquí cuando esté asignado.
        </p>
      )}
      {solicitar.isError && <Alert>{mensajeDeError(solicitar.error)}</Alert>}
    </div>
  )
}

/** Secretaría General: registro de la resolución firmada. */
export function EtapaSecretaria({ expediente }: { expediente: Expediente }) {
  const d = useDominio()
  const config = useConfigTramite()
  const { paso, pedir, dialogos } = useAccionEtapa(expediente)
  const solicitudes = useSolicitudesNumero({ expedienteId: expediente.id })
  const form = useForm<SecretariaForm>({
    resolver: zodResolver(secretariaSchema),
    defaultValues: { numeroResolucion: '', fechaFirma: '', resolucion: [], observaciones: '' },
    mode: 'onTouched',
  })
  // Trámites que crean varias concesiones (subdivisión): un número por cada una.
  const etiquetas = config.concesionesNuevas?.(expediente)
  const multiple = !!etiquetas?.length
  const asignada = solicitudes.data?.find((s) => s.estado === 'asignada' && !!s.etiquetas?.length === multiple)
  const numeroConcesion = multiple ? null : (expediente.numeroConcesion ?? asignada?.numeroConcesion ?? null)
  const numerosNuevos = multiple ? (asignada?.numerosConcesion ?? null) : null
  const listo = multiple ? !!numerosNuevos?.length : !!numeroConcesion
  const destino = paso?.destino ? d.nombreOficina(paso.destino) : ''

  // Avisos por email (simulados) a las personas del trámite y al jefe de distrito.
  function notificarResolucion(numero: string) {
    const correos = config.personas(expediente).map((p) => p.correo).filter(Boolean)
    const jefeDistrito = d.usuarios.find((u) => u.oficinaId === 'distrito')
    return expedientesApi.enviarEmail({
      expedienteId: expediente.id,
      destinatarios: [
        ...(correos.length ? correos : ['titular sin correo registrado']),
        jefeDistrito ? `${jefeDistrito.nombre} (Jefe de Distrito)` : 'Jefe de Distrito',
      ],
      asunto: `Resolución ${numero} disponible — expediente ${expediente.numero}`,
      cuerpo: `La resolución ${numero} del expediente ${expediente.numero} ya está disponible.`,
    })
  }

  const onSubmit = form.handleSubmit((v) =>
    pedir({
      titulo: '¿Confirmar la resolución?',
      mensaje: `Se registrará la resolución ${v.numeroResolucion} y el expediente pasará a ${destino} para el cierre.`,
      confirmar: 'Sí, confirmar',
      exito: {
        titulo: 'Resolución cargada',
        mensaje: `Se notificó por email al titular y al jefe de distrito. El expediente pasó a ${destino} para su finalización.`,
      },
      revision: {
        resultado: 'aprobado',
        observaciones: v.observaciones || `Resolución ${v.numeroResolucion} del ${v.fechaFirma}.`,
        detalle: v,
        cambios: {
          resolucion: { numero: v.numeroResolucion, fecha: v.fechaFirma },
          ...(numeroConcesion ? { numeroConcesion } : {}),
          ...(numerosNuevos ? config.aplicarNumerosConcesion?.(expediente, numerosNuevos) : {}),
        },
      },
      despues: () => notificarResolucion(v.numeroResolucion),
    }),
  )

  return (
    <FormProvider {...form}>
      <EtapaLayout
        expediente={expediente}
        titulo="Registrar resolución"
        icono="edit_document"
        descripcion="Cargue la resolución firmada del trámite."
        accion={
          <Button
            size="sm"
            iconRight="check_circle"
            disabled={!listo}
            title={listo ? undefined : multiple ? 'Faltan los números de concesión' : 'Falta el número de concesión'}
            onClick={() => void onSubmit()}
          >
            Confirmar
          </Button>
        }
      >
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-6">
          <SolicitudNumeroConcesion expediente={expediente} etiquetas={etiquetas} />

          <div className="grid gap-6 md:grid-cols-2">
            <FormTextField
              name="numeroResolucion"
              label="Número de resolución"
              required
              icon="gavel"
              placeholder="Ej: RES-2026-001"
              hint="Código único asignado a la resolución firmada."
            />
            <FormTextField name="fechaFirma" label="Fecha de firma" required type="date" />
          </div>

          <FormAdjuntosField name="resolucion" label="Adjuntar resolución" extensiones={['.pdf']} maxMB={5} />

          <FormTextareaField
            name="observaciones"
            label="Observaciones (opcional)"
            rows={3}
            placeholder="Comentarios adicionales o detalles relevantes sobre el cierre del trámite…"
          />

          {!listo && (
            <Alert tone="info">
              Para confirmar, primero {d.nombreOficina(d.etapas[0]?.oficinaId ?? 'catastro')} tiene que asignar{' '}
              {multiple ? 'los números de concesión' : 'el número de concesión'}.
            </Alert>
          )}
        </form>
      </EtapaLayout>
      {dialogos}
    </FormProvider>
  )
}
