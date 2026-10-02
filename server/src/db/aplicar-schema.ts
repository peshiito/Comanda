import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { env } from '../config/env.js';

const aqui = dirname(fileURLToPath(import.meta.url));
const CARPETA = join(aqui, 'schema');

async function main(): Promise<void> {
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    multipleStatements: true,
  });

  console.log(`Aplicando schema en ${env.DB_NAME}@${env.DB_HOST}:${env.DB_PORT}`);

  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  const [tablas] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT table_name AS t FROM information_schema.tables WHERE table_schema = ?`,
    [env.DB_NAME]
  );
  for (const fila of tablas) {
    await conn.query(`DROP TABLE IF EXISTS \`${fila.t}\``);
  }
  if (tablas.length) console.log(`  ${tablas.length} tabla(s) anterior(es) eliminada(s)`);
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');

  const archivos = (await readdir(CARPETA)).filter((f) => f.endsWith('.sql')).sort();
  for (const archivo of archivos) {
    const sql = await readFile(join(CARPETA, archivo), 'utf8');
    await conn.query(sql);
    console.log(`  ✔ ${archivo}`);
  }

  await conn.end();
  console.log('Schema aplicado.');
}

main().catch((error) => {
  console.error('Falló la aplicación del schema:', error);
  process.exit(1);
});
