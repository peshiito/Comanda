/** Grupos de modificadores: existen una vez y se enganchan por referencia. */
export interface GrupoSeed {
  clave: string;
  nombre: string;
  obligatorio: boolean;
  min: number;
  max: number;
  /**
   * El grupo deja de ser "elegí una" y pasa a ser "repartí la cantidad":
   * doce empanadas se cargan en una línea con 4 de carne y 8 de humita.
   * min y max cuentan cuántos sabores distintos se pueden elegir.
   */
  por_cantidad?: boolean;
  opciones: { nombre: string; delta: number }[];
}

export const GRUPOS: GrupoSeed[] = [
  {
    clave: 'punto',
    nombre: 'Punto de carne',
    obligatorio: true,
    min: 1,
    max: 1,
    opciones: [
      { nombre: 'Jugoso', delta: 0 },
      { nombre: 'A punto', delta: 0 },
      { nombre: 'Cocido', delta: 0 },
      { nombre: 'Bien cocido', delta: 0 },
    ],
  },
  {
    clave: 'guarnicion',
    nombre: 'Guarnición a elección',
    obligatorio: true,
    min: 1,
    max: 1,
    opciones: [
      { nombre: 'Papas fritas', delta: 0 },
      { nombre: 'Puré de papas', delta: 0 },
      { nombre: 'Ensalada mixta', delta: 0 },
      { nombre: 'Verduras grilladas', delta: 0 },
      { nombre: 'Arroz primavera', delta: 0 },
      { nombre: 'Papas rústicas', delta: 900 },
    ],
  },
  {
    clave: 'salsa',
    nombre: 'Salsa a elección',
    obligatorio: true,
    min: 1,
    max: 1,
    opciones: [
      { nombre: 'Bolognesa', delta: 0 },
      { nombre: 'Filetto', delta: 0 },
      { nombre: 'Manteca y salvia', delta: 0 },
      { nombre: 'Cuatro quesos', delta: 1200 },
      { nombre: 'Mixta', delta: 600 },
    ],
  },
  {
    clave: 'extras',
    nombre: 'Extras',
    obligatorio: false,
    min: 0,
    max: 4,
    opciones: [
      { nombre: 'Huevo frito', delta: 1100 },
      { nombre: 'Queso extra', delta: 1600 },
      { nombre: 'Jamón', delta: 1500 },
      { nombre: 'Panceta', delta: 2100 },
      { nombre: 'Cheddar', delta: 1400 },
    ],
  },
  {
    clave: 'aderezos',
    nombre: 'Aderezos',
    obligatorio: false,
    min: 0,
    max: 4,
    opciones: [
      { nombre: 'Mayonesa', delta: 0 },
      { nombre: 'Ketchup', delta: 0 },
      { nombre: 'Mostaza', delta: 0 },
      { nombre: 'Chimichurri', delta: 0 },
      { nombre: 'Salsa criolla', delta: 0 },
    ],
  },
  {
    clave: 'sabores_empanada',
    nombre: 'Gustos',
    obligatorio: true,
    min: 1,
    max: 8,
    // El caso que hace falta el reparto por cantidad: una docena surtida es
    // una sola línea en la comanda, no doce.
    por_cantidad: true,
    opciones: [
      { nombre: 'Carne cortada a cuchillo', delta: 0 },
      { nombre: 'Jamón y queso', delta: 0 },
      { nombre: 'Humita', delta: 0 },
      { nombre: 'Verdura', delta: 0 },
      { nombre: 'Pollo', delta: 0 },
      { nombre: 'Caprese', delta: 200 },
      { nombre: 'Roquefort con apio', delta: 300 },
      { nombre: 'Cebolla y queso', delta: 0 },
    ],
  },
  {
    clave: 'extras_pizza',
    nombre: 'Extras de pizza',
    obligatorio: false,
    min: 0,
    max: 4,
    opciones: [
      { nombre: 'Doble muzzarella', delta: 2600 },
      { nombre: 'Jamón crudo', delta: 3400 },
      { nombre: 'Rúcula', delta: 900 },
      { nombre: 'Aceitunas', delta: 700 },
      { nombre: 'Morrón asado', delta: 1100 },
      { nombre: 'Huevo', delta: 1100 },
    ],
  },
  {
    clave: 'sabor_helado',
    nombre: 'Sabores',
    obligatorio: true,
    min: 1,
    max: 2,
    opciones: [
      { nombre: 'Dulce de leche granizado', delta: 0 },
      { nombre: 'Chocolate amargo', delta: 0 },
      { nombre: 'Frutilla a la crema', delta: 0 },
      { nombre: 'Limón', delta: 0 },
      { nombre: 'Sambayón', delta: 0 },
      { nombre: 'Menta granizada', delta: 0 },
    ],
  },
  {
    clave: 'sabor_licuado',
    nombre: 'Fruta',
    obligatorio: true,
    min: 1,
    max: 2,
    opciones: [
      { nombre: 'Banana', delta: 0 },
      { nombre: 'Frutilla', delta: 400 },
      { nombre: 'Durazno', delta: 0 },
      { nombre: 'Mango', delta: 600 },
    ],
  },
  {
    clave: 'leche_cafe',
    nombre: 'Leche',
    obligatorio: false,
    min: 0,
    max: 1,
    opciones: [
      { nombre: 'Entera', delta: 0 },
      { nombre: 'Descremada', delta: 0 },
      { nombre: 'Almendras', delta: 900 },
      { nombre: 'Sin leche', delta: 0 },
    ],
  },
  {
    clave: 'coccion_pizza',
    nombre: 'Cocción',
    obligatorio: false,
    min: 0,
    max: 1,
    opciones: [
      { nombre: 'Bien cocida', delta: 0 },
      { nombre: 'Poco cocida', delta: 0 },
    ],
  },
];
