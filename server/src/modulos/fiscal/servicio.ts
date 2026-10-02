import { consultar, ejecutar, pool } from '../../db/pool.js';
import { env } from '../../config/env.js';
import { aPesos } from '../../utils/dinero.js';
import { auditar } from '../../servicios/auditoria.js';
import { calcularImpuestos } from './calculo.js';
import { driverTicket } from './driver-ticket.js';
import { driverArca } from './driver-arca.js';
import type { DriverFiscal, TipoComprobante } from './tipos.js';
import type { UsuarioToken } from '../../types/express.js';

function driver(): DriverFiscal {
  return env.FISCAL_DRIVER === 'arca' ? driverArca : driverTicket;
}

export interface DatosReceptor {
  tipo: TipoComprobante;
  doc_tipo?: string | null;
  doc_nro?: string | null;
  receptor?: string | null;
}

/**
 * Emite el comprobante de una cuenta. Nunca bloquea el cobro: si el driver no
 * puede autorizar, el comprobante queda 'pendiente' y la venta sigue cerrada.
 */
export async function emitirComprobante(
  cuentaId: number,
  datos: DatosReceptor,
  actor: UsuarioToken
) {
  const impuestos = await calcularImpuestos(cuentaId);
  const solicitud = {
    cuenta_id: cuentaId,
    tipo: datos.tipo,
    doc_tipo: datos.doc_tipo ?? null,
    doc_nro: datos.doc_nro ?? null,
    receptor: datos.receptor ?? null,
    ...impuestos,
  };

  let resultado;
  try {
    resultado = await driver().emitir(solicitud);
  } catch (error) {
    resultado = {
      punto_venta: env.FISCAL_PUNTO_VENTA,
      numero: 0,
      estado: 'error' as const,
      error: String((error as Error).message).slice(0, 250),
    };
  }

  const res = await ejecutar(
    pool,
    `INSERT INTO comprobantes
       (cuenta_id, tipo, punto_venta, numero, doc_tipo, doc_nro, receptor,
        neto, iva, total, estado, cae, cae_vto, qr_payload, error, usuario_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      cuentaId, datos.tipo, resultado.punto_venta, resultado.numero,
      solicitud.doc_tipo, solicitud.doc_nro, solicitud.receptor,
      aPesos(impuestos.neto), aPesos(impuestos.iva), aPesos(impuestos.total),
      resultado.estado, resultado.cae ?? null, resultado.cae_vto ?? null,
      resultado.qr_payload ?? null, resultado.error ?? null, actor.id,
    ]
  );

  await auditar({
    actor, accion: 'comprobante_emitido', entidad: 'comprobante', entidad_id: res.insertId,
    datos: {
      cuenta_id: cuentaId, tipo: datos.tipo, numero: resultado.numero,
      estado: resultado.estado, total: aPesos(impuestos.total), driver: driver().nombre,
    },
  });

  return {
    id: res.insertId,
    tipo: datos.tipo,
    ...resultado,
    neto: aPesos(impuestos.neto),
    iva: aPesos(impuestos.iva),
    total: aPesos(impuestos.total),
    por_alicuota: impuestos.por_alicuota.map((a) => ({
      alicuota: a.alicuota,
      base: aPesos(a.base),
      iva: aPesos(a.iva),
    })),
  };
}

/** Cola de reintento: los comprobantes que quedaron sin autorizar. */
export async function comprobantesPendientes() {
  return consultar(
    pool,
    `SELECT c.id, c.cuenta_id, c.tipo, c.punto_venta, c.numero, c.total, c.estado,
            c.error, c.intentos, c.creado_at
     FROM comprobantes c WHERE c.estado IN ('pendiente','error')
     ORDER BY c.creado_at LIMIT 100`
  );
}

export function driverActivo(): string {
  return driver().nombre;
}
