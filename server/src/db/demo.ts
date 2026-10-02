/**
 * Pone el local "en pleno servicio": turno abierto, mesas en distintos estados,
 * comandas en cocina con demora, una devolución, ventas cerradas y pérdidas.
 * Sirve para mostrar el sistema sin tener que simular un viernes a mano.
 *
 *   npm run db:demo
 */
import { consultar, consultarUna, ejecutar, pool, cerrarPool } from './pool.js';

const api = 'http://localhost:4000/api';

interface Sesion { token: string }
interface UsuarioPin { id: number; nombre: string }

async function token(email: string, password: string): Promise<string> {
  const r = await fetch(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (r.status === 429) {
    // Pasa siempre después de ataque.sh, que fuerza PIN a propósito: 20
    // intentos cada 10 minutos. El 429 pelado no se entiende.
    throw new Error(
      'El limitador de login está contando (429). Es normal si acabás de ' +
      'correr ataque.sh: esperá unos minutos y volvé a intentar.'
    );
  }
  if (!r.ok) throw new Error(`login ${email}: ${r.status}`);
  return ((await r.json()) as Sesion).token;
}

async function tokenPin(nombre: string, pin: string): Promise<string> {
  const lista = (await (await fetch(`${api}/auth/usuarios-pin`)).json()) as UsuarioPin[];
  const u = lista.find((x) => x.nombre === nombre);
  if (!u) throw new Error(`no existe el usuario ${nombre}`);
  const r = await fetch(`${api}/auth/pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario_id: u.id, pin }),
  });
  if (!r.ok) throw new Error(`pin ${nombre}: ${r.status}`);
  return ((await r.json()) as Sesion).token;
}

function cliente(tk: string) {
  return async (metodo: string, ruta: string, cuerpo?: unknown) => {
    const r = await fetch(`${api}${ruta}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    const texto = await r.text();
    const datos = texto ? JSON.parse(texto) : null;
    if (!r.ok) throw new Error(`${metodo} ${ruta}: ${datos?.error ?? r.status}`);
    return datos;
  };
}

interface Cat { productos: { id: number; nombre: string; variantes: { id: number }[]; grupos: number[] }[] }

/**
 * El personal de demostración lo crea el encargado por la misma API que usa
 * la pantalla de Empleados. Si ya existen (porque corriste db:demo dos veces)
 * los deja como están.
 */
const PERSONAL = [
  { nombre: 'Lucía Ramos', email: 'caja@local.test', rol: 'caja', password: 'caja1234', pin: '2222' },
  { nombre: 'Diego Sosa', rol: 'mozo', pin: '3333' },
  { nombre: 'Carla Vega', rol: 'mozo', pin: '4444' },
  { nombre: 'Nahuel Ortiz', rol: 'mozo', pin: '5555' },
  { nombre: 'Cocina', rol: 'cocina', pin: '6666' },
];

async function crearPersonal(encargado: ReturnType<typeof cliente>): Promise<void> {
  const existentes = (await encargado('GET', '/admin/usuarios')) as { nombre: string }[];
  const nombres = new Set(existentes.map((u) => u.nombre));
  let creados = 0;
  for (const p of PERSONAL) {
    if (nombres.has(p.nombre)) continue;
    await encargado('POST', '/admin/usuarios', p);
    creados += 1;
  }
  if (creados) console.log(`  ✔ ${creados} empleados de demostración`);
}

async function main(): Promise<void> {
  const encargado = cliente(await token('encargado@local.test', 'encargado1234'));
  await crearPersonal(encargado);

  const caja = cliente(await token('caja@local.test', 'caja1234'));
  const mozo = cliente(await tokenPin('Diego Sosa', '3333'));
  const mozo2 = cliente(await tokenPin('Carla Vega', '4444'));
  const cocina = cliente(await tokenPin('Cocina', '6666'));

  const carta = await caja('GET', '/carta');
  const grupos = await caja('GET', '/carta/grupos');
  const todos = (carta.categorias as Cat[]).flatMap((c) => c.productos);
  const prod = (n: string) => todos.find((p) => p.nombre === n)!;
  const opcion = (g: string, o: string) =>
    grupos.find((x: { nombre: string }) => x.nombre === g).opciones.find((y: { nombre: string }) => y.nombre === o).id;

  const salon = await mozo('GET', '/salon');
  const mesa = (n: number) => salon.mesas.find((m: { nombre: string }) => m.nombre === `Mesa ${n}`).id;

  // --- Turno abierto ---
  if (!(await caja('GET', '/caja/turno')).turno) {
    await caja('POST', '/caja/turno/abrir', { fondo_inicial: 45000 });
  }

  const PUNTO = opcion('Punto de carne', 'A punto');
  const PAPAS = opcion('Guarnición a elección', 'Papas fritas');
  const PURE = opcion('Guarnición a elección', 'Puré de papas');
  const SALSA = opcion('Salsa a elección', 'Bolognesa');
  const CARNE = opcion('Gustos', 'Carne cortada a cuchillo');
  const HUMITA = opcion('Gustos', 'Humita');
  const JYQ = opcion('Gustos', 'Jamón y queso');
  const DDL = opcion('Sabores', 'Dulce de leche granizado');

  // --- Mesa 3: recién sentados, el mozo todavía no pasó nada ---
  await mozo('POST', '/cuentas', { tipo: 'salon', mesa_id: mesa(3), comensales: 2 });

  // --- Mesa 5: el mozo pasó el pedido y caja todavía no lo cargó ---
  const c5 = await mozo('POST', '/cuentas', { tipo: 'salon', mesa_id: mesa(5), comensales: 4 });
  const b5 = await mozo('POST', '/borradores/mio', { mesa_id: mesa(5), cuenta_id: c5.id });
  await mozo('POST', `/borradores/${b5.id}/items`, {
    producto_id: prod('Milanesa napolitana').id,
    variante_id: prod('Milanesa napolitana').variantes[0].id,
    cantidad: 2, nota: 'una sin sal', opcion_ids: [PURE],
  });
  await mozo('POST', `/borradores/${b5.id}/items`, {
    producto_id: prod('Provoleta a la parrilla').id, cantidad: 1,
  });
  await mozo('PATCH', `/borradores/${b5.id}`, { nota: 'festejan un cumpleaños, la milanesa va al final', pago_previsto: 'tarjeta' });
  await mozo('POST', `/borradores/${b5.id}/pasar`);

  // --- Mesa 8: pedido en cocina, con demora ---
  const c8 = await mozo2('POST', '/cuentas', { tipo: 'salon', mesa_id: mesa(8), comensales: 3 });
  await caja('POST', `/cuentas/${c8.id}/items`, {
    items: [
      { producto_id: prod('Bife de chorizo').id, cantidad: 2, opcion_ids: [PUNTO, PAPAS] },
      { producto_id: prod('Ravioles de ricota y nuez').id, cantidad: 1, opcion_ids: [SALSA] },
      { producto_id: prod('Cerveza tirada').id, variante_id: prod('Cerveza tirada').variantes[0].id, cantidad: 3 },
    ],
    enviar: true,
  });

  // --- Mesa 11: comió, un plato se devolvió, ya pidió la cuenta ---
  const c11 = await mozo('POST', '/cuentas', { tipo: 'salon', mesa_id: mesa(11), comensales: 4 });
  await caja('POST', `/cuentas/${c11.id}/items`, {
    items: [
      { producto_id: prod('Milanesa de ternera').id, variante_id: prod('Milanesa de ternera').variantes[0].id, cantidad: 2, opcion_ids: [PAPAS] },
      { producto_id: prod('Entraña').id, cantidad: 1, opcion_ids: [PUNTO, PAPAS] },
      { producto_id: prod('Vino de la casa').id, variante_id: prod('Vino de la casa').variantes[0].id, cantidad: 1 },
    ],
    enviar: true,
  });
  const comandas11 = await caja('GET', `/cuentas/${c11.id}`);
  await cocina('POST', `/comandas/${comandas11.comandas[0].id}/terminada`);
  await mozo('POST', `/comandas/${comandas11.comandas[0].id}/retirado`);
  const itemEntrana = comandas11.items.find((i: { nombre_snapshot: string }) => i.nombre_snapshot.includes('Entraña'));
  await caja('POST', `/cuentas/${c11.id}/items/${itemEntrana.id}/devolver`, {
    motivo: 'error_cocina', detalle: 'salió cruda', reponer: true, pin: '1111',
  });
  await caja('POST', `/cuentas/${c11.id}/items`, {
    items: [{ producto_id: prod('Flan casero con dulce').id, cantidad: 2 }], enviar: true,
  });
  await mozo('POST', `/cuentas/${c11.id}/pedir-cuenta`);

  // --- Mesa 14 + 15 unidas: cumpleaños ---
  const c14 = await mozo2('POST', '/cuentas', { tipo: 'salon', mesa_id: mesa(14), comensales: 6 });
  await mozo2('POST', `/salon/mesas/${mesa(14)}/unir`, { mesa_ids: [mesa(15)] });
  await caja('POST', `/cuentas/${c14.id}/items`, {
    items: [
      { producto_id: prod('Parrillada para dos').id, cantidad: 2, opcion_ids: [PAPAS] },
      { producto_id: prod('Rabas').id, cantidad: 2 },
      { producto_id: prod('Malbec reserva').id, cantidad: 2 },
    ],
    enviar: true, urgente: true,
  });

  // --- Take away esperando ---
  const cta = await caja('POST', '/cuentas', { tipo: 'take_away', referencia: 'Ramírez' });
  await caja('POST', `/cuentas/${cta.id}/items`, {
    items: [
      { producto_id: prod('Pizza muzzarella').id, variante_id: prod('Pizza muzzarella').variantes[0].id, cantidad: 2 },
      {
        producto_id: prod('Empanadas').id,
        cantidad: 6,
        opcion_ids: [CARNE, HUMITA, JYQ],
        opcion_cant: [
          { opcion_id: CARNE, cantidad: 3 },
          { opcion_id: HUMITA, cantidad: 2 },
          { opcion_id: JYQ, cantidad: 1 },
        ],
      },
    ],
    enviar: true,
  });

  // --- Dos ventas ya cerradas, para que los reportes tengan algo ---
  for (const [i, mesaN] of [1, 2].entries()) {
    const c = await mozo('POST', '/cuentas', { tipo: 'salon', mesa_id: mesa(mesaN), comensales: 2 });
    await caja('POST', `/cuentas/${c.id}/items`, {
      items: [
        { producto_id: prod('Milanesa de pollo').id, cantidad: 2, opcion_ids: [PAPAS] },
        { producto_id: prod('Gaseosa línea Coca-Cola').id, variante_id: prod('Gaseosa línea Coca-Cola').variantes[0].id, cantidad: 2 },
        { producto_id: prod('Helado dos bochas').id, cantidad: 2, opcion_ids: [DDL] },
      ],
      enviar: true,
    });
    const det = await caja('GET', `/cuentas/${c.id}`);
    for (const k of det.comandas) await cocina('POST', `/comandas/${k.id}/terminada`);
    await mozo('POST', `/cuentas/${c.id}/pedir-cuenta`);
    const total = Number((await caja('GET', `/cuentas/${c.id}`)).saldo);
    await caja('POST', `/caja/cuentas/${c.id}/cobrar`, {
      pagos: i === 0
        ? [{ medio: 'efectivo', monto: total, recibido: Math.ceil(total / 1000) * 1000 }]
        : [{ medio: 'debito', monto: total, referencia: 'lote 0031' }],
      propina: i === 0 ? 3000 : 0,
      idempotency_key: `demo-${mesaN}-${Date.now()}`,
      comprobante: { tipo: 'ticket' },
    });
  }

  // --- Una que se fue sin pagar: alimenta el reporte de pérdidas ---
  const cFuga = await mozo('POST', '/cuentas', { tipo: 'salon', mesa_id: mesa(4), comensales: 2 });
  await caja('POST', `/cuentas/${cFuga.id}/items`, {
    items: [{ producto_id: prod('Hamburguesa completa').id, cantidad: 2, opcion_ids: [PUNTO] }],
    enviar: true,
  });
  await caja('POST', `/cuentas/${cFuga.id}/perdida`, {
    motivo: 'Se fueron sin pagar mientras el mozo atendía otra mesa', pin: '1111',
  });

  // --- Un producto agotado por hoy ---
  await cocina('POST', `/carta/producto/${prod('Rabas').id}/agotado`, { agotado: true, alcance: 'hoy' });

  // --- Envejecer las comandas pendientes para que se vea el semáforo ---
  await ejecutar(
    pool,
    `UPDATE comandas SET enviada_at = DATE_SUB(enviada_at, INTERVAL 17 MINUTE)
     WHERE estado = 'pendiente' AND cuenta_id = ?`,
    [c8.id]
  );
  await ejecutar(
    pool,
    `UPDATE comandas SET enviada_at = DATE_SUB(enviada_at, INTERVAL 24 MINUTE)
     WHERE estado = 'pendiente' AND cuenta_id = ?`,
    [c14.id]
  );
  await ejecutar(
    pool,
    `UPDATE cuentas SET abierta_at = DATE_SUB(abierta_at, INTERVAL 52 MINUTE) WHERE id IN (?, ?)`,
    [c11.id, c14.id]
  );
  await ejecutar(
    pool,
    `UPDATE cuentas SET cuenta_pedida_at = DATE_SUB(NOW(), INTERVAL 7 MINUTE) WHERE id = ?`,
    [c11.id]
  );

  const abiertas = await consultarUna<{ n: number }>(
    pool, `SELECT COUNT(*) AS n FROM cuentas WHERE estado IN ('abierta','por_cobrar')`
  );
  const pend = await consultar(pool, `SELECT id FROM comandas WHERE estado = 'pendiente'`);

  console.log('Servicio simulado:');
  console.log(`  ${abiertas?.n} cuentas abiertas · ${pend.length} comandas en cocina`);
  console.log('  Mesa 5 esperando que caja la cargue · Mesa 11 pidió la cuenta');
  console.log('  Mesas 14+15 unidas · un take away · una cuenta no cobrada');
  await cerrarPool();
}

main().catch(async (error) => {
  console.error('Falló la simulación:', error);
  await cerrarPool();
  process.exit(1);
});
