/**
 * Arrastres suaves: un movimiento chico de la mano cambia poco la pieza. Los primeros píxeles no hacen nada (un
 * toque no mueve), los que siguen avanzan como mucho medio milímetro cada uno y recién después el arrastre sigue
 * al dedo. Así llegar a 3 mm o a 2 cm es fácil aunque la vista muestre la mesa entera.
 */
export const DEAD_PX = 6;
const SLOW_PX = 96;
const SLOW_MM_PER_PX = 0.5;

/**
 * Cuántos mm avanza un arrastre de `px` píxeles que, siguiendo al dedo, habría avanzado `worldMm`.
 * Conserva el signo de `worldMm`.
 */
export function gentle(px: number, worldMm: number): number {
  if (px <= DEAD_PX || worldMm === 0) return 0;
  const k = Math.abs(worldMm) / px;
  const slow = Math.min(SLOW_MM_PER_PX, k);
  const mm = px <= SLOW_PX ? (px - DEAD_PX) * slow : (SLOW_PX - DEAD_PX) * slow + (px - SLOW_PX) * k;
  return Math.sign(worldMm) * mm;
}

/** Medida redonda: al mm hasta 2 cm, cada 5 mm después. */
export function roundMeasure(mm: number): number {
  return Math.abs(mm) < 20 ? Math.round(mm) : Math.round(mm / 5) * 5;
}
