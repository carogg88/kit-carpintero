import { getLang, t } from '@kitc/core';
import { RECIPES } from '../help/recipes';
import { EN } from './en';
import { ES } from './es';
import { SHOW } from './show';
import { steps, type Article, type HelpContent } from './types';

const RECIPE_TOPIC = 'como-hacer';

/** Las recetas cortas son artículos del tema "Cómo hacer…": sus pasos ya vienen traducidos con t(). */
function recipeArticles(): Article[] {
  return RECIPES.map((r) => ({
    id: r.id,
    topic: RECIPE_TOPIC,
    title: t(r.title),
    summary: t(r.steps[0]!),
    intro: [],
    sections: [{ id: 'pasos', title: t('Paso a paso'), blocks: [steps(...r.steps.map((s) => t(s)))] }],
    show: r.show,
  }));
}

let cache: { lang: string; content: HelpContent } | null = null;

/** El Centro de ayuda en el idioma de la app. */
export function helpContent(): HelpContent {
  const lang = getLang();
  if (cache?.lang === lang) return cache.content;
  const base = lang === 'en' ? EN : ES;
  const articles = base.articles.map((a) => (a.show || !SHOW[a.id] ? a : { ...a, show: SHOW[a.id] }));
  const content = { ...base, articles: [...articles, ...recipeArticles()] };
  cache = { lang, content };
  return content;
}

export const articleById = (c: HelpContent, id: string) => c.articles.find((a) => a.id === id);
export const topicById = (c: HelpContent, id: string) => c.topics.find((x) => x.id === id);
export const topicArticles = (c: HelpContent, topic: string) => c.articles.filter((a) => a.topic === topic);

/** Sin mayúsculas, tildes ni marcas, para buscar "cajon" y encontrar "Cajón". */
const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[*`[\]()]/g, ' ');

/** El texto de un artículo, para buscar en todo lo que dice. */
function articleText(a: Article): string {
  const blocks = [...a.intro, ...a.sections.flatMap((s) => s.blocks)];
  const parts = blocks.flatMap((b) => {
    if (b.kind === 'steps' || b.kind === 'list') return b.items;
    if (b.kind === 'table') return [...b.head, ...b.rows.flat()];
    if (b.kind === 'img') return [b.alt];
    return [b.text];
  });
  return [...a.sections.map((s) => s.title), ...parts, ...(a.faq ?? []).flatMap((f) => [f.q, f.a])].join(' ');
}

/**
 * Artículos que tienen todas las palabras buscadas, los que las tienen en el título primero. Las palabras de una
 * o dos letras ("un", "de") no cuentan.
 */
export function searchArticles(c: HelpContent, query: string): Article[] {
  const words = fold(query)
    .split(/\s+/)
    .filter((w) => w.length > 2);
  if (!words.length) return [];
  const scored = c.articles.map((a) => {
    const title = fold(`${a.title} ${a.summary}`);
    const body = fold(articleText(a));
    // El singular también vale: "piezas" encuentra "pieza" y "cajones", "cajón".
    const has = (text: string, w: string) => text.includes(w) || (w.length > 4 && text.includes(w.replace(/e?s$/, '')));
    if (!words.every((w) => has(title, w) || has(body, w))) return { a, score: 0 };
    return { a, score: 1 + words.filter((w) => has(title, w)).length * 2 };
  });
  return scored
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score)
    .map((x) => x.a);
}
