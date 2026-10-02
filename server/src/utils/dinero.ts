/**
 * Toda la plata se calcula en centavos enteros y se guarda como DECIMAL(12,2).
 * Nunca se suman ni se multiplican floats de pesos.
 */

export function aCentavos(valor: string | number | null | undefined): number {
  if (valor === null || valor === undefined || valor === '') return 0;
  const n = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function aPesos(centavos: number): string {
  return (Math.round(centavos) / 100).toFixed(2);
}

export function sumar(...valores: number[]): number {
  return valores.reduce((acc, v) => acc + Math.round(v), 0);
}

/** Reparte un monto en n partes sin perder centavos: el resto va a las primeras. */
export function repartir(centavos: number, partes: number): number[] {
  if (partes < 1) return [centavos];
  const base = Math.floor(centavos / partes);
  const resto = centavos - base * partes;
  return Array.from({ length: partes }, (_, i) => base + (i < resto ? 1 : 0));
}

/** Neto e IVA a partir de un total que ya incluye IVA. */
export function desglosarIva(totalCentavos: number, alicuota: number): { neto: number; iva: number } {
  const factor = 1 + alicuota / 100;
  const neto = Math.round(totalCentavos / factor);
  return { neto, iva: totalCentavos - neto };
}

export function formatear(centavos: number): string {
  const signo = centavos < 0 ? '-' : '';
  const abs = Math.abs(centavos);
  const entero = Math.floor(abs / 100).toLocaleString('es-AR');
  const dec = String(abs % 100).padStart(2, '0');
  return `${signo}$${entero},${dec}`;
}
