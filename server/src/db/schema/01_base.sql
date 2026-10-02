-- Usuarios, auditoría y configuración del local.

CREATE TABLE usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  email VARCHAR(160) NULL UNIQUE,
  password_hash VARCHAR(255) NULL,
  pin_hash VARCHAR(255) NULL,
  rol ENUM('encargado','caja','mozo','cocina') NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  creado_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_usuarios_rol (rol, activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Append-only: nunca se hace UPDATE ni DELETE sobre esta tabla.
CREATE TABLE auditoria (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  actor_id INT NULL,
  actor_nombre VARCHAR(80) NULL,
  actor_rol VARCHAR(20) NULL,
  accion VARCHAR(60) NOT NULL,
  entidad VARCHAR(40) NULL,
  entidad_id BIGINT NULL,
  motivo VARCHAR(255) NULL,
  datos JSON NULL,
  creado_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_auditoria_fecha (creado_at),
  INDEX idx_auditoria_accion (accion, creado_at),
  INDEX idx_auditoria_actor (actor_id, creado_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE config (
  clave VARCHAR(60) PRIMARY KEY,
  valor VARCHAR(255) NOT NULL,
  descripcion VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Contadores con bloqueo para numeración sin huecos (comprobantes).
CREATE TABLE contadores (
  clave VARCHAR(60) PRIMARY KEY,
  valor INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
