import { describe, expect, it } from 'vitest';
import { RECIPES } from '../help/recipes';
import { helpContent, searchArticles } from './content';
import { EN } from './en';
import { ES } from './es';
import type { Article, Block } from './types';

/** La forma de un bloque, sin el texto: lo que tiene que coincidir entre idiomas. */
const shape = (b: Block) => {
  if (b.kind === 'steps' || b.kind === 'list') return `${b.kind}:${b.items.length}`;
  if (b.kind === 'table') return `table:${b.head.length}x${b.rows.length}:${b.rows.map((r) => r.length).join(',')}`;
  if (b.kind === 'img') return `img:${b.src}:${b.phone ?? false}`;
  return b.kind;
};
const outline = (a: Article) => ({
  id: a.id,
  topic: a.topic,
  intro: a.intro.map(shape),
  sections: a.sections.map((s) => ({ id: s.id, blocks: s.blocks.map(shape) })),
  faq: a.faq?.length ?? 0,
  related: a.related ?? [],
});
const texts = (a: Article) =>
  [...a.intro, ...a.sections.flatMap((s) => s.blocks)].flatMap((b) =>
    b.kind === 'steps' || b.kind === 'list' ? b.items : b.kind === 'table' ? b.rows.flat() : b.kind === 'img' ? [] : [b.text],
  );

describe('Centro de ayuda', () => {
  it('el inglés tiene los mismos temas, artículos, secciones y pasos que el español', () => {
    expect(EN.topics.map((x) => [x.id, x.icon])).toEqual(ES.topics.map((x) => [x.id, x.icon]));
    expect(EN.articles.map(outline)).toEqual(ES.articles.map(outline));
    expect(EN.popular).toEqual(ES.popular);
    expect(EN.suggestions).toHaveLength(ES.suggestions.length);
  });

  it('los enlaces, los relacionados y lo más leído llevan a artículos que existen', () => {
    const ids = new Set([...ES.articles.map((a) => a.id), ...RECIPES.map((r) => r.id)]);
    expect(ids.size).toBe(ES.articles.length + RECIPES.length);
    for (const c of [ES, EN]) {
      const linked = c.articles.flatMap((a) => [...(a.related ?? []), ...texts(a).flatMap((s) => [...s.matchAll(/\]\(([a-z0-9-]+)\)/g)].map((m) => m[1]!))]);
      expect(linked.filter((id) => !ids.has(id))).toEqual([]);
      expect(c.popular.filter((id) => !ids.has(id))).toEqual([]);
      expect(c.articles.every((a) => c.topics.some((x) => x.id === a.topic))).toBe(true);
    }
  });

  it('cada captura está en public/ayuda', () => {
    const srcs = ES.articles.flatMap((a) => [...a.intro, ...a.sections.flatMap((s) => s.blocks)]).flatMap((b) => (b.kind === 'img' ? [b.src] : []));
    expect(srcs.length).toBeGreaterThan(0);
    // Solo los nombres: las capturas no se cargan.
    const files = new Set(Object.keys(import.meta.glob('../../public/ayuda/*.jpg')).map((f) => f.slice(f.lastIndexOf('/') + 1, -'.jpg'.length)));
    expect(srcs.filter((s) => !files.has(s))).toEqual([]);
  });

  it('la búsqueda encuentra sin tildes y con plurales, el título primero', () => {
    const c = helpContent();
    expect(c.articles.filter((a) => a.topic === 'como-hacer')).toHaveLength(RECIPES.length);
    expect(searchArticles(c, 'cajones')[0]?.id).toBe('cajon');
    expect(searchArticles(c, 'PULGADAS').map((a) => a.id)).toContain('unidades');
    expect(searchArticles(c, 'de')).toEqual([]);
    expect(searchArticles(c, 'xyzzy madera')).toEqual([]);
  });
});
