import bcrypt from 'bcryptjs';
import { consultarUna, ejecutar, pool, cerrarPool } from './pool.js';
import { GRUPOS } from './seed/grupos.js';
import { CARTA } from './seed/carta.js';
import { CONFIG_LOCAL, MESAS, USUARIOS, ZONAS } from './seed/local.js';

const pesos = (v: number) => v.toFixed(2);

async function estaVacia(): Promise<boolean> {
  const f = await consultarUna<{ n: number }>(pool, 'SELECT COUNT(*) AS n FROM usuarios');
  return (f?.n ?? 0) === 0;
}

async function sembrarUsuarios(): Promise<void> {
  for (const u of USUARIOS) {
    await ejecutar(
      pool,
      `INSERT INTO usuarios (nombre, email, password_hash, pin_hash, rol) VALUES (?, ?, ?, ?, ?)`,
      [
        u.nombre,
        u.email ?? null,
        u.password ? await bcrypt.hash(u.password, 10) : null,
        u.pin ? await bcrypt.hash(u.pin, 10) : null,
        u.rol,
      ]
    );
  }
  console.log(`  ✔ ${USUARIOS.length} usuarios`);
}

async function sembrarConfig(): Promise<void> {
  for (const [clave, valor] of Object.entries(CONFIG_LOCAL)) {
    await ejecutar(pool, 'INSERT INTO config (clave, valor) VALUES (?, ?)', [clave, valor]);
  }
  console.log(`  ✔ configuración del local`);
}

/** Medidas de arranque: [ancho, alto, forma]. */
function medidas(capacidad: number): [number, number, string] {
  if (capacidad <= 2) return [92, 92, 'cuadrada'];
  if (capacidad <= 4) return [140, 96, 'rectangular'];
  return [132, 132, 'redonda'];
}

async function sembrarMesas(): Promise<void> {
  for (const m of MESAS) {
    await ejecutar(
      pool,
      `INSERT INTO mesas (nombre, capacidad, pos_x, pos_y, ancho, alto, forma)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      // El tamaño inicial sale de la capacidad; después el encargado lo estira
      // a mano desde Salón → Editar hasta que el plano se parezca a la sala.
      [m.nombre, m.capacidad, m.pos_x, m.pos_y, ...medidas(m.capacidad)]
    );
  }
  for (const z of ZONAS) {
    await ejecutar(
      pool,
      'INSERT INTO salon_zonas (nombre, pos_x, pos_y, ancho, alto, tipo) VALUES (?, ?, ?, ?, ?, ?)',
      [z.nombre, z.pos_x, z.pos_y, z.ancho, z.alto, z.tipo]
    );
  }
  console.log(`  ✔ ${MESAS.length} mesas · ${ZONAS.length} zonas`);
}

async function sembrarGrupos(): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  for (const g of GRUPOS) {
    const res = await ejecutar(
      pool,
      `INSERT INTO modificador_grupos (nombre, obligatorio, min_sel, max_sel, por_cantidad)
       VALUES (?, ?, ?, ?, ?)`,
      [g.nombre, g.obligatorio ? 1 : 0, g.min, g.max, g.por_cantidad ? 1 : 0]
    );
    mapa.set(g.clave, res.insertId);
    for (const [i, o] of g.opciones.entries()) {
      await ejecutar(
        pool,
        'INSERT INTO modificador_opciones (grupo_id, nombre, delta_precio, orden) VALUES (?, ?, ?, ?)',
        [res.insertId, o.nombre, pesos(o.delta), i]
      );
    }
  }
  console.log(`  ✔ ${GRUPOS.length} grupos de modificadores`);
  return mapa;
}

async function sembrarCarta(grupos: Map<string, number>): Promise<void> {
  let productos = 0;
  let variantes = 0;

  for (const [ci, cat] of CARTA.entries()) {
    const resCat = await ejecutar(pool, 'INSERT INTO categorias (nombre, orden) VALUES (?, ?)', [
      cat.nombre,
      ci,
    ]);

    for (const [pi, p] of cat.productos.entries()) {
      const res = await ejecutar(
        pool,
        `INSERT INTO productos
           (categoria_id, nombre, descripcion, codigo_corto, precio, costo, iva_alicuota,
            visible_qr, apto_celiaco, apto_vegetariano, apto_vegano,
            horario_desde, horario_hasta, orden, va_a_cocina)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          resCat.insertId, p.nombre, p.desc ?? null, p.codigo ?? null,
          pesos(p.precio), pesos(p.costo ?? Math.round(p.precio * 0.38)), pesos(p.iva ?? 21),
          p.qr === false ? 0 : 1,
          p.celiaco ? 1 : 0, p.vegetariano ? 1 : 0, p.vegano ? 1 : 0,
          p.horario?.[0] ?? null, p.horario?.[1] ?? null, pi,
          (p.barra ?? cat.barra) ? 0 : 1,
        ]
      );
      productos += 1;

      for (const [vi, v] of (p.variantes ?? []).entries()) {
        await ejecutar(
          pool,
          'INSERT INTO producto_variantes (producto_id, nombre, precio, orden) VALUES (?, ?, ?, ?)',
          [res.insertId, v.nombre, pesos(v.precio), vi]
        );
        variantes += 1;
      }

      for (const [gi, clave] of (p.grupos ?? []).entries()) {
        const grupoId = grupos.get(clave);
        if (!grupoId) throw new Error(`Grupo desconocido en el seed: ${clave}`);
        await ejecutar(
          pool,
          'INSERT INTO producto_grupos (producto_id, grupo_id, orden) VALUES (?, ?, ?)',
          [res.insertId, grupoId, gi]
        );
      }
    }
  }
  console.log(`  ✔ ${CARTA.length} categorías, ${productos} productos, ${variantes} variantes`);
}

async function main(): Promise<void> {
  if (!(await estaVacia())) {
    console.error('La base ya tiene datos. Corré "npm run db:reset" para rehacerla.');
    process.exit(1);
  }

  console.log('Sembrando datos del local...');
  await sembrarUsuarios();
  await sembrarConfig();
  await sembrarMesas();
  await sembrarCarta(await sembrarGrupos());

  console.log('\nListo. El local arranca con un solo usuario, el que instala:');
  console.log('  encargado@local.test / encargado1234   (PIN 1111)');
  console.log('\nDesde Admin → Empleados carga al resto de su gente.');
  console.log('Para ver el sistema con personal y un servicio en curso:');
  console.log('  npm run db:demo');
  await cerrarPool();
}

main().catch(async (error) => {
  console.error('Falló el seed:', error);
  await cerrarPool();
  process.exit(1);
});
