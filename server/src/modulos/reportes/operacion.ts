import { consultar, consultarUna, pool } from '../../db/pool.js';
import type { Rango } from './ventas.js';

/**
 * Los tres relojes del local, medidos sin pedirle un dato a nadie:
 * cuánto dura la mesa, cuánto tarda la cocina y cuánto se tarda en cobrar.
 */
export async function tiempos(r: Rango) {
  const mesa = await consultarUna<{ minutos: string; mesas: number }>(
    pool,
    `SELECT AVG(TIMESTAMPDIFF(MINUTE, abierta_at, cerrada_at)) AS minutos, COUNT(*) AS mesas
     FROM cuentas
     WHERE estado = 'cerrada' AND cerrada_at IS NOT NULL
       AND DATE(cerrada_at) BETWEEN ? AND ?`,
    [r.desde, r.hasta]
  );

  const cocina = await consultarUna<{ minutos: string; comandas: number; demoradas: number }>(
    pool,
    `SELECT AVG(TIMESTAMPDIFF(SECOND, enviada_at, terminada_at)) / 60 AS minutos,
            COUNT(*) AS comandas,
            SUM(TIMESTAMPDIFF(MINUTE, enviada_at, terminada_at) > 20) AS demoradas
     FROM comandas
     WHERE terminada_at IS NOT NULL AND DATE(enviada_at) BETWEEN ? AND ?`,
    [r.desde, r.hasta]
  );

  const cobro = await consultarUna<{ minutos: string }>(
    pool,
    `SELECT AVG(TIMESTAMPDIFF(SECOND, cuenta_pedida_at, cerrada_at)) / 60 AS minutos
     FROM cuentas
     WHERE estado = 'cerrada' AND cuenta_pedida_at IS NOT NULL
       AND DATE(cerrada_at) BETWEEN ? AND ?`,
    [r.desde, r.hasta]
  );

  const retiro = await consultarUna<{ minutos: string }>(
    pool,
    `SELECT AVG(TIMESTAMPDIFF(SECOND, terminada_at, retirado_at)) / 60 AS minutos
     FROM comandas
     WHERE retirado_at IS NOT NULL AND DATE(enviada_at) BETWEEN ? AND ?`,
    [r.desde, r.hasta]
  );

  const redondear = (v: string | null | undefined) => (v === null || v === undefined ? null : Number(Number(v).toFixed(1)));

  return {
    mesa_minutos: redondear(mesa?.minutos),
    mesas_medidas: mesa?.mesas ?? 0,
    cocina_minutos: redondear(cocina?.minutos),
    comandas_medidas: cocina?.comandas ?? 0,
    comandas_demoradas: Number(cocina?.demoradas ?? 0),
    cobro_minutos: redondear(cobro?.minutos),
    retiro_minutos: redondear(retiro?.minutos),
  };
}

/** Por cocina por hora: sirve para discutir si la cocina viene lenta los sábados. */
export async function cocinaPorHora(r: Rango) {
  return consultar(
    pool,
    `SELECT HOUR(enviada_at) AS hora, COUNT(*) AS comandas,
            ROUND(AVG(TIMESTAMPDIFF(SECOND, enviada_at, terminada_at)) / 60, 1) AS minutos
     FROM comandas
     WHERE terminada_at IS NOT NULL AND DATE(enviada_at) BETWEEN ? AND ?
     GROUP BY hora ORDER BY hora`,
    [r.desde, r.hasta]
  );
}

/** Lo que el local tiró y lo que se fue sin pagar: dos cosas distintas. */
export async function perdidas(r: Rango) {
  const devoluciones = await consultar(
    pool,
    `SELECT i.id, i.nombre_snapshot AS producto, i.cantidad, i.total_linea AS importe,
            i.motivo, i.resuelto_at, u.nombre AS autorizo, c.id AS cuenta_id, m.nombre AS mesa
     FROM cuenta_items i
     JOIN cuentas c ON c.id = i.cuenta_id
     LEFT JOIN mesas m ON m.id = c.mesa_id
     LEFT JOIN usuarios u ON u.id = i.resuelto_por
     WHERE i.estado = 'devuelto' AND DATE(i.resuelto_at) BETWEEN ? AND ?
     ORDER BY i.resuelto_at DESC`,
    [r.desde, r.hasta]
  );

  const anulaciones = await consultar(
    pool,
    `SELECT i.id, i.nombre_snapshot AS producto, i.cantidad, i.total_linea AS importe,
            i.motivo, i.resuelto_at, u.nombre AS autorizo, i.comanda_id IS NOT NULL AS estaba_en_cocina
     FROM cuenta_items i
     LEFT JOIN usuarios u ON u.id = i.resuelto_por
     WHERE i.estado = 'anulado' AND DATE(i.resuelto_at) BETWEEN ? AND ?
     ORDER BY i.resuelto_at DESC`,
    [r.desde, r.hasta]
  );

  const noCobradas = await consultar(
    pool,
    `SELECT c.id, m.nombre AS mesa, c.total AS importe, c.motivo_cierre AS motivo,
            c.cerrada_at, u.nombre AS mozo
     FROM cuentas c
     LEFT JOIN mesas m ON m.id = c.mesa_id
     LEFT JOIN usuarios u ON u.id = c.mozo_id
     WHERE c.estado = 'perdida' AND DATE(c.cerrada_at) BETWEEN ? AND ?
     ORDER BY c.cerrada_at DESC`,
    [r.desde, r.hasta]
  );

  const suma = (filas: { importe?: unknown }[]) =>
    filas.reduce((a, f) => a + Number(f.importe ?? 0), 0).toFixed(2);

  return {
    devoluciones,
    anulaciones,
    no_cobradas: noCobradas,
    total_devuelto: suma(devoluciones as { importe: unknown }[]),
    total_anulado: suma(anulaciones as { importe: unknown }[]),
    total_no_cobrado: suma(noCobradas as { importe: unknown }[]),
  };
}

/**
 * Si "sin cebolla" se escribió 40 veces este mes, al dueño le falta un
 * modificador. El sistema le dice cuál crear.
 */
export async function notasFrecuentes(r: Rango, limite = 30) {
  return consultar(
    pool,
    `SELECT LOWER(TRIM(i.nota)) AS nota, COUNT(*) AS veces
     FROM cuenta_items i JOIN cuentas c ON c.id = i.cuenta_id
     WHERE i.nota IS NOT NULL AND TRIM(i.nota) <> ''
       AND DATE(c.abierta_at) BETWEEN ? AND ?
     GROUP BY nota HAVING veces > 1 ORDER BY veces DESC LIMIT ?`,
    [r.desde, r.hasta, limite]
  );
}

/** Diferencias de caja por turno: la otra vía de fuga. */
export async function turnosCerrados(r: Rango) {
  return consultar(
    pool,
    `SELECT t.id, t.abierto_at, t.cerrado_at, t.fondo_inicial, t.efectivo_esperado,
            t.total_declarado, t.diferencia, t.nota,
            ua.nombre AS abrio, uc.nombre AS cerro
     FROM caja_turnos t
     JOIN usuarios ua ON ua.id = t.usuario_apertura
     LEFT JOIN usuarios uc ON uc.id = t.usuario_cierre
     WHERE t.cerrado_at IS NOT NULL AND DATE(t.cerrado_at) BETWEEN ? AND ?
     ORDER BY t.cerrado_at DESC`,
    [r.desde, r.hasta]
  );
}
