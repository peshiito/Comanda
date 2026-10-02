const pesosAR = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
});

export function plata(valor) {
  const n = Number(valor ?? 0);
  return pesosAR.format(Number.isFinite(n) ? n : 0);
}

/**
 * Sólo el número, sin el símbolo. En un ticket o una factura la columna ya
 * se sabe que es plata y repetir el "$" en cada línea ensucia la lectura.
 */
export function montoPlano(valor) {
  const n = Number(valor ?? 0);
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

/** Sin centavos: para KPIs grandes donde los decimales son ruido. */
export function plataCorta(valor) {
  const n = Number(valor ?? 0);
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

export function numero(valor) {
  return new Intl.NumberFormat('es-AR').format(Number(valor ?? 0));
}

export function hora(fecha) {
  if (!fecha) return '';
  return new Date(fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export function fechaHora(fecha) {
  if (!fecha) return '';
  return new Date(fecha).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function minutosDesde(fecha) {
  if (!fecha) return null;
  return Math.floor((Date.now() - new Date(fecha).getTime()) / 60000);
}

export function duracion(minutos) {
  if (minutos === null || minutos === undefined) return '—';
  const m = Math.max(0, Math.round(minutos));
  if (m < 60) return `${m}′`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}`;
}

/** "Mesa 7" → "7". El mozo busca el número, no la palabra. */
export function soloNumero(nombre) {
  const n = String(nombre ?? '').replace(/\D/g, '');
  return n || String(nombre ?? '');
}

/**
 * La fecha de hoy en el reloj de quien está mirando la pantalla.
 * `toISOString()` devuelve UTC, que desde las 21:00 argentinas ya es mañana:
 * los filtros arrancaban en un día sin ventas. Ver `server/utils/fechas.ts`.
 */
export function fechaLocal(d = new Date()) {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export const HOY = () => fechaLocal();

export const ETIQUETA_ESTADO = {
  libre: { texto: 'Libre', clase: 'eti-neutra' },
  reservada: { texto: 'Reservada', clase: 'eti-azul' },
  ocupada_sin_pedido: { texto: 'Sin pedido', clase: 'eti-amarilla' },
  en_cocina: { texto: 'En cocina', clase: 'eti-naranja' },
  servida: { texto: 'Servida', clase: 'eti-verde' },
  por_cobrar: { texto: 'Por cobrar', clase: 'eti-tinta' },
  unida: { texto: 'Unida', clase: 'eti-neutra' },
};

export const ESTADO_CUENTA = {
  abierta: { texto: 'Abierta', clase: 'eti-verde' },
  por_cobrar: { texto: 'Por cobrar', clase: 'eti-tinta' },
  cerrada: { texto: 'Cobrada', clase: 'eti-neutra' },
  perdida: { texto: 'No cobrada', clase: 'eti-roja' },
  fusionada: { texto: 'Fusionada', clase: 'eti-neutra' },
};

export const MEDIOS = {
  efectivo: 'Efectivo',
  debito: 'Débito',
  credito: 'Crédito',
  transferencia: 'Transferencia',
  qr: 'QR',
};

export const MOTIVOS_DEVOLUCION = {
  error_cocina: 'Error de cocina',
  error_pedido: 'Error al tomar el pedido',
  devuelto_cliente: 'Devuelto por el cliente',
  se_cayo: 'Se cayó',
  otro: 'Otro',
};

export const NIVEL_CLASE = {
  verde: 'eti-verde',
  amarillo: 'eti-amarilla',
  naranja: 'eti-naranja',
  rojo: 'eti-roja',
  azul: 'eti-azul',
};

/**
 * Ruta de la foto de un producto. Devuelve null si no tiene, para que quien
 * la use decida qué poner en el hueco en vez de mostrar una imagen rota.
 */
export function urlFoto(foto) {
  return foto ? `/fotos/${foto}` : null;
}
