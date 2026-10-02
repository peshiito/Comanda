import { consultar, pool } from '../../db/pool.js';
import { leerConfig } from '../../servicios/config.js';

export type TipoPrioridad =
  | 'plato_listo' | 'mesa_sin_pedido' | 'cuenta_pedida' | 'reserva_encima';

export interface Prioridad {
  tipo: TipoPrioridad;
  nivel: 'rojo' | 'naranja' | 'azul';
  mesa: string | null;
  mesa_id: number | null;
  cuenta_id: number | null;
  comanda_id: number | null;
  mozo_id: number | null;
  minutos: number;
  texto: string;
}

/**
 * La pantalla del mozo se ordena por urgencia, no por número de mesa.
 * El aviso más valioso es el plato listo que nadie retiró: se está enfriando.
 */
export async function prioridades(mozoId?: number): Promise<Prioridad[]> {
  const cfg = await leerConfig();
  const lista: Prioridad[] = [];

  const listos = await consultar<{
    id: number; cuenta_id: number; mesa_label: string; mesa_id: number | null;
    mozo_id: number | null; minutos: number;
  }>(
    pool,
    `SELECT k.id, k.cuenta_id, k.mesa_label, c.mesa_id, c.mozo_id,
            TIMESTAMPDIFF(MINUTE, k.terminada_at, NOW()) AS minutos
     FROM comandas k
     JOIN cuentas c ON c.id = k.cuenta_id
     WHERE k.estado = 'terminada' AND k.retirado_at IS NULL
       AND c.estado IN ('abierta','por_cobrar')
     ORDER BY k.terminada_at`
  );
  for (const l of listos) {
    lista.push({
      tipo: 'plato_listo',
      nivel: l.minutos >= Number(cfg.plato_listo_sin_retirar_min) ? 'rojo' : 'naranja',
      mesa: l.mesa_label, mesa_id: l.mesa_id, cuenta_id: l.cuenta_id,
      comanda_id: l.id, mozo_id: l.mozo_id, minutos: l.minutos,
      texto: `${l.mesa_label} lista`,
    });
  }

  const sinPedido = await consultar<{
    id: number; mesa_id: number | null; mesa: string | null; mozo_id: number | null; minutos: number;
  }>(
    pool,
    `SELECT c.id, c.mesa_id, m.nombre AS mesa, c.mozo_id,
            TIMESTAMPDIFF(MINUTE, c.abierta_at, NOW()) AS minutos
     FROM cuentas c
     LEFT JOIN mesas m ON m.id = c.mesa_id
     WHERE c.estado = 'abierta'
       AND TIMESTAMPDIFF(MINUTE, c.abierta_at, NOW()) >= ?
       AND NOT EXISTS (SELECT 1 FROM cuenta_items i WHERE i.cuenta_id = c.id AND i.estado = 'activo')
     ORDER BY c.abierta_at`,
    [Number(cfg.mesa_sin_pedido_min)]
  );
  for (const s of sinPedido) {
    lista.push({
      tipo: 'mesa_sin_pedido', nivel: 'naranja', mesa: s.mesa, mesa_id: s.mesa_id,
      cuenta_id: s.id, comanda_id: null, mozo_id: s.mozo_id, minutos: s.minutos,
      texto: `${s.mesa ?? 'Take away'} sin pedido hace ${s.minutos} min`,
    });
  }

  const porCobrar = await consultar<{
    id: number; mesa_id: number | null; mesa: string | null; mozo_id: number | null; minutos: number;
  }>(
    pool,
    `SELECT c.id, c.mesa_id, m.nombre AS mesa, c.mozo_id,
            TIMESTAMPDIFF(MINUTE, c.cuenta_pedida_at, NOW()) AS minutos
     FROM cuentas c
     LEFT JOIN mesas m ON m.id = c.mesa_id
     WHERE c.estado = 'por_cobrar' AND c.cuenta_pedida_at IS NOT NULL
       AND TIMESTAMPDIFF(MINUTE, c.cuenta_pedida_at, NOW()) >= ?
     ORDER BY c.cuenta_pedida_at`,
    [Number(cfg.cuenta_pedida_min)]
  );
  for (const p of porCobrar) {
    lista.push({
      tipo: 'cuenta_pedida', nivel: 'naranja', mesa: p.mesa, mesa_id: p.mesa_id,
      cuenta_id: p.id, comanda_id: null, mozo_id: p.mozo_id, minutos: p.minutos,
      texto: `${p.mesa ?? 'Take away'} espera la cuenta hace ${p.minutos} min`,
    });
  }

  const reservas = await consultar<{ mesa_id: number; mesa: string; nombre: string; minutos: number }>(
    pool,
    `SELECT r.mesa_id, m.nombre AS mesa, r.nombre,
            TIMESTAMPDIFF(MINUTE, NOW(), r.fecha_hora) AS minutos
     FROM reservas r
     JOIN mesas m ON m.id = r.mesa_id
     WHERE r.estado = 'pendiente' AND r.fecha_hora BETWEEN NOW() AND (NOW() + INTERVAL 20 MINUTE)
       AND EXISTS (SELECT 1 FROM cuentas c WHERE c.mesa_id = r.mesa_id AND c.estado IN ('abierta','por_cobrar'))`
  );
  for (const r of reservas) {
    lista.push({
      tipo: 'reserva_encima', nivel: 'azul', mesa: r.mesa, mesa_id: r.mesa_id,
      cuenta_id: null, comanda_id: null, mozo_id: null, minutos: r.minutos,
      texto: `Reserva de ${r.nombre} en ${r.minutos} min y la ${r.mesa} está ocupada`,
    });
  }

  const orden = { rojo: 0, naranja: 1, azul: 2 };
  const filtradas = mozoId ? lista.filter((p) => p.mozo_id === null || p.mozo_id === mozoId) : lista;
  return filtradas.sort((a, b) => orden[a.nivel] - orden[b.nivel] || b.minutos - a.minutos);
}
