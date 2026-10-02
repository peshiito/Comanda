-- Cuentas (ventas), ítems con precio congelado y comandas a cocina.
-- Una mesa es un contenedor: puede tener varias cuentas abiertas a la vez.

CREATE TABLE cuentas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tipo ENUM('salon','take_away') NOT NULL DEFAULT 'salon',
  mesa_id INT NULL,
  referencia VARCHAR(60) NULL,
  mozo_id INT NULL,
  abierta_por INT NOT NULL,
  comensales INT NOT NULL DEFAULT 0,
  estado ENUM('abierta','por_cobrar','cerrada','perdida','fusionada') NOT NULL DEFAULT 'abierta',
  fusionada_en INT NULL,
  cubierto_unitario DECIMAL(12,2) NOT NULL DEFAULT 0,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  cubierto_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  descuento DECIMAL(12,2) NOT NULL DEFAULT 0,
  descuento_motivo VARCHAR(255) NULL,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  pagado DECIMAL(12,2) NOT NULL DEFAULT 0,
  propina DECIMAL(12,2) NOT NULL DEFAULT 0,
  motivo_cierre VARCHAR(255) NULL,
  version INT NOT NULL DEFAULT 0,
  abierta_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  cuenta_pedida_at DATETIME(3) NULL,
  cerrada_at DATETIME(3) NULL,
  CONSTRAINT fk_cuenta_mesa FOREIGN KEY (mesa_id) REFERENCES mesas(id),
  CONSTRAINT fk_cuenta_mozo FOREIGN KEY (mozo_id) REFERENCES usuarios(id),
  CONSTRAINT fk_cuenta_abierta FOREIGN KEY (abierta_por) REFERENCES usuarios(id),
  CONSTRAINT fk_cuenta_fusion FOREIGN KEY (fusionada_en) REFERENCES cuentas(id),
  INDEX idx_cuenta_estado (estado, mesa_id),
  INDEX idx_cuenta_abierta (abierta_at),
  INDEX idx_cuenta_cerrada (cerrada_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE comandas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cuenta_id INT NOT NULL,
  mesa_label VARCHAR(40) NOT NULL,
  estado ENUM('pendiente','terminada') NOT NULL DEFAULT 'pendiente',
  urgente TINYINT(1) NOT NULL DEFAULT 0,
  nota VARCHAR(255) NULL,
  enviada_por INT NOT NULL,
  enviada_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  terminada_por INT NULL,
  terminada_at DATETIME(3) NULL,
  -- el mozo apaga el aviso de "plato listo" con un toque: es la forma más
  -- liviana de saber que se retiró, sin pedirle nada al cocinero
  retirado_por INT NULL,
  retirado_at DATETIME(3) NULL,
  CONSTRAINT fk_comanda_cuenta FOREIGN KEY (cuenta_id) REFERENCES cuentas(id),
  CONSTRAINT fk_comanda_envio FOREIGN KEY (enviada_por) REFERENCES usuarios(id),
  INDEX idx_comanda_estado (estado, enviada_at),
  INDEX idx_comanda_cuenta (cuenta_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE cuenta_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  cuenta_id INT NOT NULL,
  comanda_id INT NULL,
  producto_id INT NULL,
  variante_id INT NULL,
  nombre_snapshot VARCHAR(200) NOT NULL,
  precio_snapshot DECIMAL(12,2) NOT NULL,
  iva_snapshot DECIMAL(5,2) NOT NULL DEFAULT 21.00,
  cantidad INT NOT NULL DEFAULT 1,
  mods_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_linea DECIMAL(12,2) NOT NULL DEFAULT 0,
  nota VARCHAR(255) NULL,
  estado ENUM('activo','anulado','devuelto') NOT NULL DEFAULT 'activo',
  -- Congelado como el precio: si mañana el producto cambia de criterio,
  -- este ítem ya fue servido de una manera y no se reescribe.
  de_barra TINYINT(1) NOT NULL DEFAULT 0,
  es_reposicion TINYINT(1) NOT NULL DEFAULT 0,
  cargado_por INT NOT NULL,
  autor_pedido INT NULL,
  resuelto_por INT NULL,
  motivo VARCHAR(255) NULL,
  resuelto_at DATETIME(3) NULL,
  creado_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_item_cuenta FOREIGN KEY (cuenta_id) REFERENCES cuentas(id) ON DELETE CASCADE,
  CONSTRAINT fk_item_comanda FOREIGN KEY (comanda_id) REFERENCES comandas(id),
  CONSTRAINT fk_item_prod FOREIGN KEY (producto_id) REFERENCES productos(id),
  INDEX idx_item_cuenta (cuenta_id, estado),
  INDEX idx_item_comanda (comanda_id),
  INDEX idx_item_prod (producto_id, creado_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE cuenta_item_mods (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  item_id BIGINT NOT NULL,
  opcion_id INT NULL,
  grupo_nombre VARCHAR(80) NOT NULL,
  nombre_snapshot VARCHAR(80) NOT NULL,
  delta_snapshot DECIMAL(12,2) NOT NULL DEFAULT 0,
  -- Cuántas de este sabor. En los grupos normales siempre es 1.
  cantidad INT NOT NULL DEFAULT 1,
  CONSTRAINT fk_mod_item FOREIGN KEY (item_id) REFERENCES cuenta_items(id) ON DELETE CASCADE,
  INDEX idx_mod_item (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
