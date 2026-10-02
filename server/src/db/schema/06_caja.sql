-- Caja: turnos con arqueo, movimientos y pagos idempotentes.

CREATE TABLE caja_turnos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_apertura INT NOT NULL,
  fondo_inicial DECIMAL(12,2) NOT NULL DEFAULT 0,
  abierto_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  usuario_cierre INT NULL,
  cerrado_at DATETIME(3) NULL,
  efectivo_esperado DECIMAL(12,2) NULL,
  total_declarado DECIMAL(12,2) NULL,
  diferencia DECIMAL(12,2) NULL,
  nota VARCHAR(255) NULL,
  CONSTRAINT fk_turno_apertura FOREIGN KEY (usuario_apertura) REFERENCES usuarios(id),
  CONSTRAINT fk_turno_cierre FOREIGN KEY (usuario_cierre) REFERENCES usuarios(id),
  INDEX idx_turno_abierto (cerrado_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE caja_movimientos (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  turno_id INT NOT NULL,
  tipo ENUM('ingreso','egreso','retiro') NOT NULL,
  /**
   * Por dónde salió o entró la plata. Es la diferencia entre que el arqueo
   * del cajón cuadre o no: pagar un sueldo por transferencia NO saca plata
   * del cajón, y antes se la restaba igual.
   */
  medio ENUM('efectivo','debito','credito','transferencia','qr') NOT NULL DEFAULT 'efectivo',
  /**
   * Para agrupar en los reportes. El motivo libre sirve para el detalle
   * ("adelanto a Diego"), pero si el reporte depende de que todos escriban
   * igual, no se puede sumar nada.
   */
  categoria ENUM(
    'mercaderia','sueldo','adelanto','servicio','alquiler','impuesto',
    'mantenimiento','retiro','aporte','otro'
  ) NOT NULL DEFAULT 'otro',
  monto DECIMAL(12,2) NOT NULL,
  motivo VARCHAR(255) NOT NULL,
  usuario_id INT NOT NULL,
  creado_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_mov_turno FOREIGN KEY (turno_id) REFERENCES caja_turnos(id),
  CONSTRAINT fk_mov_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  INDEX idx_mov_turno (turno_id, creado_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE pagos (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  cuenta_id INT NOT NULL,
  turno_id INT NOT NULL,
  medio ENUM('efectivo','debito','credito','transferencia','qr') NOT NULL,
  monto DECIMAL(12,2) NOT NULL,
  propina DECIMAL(12,2) NOT NULL DEFAULT 0,
  recibido DECIMAL(12,2) NULL,
  vuelto DECIMAL(12,2) NULL,
  referencia VARCHAR(80) NULL,
  idempotency_key VARCHAR(80) NOT NULL UNIQUE,
  usuario_id INT NOT NULL,
  creado_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_pago_cuenta FOREIGN KEY (cuenta_id) REFERENCES cuentas(id),
  CONSTRAINT fk_pago_turno FOREIGN KEY (turno_id) REFERENCES caja_turnos(id),
  CONSTRAINT fk_pago_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  INDEX idx_pago_cuenta (cuenta_id),
  INDEX idx_pago_turno (turno_id, medio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
