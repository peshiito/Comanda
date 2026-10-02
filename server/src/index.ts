import { createServer } from 'node:http';
import { crearApp } from './app.js';
import { env } from './config/env.js';
import { pool, cerrarPool } from './db/pool.js';
import { iniciarSockets } from './sockets/index.js';

async function main(): Promise<void> {
  // Falla temprano y claro si la base no está levantada.
  try {
    const conn = await pool.getConnection();
    conn.release();
  } catch (error) {
    console.error(
      `No se pudo conectar a MySQL en ${env.DB_HOST}:${env.DB_PORT}. ` +
        'Levantá Docker con: docker compose up -d'
    );
    console.error(String((error as Error).message));
    process.exit(1);
  }

  const app = crearApp();
  const servidor = createServer(app);
  iniciarSockets(servidor);

  servidor.listen(env.PORT, () => {
    console.log(`API escuchando en http://localhost:${env.PORT}`);
    console.log(`Socket.IO listo. Origen permitido: ${env.CORS_ORIGEN}`);
  });

  const apagar = async (senal: string) => {
    console.log(`\n${senal} recibido, cerrando...`);
    servidor.close();
    await cerrarPool();
    process.exit(0);
  };

  process.on('SIGINT', () => void apagar('SIGINT'));
  process.on('SIGTERM', () => void apagar('SIGTERM'));
}

main().catch((error) => {
  console.error('Fallo al iniciar:', error);
  process.exit(1);
});
