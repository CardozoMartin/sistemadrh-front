import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { Alert } from '@/components/feedback/States'
import { Field, Input } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/config/routes'
import { mensajeDeError } from '@/services/api/errors'
import { PantallaAcceso } from '../components/PantallaAcceso'
import { useSesion } from '../context'

/** Ingreso con legajo o email y contraseña. Vuelve a la pantalla que se quería abrir. */
export default function LoginPage() {
  const sesion = useSesion()
  const navigate = useNavigate()
  const destino = (useLocation().state as { desde?: string } | null)?.desde ?? ROUTES.dashboard
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    document.title = 'Ingresar | Sistema DRH'
  }, [])

  if (sesion.estado === 'conectado') return <Navigate to={destino} replace />

  async function ingresar(e: FormEvent) {
    e.preventDefault()
    if (!usuario.trim() || !clave) return setError('Ingrese su legajo o email y la contraseña.')
    setEnviando(true)
    setError(null)
    try {
      const u = await sesion.ingresar(usuario.trim(), clave)
      navigate(u.debeCambiarClave ? ROUTES.cambiarClave : destino, { replace: true })
    } catch (err) {
      setError(mensajeDeError(err))
      setClave('')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <PantallaAcceso titulo="Ingresar al sistema" descripcion="Use su legajo o su email institucional y su contraseña.">
      <form noValidate onSubmit={(e) => void ingresar(e)} className="flex flex-col gap-5">
        <Field id="usuario" label="Legajo o email">
          <Input id="usuario" icon="person" autoComplete="username" autoFocus value={usuario} onChange={(e) => setUsuario(e.target.value)} />
        </Field>
        <Field id="clave" label="Contraseña">
          <Input id="clave" icon="lock" type="password" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} />
        </Field>
        {error && <Alert>{error}</Alert>}
        <Button type="submit" iconRight="login" loading={enviando} disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </Button>
        <p className="text-xs text-slate-500 dark:text-slate-400">¿Olvidó la contraseña? Pídale al administrador del sistema que se la restablezca.</p>
      </form>
    </PantallaAcceso>
  )
}
