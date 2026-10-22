import { cutList, cutPiece } from './cutlist';
import { t, tk } from './i18n';
import { groupJoints } from './jointinfo';
import { jointRoom } from './jointfit';
import { JOINT_NAMES } from './joints';
import type { JointType, Project } from './project';

/**
 * Cómo armarlo: el orden de trabajo del taller, sacado del modelo. Cortar, encolar tablas anchas, marcar, hacer
 * los encastres de a un tipo por vez, los demás trabajos, presentar en seco, lijar, encolar por partes y
 * terminar. Cada paso dice qué piezas toca, para quien nunca armó un mueble.
 */

export type AssemblyKind = 'cortar' | 'tiras' | 'marcar' | 'encastre' | 'otros' | 'seco' | 'lijar' | 'encolar' | 'terminar';

export interface AssemblyStep {
  /** Fijo para el mismo modelo: sirve para recordar qué pasos ya se hicieron. */
  key: string;
  kind: AssemblyKind;
  title: string;
  text: string;
  /** Una línea por pieza o por grupo de piezas. */
  items: string[];
  /** En los pasos de encastres: cuál, para mostrar la herramienta y la dificultad. */
  joint?: JointType;
}

const byId = (x: string, y: string) => x.localeCompare(y, 'es', { numeric: true });

/** "P1 a P4" si son correlativas, "F1 y F3" o "F1, F2 y F5" si no. */
export function listIds(ids: string[]): string {
  const sorted = [...new Set(ids)].sort(byId);
  const m = sorted.map((id) => id.match(/^(\D+)(\d+)$/));
  const prefix = m[0]?.[1];
  const nums = m.map((x) => (x && x[1] === prefix ? Number(x[2]) : NaN));
  if (sorted.length > 2 && nums.every((v, i) => v === (nums[0] ?? 0) + i)) return t('{a} a {b}', { a: sorted[0]!, b: sorted[sorted.length - 1]! });
  if (sorted.length < 2) return sorted[0] ?? '';
  return t('{list} y {last}', { list: sorted.slice(0, -1).join(', '), last: sorted[sorted.length - 1]! });
}

/** Qué se hace en cada encastre, en orden: primero lo que recibe ({a}) o lo que se marca primero. */
const JOINT_HOW: Partial<Record<JointType, string>> = {
  mortaja: tk('Primero las mortajas en {a}; después las espigas en {b}. Ajustá cada espiga a su mortaja y numerá las dos: no salen todas iguales.'),
  'cola-milano': tk('Primero las colas en {b}. Después apoyá cada cola sobre {a}, marcá los pines con un cúter y cortalos.'),
  dedos: tk('Cortá los dedos de {a} y {b} con el mismo patrón, sin mover el tope entre una pieza y otra.'),
  canal: tk('Hacé las canales en {a}; ahí entran {b}. Probá el ancho con un retazo antes de pasar a las piezas.'),
  rebaje: tk('Hacé los rebajes en {a}; ahí apoyan {b}. Probá con un retazo antes de pasar a las piezas.'),
  machiembrado: tk('Hacé las canales en {a} y las lengüetas en {b}. Probá el ajuste con un retazo.'),
  clavija: tk('Agujereá {a} y {b} con la plantilla para tarugos, siempre apoyada en la cara marcada.'),
  galleta: tk('Marcá una raya que cruce las dos piezas en cada galleta y hacé las ranuras en {a} y {b} sobre esas rayas.'),
  bolsillo: tk('Hacé los agujeros de bolsillo en {b}, en la cara que no se ve.'),
  brida: tk('Primero la horquilla en {b}; después el rebaje en {a}, ajustado al ancho de la horquilla.'),
  'media-madera': tk('Rebajá {a} y {b} a la mitad del espesor. Cortá un poco menos y ajustá con formón hasta que queden al ras.'),
  inglete: tk('Cortá los ingletes de {a} y {b} con la sierra bien a 45°: probá antes con dos retazos que cierren a escuadra.'),
};

/** Los pasos para armar el mueble, en orden. `dims` escribe las tres medidas de corte, con la unidad una sola vez. */
export function assemblySteps(project: Project, dims: (cut: [number, number, number]) => string): AssemblyStep[] {
  const steps: AssemblyStep[] = [];
  const rows = cutList(project);
  const total = rows.reduce((sum, r) => sum + r.ids.length, 0);
  const longest = [...rows].sort((x, y) => y.cut[0] - x.cut[0]);
  steps.push({
    key: 'cortar',
    kind: 'cortar',
    title: t('Cortá las piezas'),
    text:
      total === 1
        ? t('Cortá la pieza a la medida de la lista de cortes.')
        : t('Cortá las {n} piezas a la medida de la lista de cortes. Empezá por las más largas: si una sale mal, todavía sirve para otra más corta.', { n: total }),
    items: longest.map((r) =>
      t('{ids} · {name}: {count} de {size}', { ids: listIds(r.ids), name: r.name, count: r.ids.length, size: dims(r.cut) }),
    ),
  });

  const wide = rows.filter((r) => r.boards > 1);
  if (wide.length)
    steps.push({
      key: 'tiras',
      kind: 'tiras',
      title: t('Encolá las tablas anchas'),
      text: t('Lo que es más ancho que una tabla sale de tiras encoladas de canto. Encolalas con prensas, dejalas secar un día y recién ahí cepillalas y cortalas a medida.'),
      items: wide.map((r) => t('{ids} · {name}: {boards} tiras', { ids: listIds(r.ids), name: r.name, boards: r.boards })),
    });

  steps.push({
    key: 'marcar',
    kind: 'marcar',
    title: t('Marcá cada pieza'),
    text: t('Escribí en lápiz el código de cada pieza (P1, F2…) y una flecha en la cara que queda afuera. En el plano, cada pieza tiene su hoja con dónde va cada encastre.'),
    items: [],
  });

  // Encastres: de a un tipo por vez en cada grupo, los que llevan cortes. Lo que va a tope se atornilla al encolar.
  const groups = groupJoints(project);
  for (const g of groups) {
    const types = [...new Set(g.joints.map((j) => j.type))].filter((type) => type !== 'tope');
    for (const type of types) {
      const joints = g.joints.filter((j) => j.type === type);
      const a = listIds(joints.map((j) => j.partA));
      const b = listIds(joints.map((j) => j.partB));
      // Las espigas o agujeros que se acortaron para no chocar adentro de la pieza: que no se hagan como las demás.
      const short = joints.filter((j) => {
        const room = jointRoom(project, j);
        return room && room.current < room.usual;
      });
      const shortNote = short.length
        ? type === 'mortaja'
          ? t('Ojo: las espigas de {b} que van en {a} son más cortas, para no chocar adentro con las otras.', { a: listIds(short.map((j) => j.partA)), b: listIds(short.map((j) => j.partB)) })
          : t('Ojo: los agujeros de {a} para {b} son menos hondos, para no chocar adentro con los otros.', { a: listIds(short.map((j) => j.partA)), b: listIds(short.map((j) => j.partB)) })
        : null;
      steps.push({
        key: `encastre:${g.key}:${type}`,
        kind: 'encastre',
        title: t('{joint}: {group}', { joint: t(JOINT_NAMES[type]), group: g.label.toLocaleLowerCase() }),
        text: t(JOINT_HOW[type] ?? tk('Hacé los encastres en {a} y {b}. Probá primero con un retazo.'), { a, b }),
        items: [joints.length === 1 ? t('1 unión') : t('{n} uniones', { n: joints.length }), ...(shortNote ? [shortNote] : [])],
        joint: type,
      });
    }
  }
  const cuts = steps.some((s) => s.kind === 'encastre');

  // Vaciados, biseles, tramos, torneados: con la pieza suelta, antes de armar. El mismo trabajo en varias piezas va
  // en una línea ("P1 a P4: cantos redondeados 3 mm").
  const bare = { ...project, joints: [] };
  const boxes = project.parts.filter((p) => p.base.kind === 'box');
  const byWork = new Map<string, string[]>();
  for (const p of boxes) for (const w of cutPiece(p, bare).work) byWork.set(w, [...(byWork.get(w) ?? []), p.id]);
  if (byWork.size)
    steps.push({
      key: 'otros',
      kind: 'otros',
      title: t('Los demás trabajos'),
      text: t('Hacelos ahora, con cada pieza suelta: es más fácil sujetarla en el banco que con el mueble armado.'),
      items: [...byWork].map(([work, ids]) =>
        t('{who}: {work}', { who: ids.length === boxes.length && ids.length > 1 ? t('Todas las piezas') : listIds(ids), work }),
      ),
    });

  if (cuts)
    steps.push({
      key: 'seco',
      kind: 'seco',
      title: t('Presentá en seco'),
      text: t('Armá todo sin cola, con prensas. Cada unión tiene que cerrar sin forzar, y el mueble quedar a escuadra: las dos diagonales tienen que medir lo mismo.'),
      items: [],
    });

  steps.push({
    key: 'lijar',
    kind: 'lijar',
    title: t('Lijá antes de encolar'),
    text: cuts
      ? t('Desarmá y lijá las caras que quedan adentro, con grano 120 y después 180. Una vez encolado no se llega bien a las esquinas.')
      : t('Lijá las caras que quedan adentro, con grano 120 y después 180. Una vez armado no se llega bien a las esquinas.'),
    items: [],
  });

  const glued = groups.filter((g) => g.joints.some((j) => j.type !== 'tope'));
  const plain = groups.filter((g) => g.joints.every((j) => j.type === 'tope'));
  if (glued.length || plain.length)
    steps.push({
      key: 'encolar',
      kind: 'encolar',
      title: glued.length ? t('Encolá por partes') : t('Armá con tornillos'),
      text: glued.length
        ? t('Encolá de a partes y dejá cada una en las prensas hasta que seque (una hora como mínimo). Limpiá la cola que sale con un trapo húmedo antes de que se seque.')
        : t('Uní las piezas con tornillos o clips de fijación, con agujeros guía para que la madera no se raje.'),
      items: [
        ...glued.map((g) => t('{group}: {n} uniones con cola', { group: g.label, n: g.joints.length })),
        ...plain.map((g) => t('{group}: va a tope; al final, con tornillos o clips de fijación', { group: g.label })),
      ],
    });

  steps.push({
    key: 'terminar',
    kind: 'terminar',
    title: t('Lijá todo y protegé la madera'),
    text: t('Lijá con grano 220, sacá el polvo con un trapo apenas húmedo y pasá la terminación: aceite, cera o laca. Probala antes en un retazo de la misma madera.'),
    items: [],
  });
  return steps;
}
