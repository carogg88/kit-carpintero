import { cutList, cutPiece } from './cutlist';
import { t, tk } from './i18n';
import { groupJoints } from './jointinfo';
import { jointRoom } from './jointfit';
import { HOLD_NAMES, holdOf, isBreadboard, JOINT_NAMES, plainJoint, tenonStyle, type Hold, type TenonStyle } from './joints';
import type { Joint, JointType, Project } from './project';
import { finishName, finishSteps, hasFinishes, partFinish } from './finishes';
import { buildSteps, type BuildStep } from './build';

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

/** Lo que se le hace al faldón para sujetar la tapa sin trabarla. */
const HOLD_HOW: Partial<Record<Hold, string>> = {
  botones: tk('Hacé la ranura de los botones en la cara de adentro de {b}, con fresadora o sierra de mesa. Los botones salen de un retazo: una lengüeta de 6 mm que entre en la ranura sin llegar al fondo.'),
  grampas: tk('Hacé los rebajes de las grampas en el canto de arriba de {b}, con una mecha Forstner de 20 mm, del hondo justo de la chapa.'),
  ovalados: tk('Hacé los agujeros de bolsillo en {b} y alargá la salida 4 mm hacia donde se mueve la tapa, con la mecha inclinada.'),
};

/** El testero: lengüeta en la punta de la tapa, canal en el testero y tarugos con agujeros ovalados en la lengüeta. */
const BREADBOARD_HOW = tk(
  'Hacé la canal en {a} y la lengüeta en la punta de {b}. Presentá el testero, agujereá los tarugos atravesando los dos, sacalo y alargá 6 mm hacia la punta los agujeros de la lengüeta, menos el del medio. Cola solo en los 10 cm del medio de la canal: el resto de la tapa tiene que poder moverse.',
);

/** El panel macizo que flota en la canal: sin cola y con su juego. */
function floating(joints: Joint[]): string[] {
  const play = Math.max(0, ...joints.map((j) => (j.type === 'canal' ? (j.params.play ?? 0) : 0)));
  return play ? [t('El panel va sin cola: la canal le deja {play} mm de juego de cada lado para que crezca con la humedad.', { play })] : [];
}

/** Cómo se hace cada forma de trabar la caja y espiga, además de la caja y la espiga. */
const STYLE_HOW: Partial<Record<TenonStyle | 'media-caja', string>> = {
  pasante: tk('Pasante: la espiga atraviesa {a}. Marcá la mortaja en las dos caras y cavá desde cada una hasta el medio, así no se astilla la salida.'),
  cunas: tk('Con cuñas: dos cortes de sierra en cada espiga, a un quinto de cada canto, y la mortaja abierta 2 mm de cada lado en la mitad de afuera. Las cuñas, de madera dura y con la veta a lo largo, se encolan, se clavan a la vez y después se enrasan.'),
  'ciega-cunas': tk('Ciega con cuñas: apoyá las cuñas en los cortes de la espiga antes de entrarla. Al apretar, chocan con el fondo de la mortaja y abren la espiga. Probá en seco sin las cuñas: una vez encolada no se desarma.'),
  tarugada: tk('Tarugada: agujereá {a} con la espiga afuera. Entrá la espiga, marcá el agujero, sacala y agujereala 1 a 2 mm más cerca del hombro. El tarugo, de madera dura y con un poco de punta, tira de la espiga y cierra el hombro.'),
  llave: tk('Con llave: la espiga asoma del otro lado de {a} y lleva un agujero para la llave, que empieza 2 mm adentro de {a} para que apriete. La llave entra a golpes y se saca para desarmar.'),
  'media-caja': tk('Media caja: el diente de la espiga llena el hombro del lado de afuera, y la mortaja lleva ese escalón poco hondo.'),
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
    const types = [...new Set(g.joints.filter((j) => !plainJoint(j)).map((j) => j.type))];
    for (const type of types) {
      const joints = g.joints.filter((j) => j.type === type && !plainJoint(j));
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
      // Las formas de trabar la caja y espiga que aparecen en este grupo, cada una con su explicación.
      const styles =
        type === 'mortaja'
          ? [...new Set(joints.flatMap((j) => [tenonStyle(j.params), ...((j.params.haunch ?? 0) > 0 ? (['media-caja'] as const) : [])]))]
              .map((s) => STYLE_HOW[s])
              .filter((x): x is string => !!x)
              .map((x) => t(x, { a, b }))
          : [];
      steps.push({
        key: `encastre:${g.key}:${type}`,
        kind: 'encastre',
        title: t('{joint}: {group}', { joint: t(type === 'tope' ? HOLD_NAMES[holdOf(joints[0]!.params)] : JOINT_NAMES[type]), group: g.label.toLocaleLowerCase() }),
        text: t(
          (type === 'tope'
            ? HOLD_HOW[holdOf(joints[0]!.params)]
            : type === 'machiembrado' && joints.every((j) => isBreadboard(j.params))
              ? BREADBOARD_HOW
              : JOINT_HOW[type]) ?? tk('Hacé los encastres en {a} y {b}. Probá primero con un retazo.'),
          { a, b },
        ),
        items: [joints.length === 1 ? t('1 unión') : t('{n} uniones', { n: joints.length }), ...styles, ...floating(joints), ...(shortNote ? [shortNote] : [])],
        joint: type,
      });
    }
  }
  // La ranura de los botones no se presenta en seco: la tapa se sujeta al final.
  const cuts = steps.some((s) => s.kind === 'encastre' && s.joint !== 'tope');

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
      text: `${t('Armá todo sin cola, con prensas. Cada unión tiene que cerrar sin forzar, y el mueble quedar a escuadra: las dos diagonales tienen que medir lo mismo.')} ${t('Seguí este orden: así ninguna pieza traba a la que viene después.')}`,
      items: buildLines(project, buildSteps(project)),
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
        ...plain.map((g) => {
          // La tapa que corre: se sujeta al final, sin cola.
          const held = g.joints.find((j) => !plainJoint(j));
          return held
            ? t('{group}: va a tope, sin cola; al final, sujetala con {hold}', { group: g.label, hold: t(HOLD_NAMES[holdOf(held.params)]).toLocaleLowerCase() })
            : t('{group}: va a tope; al final, con tornillos o clips de fijación', { group: g.label });
        }),
      ],
    });

  steps.push(finishStep(project));
  return steps;
}

/**
 * El último paso: lijar todo y pasar la terminación. Si se eligió, una línea por terminación con sus piezas, cuántas
 * manos, cuánto secado y con qué pulir entre manos.
 */
function finishStep(project: Project): AssemblyStep {
  const step: AssemblyStep = {
    key: 'terminar',
    kind: 'terminar',
    title: t('Lijá todo y protegé la madera'),
    text: t('Lijá con grano 220, sacá el polvo con un trapo apenas húmedo y pasá la terminación: aceite, cera o laca. Probala antes en un retazo de la misma madera.'),
    items: [],
  };
  if (!hasFinishes(project)) return step;
  const groups = new Map<string, { ids: string[]; line: string }>();
  for (const p of project.parts) {
    const f = partFinish(project, p);
    if (!f) continue;
    const key = `${f.id}|${f.color ?? ''}`;
    const g = groups.get(key) ?? { ids: [], line: `${finishName(f)}. ${finishSteps(f)}` };
    g.ids.push(p.id);
    groups.set(key, g);
  }
  step.text = t('Lijá con grano 220 y sacá el polvo con un trapo apenas húmedo. Probá cada terminación antes en un retazo de la misma madera: el color final depende de la madera y de la marca.');
  const all = groups.size === 1 && [...groups.values()][0]!.ids.length === project.parts.filter((p) => p.wood !== 'melamina').length;
  step.items = [...groups.values()].map((g) => (all ? g.line : t('{ids}: {finish}', { ids: listIds(g.ids), finish: g.line })));
  return step;
}

/** De dónde llega una pieza que se mueve hacia `dir`, en palabras: el frente mira hacia adelante. */
function fromSide(dir: readonly number[]): string {
  const k = [0, 1, 2].reduce((m, i) => (Math.abs(dir[i]!) > Math.abs(dir[m]!) ? i : m), 0);
  const from = -(dir[k] ?? 0);
  if (k === 0) return from > 0 ? t('la derecha') : t('la izquierda');
  if (k === 1) return from > 0 ? t('arriba') : t('abajo');
  return from > 0 ? t('adelante') : t('atrás');
}

/**
 * El orden de armado en renglones, para presentar en seco: la base, cada pieza con dónde entra y desde qué lado, y
 * las partes que se arman aparte (un pie de mesa, un cajón) con su propio orden en el mismo renglón.
 */
export function buildLines(project: Pick<Project, 'parts'>, steps: readonly BuildStep[]): string[] {
  const order = (unit: string) => steps.filter((s) => s.unit === unit).map((s) => listIds(s.parts));
  return steps.filter((s) => s.unit === 'mueble').map((s) => stepLine(project, s, s.parts.length > 1 ? order(s.parts[0]!).join(', ') : ''));
}

/**
 * Un renglón por paso, también los de las partes que se arman aparte: lo que dice la animación del armado mientras
 * entra cada pieza. Una parte ya armada solo dice dónde entra; su orden está en los pasos de antes.
 */
export function buildStepLines(project: Pick<Project, 'parts'>, steps: readonly BuildStep[]): string[] {
  return steps.map((s) => (s.unit !== 'mueble' && s.kind === 'base' ? t('Aparte, empezá esta parte por {ids}.', { ids: partLabel(project, s) }) : stepLine(project, s, null)));
}

function partLabel(project: Pick<Project, 'parts'>, s: BuildStep): string {
  const id = s.parts[0]!;
  return s.parts.length === 1 ? t('{id} · {name}', { id, name: project.parts.find((p) => p.id === id)?.name ?? '' }) : listIds(s.parts);
}

/** El renglón de un paso. Con `order`, una parte o un cajón dice también en qué orden se arma; con null, ya está armado. */
function stepLine(project: Pick<Project, 'parts'>, s: BuildStep, order: string | null): string {
  const ids = partLabel(project, s);
  const side = fromSide(s.dir);
  // Contra muchas piezas a la vez (la tapa sobre todo el armazón): lo ya armado.
  const onto = s.onto.length > 4 ? t('lo ya armado') : listIds(s.onto);
  let line: string;
  if (s.kind === 'base') line = t('{ids}: es la base; apoyala en el banco.', { ids });
  else if (s.kind === 'cajon') line = order ? t('Cajón {ids}: armalo aparte ({order}) y entralo desde adelante.', { ids, order }) : t('Cajón {ids}: entra desde adelante.', { ids });
  else if (s.kind === 'puerta') line = order ? t('Puerta {ids}: armala aparte ({order}) y colgala al final.', { ids, order }) : t('Puerta {ids}: colgala al final.', { ids });
  else if (s.kind === 'tapa') line = t('Tapa {ids}: va al final, con sus bisagras.', { ids });
  else if (s.kind === 'parte')
    line = order
      ? t('{ids}: armalos aparte en este orden: {order}. Después entran en {onto} desde {side}.', { ids, order, onto: onto || t('su lugar'), side })
      : t('{ids}: ya armados, entran en {onto} desde {side}.', { ids, onto: onto || t('su lugar'), side });
  else if (!onto) line = t('{ids}: presentala en su lugar, desde {side}.', { ids, side });
  else if (s.rests) line = t('{ids}: apoya en {onto}; llega desde {side}.', { ids, onto, side });
  else line = s.enters ? t('{ids}: entra en {onto} desde {side}.', { ids, onto, side }) : t('{ids}: recibe a {onto}; llega desde {side}.', { ids, onto, side });
  return s.forced ? `${line} ${t('Entra derecho: fijate que ninguna espiga se trabe.')}` : line;
}
