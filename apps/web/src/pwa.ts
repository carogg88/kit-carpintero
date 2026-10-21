import { useSyncExternalStore } from 'react';

/** Evento que da el navegador cuando la app se puede instalar (Chrome, Edge, Android). */
interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let installPrompt: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

/** Registra el service worker (solo en el build: en desarrollo molestaría con copias viejas) y escucha si se puede instalar. */
export function setUpApp(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e as InstallPrompt;
    changed();
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    changed();
  });
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
        // Sin service worker la app anda igual, solo que necesita conexión.
      });
    });
  }
}

/** Si el navegador ofrece instalarla, la función que abre su cartel; si no, null. */
export function useInstall(): (() => void) | null {
  const prompt = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => installPrompt,
  );
  if (!prompt) return null;
  return () => {
    void prompt.prompt();
    void prompt.userChoice.finally(() => {
      installPrompt = null;
      changed();
    });
  };
}
