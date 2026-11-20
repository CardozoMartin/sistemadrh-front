// Backend → formulario: para volver a abrir un cambio en carga con lo que ya se guardó.
// (Formulario → backend es igual que en el alta: titularesADto de ../AltaDeConcesion/adaptadores.)
import type { TitularForm } from '../shared/schemas/titular'
import type { CambioBackend } from './backend.types'
import { nuevoTitularVacio, type NuevoTitularForm } from './schemas'

const t = (v: string | null | undefined) => v ?? ''

export function propuestaAFormulario({ cambio }: CambioBackend): NuevoTitularForm {
  const vacio = nuevoTitularVacio()
  return {
    titulares: cambio.nuevosTitulares.length
      ? cambio.nuevosTitulares.map((p) => ({
          tipoPersona: p.tipoPersona === 'JURIDICA' ? 'juridica' : 'fisica',
          tipoDocumento: (p.tipoDocumento?.toLowerCase() ?? 'dni') as TitularForm['tipoDocumento'],
          documento: t(p.documento),
          correo: t(p.email),
          telefono: t(p.telefono),
          apellido: t(p.apellido),
          nombre: t(p.nombre),
          fechaNacimiento: t(p.fechaNacimiento),
          razonSocial: t(p.razonSocial),
          fechaConstitucion: t(p.fechaConstitucion),
        }))
      : vacio.titulares,
    domicilios: cambio.nuevosDomicilios.length
      ? cambio.nuevosDomicilios.map((d) => ({ calle: t(d.calle), numero: t(d.numero), departamento: t(d.departamento), localidad: t(d.localidad), distrito: t(d.distrito) }))
      : vacio.domicilios,
  }
}
