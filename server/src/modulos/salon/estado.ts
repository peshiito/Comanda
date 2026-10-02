import { consultar, pool } from '../../db/pool.js';
import { zonasActivas } from './zonas.js';
import { leerConfig } from '../../servicios/config.js';

export type EstadoMesa =
  | 'libre' | 'reservada' | 'ocupada_sin_pedido' | 'en_cocina' | 'servida'
  | 'por_cobrar' | 'unida';

export interface MesaSalon {
  id: number;
  nombre: string;
  capacidad: number;
  ancho: number;
  alto: number;
  forma: string;
  pos_x: number;
  pos_y: number;
  unida_a: number | null;
  satelites: string[];
  estado: EstadoMesa;
  cuentas: CuentaResumen[];
  comensales: number;
  minutos: number | null;
  reserva: { nombre: string; hora: string; personas: number } | null;
  borrador_pasado: boolean;
}

export interface CuentaResumen {
  id: number;
  estado: string;
  referencia: string | null;
  mozo_id: number | null;
  mozo: string | null;
  comensales: number;
  items: number;
  total: string;
  pagado: string;
  abierta_at: string;
  comandas_pendientes: number;
  comandas_listas: number;
}

const minutosDesde = (fecha: Date | string | null): number | null =>
  fecha ? Math.floor((Date.now() - new Date(fecha).getTime()) / 60000) : null;

async function cuentasAbiertas(): Promise<(CuentaResumen & { mesa_id: number | null })[]> {
  return consultar(
    pool,
    `SELECT c.id, c.mesa_id, c.estado, c.mozo_id, u.nombre AS mozo, c.comensales,
            c.referencia, c.total, c.pagado, c.abierta_at,
            (SELECT COUNT(*) FROM cuenta_items i WHERE i.cuenta_id = c.id AND i.estado = 'activo') AS items,
            (SELECT COUNT(*) FROM comandas k WHERE k.cuenta_id = c.id AND k.estado = 'pendiente') AS comandas_pendientes,
            (SELECT COUNT(*) FROM comandas k WHERE k.cuenta_id = c.id AND k.estado = 'terminada' AND k.retirado_at IS NULL) AS comandas_listas
     FROM cuentas c
     LEFT JOIN usuarios u ON u.id = c.mozo_id
     WHERE c.estado IN ('abierta','por_cobrar')
     ORDER BY c.abierta_at`
  );
}

function estadoDeMesa(cuentas: CuentaResumen[], reservada: boolean): EstadoMesa {
  if (!cuentas.length) return reservada ? 'reservada' : 'libre';
  if (cuentas.some((c) => c.estado === 'por_cobrar')) return 'por_cobrar';
  if (cuentas.some((c) => c.comandas_pendientes > 0)) return 'en_cocina';
  if (cuentas.every((c) => c.items === 0)) return 'ocupada_sin_pedido';
  return 'servida';
}

export async function vistaSalon(): Promise<{ mesas: MesaSalon[]; take_away: CuentaResumen[]; zonas: unknown[] }> {
  const cfg = await leerConfig();
  const anticipacion = Number(cfg.reserva_aviso_min ?? 45);

  const mesas = await consultar<{
    id: number; nombre: string; capacidad: number; pos_x: number; pos_y: number;
    ancho: number; alto: number; forma: string; unida_a: number | null;
  }>(
    pool,
    // Por posición en el mapa, no alfabético: si no, la 10 va antes que la 2.
    `SELECT id, nombre, capacidad, pos_x, pos_y, ancho, alto, forma, unida_a FROM mesas
     WHERE activa = 1
     ORDER BY pos_y, pos_x, CAST(REGEXP_REPLACE(nombre, '[^0-9]', '') AS UNSIGNED), nombre`
  );

  const cuentas = await cuentasAbiertas();
  const reservas = await consultar<{ mesa_id: number; nombre: string; fecha_hora: string; personas: number }>(
    pool,
    `SELECT mesa_id, nombre, fecha_hora, personas FROM reservas
     WHERE estado = 'pendiente' AND fecha_hora BETWEEN (NOW() - INTERVAL 30 MINUTE)
       AND (NOW() + INTERVAL ? MINUTE) ORDER BY fecha_hora`,
    [anticipacion]
  );
  const borradores = await consultar<{ mesa_id: number }>(
    pool,
    `SELECT DISTINCT mesa_id FROM borradores WHERE estado = 'pasado' AND mesa_id IS NOT NULL`
  );

  const vista: MesaSalon[] = mesas.map((m) => {
    const propias = cuentas.filter((c) => c.mesa_id === m.id);
    const reserva = reservas.find((r) => r.mesa_id === m.id) ?? null;
    const satelites = mesas.filter((s) => s.unida_a === m.id).map((s) => s.nombre);
    return {
      ...m,
      satelites,
      estado: m.unida_a ? 'unida' : estadoDeMesa(propias, Boolean(reserva)),
      cuentas: propias,
      comensales: propias.reduce((a, c) => a + c.comensales, 0),
      minutos: propias.length ? minutosDesde(propias[0].abierta_at) : null,
      reserva: reserva
        ? { nombre: reserva.nombre, hora: String(reserva.fecha_hora), personas: reserva.personas }
        : null,
      borrador_pasado: borradores.some((b) => b.mesa_id === m.id),
    };
  });

  return {
    mesas: vista,
    take_away: cuentas.filter((c) => c.mesa_id === null),
    // Barra, recepción, puertas: se dibujan detrás de las mesas.
    zonas: await zonasActivas(),
  };
}
