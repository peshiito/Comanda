import { env } from '../../config/env.js';
import { siguienteNumero } from './driver-ticket.js';
import type { DriverFiscal, ResultadoComprobante, SolicitudComprobante } from './tipos.js';

/**
 * Driver ARCA (ex AFIP) — WSAA + WSFEv1.
 *
 * PENDIENTE DE IMPLEMENTAR: requiere el certificado X.509 del local y su CUIT
 * dados de alta en "Administración de certificados digitales", más el punto de
 * venta tipo Web Services y la asociación del servicio wsfe en el
 * Administrador de Relaciones. Nada de eso se puede generar desde acá: son
 * datos del contribuyente.
 *
 * Mientras no esté, la venta SE CIERRA IGUAL y el comprobante queda en estado
 * 'pendiente' para que el reintento lo complete cuando haya credenciales.
 * Eso es a propósito: un corte de internet o un problema en ARCA no puede
 * dejar al local sin poder cobrar.
 */
export const driverArca: DriverFiscal = {
  nombre: 'arca',
  async emitir(solicitud: SolicitudComprobante): Promise<ResultadoComprobante> {
    const pv = env.FISCAL_PUNTO_VENTA;
    // El número lo dicta ARCA (CompUltimoAutorizado); hasta tener credenciales
    // se reserva uno local para no dejar el comprobante sin identificar.
    const numero = await siguienteNumero(`comprobante_pv${pv}_${solicitud.tipo}`);
    return {
      punto_venta: pv,
      numero,
      estado: 'pendiente',
      error: 'ARCA sin credenciales configuradas: comprobante en cola de reintento',
    };
  },
};
