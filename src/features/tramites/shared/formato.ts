// Cómo se muestran en pantalla los datos del cambio (mensajes, resúmenes, encabezados).

/** «N° 906» (o el id, si la concesión todavía no tiene número). */
export const numeroConcesion = (c: { id: string; numero: string | null }) => `N° ${c.numero ?? c.id}`

/** «A, B y C»: los nombres de una lista de personas, para los mensajes. */
export const nombres = (lista: { nombreCompleto: string }[]) => {
  const n = lista.map((p) => p.nombreCompleto)
  return n.length <= 1 ? (n[0] ?? '') : `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`
}
