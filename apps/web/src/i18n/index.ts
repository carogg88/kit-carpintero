import { addMessages, setLang, t, type Lang } from '@kitc/core';

/** Cada pantalla trae su archivo de traducciones: en-<pantalla>.ts con `export default { 'español': 'English' }`. */
const files = import.meta.glob<{ default: Record<string, string> }>('./en-*.ts', { eager: true });

let loaded = false;
/** Suma todas las traducciones de la app (también en el worker del motor). */
export function loadMessages(): void {
  if (loaded) return;
  loaded = true;
  for (const f of Object.values(files)) addMessages(f.default);
}

const KEY = 'kit-idioma';

/** El idioma elegido, o el del navegador: español si lo pide, si no inglés. */
export function preferredLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'es' || saved === 'en') return saved;
  } catch {
    // Sin almacenamiento (modo privado): se usa el del navegador.
  }
  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
}

/** Arranca la app en el idioma preferido. */
export function initLang(): Lang {
  loadMessages();
  const lang = preferredLang();
  setLang(lang);
  document.documentElement.lang = lang;
  return lang;
}

/** Cambia de idioma y recarga: así todo, hasta el plano, sale de nuevo en el idioma nuevo. */
export function switchLang(lang: Lang): void {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // Si no se puede guardar, igual cambia en esta visita.
  }
  setLang(lang);
  location.reload();
}

/** El nombre que trae un proyecto en blanco, en los dos idiomas. */
const BLANK_NAMES = new Set(['Proyecto nuevo', 'New project']);

/** El nombre a mostrar: si es el de un proyecto en blanco sin renombrar, en el idioma de ahora. */
export function projectName(name: string): string {
  return BLANK_NAMES.has(name) ? t('Proyecto nuevo') : name;
}
