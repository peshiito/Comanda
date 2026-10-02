import 'dotenv/config';
import { z } from 'zod';

const esquema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().default(3306),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET debe tener al menos 16 caracteres'),
  JWT_EXPIRA: z.string().default('12h'),
  CORS_ORIGEN: z.string().default('http://localhost:5173'),
  FISCAL_DRIVER: z.enum(['ticket', 'arca']).default('ticket'),
  FISCAL_PUNTO_VENTA: z.coerce.number().default(1),
});

const parseo = esquema.safeParse(process.env);

if (!parseo.success) {
  console.error('Error de configuración (.env):');
  for (const issue of parseo.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parseo.data;
export const esProduccion = env.NODE_ENV === 'production';

/**
 * Un secreto de ejemplo pasa la validación de largo y deja el sistema abierto:
 * quien haya visto el repositorio puede firmarse un token de encargado. En
 * producción eso no arranca.
 *
 * Se mira el contenido y no sólo el largo porque el riesgo real no es un
 * secreto corto, es uno conocido.
 */
const SOSPECHOSOS = ['cambiar', 'change', 'secret', 'ejemplo', 'example', 'test', 'default'];

if (esProduccion) {
  const minuscula = env.JWT_SECRET.toLowerCase();
  if (SOSPECHOSOS.some((s) => minuscula.includes(s)) || env.JWT_SECRET.length < 32) {
    console.error(
      'JWT_SECRET parece de ejemplo o es demasiado corto. Generá uno con:\n' +
        '  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"'
    );
    process.exit(1);
  }
}
