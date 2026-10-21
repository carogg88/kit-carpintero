import { describe, expect, it } from 'vitest';
import { hasMessage } from '@kitc/core';
import { loadMessages } from '.';

// El código de la app y del núcleo como texto, para buscar cada `t('…')` y `tk('…')`.
const sources = {
  ...import.meta.glob<string>(['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}'], { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob<string>(['../../../../packages/core/src/**/*.ts', '!../../../../packages/core/src/**/*.test.ts'], { query: '?raw', import: 'default', eager: true }),
};

describe('traducciones', () => {
  it('toda frase de la app tiene su versión en inglés', () => {
    loadMessages();
    const all = Object.entries(sources).flatMap(([file, src]) =>
      [...src.matchAll(/\btk?\(\s*(['"])((?:\\.|(?!\1).)*)\1/g)].map((m) => ({ file, key: m[2]!.replace(/\\(['"\\])/g, '$1') })),
    );
    expect(Object.keys(sources).length).toBeGreaterThan(30);
    expect(all.filter((k) => !hasMessage(k.key)).map((k) => `${k.file}: ${k.key}`)).toEqual([]);
  });
});
