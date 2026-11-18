import { useEffect, useState } from 'react'
import { Alert, LoadingState } from '@/components/feedback/States'
import { controlClass } from '@/components/form/styles'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Icon } from '@/components/ui/Icon'
import { mensajeDeError } from '@/services/api/errors'
import type { AltaBackend } from '../../backend.types'
import { useBorradorAvisoDeuda, useEmails, useNotificarDeuda } from '../../hooks'

type Texto = { asunto: string; cuerpo: string }

const fecha = (iso: string) => new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })

/**
 * Aviso de deuda por correo (expediente en espera en Recaudación). El sistema arma el correo de
 * cada titular con deuda con el texto base de la DRH (backend: tramites/circuito/aviso-deuda.ts) y
 * Recaudación lo puede editar antes de enviarlo (agregar dónde pagar, horarios, un plazo…).
 * Lo que se envía queda registrado tal cual en el expediente.
 */
export function AvisoDeudaEditable({ alta }: { alta: AltaBackend }) {
  const [abierto, setAbierto] = useState(false)
  const emails = useEmails(alta.id)
  const borrador = useBorradorAvisoDeuda(alta.id, abierto)
  const notificar = useNotificarDeuda(alta.id)
  const [textos, setTextos] = useState<Record<string, Texto>>({})
  const [confirmar, setConfirmar] = useState(false)
  const avisos = (emails.data ?? []).filter((e) => e.tipo === 'AVISO_DEUDA')
  const correos = borrador.data?.correos ?? []
  const conEmail = correos.filter((c) => c.email)

  // Al abrir, cada correo arranca con el texto base.
  useEffect(() => {
    if (borrador.data) setTextos(Object.fromEntries(borrador.data.correos.map((c) => [c.personaId, { asunto: c.asunto, cuerpo: c.cuerpo }])))
  }, [borrador.data])

  const editar = (personaId: string, campo: keyof Texto, valor: string) => setTextos((t) => ({ ...t, [personaId]: { ...t[personaId], [campo]: valor } }))
  const incompleto = conEmail.some((c) => (textos[c.personaId]?.asunto.trim().length ?? 0) < 3 || (textos[c.personaId]?.cuerpo.trim().length ?? 0) < 20)

  function enviar() {
    setConfirmar(false)
    notificar.mutate(
      { textos: conEmail.map((c) => ({ personaId: c.personaId, asunto: textos[c.personaId].asunto.trim(), cuerpo: textos[c.personaId].cuerpo.trim() })) },
      { onSuccess: () => setAbierto(false) },
    )
  }

  const resultado = notificar.data

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Icon name="mail" className="mt-0.5 text-primary" />
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Aviso de deuda al titular</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Un correo a cada titular con deuda, al email que tiene cargado. Revise el texto y agregue lo que haga falta antes de enviarlo.
            </p>
            {avisos[0] && (
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                Último aviso: {fecha(avisos[0].fecha)} a {avisos[0].para.join(', ')}
                {avisos[0].estado !== 'ENVIADO' && ' (no salió)'} · {avisos.length} en total
              </p>
            )}
          </div>
        </div>
        {!abierto && (
          <Button size="sm" variant="secondary" iconLeft="edit" onClick={() => setAbierto(true)}>
            {avisos.length ? 'Redactar otro aviso' : 'Redactar aviso'}
          </Button>
        )}
      </div>

      {resultado && !abierto && (
        <Alert tone="info">
          {resultado.enviados.map((e) => (
            <span key={e.id} className="block">
              {e.estado === 'ENVIADO'
                ? `Enviado a ${e.titular} (${e.para.join(', ')}).`
                : e.estado === 'NO_ENVIADO_PRUEBA'
                  ? `Registrado para ${e.titular} (${e.para.join(', ')}), pero NO salió: el servidor de correo no está configurado.`
                  : `No se pudo enviar a ${e.titular}: ${e.error ?? 'error del servidor de correo'}.`}
            </span>
          ))}
          {resultado.sinCorreo.length > 0 && <span className="block">Sin email cargado: {resultado.sinCorreo.join(', ')}.</span>}
        </Alert>
      )}

      {abierto && (
        <>
          {borrador.isPending && <LoadingState mensaje="Armando el correo…" className="py-6" />}
          {borrador.isError && <Alert>{mensajeDeError(borrador.error)}</Alert>}
          {correos.map((c) => {
            const base = { asunto: c.asunto, cuerpo: c.cuerpo }
            const texto = textos[c.personaId] ?? base
            const cambiado = texto.asunto !== base.asunto || texto.cuerpo !== base.cuerpo
            return (
              <div key={c.personaId} className="flex flex-col gap-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/40">
                <p className="text-sm">
                  <span className="font-semibold text-slate-900 dark:text-white">Para: {c.titular}</span>{' '}
                  {c.email ? (
                    <span className="text-slate-600 dark:text-slate-300">&lt;{c.email}&gt;</span>
                  ) : (
                    <span className="text-amber-700 dark:text-amber-300">— sin email cargado: no se le puede avisar por correo</span>
                  )}
                </p>
                {c.email && (
                  <>
                    <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Asunto
                      <input value={texto.asunto} onChange={(e) => editar(c.personaId, 'asunto', e.target.value)} maxLength={200} className={controlClass({ className: 'py-2 font-normal' })} />
                    </label>
                    <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Texto del correo
                      <textarea
                        value={texto.cuerpo}
                        onChange={(e) => editar(c.personaId, 'cuerpo', e.target.value)}
                        rows={12}
                        maxLength={10000}
                        className={controlClass({ className: 'resize-y font-normal leading-relaxed' })}
                      />
                    </label>
                    {cambiado && (
                      <button
                        type="button"
                        onClick={() => setTextos((t) => ({ ...t, [c.personaId]: base }))}
                        className="self-start text-xs font-medium text-primary hover:underline"
                      >
                        Volver al texto original
                      </button>
                    )}
                  </>
                )}
              </div>
            )
          })}

          {notificar.error && <Alert>{mensajeDeError(notificar.error)}</Alert>}
          {borrador.data && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" iconLeft="send" loading={notificar.isPending} disabled={!conEmail.length || incompleto} onClick={() => setConfirmar(true)}>
                Enviar aviso
              </Button>
              <Button size="sm" variant="secondary" disabled={notificar.isPending} onClick={() => setAbierto(false)}>
                Cancelar
              </Button>
              {incompleto && <span className="self-center text-xs text-red-600 dark:text-red-400">Complete el asunto y el texto de cada correo.</span>}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmar}
        title="¿Enviar el aviso de deuda?"
        message={`Se envía el correo a ${conEmail.map((c) => `${c.titular} (${c.email})`).join(', ')}. Queda registrado en el expediente tal como está escrito.`}
        confirmLabel="Sí, enviar"
        cancelLabel="Volver"
        onConfirm={enviar}
        onCancel={() => setConfirmar(false)}
      />
    </div>
  )
}
