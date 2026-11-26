import { useEffect, useState } from 'react'
import { Alert } from '@/components/feedback/States'
import { controlClass } from '@/components/form/styles'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { mensajeDeError } from '@/services/api/errors'
import type { HooksRecaudacion } from './PanelRecaudacion'

type Texto = { asunto: string; cuerpo: string }

/**
 * Aviso de deuda por correo: el sistema arma el texto de cada titular con deuda y Recaudación lo puede editar.
 * `bloqueado`: por qué todavía no se puede preparar (el botón queda deshabilitado con ese motivo).
 */
export function AvisoDeudaPanel({ expedienteId, hooks, bloqueado }: { expedienteId: string; hooks: HooksRecaudacion; bloqueado?: string }) {
  const [abierto, setAbierto] = useState(false)
  const borrador = hooks.useBorradorAviso(expedienteId, abierto)
  const notificar = hooks.useNotificar(expedienteId)
  const [textos, setTextos] = useState<Record<string, Texto>>({})
  const correos = borrador.data?.correos ?? []
  const conEmail = correos.filter((c) => c.email)

  useEffect(() => {
    if (borrador.data) setTextos(Object.fromEntries(borrador.data.correos.map((c) => [c.personaId, { asunto: c.asunto, cuerpo: c.cuerpo }])))
  }, [borrador.data])

  const editar = (personaId: string, campo: keyof Texto, valor: string) => setTextos((t) => ({ ...t, [personaId]: { ...t[personaId], [campo]: valor } }))
  const incompleto = conEmail.some((c) => (textos[c.personaId]?.asunto.trim().length ?? 0) < 3 || (textos[c.personaId]?.cuerpo.trim().length ?? 0) < 20)

  function enviar() {
    notificar.mutate(
      { textos: conEmail.map((c) => ({ personaId: c.personaId, asunto: textos[c.personaId].asunto.trim(), cuerpo: textos[c.personaId].cuerpo.trim() })) },
      { onSuccess: () => setAbierto(false) },
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Icon name="mail" className="mt-0.5 text-primary" />
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Aviso de deuda al titular</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Un correo a cada titular con deuda, al email que tiene cargado. Puede editar el texto antes de enviarlo.</p>
            {bloqueado && <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">{bloqueado}</p>}
          </div>
        </div>
        {!abierto && (
          <Button size="sm" variant="secondary" iconLeft="edit_note" disabled={!!bloqueado} onClick={() => setAbierto(true)}>
            Preparar aviso
          </Button>
        )}
      </div>

      {notificar.data && (
        <Alert tone="info">
          Enviado a {notificar.data.enviados.map((e) => `${e.titular} (${e.para.join(', ')})`).join(', ') || 'nadie'}.
          {notificar.data.sinCorreo.length > 0 && ` Sin correo cargado: ${notificar.data.sinCorreo.join(', ')}.`}
        </Alert>
      )}

      {abierto &&
        (borrador.isPending ? (
          <p className="text-sm text-slate-500">Armando el texto…</p>
        ) : borrador.isError ? (
          <Alert>{mensajeDeError(borrador.error)}</Alert>
        ) : (
          <>
            {correos.map((c) =>
              c.email ? (
                <div key={c.personaId} className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-900/40">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Para <strong>{c.titular}</strong> · {c.email}
                  </p>
                  <input value={textos[c.personaId]?.asunto ?? ''} onChange={(e) => editar(c.personaId, 'asunto', e.target.value)} className={controlClass({})} aria-label="Asunto" />
                  <textarea
                    value={textos[c.personaId]?.cuerpo ?? ''}
                    onChange={(e) => editar(c.personaId, 'cuerpo', e.target.value)}
                    rows={8}
                    className={controlClass({ className: 'resize-y' })}
                    aria-label="Texto del correo"
                  />
                </div>
              ) : (
                <p key={c.personaId} className="text-sm text-amber-700 dark:text-amber-300">
                  {c.titular} no tiene correo cargado: no se le puede avisar por este medio.
                </p>
              ),
            )}
            {notificar.error && <Alert>{mensajeDeError(notificar.error)}</Alert>}
            <div className="flex gap-2">
              <Button size="sm" iconRight="send" disabled={!conEmail.length || incompleto} loading={notificar.isPending} onClick={enviar}>
                Enviar aviso
              </Button>
              <Button size="sm" variant="ghost" disabled={notificar.isPending} onClick={() => setAbierto(false)}>
                Cancelar
              </Button>
            </div>
          </>
        ))}
    </div>
  )
}
