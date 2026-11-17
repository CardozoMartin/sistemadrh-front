import type { ComponentType } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { RUTA_BANDEJA, ROUTES } from '@/config/routes'
import { RUTA_GESTION } from '@/config/tramites'
import { etapaActual, faltaTomar } from '@/features/expedientes/circuito'
import { CircuitoProgreso } from '@/features/expedientes/components/CircuitoProgreso'
import { HistorialExpediente } from '@/features/expedientes/components/HistorialExpediente'
import { useExpediente } from '@/features/expedientes/hooks'
import { useDominio } from '@/hooks/useDominio'
import { esNoEncontrado } from '@/services/api/errors'
import type { Expediente, TipoTramite } from '@/types/domain'
import { ConfigTramiteContext, type ConfigTramite } from './config'
import { EtapaDistrito } from './EtapaDistrito'
import { EtapaJuridico } from './EtapaJuridico'
import { EtapaRecaudacion } from './EtapaRecaudacion'
import { EtapaSecretaria } from './EtapaSecretaria'
import { TomarExpediente } from './TomarExpediente'

export type PantallaEtapa = ComponentType<{ expediente: Expediente }>

/**
 * Pantalla de cada etapa del circuito (por id de /etapas) que comparten todos los
 * trámites. El orden del circuito viene de la API; el cierre lo pone cada trámite.
 */
export const PANTALLAS_CIRCUITO: Record<string, PantallaEtapa> = {
  verificacion_deuda: EtapaRecaudacion,
  inspeccion_tecnica: EtapaDistrito,
  dictamen_juridico: EtapaJuridico,
  resolucion: EtapaSecretaria,
}

interface GestionExpedienteProps {
  tramiteId: TipoTramite
  /** Título mientras carga (ej: "Expediente de alta de concesión"). */
  titulo: string
  config: ConfigTramite
  /** Pantalla del cierre en Catastro (etapa `cierre`), propia de cada trámite. */
  cierre: PantallaEtapa
  /** Para reemplazar alguna pantalla compartida (por id de etapa). */
  pantallas?: Record<string, PantallaEtapa>
}

/** Abre el expediente en la etapa donde está y muestra la pantalla de esa oficina. */
export function GestionExpediente({ tramiteId, titulo, config, cierre, pantallas }: GestionExpedienteProps) {
  const navigate = useNavigate()
  const { expedienteId } = useParams()
  const dominio = useDominio()
  const query = useExpediente(expedienteId)

  if (query.isPending) {
    return (
      <>
        <PageHeader title={titulo} />
        <LoadingState mensaje="Cargando expediente…" />
      </>
    )
  }

  if (query.isError) {
    return (
      <>
        <PageHeader title={titulo} />
        {esNoEncontrado(query.error) ? (
          <EmptyState icon="search_off" titulo="No se encontró el expediente">
            <Button size="sm" onClick={() => navigate(ROUTES.catastro.pendientes)}>
              Ir a seguimiento
            </Button>
          </EmptyState>
        ) : (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} reintentando={query.isFetching} />
        )}
      </>
    )
  }

  const expediente = query.data

  // El expediente es de otro trámite: se abre con la pantalla que le corresponde.
  if (expediente.tramiteId !== tramiteId) {
    const ruta = RUTA_GESTION[expediente.tramiteId]
    if (ruta) return <Navigate to={ruta(expediente.id)} replace />
  }

  const etapa = etapaActual(expediente, dominio)
  const pendiente = dominio.estadosPendientes.includes(expediente.estadoId)
  const porEtapa: Record<string, PantallaEtapa> = { ...PANTALLAS_CIRCUITO, cierre, ...pantallas }
  const Pantalla = etapa && expediente.tramiteId === tramiteId ? porEtapa[etapa.id] : undefined

  // Finalizado, anulado o una etapa sin pantalla: vista de solo lectura.
  if (!pendiente || !Pantalla) {
    return (
      <>
        <PageHeader
          title={`Expediente ${expediente.numero}`}
          description={`${dominio.nombreTramite(expediente.tramiteId)} · ${expediente.titular}`}
        />
        <div className="flex flex-col gap-6">
          <CircuitoProgreso expediente={expediente} />
          <Card className="p-6">
            <p className="mb-4 font-semibold">
              {pendiente
                ? `La etapa «${etapa?.nombre ?? '—'}» no tiene una pantalla de revisión.`
                : `El expediente está ${dominio.estado(expediente.estadoId)?.nombre.toLowerCase() ?? 'cerrado'}.`}
              {expediente.numeroConcesion && ` Concesión N° ${expediente.numeroConcesion}.`}
              {expediente.padronRentasPendiente && ' Pendiente de carga en el padrón de Rentas.'}
            </p>
            <HistorialExpediente expediente={expediente} />
            <Button className="mt-4" size="sm" variant="secondary" iconLeft="arrow_back" onClick={() => navigate(RUTA_BANDEJA[expediente.oficinaId])}>
              Volver a la bandeja
            </Button>
          </Card>
        </div>
      </>
    )
  }

  // Antes de revisar, la oficina tiene que tomar el expediente (queda en el historial).
  // key: al cambiar de etapa (o de expediente) se arma un formulario nuevo.
  return (
    <ConfigTramiteContext value={config}>
      {faltaTomar(expediente, dominio) ? (
        <TomarExpediente expediente={expediente} />
      ) : (
        <Pantalla key={`${expediente.id}-${etapa!.id}`} expediente={expediente} />
      )}
    </ConfigTramiteContext>
  )
}
