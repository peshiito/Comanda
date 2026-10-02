/** Carta de un bodegón: precios de referencia 2026, IVA incluido. */
export interface ProductoSeed {
  nombre: string;
  precio: number;
  codigo?: string;
  desc?: string;
  costo?: number;
  iva?: number;
  grupos?: string[];
  variantes?: { nombre: string; precio: number }[];
  celiaco?: boolean;
  vegetariano?: boolean;
  vegano?: boolean;
  horario?: [string, string];
  qr?: boolean;
  /** Sale de la barra, no de la cocina. Si no se dice, hereda la categoría. */
  barra?: boolean;
}

export interface CategoriaSeed {
  nombre: string;
  /**
   * Toda la categoría sale de la barra: el mozo lo alcanza directo y no
   * genera comanda. Cada producto puede desmarcarse con `barra: false`
   * (por ejemplo un licuado, que hay que prepararlo).
   */
  barra?: boolean;
  productos: ProductoSeed[];
}

export const CARTA: CategoriaSeed[] = [
  {
    nombre: 'Entradas',
    productos: [
      { nombre: 'Provoleta a la parrilla', precio: 9800, codigo: '11', costo: 3400, vegetariano: true, celiaco: true },
      {
        nombre: 'Empanadas', precio: 2600, codigo: '12',
        desc: 'Precio por unidad. Elegí los gustos, van al horno.',
        costo: 900, grupos: ['sabores_empanada'],
      },
      { nombre: 'Provoleta con panceta', precio: 12400, codigo: '13', celiaco: true },
      { nombre: 'Rabas', precio: 16500, codigo: '14', costo: 7200, grupos: ['aderezos'] },
      { nombre: 'Tabla de fiambres', precio: 21900, codigo: '15', desc: 'Para dos personas', costo: 9800 },
      { nombre: 'Papas bravas', precio: 8900, codigo: '16', vegetariano: true, grupos: ['aderezos'] },
      { nombre: 'Berenjenas en escabeche', precio: 7400, codigo: '17', vegano: true, celiaco: true },
      { nombre: 'Croquetas de queso', precio: 8200, codigo: '18', vegetariano: true, grupos: ['aderezos'] },
      { nombre: 'Matambrito arrollado', precio: 13900, codigo: '19', costo: 6200 },
      { nombre: 'Mejillones a la provenzal', precio: 15800, codigo: '1A', costo: 7100 },
    ],
  },
  {
    nombre: 'Minutas y milanesas',
    productos: [
      {
        nombre: 'Milanesa de ternera', precio: 15900, codigo: '21', costo: 6100,
        grupos: ['guarnicion', 'extras'],
        variantes: [{ nombre: 'Porción', precio: 15900 }, { nombre: 'Media porción', precio: 10900 }],
      },
      {
        nombre: 'Milanesa napolitana', precio: 18400, codigo: '22', costo: 7400,
        desc: 'Con jamón, salsa y muzzarella',
        grupos: ['guarnicion', 'extras'],
        variantes: [{ nombre: 'Porción', precio: 18400 }, { nombre: 'Media porción', precio: 12900 }],
      },
      { nombre: 'Milanesa de pollo', precio: 15200, codigo: '23', grupos: ['guarnicion', 'extras'] },
      { nombre: 'Suprema a la crema', precio: 17600, codigo: '24', grupos: ['guarnicion'] },
      { nombre: 'Hamburguesa completa', precio: 14800, codigo: '25', grupos: ['punto', 'extras', 'aderezos'] },
      { nombre: 'Sándwich de lomo', precio: 16900, codigo: '26', grupos: ['punto', 'extras', 'aderezos'] },
      { nombre: 'Tortilla de papas', precio: 11200, codigo: '27', vegetariano: true },
      { nombre: 'Milanesa a la napolitana de pollo', precio: 17200, codigo: '28', grupos: ['guarnicion', 'extras'] },
      { nombre: 'Bife a la criolla', precio: 19400, codigo: '29', grupos: ['punto', 'guarnicion'] },
      { nombre: 'Revuelto Gramajo', precio: 14200, codigo: '2A' },
      { nombre: 'Suprema Maryland', precio: 18600, codigo: '2B', grupos: ['guarnicion'] },
    ],
  },
  {
    nombre: 'Parrilla',
    productos: [
      { nombre: 'Bife de chorizo', precio: 24900, codigo: '31', costo: 11200, grupos: ['punto', 'guarnicion'] },
      { nombre: 'Entraña', precio: 26500, codigo: '32', costo: 12400, grupos: ['punto', 'guarnicion'] },
      { nombre: 'Vacío', precio: 22400, codigo: '33', grupos: ['punto', 'guarnicion'] },
      { nombre: 'Asado de tira', precio: 21800, codigo: '34', grupos: ['punto', 'guarnicion'] },
      { nombre: 'Pollo a la parrilla', precio: 17200, codigo: '35', grupos: ['guarnicion'] },
      { nombre: 'Chorizo', precio: 5400, codigo: '36' },
      { nombre: 'Morcilla', precio: 5200, codigo: '37' },
      { nombre: 'Parrillada para dos', precio: 46900, codigo: '38', desc: 'Asado, vacío, pollo, chorizo y morcilla', costo: 21000, grupos: ['guarnicion'] },
      { nombre: 'Bife de lomo', precio: 28900, codigo: '39', costo: 13800, grupos: ['punto', 'guarnicion'] },
      { nombre: 'Ojo de bife', precio: 27400, codigo: '3A', costo: 12900, grupos: ['punto', 'guarnicion'] },
      { nombre: 'Costillar a la estaca', precio: 25800, codigo: '3B', costo: 11600, grupos: ['guarnicion'] },
      { nombre: 'Mollejas al limón', precio: 16900, codigo: '3C', costo: 7400, celiaco: true },
      { nombre: 'Chinchulines trenzados', precio: 14200, codigo: '3D', celiaco: true },
      { nombre: 'Pechito de cerdo', precio: 20400, codigo: '3E', grupos: ['guarnicion'] },
      { nombre: 'Provoleta de cabra', precio: 13400, codigo: '3F', vegetariano: true, celiaco: true },
    ],
  },
  {
    nombre: 'Pastas',
    productos: [
      { nombre: 'Ravioles de ricota y nuez', precio: 16400, codigo: '41', vegetariano: true, grupos: ['salsa'] },
      { nombre: 'Sorrentinos de jamón y queso', precio: 17800, codigo: '42', grupos: ['salsa'] },
      { nombre: 'Ñoquis caseros', precio: 15200, codigo: '43', vegetariano: true, grupos: ['salsa'] },
      { nombre: 'Tallarines', precio: 14600, codigo: '44', vegetariano: true, grupos: ['salsa'] },
      { nombre: 'Lasaña de carne', precio: 18200, codigo: '45' },
      { nombre: 'Sorrentinos de calabaza y almendras', precio: 17400, codigo: '46', vegetariano: true, grupos: ['salsa'] },
      { nombre: 'Canelones de verdura', precio: 16200, codigo: '47', vegetariano: true, grupos: ['salsa'] },
      { nombre: 'Fideos con tuco y albóndigas', precio: 15800, codigo: '48' },
      { nombre: 'Ravioles de carne', precio: 16800, codigo: '49', grupos: ['salsa'] },
    ],
  },
  {
    nombre: 'Pizzas',
    productos: [
      {
        nombre: 'Pizza muzzarella', precio: 16900, codigo: '51', vegetariano: true,
        grupos: ['coccion_pizza', 'extras_pizza'],
        variantes: [
          { nombre: 'Grande', precio: 16900 },
          { nombre: 'Chica', precio: 11900 },
          { nombre: 'Al molde grande', precio: 18600 },
        ],
      },
      { nombre: 'Pizza napolitana', precio: 18400, codigo: '52', vegetariano: true, grupos: ['coccion_pizza', 'extras_pizza'] },
      { nombre: 'Pizza fugazzeta', precio: 19200, codigo: '53', vegetariano: true, grupos: ['coccion_pizza', 'extras_pizza'] },
      { nombre: 'Pizza especial', precio: 20800, codigo: '54', grupos: ['coccion_pizza', 'extras_pizza'] },
      { nombre: 'Pizza calabresa', precio: 19800, codigo: '55', grupos: ['coccion_pizza', 'extras_pizza'] },
      { nombre: 'Pizza cuatro quesos', precio: 21400, codigo: '56', vegetariano: true, grupos: ['coccion_pizza', 'extras_pizza'] },
      { nombre: 'Pizza rúcula y jamón crudo', precio: 22600, codigo: '57', grupos: ['coccion_pizza', 'extras_pizza'] },
    ],
  },
  {
    nombre: 'Guarniciones',
    productos: [
      { nombre: 'Papas fritas', precio: 7200, codigo: '61', vegetariano: true, vegano: true, grupos: ['aderezos'] },
      { nombre: 'Papas con cheddar y panceta', precio: 11400, codigo: '62' },
      { nombre: 'Ensalada mixta', precio: 6800, codigo: '63', vegetariano: true, vegano: true, celiaco: true },
      { nombre: 'Puré de papas', precio: 6400, codigo: '64', vegetariano: true, celiaco: true },
      { nombre: 'Verduras grilladas', precio: 7600, codigo: '65', vegetariano: true, vegano: true, celiaco: true },
      { nombre: 'Papas noisette', precio: 7600, codigo: '66', vegetariano: true },
      { nombre: 'Arroz primavera', precio: 6200, codigo: '67', vegetariano: true, celiaco: true },
      { nombre: 'Ensalada rusa', precio: 7400, codigo: '68', vegetariano: true, celiaco: true },
      { nombre: 'Batatas fritas', precio: 7800, codigo: '69', vegano: true },
    ],
  },
  {
    nombre: 'Menú del mediodía',
    productos: [
      {
        nombre: 'Menú ejecutivo', precio: 13900, codigo: '71',
        desc: 'Plato principal + bebida + postre. Solo al mediodía.',
        horario: ['11:30:00', '15:30:00'], grupos: ['guarnicion'],
      },
      {
        nombre: 'Plato del día', precio: 12400, codigo: '72',
        desc: 'Consultá con el mozo', horario: ['11:30:00', '15:30:00'],
      },
    ],
  },
  {
    nombre: 'Postres',
    productos: [
      { nombre: 'Flan casero con dulce', precio: 6900, codigo: '81', vegetariano: true },
      { nombre: 'Helado dos bochas', precio: 6200, codigo: '82', vegetariano: true, celiaco: true, grupos: ['sabor_helado'] },
      { nombre: 'Budín de pan', precio: 6400, codigo: '83', vegetariano: true },
      { nombre: 'Panqueque de dulce de leche', precio: 7400, codigo: '84', vegetariano: true },
      { nombre: 'Ensalada de frutas', precio: 5900, codigo: '85', vegano: true, celiaco: true },
      { nombre: 'Tiramisú', precio: 7800, codigo: '86', vegetariano: true },
      { nombre: 'Volcán de chocolate', precio: 8400, codigo: '87', vegetariano: true },
      { nombre: 'Queso y dulce', precio: 6100, codigo: '88', vegetariano: true, celiaco: true },
      { nombre: 'Flan mixto con crema', precio: 7400, codigo: '89', vegetariano: true },
    ],
  },
  {
    nombre: 'Bebidas',
    // Hasta el café y la limonada se preparan en la barra, no en la cocina.
    barra: true,
    productos: [
      { nombre: 'Agua sin gas', precio: 3200, codigo: '91', celiaco: true, vegano: true, variantes: [{ nombre: '500 ml', precio: 3200 }, { nombre: '1,5 L', precio: 4900 }] },
      { nombre: 'Agua con gas', precio: 3200, codigo: '92', celiaco: true, vegano: true },
      { nombre: 'Gaseosa línea Coca-Cola', precio: 4100, codigo: '93', variantes: [{ nombre: 'Vaso', precio: 4100 }, { nombre: 'Botella 1,5 L', precio: 6900 }] },
      { nombre: 'Limonada con menta y jengibre', precio: 5600, codigo: '94', vegano: true },
      { nombre: 'Café', precio: 3400, codigo: '95', celiaco: true, grupos: ['leche_cafe'] },
      { nombre: 'Cortado', precio: 3600, codigo: '96', celiaco: true, grupos: ['leche_cafe'] },
      { nombre: 'Submarino', precio: 5200, codigo: '97', vegetariano: true },
      { nombre: 'Té', precio: 2900, codigo: '98', celiaco: true, vegano: true },
      { nombre: 'Jugo de naranja exprimido', precio: 5400, codigo: '99', vegano: true, celiaco: true },
      { nombre: 'Agua tónica', precio: 3800, codigo: '9A', vegano: true, celiaco: true },
      // Es bebida pero hay que licuarla: la hace la barra, no la cocina.
      { nombre: 'Licuado', precio: 5800, codigo: '9B', vegetariano: true, grupos: ['sabor_licuado'] },
    ],
  },
  {
    nombre: 'Cervezas y vinos',
    barra: true,
    productos: [
      { nombre: 'Cerveza tirada', precio: 6400, codigo: 'A1', variantes: [{ nombre: 'Pinta', precio: 6400 }, { nombre: 'Media pinta', precio: 4200 }] },
      { nombre: 'Cerveza en botella', precio: 7200, codigo: 'A2' },
      { nombre: 'Vino de la casa', precio: 12900, codigo: 'A3', variantes: [{ nombre: 'Botella', precio: 12900 }, { nombre: 'Copa', precio: 4600 }] },
      { nombre: 'Malbec reserva', precio: 26400, codigo: 'A4' },
      { nombre: 'Fernet con cola', precio: 8200, codigo: 'A5' },
      { nombre: 'Cerveza artesanal IPA', precio: 7800, codigo: 'A6', variantes: [{ nombre: 'Pinta', precio: 7800 }, { nombre: 'Media pinta', precio: 5100 }] },
      { nombre: 'Cerveza negra', precio: 7400, codigo: 'A7' },
      { nombre: 'Torrontés', precio: 14200, codigo: 'A8', variantes: [{ nombre: 'Botella', precio: 14200 }, { nombre: 'Copa', precio: 5200 }] },
      { nombre: 'Cabernet Sauvignon', precio: 23800, codigo: 'A9' },
      { nombre: 'Gin tonic', precio: 9400, codigo: 'AA' },
      { nombre: 'Aperol spritz', precio: 9800, codigo: 'AB' },
    ],
  },
];
