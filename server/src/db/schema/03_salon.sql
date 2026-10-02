-- Salón: mesas, uniones y reservas mínimas.

CREATE TABLE mesas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(20) NOT NULL UNIQUE,
  capacidad INT NOT NULL DEFAULT 4,
  pos_x INT NOT NULL DEFAULT 0,
  pos_y INT NOT NULL DEFAULT 0,
  -- Tamaño y forma con que se dibuja en el plano. Van guardados y no
  -- deducidos de la capacidad porque el encargado los estira a mano hasta
  -- que el dibujo se parece a la sala: una mesa de 6 contra la pared es
  -- larga y angosta, y una redonda de 6 en el medio es otra cosa.
  ancho INT NOT NULL DEFAULT 140,
  alto INT NOT NULL DEFAULT 96,
  forma ENUM('cuadrada','rectangular','redonda') NOT NULL DEFAULT 'rectangular',
  -- unida_a apunta SIEMPRE a una mesa principal (sin cadenas)
  unida_a INT NULL,
  activa TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_mesa_union FOREIGN KEY (unida_a) REFERENCES mesas(id) ON DELETE SET NULL,
  INDEX idx_mesa_union (unida_a)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/**
 * Lo que hay en el salón además de las mesas: la barra, la recepción, la
 * puerta, la cocina. No son mesas —no se ocupan ni se cobran— pero sin ellas
 * el plano no se parece a la sala y el mozo nuevo no se ubica.
 */
CREATE TABLE salon_zonas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(30) NOT NULL,
  pos_x INT NOT NULL DEFAULT 0,
  pos_y INT NOT NULL DEFAULT 0,
  ancho INT NOT NULL DEFAULT 160,
  alto INT NOT NULL DEFAULT 80,
  -- `area` se dibuja como un bloque (la barra, la cocina); `puerta` como una
  -- marca finita en la pared (entrada, salida).
  tipo ENUM('area','puerta') NOT NULL DEFAULT 'area',
  activa TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE reservas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mesa_id INT NOT NULL,
  nombre VARCHAR(80) NOT NULL,
  telefono VARCHAR(30) NULL,
  personas INT NOT NULL DEFAULT 2,
  fecha_hora DATETIME NOT NULL,
  estado ENUM('pendiente','consumida','cancelada') NOT NULL DEFAULT 'pendiente',
  nota VARCHAR(255) NULL,
  creado_por INT NULL,
  creado_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reserva_mesa FOREIGN KEY (mesa_id) REFERENCES mesas(id),
  INDEX idx_reserva_fecha (fecha_hora, estado),
  INDEX idx_reserva_mesa (mesa_id, estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
