import { useState } from 'react';
import { formatLength, type Units } from '@kitc/core';
import styles from './App.module.css';

const TEMPLATES = [
  { id: 'mesa', name: 'Mesa', size: [1800, 750, 900] },
  { id: 'taburete', name: 'Taburete', size: [380, 650, 380] },
  { id: 'estante', name: 'Estante', size: [900, 1800, 300] },
  { id: 'caja', name: 'Caja de té', size: [240, 90, 160] },
] as const;

export function App() {
  const [units, setUnits] = useState<Units>('cm');

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <svg width="26" height="26" viewBox="0 0 28 28" aria-hidden="true">
            <rect x="3" y="6" width="22" height="5" rx="1" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M6 11v13M22 11v13" stroke="currentColor" strokeWidth="2" />
          </svg>
          Kit Carpintero
        </div>
        <div className={styles.seg} role="group" aria-label="Unidades">
          {(['cm', 'in'] as const).map((u) => (
            <button key={u} type="button" aria-pressed={units === u} onClick={() => setUnits(u)}>
              {u === 'cm' ? 'cm' : 'pulgadas'}
            </button>
          ))}
        </div>
      </header>

      <main className={styles.main}>
        <h1 className={styles.title}>¿Qué mueble vas a hacer?</h1>
        <p className={styles.lead}>Elegí una plantilla para empezar. El editor llega en los próximos pasos.</p>
        <ul className={styles.grid}>
          {TEMPLATES.map((t) => (
            <li key={t.id} className={styles.card}>
              <span className={styles.cardName}>{t.name}</span>
              <span className={styles.cardSize}>{t.size.map((mm) => formatLength(mm, units)).join(' × ')}</span>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
