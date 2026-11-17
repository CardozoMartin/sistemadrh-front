import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { Alert, LoadingState } from '@/components/feedback/States'
import { Field, Input } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/config/routes'
import { mensajeDeError } from '@/services/api/errors'
import { authApi, errorClave } from '../api'
import { PantallaAcceso } from '../components/PantallaAcceso'
import { useSesion } from '../context'

/**
 * Cambio de contraseña. Obligatorio después de entrar con una temporal (alta o restablecimiento);
 * también se llega desde el menú del usuario. Cierra las sesiones abiertas en otras PC.
 */
export default function CambiarClavePage() {
  const sesion = useSesion()
  const navigate = useNavigate()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetida, setRepetida] = useState('')
  const [errores, setErrores] = useState<{ nueva?: string; repetida?: string; general?: string }>({})
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    document.title = 'Cambiar contraseña | Sistema DRH'
  }, [])

  if (sesion.estado === 'cargando') return <LoadingState mensaje="Verificando la sesión…" />
  if (sesion.estado === 'anonimo') return <Navigate to={ROUTES.login} replace />
  const obligatorio = !!sesion.usuario?.debeCambiarClave

  async function guardar(e: FormEvent) {
    e.preventDefault()
    const e1 = !actual ? 'Ingrese la contraseña actual.' : undefined
    const e2 = errorClave(nueva) ?? (nueva === actual ? 'La contraseña nueva tiene que ser distinta de la actual.' : undefined)
    const e3 = nueva !== repetida ? 'Las dos contraseñas nuevas no coinciden.' : undefined
    setErrores({ general: e1, nueva: e2 ?? undefined, repetida: e3 })
    if (e1 || e2 || e3) return
    setEnviando(true)
    try {
      sesion.actualizar(await authApi.cambiarClave(actual, nueva))
      navigate(ROUTES.dashboard, { replace: true })
    } catch (err) {
      setErrores({ general: mensajeDeError(err) })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <PantallaAcceso
      titulo={obligatorio ? 'Elija su contraseña' : 'Cambiar contraseña'}
      descripcion={
        obligatorio
          ? `Hola, ${sesion.usuario?.nombre}. Entró con una contraseña temporal: elija una propia para seguir.`
          : 'Al cambiarla se cierran las sesiones abiertas en otras computadoras.'
      }
    >
      <form noValidate onSubmit={(e) => void guardar(e)} className="flex flex-col gap-5">
        <Field id="actual" label={obligatorio ? 'Contraseña temporal' : 'Contraseña actual'}>
          <Input id="actual" type="password" autoComplete="current-password" autoFocus value={actual} onChange={(e) => setActual(e.target.value)} />
        </Field>
        <Field id="nueva" label="Contraseña nueva" hint="Al menos 8 caracteres, con letras y números." error={errores.nueva}>
          <Input id="nueva" type="password" autoComplete="new-password" invalid={!!errores.nueva} value={nueva} onChange={(e) => setNueva(e.target.value)} />
        </Field>
        <Field id="repetida" label="Repita la contraseña nueva" error={errores.repetida}>
          <Input id="repetida" type="password" autoComplete="new-password" invalid={!!errores.repetida} value={repetida} onChange={(e) => setRepetida(e.target.value)} />
        </Field>
        {errores.general && <Alert>{errores.general}</Alert>}
        <div className="flex flex-wrap justify-end gap-3">
          {obligatorio ? (
            <Button variant="ghost" onClick={() => void sesion.salir()}>
              Salir
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => navigate(-1)}>
              Cancelar
            </Button>
          )}
          <Button type="submit" iconRight="check" loading={enviando} disabled={enviando}>
            Guardar contraseña
          </Button>
        </div>
      </form>
    </PantallaAcceso>
  )
}
