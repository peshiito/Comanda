/**
 * Todo lo que hace falta para imprimir un comprobante, en una sola consulta.
 *
 * Va junto y no repartido en tres llamadas porque la pantalla de impresión
 * tiene que abrir, pintar y disparar el diálogo del navegador sin parpadear:
 * si los datos llegan en tandas, el usuario ve el documento armarse a pedazos
 * o peor, imprime uno a medio cargar.
 */
import { consultar, consultarUna, pool } from '../../db/pool.js';
import { noEncontrado } from '../../utils/errores.js';
import { leerConfig } from '../../servicios/config.js';
import { aPesos } from '../../utils/dinero.js';
import { calcularImpuestos } from '../fiscal/calculo.js';
import { itemsDeCuenta } from '../cuentas/items.js';

interface FilaCuenta {
  id: number;
  tipo: string;
  estado: string;
  mesa: string | null;
  referencia: string | null;
  mozo: string | null;
  comensales: number;
  subtotal: string;
  cubierto_total: string;
  descuento: string;
  descuento_motivo: string | null;
  total: string;
  pagado: string;
  propina: string;
  abierta_at: string;
  cerrada_at: string | null;
}

export async function documentoDeCuenta(cuentaId: number) {
  const cuenta = await consultarUna<FilaCuenta>(
    pool,
    `SELECT c.id, c.tipo, c.estado, m.nombre AS mesa, c.referencia,
            u.nombre AS mozo, c.comensales, c.subtotal, c.cubierto_total,
            c.descuento, c.descuento_motivo, c.total, c.pagado, c.propina,
            c.abierta_at, c.cerrada_at
     FROM cuentas c
     LEFT JOIN mesas m ON m.id = c.mesa_id
     LEFT JOIN usuarios u ON u.id = c.mozo_id
     WHERE c.id = ?`,
    [cuentaId]
  );
  if (!cuenta) throw noEncontrado('Cuenta no encontrada');

  const [cfg, items, pagos, comprobantes, impuestos] = await Promise.all([
    leerConfig(),
    itemsDeCuenta(cuentaId),
    // El cajero no está en `cuentas`: es quien registró el pago.
    consultar<{
      medio: string; monto: string; propina: string;
      recibido: string | null; vuelto: string | null;
      creado_at: string; cajero: string | null;
    }>(
      pool,
      `SELECT p.medio, p.monto, p.propina, p.recibido, p.vuelto, p.creado_at,
              u.nombre AS cajero
       FROM pagos p LEFT JOIN usuarios u ON u.id = p.usuario_id
       WHERE p.cuenta_id = ? ORDER BY p.id`,
      [cuentaId]
    ),
    consultar<Record<string, unknown>>(
      pool,
      `SELECT id, tipo, punto_venta, numero, doc_tipo, doc_nro, receptor,
              neto, iva, total, estado, cae, cae_vto, qr_payload, creado_at
       FROM comprobantes WHERE cuenta_id = ? ORDER BY id`,
      [cuentaId]
    ),
    calcularImpuestos(cuentaId),
  ]);

  return {
    local: {
      nombre: cfg.nombre_local,
      direccion: cfg.direccion_local,
      localidad: cfg.localidad_local,
      cuit: cfg.cuit_local,
      ingresos_brutos: cfg.ingresos_brutos,
      condicion_iva: cfg.condicion_iva,
      inicio_actividades: cfg.inicio_actividades,
      pie: cfg.pie_ticket,
    },
    cuenta: {
      ...cuenta,
      // Sólo lo que de verdad se cobra: lo anulado y lo devuelto no se imprime.
      items: items.filter((i) => i.estado === 'activo'),
    },
    pagos,
    comprobantes,
    impuestos: {
      neto: aPesos(impuestos.neto),
      iva: aPesos(impuestos.iva),
      total: aPesos(impuestos.total),
      por_alicuota: impuestos.por_alicuota.map((a) => ({
        alicuota: a.alicuota,
        base: aPesos(a.base),
        iva: aPesos(a.iva),
      })),
    },
  };
}
