import { describe, expect, it } from 'vitest';
import { decodeShare, encodeShare } from './share';
import { buildTemplate, templateById } from './templates';

const now = '2026-10-22T00:00:00Z';

describe('compartir por enlace', () => {
  it('el proyecto vuelve igual del enlace', async () => {
    const p = buildTemplate(templateById('cajonera')!, {}, 'melamina', undefined, now);
    const data = await encodeShare(p);
    expect(data).toMatch(/^[A-Za-z0-9_-]+$/);
    // Una cajonera de 26 piezas entra en un enlace corto.
    expect(data.length).toBeLessThan(6000);
    const r = await decodeShare(data);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.project).toEqual(p);
  });

  it('un enlace roto avisa, no rompe', async () => {
    const data = await encodeShare(buildTemplate(templateById('mesa')!, {}, 'guatambu', undefined, now));
    const r = await decodeShare(data.slice(0, 40));
    expect(r.ok).toBe(false);
    expect((await decodeShare('no-es-un-proyecto')).ok).toBe(false);
  });
});
