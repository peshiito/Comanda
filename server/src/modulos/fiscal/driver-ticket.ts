import { consultarUna, ejecutar, transaccion } from '../../db/pool.js';
import { env } from '../../config/env.js';
import type { DriverFiscal, ResultadoComprobante, SolicitudComprobante } from './tipos.js';

/** Numeración sin huecos: el contador se lee con bloqueo dentro de la transacción. */
export async function siguienteNumero(clave: string): Promise<number> {
  return transaccion(async (conn) => {
    await ejecutar(conn, 'INSERT IGNORE INTO contadores (clave, valor) VALUES (?, 0)', [clave]);
    const fila = await consultarUna<{ valor: number }>(
      conn,
      'SELECT valor FROM contadores WHERE clave = ? FOR UPDATE',
      [clave]
    );
    const siguiente = (fila?.valor ?? 0) + 1;
    await ejecutar(conn, 'UPDATE contadores SET valor = ? WHERE clave = ?', [siguiente, clave]);
    return siguiente;
  });
}

/**
 * Ticket no fiscal: el local que no factura igual necesita un comprobante
 * numerado para el cliente y para la auditoría.
 */
export const driverTicket: DriverFiscal = {
  nombre: 'ticket',
  async emitir(solicitud: SolicitudComprobante): Promise<ResultadoComprobante> {
    const pv = env.FISCAL_PUNTO_VENTA;
    const numero = await siguienteNumero(`comprobante_pv${pv}_${solicitud.tipo}`);
    return { punto_venta: pv, numero, estado: 'emitido', cae: null, cae_vto: null, qr_payload: null };
  },
};
