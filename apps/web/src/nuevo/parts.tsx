import type { ReactNode } from 'react';
import type { Units } from '@kitc/core';
import { IconBack } from '../editor/icons';
import styles from './Nuevo.module.css';

export function BackHeader({ overline, title, back, children }: { overline?: string; title: string; back: string; children?: ReactNode }) {
  return (
    <header className={styles.header}>
      <a href={back} className={styles.back} aria-label="Volver al inicio">
        <IconBack />
      </a>
      <div className={styles.titles}>
        {overline && <span className={styles.overline}>{overline}</span>}
        <h1 className={styles.h1}>{title}</h1>
      </div>
      {children}
    </header>
  );
}

export function UnitsToggle({ units, onChange }: { units: Units; onChange: (u: Units) => void }) {
  return (
    <div className={styles.units} role="group" aria-label="Unidades">
      <button type="button" aria-pressed={units === 'cm'} onClick={() => onChange('cm')}>
        cm
      </button>
      <button type="button" aria-pressed={units === 'in'} onClick={() => onChange('in')}>
        pulg.
      </button>
    </div>
  );
}
