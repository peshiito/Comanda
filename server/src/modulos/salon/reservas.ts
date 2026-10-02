import { consultar, ejecutar, pool } from '../../db/pool.js';
import { noEncontrado } from '../../utils/errores.js';
import { auditar } from '../../servicios/auditoria.js';
import { emitir } from '../../sockets/index.js';
import type { UsuarioToken } from '../../types/express.js';
import type { z } from 'zod';
import type { reservaSchema } from './esquemas.js';

type Reserva = z.infer<typeof reservaSchema>;

/** Reservas mínimas: nombre, hora y teléfono para que aparezcan en el semáforo. */
export async function listarReservas(desde?: string, hasta?: string) {
  const params: unknown[] = [];
  let filtro = '';
  if (desde && hasta) {
    filtro = 'AND r.fecha_hora BETWEEN ? AND ?';
    params.push(desde, hasta);
  } else {
    filtro = 'AND r.fecha_hora >= (NOW() - INTERVAL 2 HOUR)';
  }
  return consultar(
    pool,
    `SELECT r.id, r.mesa_id, m.nombre AS mesa, r.nombre, r.telefono, r.personas,
            r.fecha_hora, r.estado, r.nota
     FROM reservas r JOIN mesas m ON m.id = r.mesa_id
     WHERE 1 = 1 ${filtro}
     ORDER BY r.fecha_hora LIMIT 200`,
    params
  );
}

export async function crearReserva(datos: Reserva, actor: UsuarioToken) {
  const res = await ejecutar(
    pool,
    `INSERT INTO reservas (mesa_id, nombre, telefono, personas, fecha_hora, nota, creado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      datos.mesa_id, datos.nombre, datos.telefono || null, datos.personas,
      new Date(datos.fecha_hora), datos.nota || null, actor.id,
    ]
  );
  await auditar({ actor, accion: 'reserva_creada', entidad: 'reserva', entidad_id: res.insertId });
  emitir(['salon', 'caja'], 'salon:cambio', { motivo: 'reserva' });
  return { id: res.insertId };
}

export async function cambiarEstadoReserva(
  id: number,
  estado: 'pendiente' | 'consumida' | 'cancelada',
  actor: UsuarioToken
) {
  const res = await ejecutar(pool, 'UPDATE reservas SET estado = ? WHERE id = ?', [estado, id]);
  if (!res.affectedRows) throw noEncontrado('Reserva no encontrada');
  await auditar({ actor, accion: `reserva_${estado}`, entidad: 'reserva', entidad_id: id });
  emitir(['salon', 'caja'], 'salon:cambio', { motivo: 'reserva' });
  return { id, estado };
}

/** Al ocupar una mesa reservada, la reserva se consume sola. */
export async function consumirReservaDeMesa(mesaId: number): Promise<void> {
  await ejecutar(
    pool,
    `UPDATE reservas SET estado = 'consumida'
     WHERE mesa_id = ? AND estado = 'pendiente'
       AND fecha_hora BETWEEN (NOW() - INTERVAL 2 HOUR) AND (NOW() + INTERVAL 2 HOUR)`,
    [mesaId]
  );
}
