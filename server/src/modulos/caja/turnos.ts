import { consultar, consultarUna, ejecutar, pool } from '../../db/pool.js';
import { conflicto, noEncontrado } from '../../utils/errores.js';
import { aCentavos, aPesos, sumar } from '../../utils/dinero.js';
import { auditar } from '../../servicios/auditoria.js';
import { emitir } from '../../sockets/index.js';
import { limpiarAgotadosDelDia } from '../carta/disponibilidad.js';
import type { UsuarioToken } from '../../types/express.js';

export interface Turno {
  id: number;
  usuario_apertura: number;
  usuario: string;
  fondo_inicial: string;
  abierto_at: string;
}

export async function turnoAbierto(): Promise<Turno | null> {
  return consultarUna<Turno>(
    pool,
    `SELECT t.id, t.usuario_apertura, u.nombre AS usuario, t.fondo_inicial, t.abierto_at
     FROM caja_turnos t JOIN usuarios u ON u.id = t.usuario_apertura
     WHERE t.cerrado_at IS NULL ORDER BY t.id DESC LIMIT 1`
  );
}

export async function exigirTurnoAbierto(): Promise<Turno> {
  const t = await turnoAbierto();
  if (!t) throw conflicto('No hay turno de caja abierto. Abrí la caja primero.', 'sin_turno');
  return t;
}

/** Al abrir turno se limpian los agotados del día anterior. */
export async function abrirTurno(fondoInicial: number, actor: UsuarioToken) {
  if (await turnoAbierto()) throw conflicto('Ya hay un turno de caja abierto');

  const res = await ejecutar(
    pool,
    'INSERT INTO caja_turnos (usuario_apertura, fondo_inicial) VALUES (?, ?)',
    [actor.id, aPesos(aCentavos(fondoInicial))]
  );
  const limpiados = await limpiarAgotadosDelDia();

  await auditar({
    actor, accion: 'turno_abierto', entidad: 'caja_turno', entidad_id: res.insertId,
    datos: { fondo_inicial: fondoInicial, agotados_limpiados: limpiados },
  });
  emitir(['caja', 'salon', 'cocina'], 'caja:turno', { abierto: true, turno_id: res.insertId });
  return { id: res.insertId, agotados_limpiados: limpiados };
}

/** Una fila por medio de pago, con las ventas y los movimientos cruzados. */
export interface LineaMedio {
  medio: string;
  ventas: string;
  propinas: string;
  operaciones: number;
  ingresos: string;
  egresos: string;
  /** ventas + propinas + ingresos − egresos. Lo que ese medio dejó neto. */
  neto: string;
}

export interface Arqueo {
  turno_id: number;
  fondo_inicial: string;
  por_medio: LineaMedio[];
  ingresos: string;
  egresos: string;
  retiros: string;
  /** Lo que tiene que haber físicamente en el cajón. */
  efectivo_esperado: string;
  /** Ventas cobradas por fuera del efectivo: tarjetas, transferencias, QR. */
  cobrado_electronico: string;
  ventas_totales: string;
  propinas_totales: string;
  movimientos_por_categoria: { categoria: string; tipo: string; monto: string }[];
  cuentas_abiertas: { id: number; mesa: string | null; total: string }[];
}

export async function arqueo(turnoId?: number): Promise<Arqueo> {
  const turno = turnoId
    ? await consultarUna<{ id: number; fondo_inicial: string }>(
        pool, 'SELECT id, fondo_inicial FROM caja_turnos WHERE id = ?', [turnoId]
      )
    : await turnoAbierto();
  if (!turno) throw noEncontrado('Turno no encontrado');

  const porMedio = await consultar<{ medio: string; monto: string; propina: string; operaciones: number }>(
    pool,
    `SELECT medio, SUM(monto) AS monto, SUM(propina) AS propina, COUNT(*) AS operaciones
     FROM pagos WHERE turno_id = ? GROUP BY medio`,
    [turno.id]
  );
  // Cruzado por tipo Y medio: sin el medio no se puede saber qué salió del
  // cajón y qué salió del banco.
  const movs = await consultar<{ tipo: string; medio: string; monto: string }>(
    pool,
    `SELECT tipo, medio, SUM(monto) AS monto FROM caja_movimientos
     WHERE turno_id = ? GROUP BY tipo, medio`,
    [turno.id]
  );
  const porCategoria = await consultar<{ categoria: string; tipo: string; monto: string }>(
    pool,
    `SELECT categoria, tipo, SUM(monto) AS monto FROM caja_movimientos
     WHERE turno_id = ? GROUP BY categoria, tipo ORDER BY SUM(monto) DESC`,
    [turno.id]
  );
  const abiertas = await consultar<{ id: number; mesa: string | null; total: string }>(
    pool,
    `SELECT c.id, m.nombre AS mesa, c.total FROM cuentas c
     LEFT JOIN mesas m ON m.id = c.mesa_id
     WHERE c.estado IN ('abierta','por_cobrar') ORDER BY c.abierta_at`
  );

  /** Suma de movimientos, opcionalmente filtrando por medio. */
  const movimiento = (tipo: string, medio?: string) =>
    sumar(
      ...movs
        .filter((m) => m.tipo === tipo && (medio === undefined || m.medio === medio))
        .map((m) => aCentavos(m.monto))
    );

  // Todos los medios que aparecieron, ya sea cobrando o moviendo plata.
  const medios = [...new Set([...porMedio.map((p) => p.medio), ...movs.map((m) => m.medio)])];

  const lineas: LineaMedio[] = medios.map((medio) => {
    const venta = porMedio.find((p) => p.medio === medio);
    const ventas = aCentavos(venta?.monto ?? 0);
    const propinas = aCentavos(venta?.propina ?? 0);
    const ingresos = movimiento('ingreso', medio);
    // El retiro también sale por un medio: si se depositó en el banco, salió
    // del cajón; si fue una transferencia, salió de la cuenta.
    const egresos = sumar(movimiento('egreso', medio), movimiento('retiro', medio));
    return {
      medio,
      ventas: aPesos(ventas),
      propinas: aPesos(propinas),
      operaciones: venta?.operaciones ?? 0,
      ingresos: aPesos(ingresos),
      egresos: aPesos(egresos),
      neto: aPesos(sumar(ventas, propinas, ingresos, -egresos)),
    };
  });

  const efectivo = lineas.find((l) => l.medio === 'efectivo');
  // El fondo inicial es lo único que ya estaba en el cajón antes del turno.
  const esperado = sumar(aCentavos(turno.fondo_inicial), aCentavos(efectivo?.neto ?? 0));
  // Lo COBRADO por medios que no son efectivo, sin restarle las salidas: si
  // le restara los sueldos pagados por transferencia daría negativo y no
  // querría decir nada. Las salidas se leen en la tabla por medio.
  const electronico = sumar(
    ...lineas
      .filter((l) => l.medio !== 'efectivo')
      .map((l) => sumar(aCentavos(l.ventas), aCentavos(l.propinas)))
  );

  return {
    turno_id: turno.id,
    fondo_inicial: turno.fondo_inicial,
    por_medio: lineas,
    ingresos: aPesos(movimiento('ingreso')),
    egresos: aPesos(movimiento('egreso')),
    retiros: aPesos(movimiento('retiro')),
    efectivo_esperado: aPesos(esperado),
    cobrado_electronico: aPesos(electronico),
    ventas_totales: aPesos(sumar(...porMedio.map((p) => aCentavos(p.monto)))),
    propinas_totales: aPesos(sumar(...porMedio.map((p) => aCentavos(p.propina)))),
    movimientos_por_categoria: porCategoria,
    cuentas_abiertas: abiertas,
  };
}

/**
 * No se cierra el turno con mesas sin cobrar: si se permite, el arqueo no
 * cuadra nunca y el módulo de caja deja de servir.
 */
export async function cerrarTurno(totalDeclarado: number, nota: string | null, actor: UsuarioToken) {
  const turno = await exigirTurnoAbierto();
  const datos = await arqueo(turno.id);

  if (datos.cuentas_abiertas.length) {
    throw conflicto(
      `Quedan ${datos.cuentas_abiertas.length} cuenta(s) sin cobrar. Cobralas o marcalas como pérdida antes de cerrar.`,
      'cuentas_abiertas'
    );
  }

  const declarado = aCentavos(totalDeclarado);
  const diferencia = declarado - aCentavos(datos.efectivo_esperado);

  await ejecutar(
    pool,
    `UPDATE caja_turnos SET cerrado_at = NOW(3), usuario_cierre = ?, efectivo_esperado = ?,
       total_declarado = ?, diferencia = ?, nota = ? WHERE id = ?`,
    [actor.id, datos.efectivo_esperado, aPesos(declarado), aPesos(diferencia), nota, turno.id]
  );

  await auditar({
    actor, accion: 'turno_cerrado', entidad: 'caja_turno', entidad_id: turno.id,
    motivo: nota,
    datos: {
      esperado: datos.efectivo_esperado, declarado: aPesos(declarado),
      diferencia: aPesos(diferencia), ventas: datos.ventas_totales,
    },
  });
  emitir(['caja', 'salon', 'cocina'], 'caja:turno', { abierto: false, turno_id: turno.id });
  return { ...datos, total_declarado: aPesos(declarado), diferencia: aPesos(diferencia) };
}

export async function registrarMovimiento(
  datos: {
    tipo: 'ingreso' | 'egreso' | 'retiro';
    medio: string;
    categoria: string;
    monto: number;
    motivo: string;
  },
  actor: UsuarioToken
) {
  const { tipo, medio, categoria, monto, motivo } = datos;
  const turno = await exigirTurnoAbierto();
  const res = await ejecutar(
    pool,
    `INSERT INTO caja_movimientos
       (turno_id, tipo, medio, categoria, monto, motivo, usuario_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [turno.id, tipo, medio, categoria, aPesos(aCentavos(monto)), motivo, actor.id]
  );
  await auditar({
    actor, accion: `caja_${tipo}`, entidad: 'caja_movimiento', entidad_id: res.insertId,
    motivo, datos: { monto, medio, categoria },
  });
  emitir('caja', 'caja:movimiento', { turno_id: turno.id });
  return { id: res.insertId };
}

export async function movimientosDelTurno(turnoId?: number) {
  const turno = turnoId ?? (await exigirTurnoAbierto()).id;
  return consultar(
    pool,
    `SELECT m.id, m.tipo, m.medio, m.categoria, m.monto, m.motivo, m.creado_at,
            u.nombre AS usuario
     FROM caja_movimientos m JOIN usuarios u ON u.id = m.usuario_id
     WHERE m.turno_id = ? ORDER BY m.id DESC`,
    [turno]
  );
}
