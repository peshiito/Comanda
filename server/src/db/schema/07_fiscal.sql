-- Comprobantes. El driver 'ticket' (no fiscal) numera con la tabla contadores;
-- el driver 'arca' completa cae/cae_vto/qr_payload cuando hay certificado.

CREATE TABLE comprobantes (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  cuenta_id INT NOT NULL,
  tipo ENUM('ticket','factura_a','factura_b','factura_c','nota_credito') NOT NULL,
  punto_venta INT NOT NULL DEFAULT 1,
  numero INT NOT NULL,
  doc_tipo VARCHAR(12) NULL,
  doc_nro VARCHAR(20) NULL,
  receptor VARCHAR(160) NULL,
  neto DECIMAL(12,2) NOT NULL DEFAULT 0,
  iva DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  estado ENUM('emitido','pendiente','error') NOT NULL DEFAULT 'emitido',
  cae VARCHAR(20) NULL,
  cae_vto DATE NULL,
  qr_payload TEXT NULL,
  error VARCHAR(255) NULL,
  intentos INT NOT NULL DEFAULT 0,
  usuario_id INT NULL,
  creado_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_comp_cuenta FOREIGN KEY (cuenta_id) REFERENCES cuentas(id),
  UNIQUE KEY uq_comp_numero (tipo, punto_venta, numero),
  INDEX idx_comp_cuenta (cuenta_id),
  INDEX idx_comp_estado (estado, creado_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
