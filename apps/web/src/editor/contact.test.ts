import { describe, expect, it } from 'vitest';
import type { Box } from '@kitc/core';
import { contactFaces } from './contact';

describe('contactFaces', () => {
  const leg: Box = { min: [0, 0, 0], max: [45, 450, 45] };

  it('ilumina la parte de la cara que se toca', () => {
    const rail: Box = { min: [45, 300, 10], max: [400, 380, 30] };
    expect(contactFaces(leg, [rail])).toEqual([{ min: [45, 300, 10], max: [45, 380, 30] }]);
  });

  it('una pieza metida adentro de otra no es una cara de contacto', () => {
    const tenon: Box = { min: [30, 300, 10], max: [400, 380, 30] };
    expect(contactFaces(leg, [tenon])).toEqual([]);
  });

  it('dos piezas que se tocan solo en una arista no se iluminan', () => {
    const corner: Box = { min: [45, 450, 0], max: [90, 500, 45] };
    expect(contactFaces(leg, [corner])).toEqual([]);
  });

  it('apoyada en el piso de otra pieza, la cara es la de arriba', () => {
    const top: Box = { min: [0, 450, 0], max: [400, 470, 400] };
    expect(contactFaces(leg, [top])).toEqual([{ min: [0, 450, 0], max: [45, 450, 45] }]);
  });
});
