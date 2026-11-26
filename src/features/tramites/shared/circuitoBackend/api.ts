// Peticiones del circuito por las oficinas al BACKEND REAL. Todos los trámites sobre una concesión
// exponen los mismos endpoints bajo su ruta (ej: /tramites/ampliacion-reduccion/:id/recaudacion):
// la API se arma con esa ruta. Solo hablan con el backend; el cacheo lo hacen los hooks (./contexto.tsx).
import { backend } from '@/services/api/backend'
import type { AntecedentesDeuda, BorradorAvisoDeuda, DictamenDto, NotificarDeudaDto, ResolucionDto, ResultadoAvisoDeuda, VerificacionDeudaDto, VerificacionFinalDto } from './tipos'

const datos = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data)

/** `ruta`: la del trámite en el backend, ej: '/tramites/ampliacion-reduccion'. */
export function crearApiCircuito(ruta: string) {
  const de = (id: string, sub = '') => `${ruta}/${id}${sub}`
  return {
    /** La oficina que lo tiene lo toma para trabajarlo (antes de actuar). Común a todos los trámites. */
    tomar: (id: string) => datos(backend.post(`/expedientes/${id}/tomar`)),

    // Catastro
    enviar: (id: string, observaciones?: string) => datos(backend.post<unknown>(de(id, '/enviar'), { observaciones })),
    reenviar: (id: string, observaciones?: string) => datos(backend.post<unknown>(de(id, '/reenviar'), { observaciones })),
    cancelar: (id: string, observaciones: string) => datos(backend.post<unknown>(de(id, '/cancelar'), { observaciones })),
    verificacionFinal: (id: string, dto: VerificacionFinalDto) => datos(backend.post<unknown>(de(id, '/verificacion-final'), dto)),

    // Recaudación
    antecedentesDeuda: (id: string) => datos(backend.get<AntecedentesDeuda>(de(id, '/recaudacion'))),
    verificarDeuda: (id: string, dto: VerificacionDeudaDto) => datos(backend.post<unknown>(de(id, '/recaudacion'), dto)),
    borradorAvisoDeuda: (id: string) => datos(backend.get<BorradorAvisoDeuda>(de(id, '/recaudacion/aviso-deuda'))),
    notificarDeuda: (id: string, dto: NotificarDeudaDto) => datos(backend.post<ResultadoAvisoDeuda>(de(id, '/recaudacion/notificar-deuda'), dto)),

    // Distrito y Jurídico
    dictaminar: (id: string, oficina: 'distrito' | 'juridico', dto: DictamenDto) => datos(backend.post<unknown>(de(id, `/${oficina}`), dto)),

    // Secretaría General: la resolución con el PDF escaneado (multipart).
    resolucion: (id: string, dto: ResolucionDto) => {
      const form = new FormData()
      form.append('numero', dto.numero)
      form.append('anio', String(dto.anio))
      form.append('fecha', dto.fecha)
      if (dto.observaciones) form.append('observaciones', dto.observaciones)
      form.append('archivo', dto.archivo)
      // El cliente manda JSON por defecto: con multipart, axios arma el boundary solo.
      return datos(backend.post<unknown>(de(id, '/resolucion'), form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 }))
    },
    /** El PDF de la resolución (con la sesión: por eso no alcanza con un link). */
    archivoResolucion: (id: string) => datos(backend.get<Blob>(de(id, '/resolucion/archivo'), { responseType: 'blob' })),
  }
}

export type ApiCircuito = ReturnType<typeof crearApiCircuito>
