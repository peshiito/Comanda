/**
 * "Hoy" según el reloj del local, no según UTC.
 *
 * `new Date().toISOString()` da la fecha en UTC. En Argentina (UTC-3) eso
 * significa que a partir de las 21:00 la fecha "de hoy" ya es la de mañana,
 * mientras MySQL sigue guardando `cerrada_at` en hora local. El reporte del
 * día quedaba preguntando por mañana y devolvía cero justo en la franja en
 * que el encargado cierra el turno: de 21 a 24, todas las noches.
 *
 * El servidor corre en el mini PC del local, así que su hora local ES la hora
 * del restaurante; alcanza con leer los componentes locales en vez de los UTC.
 */
export function hoyLocal(ahora = new Date()): string {
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}
