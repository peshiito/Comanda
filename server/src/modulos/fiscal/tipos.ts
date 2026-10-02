export type TipoComprobante =
  | 'ticket' | 'factura_a' | 'factura_b' | 'factura_c' | 'nota_credito';

export interface SolicitudComprobante {
  cuenta_id: number;
  tipo: TipoComprobante;
  doc_tipo?: string | null;
  doc_nro?: string | null;
  receptor?: string | null;
  neto: number;
  iva: number;
  total: number;
  por_alicuota: { alicuota: number; base: number; iva: number }[];
}

export interface ResultadoComprobante {
  punto_venta: number;
  numero: number;
  estado: 'emitido' | 'pendiente' | 'error';
  cae?: string | null;
  cae_vto?: string | null;
  qr_payload?: string | null;
  error?: string | null;
}

export interface DriverFiscal {
  nombre: string;
  emitir(solicitud: SolicitudComprobante): Promise<ResultadoComprobante>;
}
