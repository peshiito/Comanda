import { consultar, ejecutar, pool } from '../db/pool.js';
import { aCentavos } from '../utils/dinero.js';

/** Valores por defecto: el sistema arranca seguro y el local los afloja si quiere. */
export const CONFIG_DEFECTO: Record<string, string> = {
  nombre_local: 'Mi Restaurante',
  cubierto_monto: '0.00',
  cubierto_activo: '0',
  // 0 = todo descuento pide PIN del encargado
  descuento_tope_sin_pin: '0.00',
  demora_amarillo_min: '10',
  demora_naranja_min: '15',
  demora_rojo_min: '20',
  mesa_sin_pedido_min: '8',
  plato_listo_sin_retirar_min: '3',
  cuenta_pedida_min: '5',
  take_away_activo: '1',
  propina_sugerida_pct: '10',
  // Datos que van impresos en el ticket. Son del contribuyente, así que se
  // configuran por instalación: acá van de ejemplo.
  direccion_local: '',
  localidad_local: '',
  cuit_local: '',
  ingresos_brutos: '',
  condicion_iva: 'Responsable Inscripto',
  inicio_actividades: '',
  pie_ticket: '',
};

let cache: Record<string, string> | null = null;

export async function leerConfig(): Promise<Record<string, string>> {
  if (cache) return cache;
  const filas = await consultar<{ clave: string; valor: string }>(
    pool,
    'SELECT clave, valor FROM config'
  );
  const guardada = Object.fromEntries(filas.map((f) => [f.clave, f.valor]));
  cache = { ...CONFIG_DEFECTO, ...guardada };
  return cache;
}

export async function valor(clave: string): Promise<string> {
  const cfg = await leerConfig();
  return cfg[clave] ?? CONFIG_DEFECTO[clave] ?? '';
}

export async function valorNumero(clave: string): Promise<number> {
  return Number(await valor(clave)) || 0;
}

export async function valorCentavos(clave: string): Promise<number> {
  return aCentavos(await valor(clave));
}

export async function valorBool(clave: string): Promise<boolean> {
  const v = await valor(clave);
  return v === '1' || v === 'true';
}

export async function guardarConfig(cambios: Record<string, string>): Promise<void> {
  for (const [clave, val] of Object.entries(cambios)) {
    await ejecutar(
      pool,
      `INSERT INTO config (clave, valor) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
      [clave, String(val)]
    );
  }
  cache = null;
}

export function invalidarCache(): void {
  cache = null;
}
