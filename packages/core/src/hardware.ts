import { boxSize, overlapBox, partBox, type Box } from './geometry';
import { jointGeometry } from './joints';
import { boardPieces, dowelsNeeded, type CutPlan } from './cutlist';
import type { Part, Project } from './project';
import { isSheet, sheetById } from './woods';
import { t } from './i18n';

/**
 * Herrajes y consumibles: lo que hay que comprar además de la madera, calculado desde los encastres,
 * los cajones, las puertas y la superficie de las piezas. Las cantidades son para comprar, redondeadas hacia arriba.
 */

/** Cómo se compra: por unidad, por par, por metro, por hoja o por litro. */
export type HardwareUnit = 'u' | 'par' | 'm' | 'hoja' | 'l';

export interface HardwareRow {
  /** Clave estable (para guardar su precio y tildarla en la lista), sin el idioma. */
  id: string;
  name: string;
  qty: number;
  unit: HardwareUnit;
  /** Para qué es, en pocas palabras. */
  note?: string;
}

/** Largos de correderas metálicas que se consiguen, en mm. */
const SLIDE_LENGTHS = [250, 300, 350, 400, 450, 500, 550, 600];

const isDrawer = (p: Part) => /^K\d+$/.test(p.id);
const isDoor = (p: Part) => /^D\d+$/.test(p.id);

const touches = (a: Box, b: Box) => overlapBox({ min: a.min.map((v) => v - 0.6) as Box['min'], max: a.max.map((v) => v + 0.6) as Box['max'] }, b) !== null;

/** Piezas que se tocan, agrupadas: cada grupo es un cajón o una hoja de puerta. */
function clusters(parts: Part[]): Part[][] {
  const left = [...parts];
  const out: Part[][] = [];
  while (left.length) {
    const group = [left.shift()!];
    for (let i = 0; i < group.length; i++) {
      const b = partBox(group[i]!);
      for (let j = left.length - 1; j >= 0; j--) {
        if (touches(b, partBox(left[j]!))) group.push(...left.splice(j, 1));
      }
    }
    out.push(group);
  }
  return out;
}

const unionOf = (parts: Part[]): Box => {
  const bs = parts.map(partBox);
  return {
    min: [0, 1, 2].map((k) => Math.min(...bs.map((b) => b.min[k]!))) as Box['min'],
    max: [0, 1, 2].map((k) => Math.max(...bs.map((b) => b.max[k]!))) as Box['max'],
  };
};

/** Bisagras por hoja según el alto: dos hasta 90 cm, tres hasta 160 cm, y una más cada 50 cm. */
export const hingesFor = (height: number) => (height <= 900 ? 2 : height <= 1600 ? 3 : 3 + Math.ceil((height - 1600) / 500));

const surface = (p: Part) => {
  const [x, y, z] = boxSize(partBox(p));
  return 2 * (x * y + x * z + y * z);
};

const add = (rows: HardwareRow[], row: HardwareRow) => {
  if (row.qty <= 0) return;
  const same = rows.find((r) => r.id === row.id);
  if (same) same.qty += row.qty;
  else rows.push(row);
};

export function hardwareList(project: Project, plan: CutPlan): HardwareRow[] {
  const rows: HardwareRow[] = [];
  const boxes = project.parts.filter((p) => p.base.kind === 'box');
  const carcass = boxes.filter((p) => !isDrawer(p) && !isDoor(p));
  const zFront = carcass.length ? Math.max(...carcass.map((p) => partBox(p).max[2])) : 0;

  for (const d of dowelsNeeded(project)) {
    add(rows, { id: `tarugo|${d.diameter}|${d.length}`, name: t('Tarugos de {d} × {len} mm', { d: d.diameter, len: Math.round(d.length) }), qty: d.count, unit: 'u' });
  }

  // Cajones: correderas metálicas si el cajón deja lugar a los costados, y un tirador por frente.
  for (const drawer of clusters(boxes.filter(isDrawer))) {
    const front = drawer.reduce((a, b) => (partBox(b).max[2] > partBox(a).max[2] ? b : a));
    const body = drawer.filter((p) => p !== front);
    const pulls = boxSize(partBox(front))[0] > 600 ? 2 : 1;
    add(rows, { id: 'tirador', name: t('Tiradores o manijas'), qty: pulls, unit: 'u', note: t('para cajones y puertas') });
    if (!body.length) continue;
    const box = unionOf(body);
    const gap = Math.min(
      ...carcass
        .map(partBox)
        .filter((c) => c.max[1] > box.min[1] && c.min[1] < box.max[1] && c.max[2] > box.min[2] && c.min[2] < box.max[2])
        .flatMap((c) => [box.min[0] - c.max[0], c.min[0] - box.max[0]])
        .filter((g) => g > -0.6),
    );
    if (gap >= 10 && Number.isFinite(gap)) {
      const depth = box.max[2] - box.min[2];
      const len = SLIDE_LENGTHS.filter((l) => l <= depth + 5).at(-1) ?? SLIDE_LENGTHS[0]!;
      add(rows, { id: `corredera|${len}`, name: t('Correderas telescópicas de {len} cm', { len: len / 10 }), qty: 1, unit: 'par', note: t('un par por cajón') });
    }
  }

  // Puertas: bisagras de cazoleta según el alto de cada hoja; codo 0 si tapa el canto, codo 18 si va embutida.
  for (const leaf of clusters(boxes.filter(isDoor))) {
    const b = unionOf(leaf);
    const overlay = b.min[2] >= zFront - 0.6;
    const n = hingesFor(b.max[1] - b.min[1]);
    add(
      rows,
      overlay
        ? { id: 'bisagra|0', name: t('Bisagras de cazoleta 35 mm, codo 0'), qty: n, unit: 'u', note: t('puerta superpuesta') }
        : { id: 'bisagra|18', name: t('Bisagras de cazoleta 35 mm, codo 18'), qty: n, unit: 'u', note: t('puerta embutida') },
    );
    add(rows, { id: 'tirador', name: t('Tiradores o manijas'), qty: 1, unit: 'u', note: t('para cajones y puertas') });
  }

  // Estantes sin encastre: van sobre cuatro soportes.
  for (const p of boxes) {
    if (!/^E\d+$/.test(p.id) || project.joints.some((j) => j.partA === p.id || j.partB === p.id)) continue;
    add(rows, { id: 'soporte', name: t('Soportes de estante de 5 mm'), qty: 4, unit: 'u', note: t('cuatro por estante regulable') });
  }

  // Una caja chica con tapa suelta arriba: la tapa va con dos bisagras chicas, no atornillada.
  const all = boxes.length ? unionOf(boxes) : null;
  const lid =
    all && all.max[1] - all.min[1] <= 400
      ? boxes.find((p) => {
          const b = partBox(p);
          return b.max[1] === all.max[1] && b.min[0] <= all.min[0] + 0.6 && b.max[0] >= all.max[0] - 0.6 && b.min[2] <= all.min[2] + 0.6 && b.max[2] >= all.max[2] - 0.6;
        })
      : undefined;
  if (lid && project.joints.some((j) => j.type === 'tope' && (j.partA === lid.id || j.partB === lid.id))) {
    add(rows, { id: 'bisagra-tapa', name: t('Bisagras chicas de bronce'), qty: 2, unit: 'u', note: t('para la tapa') });
  }

  // Lo que apoya sin encastre se atornilla; las traseras y fondos finos se clavan cada 15 cm.
  for (const j of project.joints) {
    const a = project.parts.find((p) => p.id === j.partA);
    const b = project.parts.find((p) => p.id === j.partB);
    if (!a || !b || a.base.kind !== 'box' || b.base.kind !== 'box') continue;
    const [ba, bb] = [partBox(a), partBox(b)];
    if (j.type === 'bolsillo') {
      const g = jointGeometry('bolsillo', ba, bb, j.params);
      add(rows, { id: 'tornillo-bolsillo', name: t('Tornillos para agujero de bolsillo'), qty: Math.round((g?.cutB.length ?? 0) / 2), unit: 'u' });
    }
    if (j.type === 'galleta') {
      const g = jointGeometry('galleta', ba, bb, j.params);
      add(rows, { id: 'galleta', name: t('Galletas n.º 20'), qty: g?.cutA.length ?? 0, unit: 'u' });
    }
    if (j.type !== 'tope' || isDrawer(a) || isDoor(a) || a === lid || b === lid) continue;
    const thin = Math.min(...boxSize(ba), ...boxSize(bb)) <= 9;
    if (thin) {
      const o = overlapBox({ min: ba.min.map((v) => v - 0.6) as Box['min'], max: ba.max.map((v) => v + 0.6) as Box['max'] }, bb);
      const len = o ? Math.max(...boxSize(o)) : 0;
      add(rows, { id: 'clavo', name: t('Clavos o tornillos de 3 × 20 mm'), qty: Math.ceil(len / 150) + 1, unit: 'u', note: t('para traseras y fondos') });
    } else {
      // Una tapa o un asiento macizo se sujeta a los faldones con grampas, que la dejan moverse con la humedad.
      const wide = (x: Box) => [...boxSize(x)].sort((m, n) => m - n)[1]! >= 250;
      const post = (x: Box) => {
        const s1 = [...boxSize(x)].sort((m, n) => m - n)[1];
        return s1! <= 100 && boxSize(x)[1] > 2 * s1!;
      };
      const [top, other] = wide(ba) ? [ba, bb] : wide(bb) ? [bb, ba] : [null, null];
      if (top && other && !isSheet(top === ba ? a.wood : b.wood)) {
        if (!post(other)) add(rows, { id: 'grampa', name: t('Grampas para tapa'), qty: 2, unit: 'u', note: t('sujetan la tapa sin trabarla') });
      } else add(rows, { id: 'tornillo', name: t('Tornillos para madera de 4 × 40 mm'), qty: 2, unit: 'u', note: t('para lo que apoya sin encastre') });
    }
  }

  for (const b of plan.banding) {
    const name = sheetById(b.material)?.name ?? b.material;
    add(rows, { id: `tapacanto|${b.material}|${b.width}`, name: t('Tapacanto de {sheet} de {w} mm', { sheet: t(name).toLocaleLowerCase(), w: b.width }), qty: b.meters, unit: 'm' });
  }

  // Cola si hay encastres o tapas de tiras encoladas.
  const glued = project.joints.some((j) => j.type !== 'tope') || plan.boards.some((b) => boardPieces(b).some((s) => s.id.includes('·')));
  if (glued) {
    const big = boxes.length > 20;
    add(rows, { id: big ? 'cola|500' : 'cola|250', name: big ? t('Cola vinílica para madera, 500 g') : t('Cola vinílica para madera, 250 g'), qty: 1, unit: 'u' });
  }

  // Lija y terminación por superficie: la melamina viene terminada, el MDF se sella y se pinta.
  // Las traseras y los fondos finos no se ven: no se lijan ni se terminan.
  const m2 = (list: Part[]) => list.filter((p) => Math.min(...boxSize(partBox(p))) > 9).reduce((s, p) => s + surface(p), 0) / 1e6;
  const wood = m2(boxes.filter((p) => !isSheet(p.wood) || p.wood === 'terciado' || p.wood === 'multilaminado'));
  const mdf = m2(boxes.filter((p) => p.wood === 'mdf'));
  const sheets = (area: number) => Math.max(1, Math.ceil(area / 1.5));
  /** Litros para dos manos, a 10 m² por litro, de a cuarto de litro. */
  const liters = (area: number) => Math.max(0.25, Math.ceil(((area * 2) / 10) * 4) / 4);
  if (wood > 0) {
    for (const g of [80, 120, 180]) add(rows, { id: `lija|${g}`, name: t('Lija grano {g}', { g }), qty: sheets(wood), unit: 'hoja' });
    add(rows, { id: 'terminacion', name: t('Aceite, cera o lustre'), qty: liters(wood), unit: 'l', note: t('dos manos') });
  }
  if (mdf > 0) {
    for (const g of [180, 240]) add(rows, { id: `lija|${g}`, name: t('Lija grano {g}', { g }), qty: sheets(mdf), unit: 'hoja' });
    add(rows, { id: 'sellador-mdf', name: t('Fondo sellador para MDF'), qty: liters(mdf), unit: 'l', note: t('dos manos') });
    add(rows, { id: 'pintura', name: t('Pintura o laca'), qty: liters(mdf), unit: 'l', note: t('dos manos') });
  }
  return rows;
}

