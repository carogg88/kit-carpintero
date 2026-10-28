import { boxSize, overlapBox, partBox, type Box } from './geometry';
import { findMotions, hingeEdge, isDoorPart, isDrawerPart, slideGap, SLIDE_LENGTHS, unionBox } from './motion';
import { BREADBOARD, endJoint, holdCount, isBreadboard, holdFits, holdOf, jointGeometry, tenonStyle } from './joints';
import { boardPieces, dowelsNeeded, type CutPlan } from './cutlist';
import type { Part, Project } from './project';
import { tipRisk } from './review';
import { isSheet, sheetById } from './woods';
import { t } from './i18n';
import { finishAreas, partFinish } from './finishes';

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
  const motions = findMotions(project);
  const moving = new Set(motions.flatMap((m) => m.parts));
  const carcass = boxes.filter((p) => !moving.has(p.id) && !isDrawerPart(p) && !isDoorPart(p));
  const zFront = carcass.length ? Math.max(...carcass.map((p) => partBox(p).max[2])) : 0;
  const partsOf = (ids: string[]) => boxes.filter((p) => ids.includes(p.id));

  for (const d of dowelsNeeded(project)) {
    add(rows, { id: `tarugo|${d.diameter}|${d.length}`, name: t('Tarugos de {d} × {len} mm', { d: d.diameter, len: Math.round(d.length) }), qty: d.count, unit: 'u' });
  }

  // Cajones: correderas metálicas si el cajón deja lugar a los costados, y un tirador por frente.
  for (const m of motions.filter((x) => x.kind === 'cajon')) {
    const drawer = partsOf(m.parts);
    if (!drawer.length) continue;
    const front = drawer.reduce((a, b) => (partBox(b).max[2] > partBox(a).max[2] ? b : a));
    const body = drawer.filter((p) => p !== front);
    const pulls = boxSize(partBox(front))[0] > 600 ? 2 : 1;
    add(rows, { id: 'tirador', name: t('Tiradores o manijas'), qty: pulls, unit: 'u', note: t('para cajones y puertas') });
    if (!body.length) continue;
    const box = unionBox(body);
    const gap = slideGap(box, carcass.map(partBox));
    if (gap >= 10 && Number.isFinite(gap)) {
      const depth = box.max[2] - box.min[2];
      const len = SLIDE_LENGTHS.filter((l) => l <= depth + 5).at(-1) ?? SLIDE_LENGTHS[0]!;
      add(rows, { id: `corredera|${len}`, name: t('Correderas telescópicas de {len} cm', { len: len / 10 }), qty: 1, unit: 'par', note: t('un par por cajón') });
    }
  }

  // Puertas: bisagras de cazoleta según lo largo del canto de cada hoja; codo 0 si tapa el canto, codo 18 si va embutida.
  for (const m of motions.filter((x) => x.kind === 'puerta')) {
    const overlay = m.box.min[2] >= zFront - 0.6;
    const n = hingesFor(hingeEdge(m));
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

  // Alto y de poco fondo: se atornilla a la pared.
  if (tipRisk(project)) add(rows, { id: 'antivuelco', name: t('Escuadras antivuelco'), qty: 2, unit: 'u', note: t('con tornillos y tarugos, para fijarlo a la pared') });

  // Una tapa que se levanta va con dos bisagras chicas, no atornillada.
  const lids = new Set(motions.filter((m) => m.kind === 'tapa').flatMap((m) => m.parts));
  if (lids.size) add(rows, { id: 'bisagra-tapa', name: t('Bisagras chicas de bronce'), qty: 2 * motions.filter((m) => m.kind === 'tapa').length, unit: 'u', note: t('para la tapa') });

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
    if (j.type === 'mortaja') {
      // Lo que traba una caja y espiga: cuñas, tarugos que cruzan la pata, llaves. Se hacen de un retazo de madera dura.
      const style = tenonStyle(j.params);
      const g = style === 'ciega' || style === 'pasante' ? null : jointGeometry('mortaja', ba, bb, j.params);
      const e = g && endJoint(ba, bb);
      if (g?.extra && e) {
        if (style === 'cunas' || style === 'ciega-cunas')
          add(rows, { id: 'cuna', name: t('Cuñas de madera dura'), qty: g.extra.cutB.length, unit: 'u', note: t('de un retazo, con la veta a lo largo') });
        if (style === 'tarugada') {
          const pin = g.extra.cutA.find((s) => s.kind === 'cylinder');
          if (pin?.kind === 'cylinder') {
            const d = Math.round(pin.radius * 2);
            const len = Math.round(pin.length + 4);
            add(rows, { id: `tarugo-pasante|${d}|${len}`, name: t('Tarugos de madera dura de {d} × {len} mm', { d, len }), qty: g.extra.cutA.length, unit: 'u', note: t('para tarugar, con un poco de punta') });
          }
        }
        if (style === 'llave') {
          for (const s of g.extra.cutB) {
            if (s.kind !== 'box') continue;
            const size = boxSize(s.box);
            // Larga como la espiga más dos dedos de cada lado, y del ancho del agujero en la punta gruesa.
            const len = Math.round(size[e.wide] + 50);
            add(rows, {
              id: `llave|${Math.round(size[e.axis])}|${Math.round(size[e.thin])}|${len}`,
              name: t('Llaves de madera dura de {w} × {t} × {len} mm', { w: Math.round(size[e.axis]), t: Math.round(size[e.thin]), len }),
              qty: 1,
              unit: 'u',
              note: t('una por espiga con llave'),
            });
          }
        }
      }
    }
    if (j.type === 'machiembrado' && isBreadboard(j.params)) {
      // Los tarugos del testero atraviesan el testero de cara a cara.
      const len = Math.round(Math.min(...[ba, bb].map((x) => Math.min(...boxSize(x)))) + 4);
      add(rows, { id: `tarugo-testero|${BREADBOARD.peg}|${len}`, name: t('Tarugos de madera dura de {d} × {len} mm', { d: BREADBOARD.peg, len }), qty: Math.round(j.params.pegs ?? 0), unit: 'u', note: t('para los testeros, sin cola en los de las puntas') });
    }
    if (j.type === 'galleta') {
      const g = jointGeometry('galleta', ba, bb, j.params);
      add(rows, { id: 'galleta', name: t('Galletas n.º 20'), qty: g?.cutA.length ?? 0, unit: 'u' });
    }
    if (j.type !== 'tope' || moving.has(a.id) || isDrawerPart(a) || isDoorPart(a) || lids.has(a.id) || lids.has(b.id)) continue;
    // Si se eligió cómo se sujeta, lo que pide esa sujeción.
    const hold = holdOf(j.params);
    if (hold !== 'libre') {
      const n = holdFits(ba, bb, hold) ? holdCount(ba, bb, hold) : 0;
      if (hold === 'botones' && n) {
        add(rows, { id: 'boton', name: t('Botones de madera de 25 × 40 mm'), qty: n, unit: 'u', note: t('de un retazo, con una lengüeta de 6 mm para la ranura') });
        add(rows, { id: 'tornillo|4x25', name: t('Tornillos para madera de 4 × 25 mm'), qty: n, unit: 'u', note: t('uno por botón, a la tapa') });
      } else if (hold === 'grampas' && n) {
        add(rows, { id: 'grampa-8', name: t('Grampas en 8 para tapa'), qty: n, unit: 'u', note: t('sujetan la tapa sin trabarla') });
        add(rows, { id: 'tornillo|3.5x16', name: t('Tornillos para madera de 3,5 × 16 mm'), qty: 2 * n, unit: 'u', note: t('dos por grampa') });
      } else if (hold === 'ovalados' && n) {
        add(rows, { id: 'tornillo-ovalado', name: t('Tornillos con arandela para agujero ovalado'), qty: n, unit: 'u', note: t('ajustados sin apretar de más, para que la tapa corra') });
      } else if (hold === 'tornillos') {
        add(rows, { id: 'tornillo', name: t('Tornillos para madera de 4 × 40 mm'), qty: 2, unit: 'u', note: t('para lo que apoya sin encastre') });
      }
      continue;
    }
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
  const visible = (p: Part) => Math.min(...boxSize(partBox(p))) > 9;
  const m2 = (list: Part[]) => list.filter(visible).reduce((s, p) => s + surface(p), 0) / 1e6;
  const woody = (p: Part) => !isSheet(p.wood) || p.wood === 'terciado' || p.wood === 'multilaminado';
  const wood = m2(boxes.filter(woody));
  const mdf = m2(boxes.filter((p) => p.wood === 'mdf'));
  const sheets = (area: number) => Math.max(1, Math.ceil(area / 1.5));
  /** Litros para tantas manos, a tantos m² por litro, de a cuarto de litro. */
  const liters = (area: number, coats = 2, cover = 10) => Math.max(0.25, Math.ceil(((area * coats) / cover) * 4) / 4);
  if (wood > 0) for (const g of [80, 120, 180]) add(rows, { id: `lija|${g}`, name: t('Lija grano {g}', { g }), qty: sheets(wood), unit: 'hoja' });
  if (mdf > 0) for (const g of [180, 240]) add(rows, { id: `lija|${g}`, name: t('Lija grano {g}', { g }), qty: sheets(mdf), unit: 'hoja' });
  // Lo que no tiene terminación elegida: lo de siempre.
  const open = boxes.filter((p) => !partFinish(project, p));
  const openWood = m2(open.filter(woody));
  const openMdf = m2(open.filter((p) => p.wood === 'mdf'));
  if (openWood > 0) add(rows, { id: 'terminacion', name: t('Aceite, cera o lustre'), qty: liters(openWood), unit: 'l', note: t('dos manos') });
  if (openMdf > 0) {
    add(rows, { id: 'sellador-mdf', name: t('Fondo sellador para MDF'), qty: liters(openMdf), unit: 'l', note: t('dos manos') });
    add(rows, { id: 'pintura', name: t('Pintura o laca'), qty: liters(openMdf), unit: 'l', note: t('dos manos') });
  }
  for (const { finish, m2: area, mdf: mdfArea } of finishAreas(project, surface, visible).values()) finishRows(rows, finish.id, finish.color, area, mdfArea, liters);
  return rows;
}


/** Lo que se compra para una terminación elegida: el producto, en litros según la superficie, y con qué pasarlo. */
function finishRows(
  rows: HardwareRow[],
  id: string,
  color: string | undefined,
  area: number,
  mdf: number,
  liters: (area: number, coats?: number, cover?: number) => number,
): void {
  const lacquer = (sheen: 'mate' | 'satinada' | 'brillante') => {
    const names = { mate: t('Laca poliuretánica mate'), satinada: t('Laca poliuretánica satinada'), brillante: t('Laca poliuretánica brillante') };
    add(rows, { id: `laca|${sheen}`, name: names[sheen], qty: liters(area, 3), unit: 'l', note: t('tres manos') });
    add(rows, { id: 'pincel', name: t('Pincel de 2 pulgadas'), qty: 1, unit: 'u' });
  };
  switch (id) {
    case 'aceite':
      add(rows, { id: 'aceite', name: t('Aceite de lino o tung para madera'), qty: liters(area, 3, 12), unit: 'l', note: t('tres manos') });
      add(rows, { id: 'lana-acero', name: t('Lana de acero 000'), qty: 1, unit: 'u', note: t('entre manos') });
      break;
    case 'cera':
      add(rows, { id: 'cera', name: t('Cera en pasta para madera, lata de 250 g'), qty: Math.max(1, Math.ceil(area / 4)), unit: 'u' });
      break;
    case 'lustre':
      add(rows, { id: 'lustre', name: t('Goma laca disuelta en alcohol'), qty: liters(area, 6, 14), unit: 'l', note: t('para lustrar a muñeca') });
      add(rows, { id: 'muneca', name: t('Algodón y trapo de lino para la muñeca'), qty: 1, unit: 'u' });
      break;
    case 'laca-mate':
      lacquer('mate');
      break;
    case 'laca-satinada':
      lacquer('satinada');
      break;
    case 'laca-brillante':
      lacquer('brillante');
      break;
    case 'tinte-roble':
    case 'tinte-nogal':
    case 'tinte-caoba':
    case 'tinte-wengue':
    case 'ebonizado': {
      const names: Record<string, string> = {
        'tinte-roble': t('Tinte roble para madera'),
        'tinte-nogal': t('Tinte nogal para madera'),
        'tinte-caoba': t('Tinte caoba para madera'),
        'tinte-wengue': t('Tinte wengué para madera'),
        ebonizado: t('Tinte negro para madera'),
      };
      add(rows, { id: `tinte|${id}`, name: names[id]!, qty: liters(area, 1, 12), unit: 'l', note: t('una mano') });
      lacquer('satinada');
      break;
    }
    case 'pintura':
      if (area - mdf > 0.001) add(rows, { id: 'fondo-madera', name: t('Fondo blanco para madera'), qty: liters(area - mdf, 1), unit: 'l', note: t('una mano') });
      if (mdf > 0.001) add(rows, { id: 'sellador-mdf', name: t('Fondo sellador para MDF'), qty: liters(mdf, 1), unit: 'l', note: t('una mano') });
      add(rows, { id: `esmalte|${color ?? ''}`, name: t('Esmalte al agua, color {color}', { color: color ?? '' }), qty: liters(area, 2), unit: 'l', note: t('dos manos') });
      add(rows, { id: 'rodillo', name: t('Rodillo de espuma y bandeja'), qty: 1, unit: 'u' });
      break;
  }
}
