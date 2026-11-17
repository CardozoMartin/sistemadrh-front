import { useState, type FormEvent } from 'react'
import { Alert } from '@/components/feedback/States'
import { Field, Input, Select } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/cn'
import { mensajeDeError } from '@/services/api/errors'
import { permisosDeOficina, plantillaDe, useDistritos, type MatrizPermisos, type UsuarioDatos, type UsuarioListado } from '../api'

interface Props {
  /** null: alta de un usuario nuevo. */
  usuario: UsuarioListado | null
  matriz: MatrizPermisos
  guardando: boolean
  onGuardar: (datos: UsuarioDatos) => Promise<unknown>
  onCerrar: () => void
}

type Errores = Partial<Record<keyof UsuarioDatos | 'general', string>>

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Alta y modificación de un usuario: datos, oficina, rol y sus permisos. Los permisos se
 * precargan con la plantilla del rol en la oficina y se ajustan de a uno. La contraseña no se
 * carga acá: se genera una temporal.
 */
export function UsuarioDialog({ usuario, matriz, guardando, onGuardar, onCerrar }: Props) {
  const [d, setD] = useState<UsuarioDatos>({
    legajo: usuario?.legajo ?? '',
    apellido: usuario?.apellido ?? '',
    nombre: usuario?.nombre ?? '',
    email: usuario?.email ?? '',
    esAdministrador: usuario?.esAdministrador ?? false,
    oficina: usuario?.oficina?.codigo ?? '',
    rol: usuario?.rol?.codigo ?? '',
    distrito: usuario?.distrito?.codigo ?? '',
  })
  const distritos = useDistritos()
  const esDistrito = d.oficina === 'distrito'
  const [permisos, setPermisos] = useState<string[]>(usuario?.permisos ?? [])
  const [errores, setErrores] = useState<Errores>({})

  const cambiar = (campo: keyof UsuarioDatos, valor: string | boolean) => setD((x) => ({ ...x, [campo]: valor }))
  /** Cambiar la oficina o el rol vuelve a la plantilla (los permisos de otra oficina no aplican). */
  function cambiarPuesto(campo: 'oficina' | 'rol', valor: string) {
    const nuevo = { ...d, [campo]: valor }
    setD(nuevo)
    setPermisos(plantillaDe(matriz, nuevo.oficina || undefined, nuevo.rol || undefined))
  }
  const alternar = (codigo: string) => setPermisos((ps) => (ps.includes(codigo) ? ps.filter((p) => p !== codigo) : [...ps, codigo]))

  const disponibles = permisosDeOficina(matriz, d.oficina || undefined)
  const grupos = [...new Set(disponibles.map((p) => p.grupo))]
  const plantilla = plantillaDe(matriz, d.oficina || undefined, d.rol || undefined)
  const igualAPlantilla = plantilla.length === permisos.length && plantilla.every((p) => permisos.includes(p))

  async function guardar(e?: FormEvent) {
    e?.preventDefault()
    const nuevos: Errores = {
      legajo: !d.legajo.trim() ? 'Ingrese el legajo.' : !/^[A-Za-z0-9-]{1,20}$/.test(d.legajo.trim()) ? 'Letras, números y guiones (hasta 20).' : undefined,
      apellido: !d.apellido.trim() ? 'Ingrese el apellido.' : undefined,
      nombre: !d.nombre.trim() ? 'Ingrese el nombre.' : undefined,
      email: !d.email.trim() ? 'Ingrese el email.' : !EMAIL.test(d.email.trim()) ? 'El email no es válido.' : undefined,
      oficina: !d.esAdministrador && !d.oficina ? 'Elija la oficina.' : undefined,
      rol: !d.esAdministrador && !d.rol ? 'Elija el rol.' : undefined,
    }
    setErrores(nuevos)
    if (Object.values(nuevos).some(Boolean)) return
    try {
      // Solo los que corresponden a la oficina elegida.
      const validos = permisos.filter((p) => disponibles.some((x) => x.codigo === p))
      await onGuardar({ ...d, oficina: d.oficina || undefined, rol: d.rol || undefined, distrito: esDistrito && d.distrito ? d.distrito : null, permisos: d.esAdministrador ? [] : validos })
    } catch (err) {
      setErrores({ general: mensajeDeError(err) })
    }
  }

  return (
    <Modal
      open
      size="xl"
      title={usuario ? `Editar a ${usuario.apellido}, ${usuario.nombre}` : 'Nuevo usuario'}
      description={usuario ? undefined : 'Al guardar se genera una contraseña temporal: désela al usuario; la cambia al entrar.'}
      icon={usuario ? 'edit' : 'person_add'}
      onClose={onCerrar}
      bloqueado={guardando}
      footer={
        <>
          <Button variant="ghost" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button iconRight="check" loading={guardando} disabled={guardando} onClick={() => void guardar()}>
            {usuario ? 'Guardar cambios' : 'Crear usuario'}
          </Button>
        </>
      }
    >
      <form noValidate onSubmit={(e) => void guardar(e)} className="flex flex-col gap-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="u-legajo" label="Legajo" required error={errores.legajo}>
            <Input id="u-legajo" value={d.legajo} invalid={!!errores.legajo} onChange={(e) => cambiar('legajo', e.target.value.toUpperCase())} autoFocus />
          </Field>
          <Field id="u-email" label="Email" required error={errores.email}>
            <Input id="u-email" type="email" value={d.email} invalid={!!errores.email} onChange={(e) => cambiar('email', e.target.value)} />
          </Field>
          <Field id="u-apellido" label="Apellido" required error={errores.apellido}>
            <Input id="u-apellido" value={d.apellido} invalid={!!errores.apellido} onChange={(e) => cambiar('apellido', e.target.value)} />
          </Field>
          <Field id="u-nombre" label="Nombre" required error={errores.nombre}>
            <Input id="u-nombre" value={d.nombre} invalid={!!errores.nombre} onChange={(e) => cambiar('nombre', e.target.value)} />
          </Field>
          <Field id="u-oficina" label="Oficina" required={!d.esAdministrador} error={errores.oficina} hint="Solo va a poder entrar a esta oficina.">
            <Select
              id="u-oficina"
              placeholder={d.esAdministrador ? 'Ninguna' : 'Elija…'}
              options={matriz.oficinas.map((o) => ({ value: o.codigo, label: o.nombre }))}
              value={d.oficina}
              invalid={!!errores.oficina}
              onChange={(e) => cambiarPuesto('oficina', e.target.value)}
            />
          </Field>
          <Field id="u-rol" label="Rol" required={!d.esAdministrador} error={errores.rol} hint="Precarga los permisos de su plantilla.">
            <Select
              id="u-rol"
              placeholder={d.esAdministrador ? 'Ninguno' : 'Elija…'}
              options={matriz.roles.map((r) => ({ value: r.codigo, label: r.nombre }))}
              value={d.rol}
              invalid={!!errores.rol}
              onChange={(e) => cambiarPuesto('rol', e.target.value)}
            />
          </Field>
          {esDistrito && (
            <Field id="u-distrito" label="Distrito que atiende" hint="Ve y trabaja solo los expedientes de ese distrito. «Todos»: los de cualquier distrito.">
              <Select
                id="u-distrito"
                placeholder="Todos los distritos"
                options={(distritos.data ?? []).map((x) => ({ value: x.codigo, label: x.nombre }))}
                value={d.distrito ?? ''}
                onChange={(e) => cambiar('distrito', e.target.value)}
              />
            </Field>
          )}
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm sm:col-span-2 dark:border-slate-700">
            <input type="checkbox" className="mt-0.5 size-4" checked={d.esAdministrador} onChange={(e) => cambiar('esAdministrador', e.target.checked)} />
            <span>
              <span className="font-semibold">Administrador (Informática)</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">Puede todo en todas las oficinas y administra usuarios y permisos.</span>
            </span>
          </label>
        </div>

        {!d.esAdministrador && (
          <section className="flex flex-col gap-3 border-t border-slate-200 pt-5 dark:border-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold">Permisos</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {d.oficina ? 'Los de su oficina y los generales. Consultar expedientes no requiere permisos.' : 'Elija la oficina para ver sus permisos.'}
                </p>
              </div>
              {d.oficina && d.rol && (
                <Button size="sm" variant="ghost" iconLeft="restart_alt" disabled={igualAPlantilla} onClick={() => setPermisos(plantilla)}>
                  {igualAPlantilla ? 'Igual a la plantilla' : 'Volver a la plantilla del rol'}
                </Button>
              )}
            </div>
            {d.oficina &&
              grupos.map((grupo) => (
                <fieldset key={grupo} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <legend className="px-1 text-xs font-bold text-slate-500 uppercase dark:text-slate-400">{grupo}</legend>
                  <div className="grid gap-2 md:grid-cols-2">
                    {disponibles
                      .filter((p) => p.grupo === grupo)
                      .map((p) => (
                        <label
                          key={p.codigo}
                          className={cn(
                            'flex items-start gap-2.5 rounded-md p-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50',
                            permisos.includes(p.codigo) && 'bg-primary/5',
                          )}
                        >
                          <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={permisos.includes(p.codigo)} onChange={() => alternar(p.codigo)} />
                          <span>
                            <span className="font-medium">{p.nombre}</span>
                            {p.descripcion && <span className="block text-xs text-slate-500 dark:text-slate-400">{p.descripcion}</span>}
                          </span>
                        </label>
                      ))}
                  </div>
                </fieldset>
              ))}
          </section>
        )}

        {errores.general && <Alert>{errores.general}</Alert>}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
