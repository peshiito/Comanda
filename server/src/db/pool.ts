import mysql from 'mysql2/promise';
import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { env } from '../config/env.js';

// decimalNumbers queda en false a propósito: los DECIMAL llegan como string y
// se convierten con utils/dinero.ts para no perder centavos en binario flotante.
export const pool: Pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 12,
  queueLimit: 0,
  charset: 'utf8mb4',
  timezone: 'local',
  dateStrings: false,
  supportBigNumbers: true,
});

export type Fila = RowDataPacket;
export type Ejecutor = Pool | PoolConnection;

/** SELECT que devuelve filas. */
export async function consultar<T = Fila>(
  ejecutor: Ejecutor,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const [filas] = await ejecutor.query<RowDataPacket[]>(sql, params);
  return filas as T[];
}

/** SELECT que devuelve una fila o null. */
export async function consultarUna<T = Fila>(
  ejecutor: Ejecutor,
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const filas = await consultar<T>(ejecutor, sql, params);
  return filas[0] ?? null;
}

/** INSERT / UPDATE / DELETE. */
export async function ejecutar(
  ejecutor: Ejecutor,
  sql: string,
  params: unknown[] = []
): Promise<ResultSetHeader> {
  const [res] = await ejecutor.query<ResultSetHeader>(sql, params);
  return res;
}

/** Transacción con rollback automático ante cualquier error. */
export async function transaccion<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const resultado = await fn(conn);
    await conn.commit();
    return resultado;
  } catch (error) {
    // Si la conexión se cayó, el rollback también falla — y ese error taparía
    // la causa real, que es la que querés leer en el log de una venta.
    try {
      await conn.rollback();
    } catch (fallaRollback) {
      console.error('[db] el rollback también falló', fallaRollback);
    }
    throw error;
  } finally {
    conn.release();
  }
}

export async function cerrarPool(): Promise<void> {
  await pool.end();
}
