/** Todas las medidas se guardan en milímetros; las unidades son solo de presentación. */
export type Units = 'cm' | 'in';

export const MM_PER_INCH = 25.4;
/** Paso de redondeo en pulgadas: 1/16″. */
export const INCH_STEP_MM = MM_PER_INCH / 16;

/** Número sin unidad: "72,5" en cm o "2 7/8" en pulgadas (fracciones de 1/16). */
export function formatNumber(mm: number, units: Units): string {
  if (units === 'cm') {
    return (Math.round(mm) / 10).toLocaleString('es-AR', { maximumFractionDigits: 1 });
  }
  const inch = mm / MM_PER_INCH;
  let whole = Math.floor(inch + 1e-9);
  let sixteenths = Math.round((inch - whole) * 16);
  if (sixteenths === 16) {
    whole += 1;
    sixteenths = 0;
  }
  let out = whole ? String(whole) : '';
  if (sixteenths) {
    let num = sixteenths;
    let den = 16;
    while (num % 2 === 0) {
      num /= 2;
      den /= 2;
    }
    out += (out ? ' ' : '') + `${num}/${den}`;
  }
  return out || '0';
}

export function formatLength(mm: number, units: Units): string {
  return formatNumber(mm, units) + (units === 'cm' ? ' cm' : '″');
}

/** Lee lo que escribe el usuario ("72,5", "2 7/8", "3/4″") y devuelve mm, o null si no se entiende. */
export function parseLength(input: string, units: Units): number | null {
  const s = input.trim().replace(/["″]|pulgadas|in|cm/gi, '').trim();
  if (!s) return null;
  if (units === 'cm') {
    const v = Number(s.replace(',', '.'));
    return Number.isFinite(v) ? v * 10 : null;
  }
  const m = s.match(/^(\d+(?:[.,]\d+)?)?(?:[\s-]*(\d+)\/(\d+))?$/);
  if (!m || (!m[1] && !m[2])) return null;
  let v = m[1] ? Number(m[1].replace(',', '.')) : 0;
  if (m[2] && m[3]) {
    const den = Number(m[3]);
    if (den === 0) return null;
    v += Number(m[2]) / den;
  }
  return v * MM_PER_INCH;
}

/** Redondea al paso de la unidad: 1 mm en cm, 1/16″ en pulgadas. */
export function roundToUnit(mm: number, units: Units): number {
  return units === 'cm' ? Math.round(mm) : Math.round(mm / INCH_STEP_MM) * INCH_STEP_MM;
}
