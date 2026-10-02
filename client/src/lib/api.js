const CLAVE_TOKEN = 'resto_token';

export function leerToken() {
  try {
    return localStorage.getItem(CLAVE_TOKEN);
  } catch {
    return null;
  }
}

export function guardarToken(token) {
  try {
    if (token) localStorage.setItem(CLAVE_TOKEN, token);
    else localStorage.removeItem(CLAVE_TOKEN);
  } catch {
    /* modo privado: la sesión dura lo que dure la pestaña */
  }
}

export class ErrorApi extends Error {
  constructor(estado, mensaje, codigo, detalle) {
    super(mensaje);
    this.estado = estado;
    this.codigo = codigo;
    this.detalle = detalle;
  }
}

async function pedir(metodo, ruta, cuerpo) {
  const token = leerToken();
  const res = await fetch(`/api${ruta}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });

  const texto = await res.text();
  const datos = texto ? JSON.parse(texto) : null;

  if (!res.ok) {
    if (res.status === 401) {
      guardarToken(null);
      window.dispatchEvent(new CustomEvent('sesion-vencida'));
    }
    throw new ErrorApi(res.status, datos?.error ?? 'Error de conexión', datos?.codigo, datos?.detalle);
  }
  return datos;
}

export const api = {
  get: (ruta) => pedir('GET', ruta),
  post: (ruta, cuerpo) => pedir('POST', ruta, cuerpo ?? {}),
  put: (ruta, cuerpo) => pedir('PUT', ruta, cuerpo),
  patch: (ruta, cuerpo) => pedir('PATCH', ruta, cuerpo),
  del: (ruta) => pedir('DELETE', ruta),
};

/** Clave de idempotencia para el cobro: dos toques no cobran dos veces. */
export function claveIdempotencia(prefijo) {
  return `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
