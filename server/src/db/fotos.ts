/**
 * Baja una foto para cada producto de la carta desde Wikimedia Commons.
 *
 *   npm run db:fotos          (sólo los que no tienen foto)
 *   npm run db:fotos -- todo  (rehace todas)
 *
 * Por qué Commons y no un banco de imágenes: no hace falta registrarse ni
 * tener clave de API, y cada archivo declara su licencia, así que se puede
 * filtrar a lo que realmente se puede usar. Se guarda la atribución de cada
 * foto en `uploads/carta/CREDITOS.md`.
 *
 * Son fotos de referencia para mostrar el sistema. Un local de verdad va a
 * cargar las suyas desde Admin → Carta, que es lo que corresponde: el cliente
 * quiere ver el plato que le van a traer, no una foto parecida.
 */
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { consultar, ejecutar, pool, cerrarPool } from './pool.js';

const CARPETA = path.resolve(process.cwd(), 'uploads/carta');
const API = 'https://commons.wikimedia.org/w/api.php';

/**
 * Licencias que no obligan a nada más que mencionar al autor. Se dejan afuera
 * las que no permiten uso comercial o piden compartir igual, que en un sistema
 * que se vende traen problemas.
 */
const LICENCIAS_OK = [
  'cc0', 'public domain', 'pd', 'cc by 4.0', 'cc by 3.0', 'cc by 2.0',
  'cc by-sa 4.0', 'cc by-sa 3.0', 'cc by-sa 2.0',
];

/**
 * Qué buscar para cada plato. Buscar el nombre tal cual da resultados malos
 * ("Menú ejecutivo" no existe en Commons), así que se traduce a algo que
 * Commons sí tenga, en inglés cuando el término local no rinde.
 */
const BUSQUEDAS: Record<string, string> = {
  'Provoleta a la parrilla': 'provoleta',
  'Provoleta con panceta': 'provoleta cheese',
  'Provoleta de cabra': 'grilled goat cheese',
  Empanadas: 'empanadas argentinas',
  Rabas: 'fried calamari rings',
  'Tabla de fiambres': 'charcuterie board',
  'Papas bravas': 'patatas bravas',
  'Berenjenas en escabeche': 'pickled eggplant',
  'Croquetas de queso': 'cheese croquettes',
  'Matambrito arrollado': 'matambre arrollado',
  'Mejillones a la provenzal': 'mussels provencal',
  'Milanesa de ternera': 'milanesa',
  'Milanesa napolitana': 'milanesa napolitana',
  'Milanesa de pollo': 'chicken milanesa',
  'Milanesa a la napolitana de pollo': 'milanesa napolitana',
  'Suprema a la crema': 'chicken supreme cream sauce',
  'Suprema Maryland': 'chicken maryland',
  'Hamburguesa completa': 'hamburger with fries',
  'Sándwich de lomo': 'steak sandwich',
  'Tortilla de papas': 'tortilla de patatas',
  'Bife a la criolla': 'bife criollo',
  'Revuelto Gramajo': 'revuelto gramajo',
  'Bife de chorizo': 'bife de chorizo',
  Entraña: 'grilled flank steak',
  Vacío: 'vacio asado',
  'Asado de tira': 'asado de tira',
  'Pollo a la parrilla': 'grilled chicken',
  Chorizo: 'chorizo criollo grilled',
  Morcilla: 'morcilla',
  'Parrillada para dos': 'parrillada asado',
  'Bife de lomo': 'beef tenderloin steak',
  'Ojo de bife': 'ribeye steak',
  'Costillar a la estaca': 'asado costillar',
  'Mollejas al limón': 'sweetbreads grilled',
  'Chinchulines trenzados': 'chinchulines',
  'Pechito de cerdo': 'grilled pork ribs',
  'Ravioles de ricota y nuez': 'ravioli ricotta',
  'Ravioles de carne': 'ravioli meat',
  'Sorrentinos de jamón y queso': 'sorrentinos pasta',
  'Sorrentinos de calabaza y almendras': 'pumpkin ravioli',
  'Ñoquis caseros': 'gnocchi',
  Tallarines: 'tagliatelle pasta',
  'Lasaña de carne': 'lasagna',
  'Canelones de verdura': 'cannelloni spinach',
  'Fideos con tuco y albóndigas': 'spaghetti meatballs',
  'Pizza muzzarella': 'pizza mozzarella',
  'Pizza napolitana': 'pizza napoletana',
  'Pizza fugazzeta': 'fugazzeta',
  'Pizza especial': 'pizza with ham and peppers',
  'Pizza calabresa': 'pizza calabresa',
  'Pizza cuatro quesos': 'quattro formaggi pizza',
  'Pizza rúcula y jamón crudo': 'pizza rucola prosciutto',
  'Papas fritas': 'french fries',
  'Papas con cheddar y panceta': 'loaded fries cheddar bacon',
  'Ensalada mixta': 'mixed green salad',
  'Puré de papas': 'mashed potatoes',
  'Verduras grilladas': 'grilled vegetables',
  'Papas noisette': 'noisette potatoes',
  'Arroz primavera': 'rice with vegetables',
  'Ensalada rusa': 'ensaladilla rusa',
  'Batatas fritas': 'sweet potato fries',
  'Menú ejecutivo': 'lunch plate restaurant',
  'Flan casero con dulce': 'flan dulce de leche',
  'Flan mixto con crema': 'flan with cream',
  'Helado dos bochas': 'ice cream scoops bowl',
  'Budín de pan': 'bread pudding',
  'Panqueque de dulce de leche': 'crepe dulce de leche',
  'Ensalada de frutas': 'fruit salad',
  Tiramisú: 'tiramisu',
  'Volcán de chocolate': 'chocolate lava cake',
  'Queso y dulce': 'cheese with quince paste',
  'Agua sin gas': 'bottled water glass',
  'Agua con gas': 'sparkling water glass',
  'Gaseosa línea Coca-Cola': 'cola glass ice',
  'Limonada con menta y jengibre': 'lemonade mint',
  Café: 'espresso cup',
  Cortado: 'cortado coffee',
  Submarino: 'hot chocolate milk',
  Té: 'tea cup',
  'Jugo de naranja exprimido': 'orange juice glass',
  'Agua tónica': 'tonic water glass',
  Licuado: 'fruit smoothie glass',
  'Cerveza tirada': 'draft beer glass',
  'Cerveza en botella': 'beer bottle',
  'Cerveza artesanal IPA': 'ipa beer glass',
  'Cerveza negra': 'stout beer glass',
  'Vino de la casa': 'red wine glass',
  'Malbec reserva': 'malbec wine bottle',
  Torrontés: 'white wine glass',
  'Cabernet Sauvignon': 'cabernet wine',
  'Fernet con cola': 'fernet con coca',
  'Gin tonic': 'gin and tonic',
  'Aperol spritz': 'aperol spritz',
};

interface Producto {
  id: number;
  nombre: string;
  foto: string | null;
  foto_credito: string | null;
}

interface Candidato {
  titulo: string;
  url: string;
  licencia: string;
  autor: string;
}

const limpiarHtml = (s: string): string =>
  s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

/** Nombre de archivo previsible y sin acentos, derivado del producto. */
function nombreArchivo(producto: Producto, extension: string): string {
  const base = producto.nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${producto.id}-${base}${extension}`;
}

const dormir = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Commons corta si le pedís muy seguido, y devuelve 429. Reintenta con espera
 * creciente en vez de dar el producto por perdido: sin esto, una tanda de 90
 * productos termina con diez fotos y ochenta "sin resultados" que en realidad
 * eran un límite de tasa.
 */
async function pedir(url: string, intentos = 4): Promise<Response | null> {
  for (let i = 0; i < intentos; i += 1) {
    const r = await fetch(url, { headers: { 'User-Agent': 'Comanda/1.0 (demo local)' } });
    if (r.ok) return r;
    if (r.status !== 429 && r.status < 500) {
      console.log(`      HTTP ${r.status}`);
      return null;
    }
    await dormir(1500 * (i + 1));
  }
  console.log('      no pasó el límite de la API después de varios intentos');
  return null;
}

async function buscar(termino: string): Promise<Candidato[]> {
  const url =
    `${API}?action=query&generator=search&gsrsearch=${encodeURIComponent(termino)}` +
    '&gsrnamespace=6&gsrlimit=8&prop=imageinfo' +
    '&iiprop=url%7Cextmetadata&iiurlwidth=900&format=json';

  const r = await pedir(url);
  if (!r) return [];
  const datos = (await r.json()) as {
    query?: { pages?: Record<string, {
      title: string;
      imageinfo?: { thumburl?: string; url?: string; extmetadata?: Record<string, { value: string }> }[];
    }> };
  };

  const paginas = Object.values(datos.query?.pages ?? {});
  return paginas.flatMap((p) => {
    const ii = p.imageinfo?.[0];
    const enlace = ii?.thumburl ?? ii?.url;
    if (!enlace) return [];
    // Los SVG y los PDF no sirven como foto de plato.
    if (!/\.(jpe?g|png|webp)/i.test(p.title)) return [];
    return [{
      titulo: p.title.replace(/^File:/, ''),
      url: enlace,
      licencia: limpiarHtml(ii?.extmetadata?.LicenseShortName?.value ?? ''),
      autor: limpiarHtml(ii?.extmetadata?.Artist?.value ?? 'desconocido'),
    }];
  });
}

const licenciaAceptable = (l: string): boolean => {
  const n = l.toLowerCase();
  if (n.includes('nc') || n.includes('nd') || n.includes('fair use')) return false;
  return LICENCIAS_OK.some((ok) => n.includes(ok));
};

/**
 * Un `db:reset` rehace el esquema y borra la columna `foto`, pero los archivos
 * siguen en disco. Antes de salir a buscar nada, volvemos a atar lo que ya
 * está bajado: así resembrar la base no cuesta veinte minutos de descargas.
 */
async function reconectarExistentes(productos: Producto[]): Promise<number> {
  let archivos: string[];
  try {
    archivos = await readdir(CARPETA);
  } catch {
    return 0;
  }
  let atados = 0;
  for (const p of productos) {
    if (p.foto) continue;
    const suyo = archivos.find((a) => a.startsWith(`${p.id}-`));
    if (!suyo) continue;
    await ejecutar(pool, 'UPDATE productos SET foto = ? WHERE id = ?', [suyo, p.id]);
    p.foto = suyo;
    atados += 1;
  }
  return atados;
}

async function main(): Promise<void> {
  const rehacer = process.argv.includes('todo');
  await mkdir(CARPETA, { recursive: true });

  const productos = await consultar<Producto>(
    pool,
    'SELECT id, nombre, foto, foto_credito FROM productos WHERE activo = 1 ORDER BY id'
  );

  if (!rehacer) {
    const atados = await reconectarExistentes(productos);
    if (atados) console.log(`  ✔ ${atados} fotos que ya estaban en disco, reconectadas`);
  }

  const pendientes = rehacer ? productos : productos.filter((p) => !p.foto);

  console.log(`Fotos de la carta: ${pendientes.length} de ${productos.length} productos`);
  if (!pendientes.length) {
    console.log('  Nada que bajar. Usá "npm run db:fotos -- todo" para rehacerlas.');
    return;
  }

  let listas = 0;
  let sinFoto = 0;

  for (const p of pendientes) {
    const termino = BUSQUEDAS[p.nombre] ?? p.nombre;
    let elegido: Candidato | undefined;
    try {
      elegido = (await buscar(termino)).find((c) => licenciaAceptable(c.licencia));
    } catch (error) {
      console.log(`  ✗ ${p.nombre}: ${(error as Error).message}`);
    }

    if (!elegido) {
      sinFoto += 1;
      console.log(`  ·  ${p.nombre}: sin foto con licencia usable ("${termino}")`);
      continue;
    }

    const extension = /\.png/i.test(elegido.url) ? '.png' : '.jpg';
    const archivo = nombreArchivo(p, extension);
    try {
      const img = await pedir(elegido.url);
      if (!img) throw new Error('no se pudo descargar');
      await writeFile(path.join(CARPETA, archivo), Buffer.from(await img.arrayBuffer()));
    } catch (error) {
      sinFoto += 1;
      console.log(`  ✗ ${p.nombre}: ${(error as Error).message}`);
      continue;
    }

    const credito = `Wikimedia Commons, «${elegido.titulo}». ${elegido.autor}. ${elegido.licencia}.`;
    await ejecutar(pool, 'UPDATE productos SET foto = ?, foto_credito = ? WHERE id = ?', [
      archivo, credito, p.id,
    ]);
    listas += 1;
    console.log(`  ✔ ${p.nombre}  (${elegido.licencia})`);

    // Commons pide no martillar la API. Una corrida completa tarda unos
    // dos minutos y no se corre seguido, así que conviene ir tranquilo.
    await dormir(900);
  }

  // Se arma con TODAS las fotos que hay, no sólo con las de esta corrida:
  // si no, un segundo repaso pisaría las atribuciones de la primera.
  const conFoto = await consultar<Producto>(
    pool,
    `SELECT id, nombre, foto, foto_credito FROM productos
     WHERE foto IS NOT NULL ORDER BY id`
  );
  const creditos = conFoto.map(
    (p) => `- **${p.nombre}** — \`${p.foto}\`\n  ${p.foto_credito ?? 'sin datos de origen'}`
  );

  if (creditos.length) {
    const encabezado =
      '# Créditos de las fotos\n\n' +
      'Fotos de referencia bajadas de Wikimedia Commons con `npm run db:fotos`.\n' +
      'Son para mostrar el sistema: una instalación real carga las fotos del\n' +
      'local desde Admin → Carta. Cada archivo mantiene la licencia y el autor\n' +
      'que declara Commons.\n\n';
    await writeFile(path.join(CARPETA, 'CREDITOS.md'), encabezado + creditos.join('\n\n') + '\n');
  }

  console.log(`\n  ${listas} fotos bajadas · ${sinFoto} sin foto`);
  if (creditos.length) console.log('  Atribuciones en uploads/carta/CREDITOS.md');
}

main()
  .catch((error) => {
    console.error('Fallo bajando fotos:', error);
    process.exitCode = 1;
  })
  .finally(() => void cerrarPool());
