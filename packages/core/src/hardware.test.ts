import { describe, expect, it } from 'vitest';
import { cutPlan } from './cutlist';
import { hardwareList, hingesFor } from './hardware';
import { buildTemplate, templateById } from './templates';

const now = '2026-10-22T00:00:00Z';
const list = (id: string, wood: string, v: Record<string, number> = {}) => {
  const p = buildTemplate(templateById(id)!, v, wood, undefined, now);
  return hardwareList(p, cutPlan(p));
};
const qty = (rows: ReturnType<typeof list>, id: string) => rows.find((r) => r.id === id)?.qty ?? 0;

describe('herrajes y consumibles', () => {
  it('la cajonera: un par de correderas por cajón, tiradores, tapacanto y nada de lija en melamina', () => {
    const rows = list('cajonera', 'melamina', { drawers: 4 });
    expect(rows.find((r) => r.id.startsWith('corredera|'))).toMatchObject({ qty: 4, unit: 'par' });
    // Frentes de 76 cm: dos tiradores cada uno. Uno solo si el frente mide hasta 60 cm.
    expect(qty(rows, 'tirador')).toBe(8);
    expect(qty(list('cajonera', 'melamina', { drawers: 3, width: 500 }), 'tirador')).toBe(3);
    expect(rows.some((r) => r.id.startsWith('tapacanto|'))).toBe(true);
    expect(rows.some((r) => r.id.startsWith('lija|') || r.id === 'terminacion')).toBe(false);
  });

  it('la alacena: dos bisagras por puerta, embutidas, y clavos para la trasera', () => {
    const rows = list('alacena', 'cedro');
    expect(qty(rows, 'bisagra|18')).toBe(4);
    expect(qty(rows, 'tirador')).toBe(2);
    expect(qty(rows, 'clavo')).toBeGreaterThan(0);
  });

  it('la mesa: botones para la tapa en los faldones, no en las patas, y lija con terminación', () => {
    const rows = list('mesa', 'guatambu');
    // Uno cada 25 cm: 6 en cada faldón largo y 3 en cada corto.
    expect(qty(rows, 'boton')).toBe(18);
    expect(qty(rows, 'tornillo|4x25')).toBe(18);
    expect(qty(rows, 'grampa')).toBe(0);
    expect(qty(rows, 'tornillo')).toBe(0);
    expect(['lija|80', 'lija|120', 'lija|180'].every((id) => qty(rows, id) > 0)).toBe(true);
    expect(qty(rows, 'terminacion')).toBeGreaterThan(0);
    expect(rows.some((r) => r.id.startsWith('cola|'))).toBe(true);
  });

  it('la caja de té: la tapa va con bisagras chicas', () => {
    const rows = list('caja', 'cedro');
    expect(qty(rows, 'bisagra-tapa')).toBe(2);
    expect(qty(rows, 'tornillo')).toBe(0);
  });

  it('el MDF se sella y se pinta', () => {
    const rows = list('biblioteca', 'mdf');
    expect(qty(rows, 'sellador-mdf')).toBeGreaterThan(0);
    expect(qty(rows, 'pintura')).toBeGreaterThan(0);
    expect(qty(rows, 'terminacion')).toBe(0);
  });

  it('bisagras según el alto de la puerta', () => {
    expect(hingesFor(600)).toBe(2);
    expect(hingesFor(1200)).toBe(3);
    expect(hingesFor(2000)).toBe(4);
  });
});
