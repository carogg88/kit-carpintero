import { describe, expect, it } from 'vitest';
import { buildTemplate, TEMPLATES, templateDefaults } from '@kitc/core';
import { PHOTO_SIZES, sizeCaption } from './photo';

describe('foto del mueble', () => {
  it('escribe las medidas generales del mueble, en la unidad del proyecto', () => {
    const def = TEMPLATES.find((x) => x.id === 'mesa')!;
    const p = buildTemplate(def, templateDefaults(def), 'guatambu', undefined, '2026-10-27T00:00:00Z');
    expect(sizeCaption(p)).toBe('Ancho 180 cm · Alto 75 cm · Fondo 90 cm');
    expect(sizeCaption({ ...p, parts: [] })).toBe('');
  });

  it('el tamaño más grande no pasa de 4096 px, lo que aguanta casi cualquier placa de video', () => {
    expect(Math.max(...Object.values(PHOTO_SIZES))).toBe(4096);
  });
});
