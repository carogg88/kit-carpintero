import { decimal } from './cutsData';
import { SHEETS, sheetById, t, tk, WOODS } from '@kitc/core';

const HARDNESS = { dura: tk('dura'), semidura: tk('semidura'), blanda: tk('blanda') } as const;

/** Maderas macizas y, si se puede, placas, en dos grupos del desplegable. */
export function MaterialOptions({ sheets = true }: { sheets?: boolean }) {
  return (
    <>
      <optgroup label={t('Madera maciza')}>
        {WOODS.map((w) => (
          <option key={w.id} value={w.id}>
            {t(w.name)} · {t(HARDNESS[w.hardness])}
          </option>
        ))}
      </optgroup>
      {sheets && (
        <optgroup label={t('Placas')}>
          {SHEETS.map((s) => (
            <option key={s.id} value={s.id}>
              {t(s.name)} · {t('placa')}
            </option>
          ))}
        </optgroup>
      )}
    </>
  );
}

/** "Placas de 260 × 183 cm, de 9, 12, 15 o 18 mm." */
export function sheetNote(id: string): string | null {
  const s = sheetById(id);
  if (!s) return null;
  const list = s.thicknesses.map((v) => decimal(v));
  return t('Placas de {l} × {w} cm, de {list} mm.', {
    l: s.size[0] / 10,
    w: s.size[1] / 10,
    list: list.length > 1 ? t('{a} o {b}', { a: list.slice(0, -1).join(', '), b: list.at(-1)! }) : list[0]!,
  });
}
