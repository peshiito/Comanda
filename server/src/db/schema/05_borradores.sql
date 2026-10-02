-- Borrador del mozo: su libreta. Vive en el servidor (no en el teléfono),
-- es privado hasta que lo pasa a caja, y se borra cuando la mesa queda libre.

CREATE TABLE borradores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mesa_id INT NULL,
  cuenta_id INT NULL,
  mozo_id INT NOT NULL,
  estado ENUM('privado','pasado','consumido') NOT NULL DEFAULT 'privado',
  nota VARCHAR(255) NULL,
  pago_previsto VARCHAR(40) NULL,
  creado_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  pasado_at DATETIME(3) NULL,
  CONSTRAINT fk_borr_mesa FOREIGN KEY (mesa_id) REFERENCES mesas(id) ON DELETE CASCADE,
  CONSTRAINT fk_borr_cuenta FOREIGN KEY (cuenta_id) REFERENCES cuentas(id) ON DELETE CASCADE,
  CONSTRAINT fk_borr_mozo FOREIGN KEY (mozo_id) REFERENCES usuarios(id),
  INDEX idx_borr_estado (estado, mesa_id),
  INDEX idx_borr_mozo (mozo_id, estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Los modificadores del borrador van en JSON: es un apunte, no contabilidad.
CREATE TABLE borrador_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  borrador_id INT NOT NULL,
  producto_id INT NOT NULL,
  variante_id INT NULL,
  cantidad INT NOT NULL DEFAULT 1,
  nota VARCHAR(255) NULL,
  mods JSON NULL,
  -- [{opcion_id, cantidad}] para los grupos por cantidad (los sabores).
  mods_cant JSON NULL,
  creado_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_bi_borr FOREIGN KEY (borrador_id) REFERENCES borradores(id) ON DELETE CASCADE,
  CONSTRAINT fk_bi_prod FOREIGN KEY (producto_id) REFERENCES productos(id),
  INDEX idx_bi_borr (borrador_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
