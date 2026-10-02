import { malPedido } from './errores.js';

/**
 * Lee un :id de la URL. parseInt("1 OR 1=1") devuelve 1 y deja pasar basura,
 * así que exigimos que el parámetro sea enteramente numérico.
 */
export function idParam(valor: string | undefined, nombre = 'id'): number {
  if (!valor || !/^\d{1,10}$/.test(valor)) {
    throw malPedido(`El ${nombre} de la URL no es válido`, 'param_invalido');
  }
  const n = Number.parseInt(valor, 10);
  if (n <= 0) throw malPedido(`El ${nombre} de la URL no es válido`, 'param_invalido');
  return n;
}

/**
 * Lo mismo para el `?query=`, que hasta ahora entraba crudo.
 *
 * Dos cosas distintas pasaban acá. Una: `Number('abc')` da NaN, y ese NaN
 * viajaba hasta el SQL ("Unknown column 'NaN'", "LIMIT NaN") y devolvía 500
 * donde correspondía un 400 — además de mostrarle al cliente el mensaje
 * interno de MySQL. La otra: `?limite=1&limite=2` hace que Express entregue
 * un array, así que el `as string` de las rutas era mentira y `String(…)`
 * terminaba concatenando.
 *
 * `undefined` sigue significando "no lo mandó", que cada ruta resuelve con su
 * propio valor por omisión.
 */
function unico(valor: unknown, nombre: string): string | undefined {
  if (valor === undefined || valor === null || valor === '') return undefined;
  if (typeof valor !== 'string') {
    throw malPedido(`El parámetro ${nombre} está repetido o mal formado`, 'query_invalida');
  }
  return valor;
}

/** Entero positivo. `max` acota antes de llegar a la base. */
export function numeroQuery(valor: unknown, nombre: string, max = 100_000_000): number | undefined {
  const texto = unico(valor, nombre);
  if (texto === undefined) return undefined;
  if (!/^\d{1,10}$/.test(texto)) {
    throw malPedido(`El parámetro ${nombre} tiene que ser un número`, 'query_invalida');
  }
  const n = Number.parseInt(texto, 10);
  if (n <= 0 || n > max) {
    throw malPedido(`El parámetro ${nombre} está fuera de rango`, 'query_invalida');
  }
  return n;
}

/**
 * Fecha YYYY-MM-DD. El formato solo no alcanza: 2026-02-31 pasa el regex y
 * MySQL la rechaza con un 500, así que se verifica que el calendario exista.
 */
export function fechaQuery(valor: unknown, nombre: string): string | undefined {
  const texto = unico(valor, nombre);
  if (texto === undefined) return undefined;
  const invalida = (): never => {
    throw malPedido(`La fecha ${nombre} tiene que ser AAAA-MM-DD`, 'query_invalida');
  };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) invalida();
  const d = new Date(`${texto}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== texto) invalida();
  return texto;
}

/** Texto acotado: un filtro no tiene por qué recibir 5000 caracteres. */
export function textoQuery(valor: unknown, nombre: string, max = 120): string | undefined {
  const texto = unico(valor, nombre);
  if (texto === undefined) return undefined;
  const limpio = texto.trim();
  if (limpio.length > max) {
    throw malPedido(`El parámetro ${nombre} es demasiado largo`, 'query_invalida');
  }
  return limpio || undefined;
}
