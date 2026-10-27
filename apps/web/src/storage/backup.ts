import { t, type Project } from '@kitc/core';

/** Cuándo se exportó cada proyecto por última vez, en este navegador. */
const exportKey = (id: string) => `kitc:exportado:${id}`;
export function readExported(id: string): string | null {
  try {
    return localStorage.getItem(exportKey(id));
  } catch {
    return null;
  }
}

/** Baja el proyecto como archivo .kitc.json y anota cuándo. Devuelve esa fecha. */
export function download(p: Project) {
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${p.name.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || t('proyecto')}.kitc.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  const at = new Date().toISOString();
  try {
    localStorage.setItem(exportKey(p.id), at);
  } catch {
    // Sin almacenamiento: el recordatorio vuelve a aparecer.
  }
  return at;
}
