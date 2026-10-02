-- Carta: categorías, productos, variantes y grupos de modificadores reutilizables.

CREATE TABLE categorias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(60) NOT NULL,
  orden INT NOT NULL DEFAULT 0,
  activa TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE productos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  categoria_id INT NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  descripcion VARCHAR(400) NULL,
  codigo_corto VARCHAR(8) NULL UNIQUE,
  precio DECIMAL(12,2) NOT NULL DEFAULT 0,
  costo DECIMAL(12,2) NOT NULL DEFAULT 0,
  iva_alicuota DECIMAL(5,2) NOT NULL DEFAULT 21.00,
  -- agotado_hoy se limpia solo al abrir turno de caja; baja queda hasta reactivar
  agotado_hoy TINYINT(1) NOT NULL DEFAULT 0,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  stock_restante INT NULL,
  visible_qr TINYINT(1) NOT NULL DEFAULT 1,
  -- Lo que sale de la barra (bebidas, vinos, cerveza) no pasa por cocina:
  -- el mozo lo alcanza directo de la heladera y el ítem entra a la cuenta
  -- ya entregado. Es por producto y no por categoría porque hay
  -- excepciones: un licuado es bebida pero hay que prepararlo.
  va_a_cocina TINYINT(1) NOT NULL DEFAULT 1,
  foto VARCHAR(255) NULL,
  -- De dónde salió la foto y con qué licencia. Va en la base y no sólo en
  -- un archivo suelto para que la atribución sobreviva a un backup.
  foto_credito VARCHAR(400) NULL,
  apto_celiaco TINYINT(1) NOT NULL DEFAULT 0,
  apto_vegetariano TINYINT(1) NOT NULL DEFAULT 0,
  apto_vegano TINYINT(1) NOT NULL DEFAULT 0,
  horario_desde TIME NULL,
  horario_hasta TIME NULL,
  orden INT NOT NULL DEFAULT 0,
  creado_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_prod_cat FOREIGN KEY (categoria_id) REFERENCES categorias(id),
  INDEX idx_prod_cat (categoria_id, orden),
  INDEX idx_prod_busqueda (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Precio absoluto propio: la media porción no es la mitad exacta.
CREATE TABLE producto_variantes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  producto_id INT NOT NULL,
  nombre VARCHAR(60) NOT NULL,
  precio DECIMAL(12,2) NOT NULL,
  orden INT NOT NULL DEFAULT 0,
  activa TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_var_prod FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
  INDEX idx_var_prod (producto_id, orden)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE modificador_grupos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  obligatorio TINYINT(1) NOT NULL DEFAULT 0,
  min_sel INT NOT NULL DEFAULT 0,
  max_sel INT NOT NULL DEFAULT 1,
  -- Con por_cantidad el grupo deja de ser "elegí una" y pasa a ser
  -- "repartí la cantidad": una docena de empanadas se carga como una sola
  -- línea con 4 de carne, 4 de jamón y 4 de humita. min_sel y max_sel
  -- siguen contando cuántos sabores distintos se pueden elegir.
  por_cantidad TINYINT(1) NOT NULL DEFAULT 0,
  activo TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE modificador_opciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  grupo_id INT NOT NULL,
  nombre VARCHAR(80) NOT NULL,
  delta_precio DECIMAL(12,2) NOT NULL DEFAULT 0,
  orden INT NOT NULL DEFAULT 0,
  activa TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_opc_grupo FOREIGN KEY (grupo_id) REFERENCES modificador_grupos(id) ON DELETE CASCADE,
  INDEX idx_opc_grupo (grupo_id, orden)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Los grupos se enganchan por referencia: "Punto de carne" existe una sola vez.
CREATE TABLE producto_grupos (
  producto_id INT NOT NULL,
  grupo_id INT NOT NULL,
  orden INT NOT NULL DEFAULT 0,
  PRIMARY KEY (producto_id, grupo_id),
  CONSTRAINT fk_pg_prod FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
  CONSTRAINT fk_pg_grupo FOREIGN KEY (grupo_id) REFERENCES modificador_grupos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE precio_historial (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  producto_id INT NOT NULL,
  variante_id INT NULL,
  precio_anterior DECIMAL(12,2) NOT NULL,
  precio_nuevo DECIMAL(12,2) NOT NULL,
  usuario_id INT NULL,
  creado_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ph_prod (producto_id, creado_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
