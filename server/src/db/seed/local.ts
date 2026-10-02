export interface UsuarioSeed {
  nombre: string;
  email?: string;
  rol: 'encargado' | 'caja' | 'mozo' | 'cocina';
  password?: string;
  pin?: string;
}

/**
 * Una instalación nueva arranca con un solo usuario: el encargado que instala
 * el sistema. Desde Admin → Empleados carga a su gente. No sembramos un
 * plantel de mentira, porque el local que compra el sistema no lo quiere
 * borrar a mano antes de empezar a usarlo.
 *
 * El personal de demostración lo crea `npm run db:demo`.
 */
export const USUARIOS: UsuarioSeed[] = [
  { nombre: 'Encargado', email: 'encargado@local.test', rol: 'encargado', password: 'encargado1234', pin: '1111' },
];

/** Salón de 18 mesas en una grilla de 4 columnas. */
/**
 * Disposición del salón. Las coordenadas son de un lienzo de 1000x620 y están
 * puestas a mano a propósito: un plano en grilla regular no le sirve a nadie,
 * porque el mozo ubica la mesa por dónde está parada en la sala, no por su
 * número. Quedan pasillos entre los bloques y las de 2 contra el ventanal.
 */
export const MESAS = [
  // Ventanal: mesas de dos, pegadas a la pared izquierda
  { nombre: 'Mesa 1', capacidad: 2, pos_x: 48, pos_y: 60 },
  { nombre: 'Mesa 2', capacidad: 2, pos_x: 48, pos_y: 176 },
  { nombre: 'Mesa 3', capacidad: 2, pos_x: 48, pos_y: 292 },
  { nombre: 'Mesa 4', capacidad: 2, pos_x: 48, pos_y: 408 },

  // Centro, primer bloque
  { nombre: 'Mesa 5', capacidad: 4, pos_x: 236, pos_y: 64 },
  { nombre: 'Mesa 6', capacidad: 4, pos_x: 236, pos_y: 212 },
  { nombre: 'Mesa 7', capacidad: 4, pos_x: 236, pos_y: 360 },

  // Centro, segundo bloque (pasillo de por medio)
  { nombre: 'Mesa 8', capacidad: 4, pos_x: 424, pos_y: 64 },
  { nombre: 'Mesa 9', capacidad: 4, pos_x: 424, pos_y: 212 },
  { nombre: 'Mesa 10', capacidad: 4, pos_x: 424, pos_y: 360 },

  // Fondo del salón
  { nombre: 'Mesa 11', capacidad: 4, pos_x: 612, pos_y: 64 },
  { nombre: 'Mesa 12', capacidad: 4, pos_x: 612, pos_y: 212 },
  { nombre: 'Mesa 13', capacidad: 4, pos_x: 612, pos_y: 360 },

  // Redondas grandes contra la pared derecha. La 14 y la 15 quedan juntas
  // porque son las que el local suele unir para grupos.
  { nombre: 'Mesa 14', capacidad: 6, pos_x: 812, pos_y: 64 },
  { nombre: 'Mesa 15', capacidad: 6, pos_x: 812, pos_y: 216 },
  { nombre: 'Mesa 16', capacidad: 6, pos_x: 812, pos_y: 396 },

  // Salón de abajo
  { nombre: 'Mesa 17', capacidad: 6, pos_x: 236, pos_y: 484 },
  { nombre: 'Mesa 18', capacidad: 6, pos_x: 452, pos_y: 484 },
];

/**
 * Lo que hay en el salón además de las mesas. Puestas en los huecos que dejan
 * las mesas del layout de arriba: sin ellas el plano es un montón de
 * rectángulos flotando y el mozo nuevo no sabe para dónde queda la cocina.
 */
export const ZONAS = [
  { nombre: 'Barra', pos_x: 48, pos_y: 0, ancho: 300, alto: 46, tipo: 'area' },
  { nombre: 'Cocina', pos_x: 620, pos_y: 545, ancho: 200, alto: 65, tipo: 'area' },
  { nombre: 'Recepción', pos_x: 40, pos_y: 520, ancho: 160, alto: 80, tipo: 'area' },
  { nombre: 'Entrada', pos_x: 860, pos_y: 545, ancho: 100, alto: 30, tipo: 'puerta' },
];

export const CONFIG_LOCAL: Record<string, string> = {
  nombre_local: 'El Bodegón de la Esquina',
  cubierto_activo: '1',
  cubierto_monto: '1200.00',
  // Arranca en cero: todo descuento pide PIN del encargado.
  descuento_tope_sin_pin: '0.00',
  demora_amarillo_min: '10',
  demora_naranja_min: '15',
  demora_rojo_min: '20',
  mesa_sin_pedido_min: '8',
  plato_listo_sin_retirar_min: '3',
  cuenta_pedida_min: '5',
  take_away_activo: '1',
  propina_sugerida_pct: '10',
  reserva_aviso_min: '45',
  // Datos de ejemplo para el ticket. En una instalación real los carga el
  // contador del local desde Admin → Configuración.
  direccion_local: 'Av. Rivadavia 4820',
  localidad_local: 'C1424 · Caballito, CABA',
  cuit_local: '30-71234567-4',
  ingresos_brutos: '901-234567-8',
  condicion_iva: 'Responsable Inscripto',
  inicio_actividades: '01/03/2019',
  pie_ticket: '¡Gracias por su visita!',
};
