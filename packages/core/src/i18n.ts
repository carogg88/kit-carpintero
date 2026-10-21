/**
 * Idiomas: el texto se escribe en español en el código y `t` lo cambia por su traducción.
 * La clave es la frase en español con lugares `{nombre}` para lo que varía: "Hoja {n} de {total}".
 */
import { MESSAGES_EN } from './messages-en';

export type Lang = 'es' | 'en';

let current: Lang = 'es';
const english = new Map<string, string>(Object.entries(MESSAGES_EN));

/** Elige el idioma de todo lo que se arma de ahora en más. */
export function setLang(lang: Lang): void {
  current = lang;
}

export const getLang = (): Lang => current;

/** Suma traducciones al inglés: { 'frase en español': 'English phrase' }. */
export function addMessages(messages: Record<string, string>): void {
  for (const [es, en] of Object.entries(messages)) english.set(es, en);
}

/** Frases sin traducir: para los tests que revisan que no falte ninguna. */
export const hasMessage = (es: string): boolean => english.has(es);

/** La frase en el idioma actual, con los `{lugares}` completados. */
export function t(es: string, vars?: Record<string, string | number>): string {
  const text = current === 'en' ? (english.get(es) ?? es) : es;
  return vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text;
}

/**
 * Marca una frase para traducir sin traducirla todavía: para tablas que se arman al cargar el módulo
 * (antes de elegir el idioma). Se traduce al mostrarla, con `t(tabla[clave])`.
 */
export const tk = <S extends string>(es: S): S => es;

/** Locale para números y fechas. */
export const locale = (): string => (current === 'en' ? 'en-US' : 'es-AR');
