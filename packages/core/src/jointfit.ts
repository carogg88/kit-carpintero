import { partBox, type Axis, type Box } from './geometry';
import { defaultJointParams, endJoint, isThrough, jointGeometry, MIN_TENON_WIDTH, solidBox, tenonStyle, tenonWidth } from './joints';
import type { Joint, JointType, Project } from './project';
import { t } from './i18n';

/**
 * Cortes que se encuentran adentro de una pieza. En una pata, las mortajas de los dos faldones que llegan a la misma
 * altura avanzan una hacia la otra: si las espigas son largas, se cruzan y ninguna entra. El carpintero acorta una
 * (o les corta la punta a inglete); la app hace lo mismo y lo avisa.
 */

/** Lo que se acorta en cada encastre: el largo de la espiga o el hondo del agujero, y cuánto más hondo es el corte. */
const FITS: Partial<Record<JointType, { key: string; extra: number }>> = {
  mortaja: { key: 'length', extra: 2 },
  clavija: { key: 'depthA', extra: 1 },
};

/** Madera que queda entre dos cortes que se acercan, en mm. */
const WALL = 1;

const TOL = 0.01;

type Model = Pick<Project, 'parts' | 'joints'>;

const floorHalf = (mm: number) => Math.floor(mm * 2) / 2;

export interface JointRoom {
  /** El largo de espiga (o el hondo de agujero) más grande que entra sin cruzarse con otro corte. */
  max: number;
  /** Lo que tiene ahora la unión. */
  current: number;
  /** Lo que tendría sin acortar. */
  usual: number;
  /** La pieza que recibe los dos cortes. */
  partId: string;
  /** La otra pieza cuyo corte está en el camino. */
  other: string;
  /** La unión de ese otro corte. */
  otherJoint: string;
}

/** Cuánto lugar tiene el corte de esta unión dentro de la pieza que lo recibe, o null si no se encuentra con nada. */
export function jointRoom(project: Model, joint: Joint): JointRoom | null {
  const fit = FITS[joint.type];
  const a = project.parts.find((p) => p.id === joint.partA);
  const b = project.parts.find((p) => p.id === joint.partB);
  if (!fit || !a || !b || a.base.kind !== 'box' || b.base.kind !== 'box') return null;
  const ba = partBox(a);
  const bb = partBox(b);
  const e = endJoint(ba, bb);
  const usual = defaultJointParams(joint.type, ba, bb)?.[fit.key];
  const g = jointGeometry(joint.type, ba, bb, joint.params);
  if (!e || usual === undefined || !g) return null;
  const [k1, k2] = ([0, 1, 2] as Axis[]).filter((k) => k !== e.axis) as [Axis, Axis];
  const crosses = (c: Box, o: Box) => [k1, k2].every((k) => Math.min(c.max[k], o.max[k]) - Math.max(c.min[k], o.min[k]) > TOL);
  const own = g.cutA.map(solidBox);
  let room: { free: number; other: string; otherJoint: string } | null = null;
  for (const o of project.joints) {
    if (o.id === joint.id || o.type === 'tope' || (o.partA !== a.id && o.partB !== a.id)) continue;
    const oa = project.parts.find((p) => p.id === o.partA);
    const ob = project.parts.find((p) => p.id === o.partB);
    if (!oa || !ob || oa.base.kind !== 'box' || ob.base.kind !== 'box') continue;
    const og = jointGeometry(o.type, partBox(oa), partBox(ob), o.params);
    if (!og) continue;
    const other = o.partA === a.id ? o.partB : o.partA;
    for (const ob2 of (o.partA === a.id ? og.cutA : og.cutB).map(solidBox)) {
      if (!own.some((c) => crosses(c, ob2))) continue;
      // Lo que hay entre la cara donde abre el corte y el otro corte, sobre el eje en que avanza.
      const free = e.dir === 1 ? ob2.min[e.axis] - e.face : e.face - ob2.max[e.axis];
      if (free > TOL && (!room || free < room.free)) room = { free, other, otherJoint: o.id };
    }
  }
  if (!room) return null;
  // Una espiga pasante atraviesa la pieza entera: su largo es el de la pieza, no el del campo.
  const through = joint.type === 'mortaja' && isThrough(tenonStyle(joint.params));
  return {
    max: floorHalf(room.free - fit.extra - WALL),
    current: through ? ba.max[e.axis] - ba.min[e.axis] : (joint.params[fit.key] ?? usual),
    usual,
    partId: a.id,
    other: room.other,
    otherJoint: room.otherJoint,
  };
}

/**
 * De dos cortes que se cruzan, cuál se acorta. Siempre el mismo, sin importar en qué orden se armaron las piezas:
 * así los travesaños gemelos (el de adelante y el de atrás) salen con la misma espiga y el mismo largo de corte.
 * Se acorta la pieza que va a lo ancho; si las dos van igual, la más larga; si no, la de código menor.
 */
function shortens(project: Model, j: Joint, o: Joint): boolean {
  const piece = (x: Joint) => project.parts.find((p) => p.id === x.partB);
  const long = (x: Joint) => {
    const p = piece(x);
    if (!p || p.base.kind !== 'box') return { axis: -1, size: 0 };
    const size = p.base.size;
    const axis = size.indexOf(Math.max(...size));
    return { axis, size: size[axis] ?? 0 };
  };
  const a = long(j);
  const b = long(o);
  if ((a.axis === 0) !== (b.axis === 0)) return a.axis === 0;
  if (Math.abs(a.size - b.size) > 0.5) return a.size > b.size;
  return j.id < o.id;
}

/**
 * Acorta las espigas y los agujeros que se cruzarían con otro corte de la misma pieza. De cada par se acorta uno y el
 * otro queda entero, que es lo que hace un carpintero (la más larga, más fuerte); cuál, lo decide `shortens`, no el orden.
 * Con `ids`, solo esas uniones (las nuevas) y las que chocan con ellas: las demás tienen las medidas que eligió la persona.
 */
export function fitJointDepths(project: Model, ids?: Set<string>): void {
  for (const j of project.joints) {
    const fit = FITS[j.type];
    if (!fit || (ids && !ids.has(j.id))) continue;
    const room = jointRoom(project, j);
    if (!room || room.current <= room.max) continue;
    const o = project.joints.find((x) => x.id === room.otherJoint);
    const ofit = o && FITS[o.type];
    const oroom = o && ofit ? jointRoom(project, o) : null;
    // La otra unión es la que se acorta: vuelve a tener su largo común y se acorta ella. Una pasante no se puede
    // acortar: si la otra no es pasante, se acorta la otra.
    const through = (x: Joint) => x.type === 'mortaja' && isThrough(tenonStyle(x.params));
    const other = o && (through(j) ? !through(o) : !shortens(project, j, o));
    if (o && ofit && oroom && oroom.max > 0 && other) {
      o.params = { ...o.params, [ofit.key]: Math.min(oroom.current, oroom.max) };
      const again = jointRoom(project, j);
      if (again && again.current > again.max && again.max > 0) j.params = { ...j.params, [fit.key]: again.max };
      continue;
    }
    if (room.max > 0) j.params = { ...j.params, [fit.key]: room.max };
  }
}

export interface JointNote {
  level: 'warn' | 'info';
  text: string;
}

/** Avisos de taller sobre una unión: cortes que se cruzan, espigas acortadas o demasiado angostas. */
export function jointNotes(project: Model, joint: Joint, n: (mm: number) => string): JointNote[] {
  const notes: JointNote[] = [];
  const room = jointRoom(project, joint);
  const tenon = joint.type === 'mortaja';
  if (room && room.current > room.max)
    notes.push({
      level: 'warn',
      text: tenon
        ? isThrough(tenonStyle(joint.params))
          ? t('Adentro de {part}, esta espiga pasante choca con la de {other}. Una pasante va donde no se cruza con otro corte: cambiá la altura de una o hacela ciega.', { part: room.partId, other: room.other })
          : t('Adentro de {part}, esta espiga choca con la de {other}. Acortala a {max} o menos, o cortale la punta a inglete.', { part: room.partId, other: room.other, max: n(Math.floor(room.max)) })
        : t('Adentro de {part}, estos agujeros chocan con el corte de {other}. Hacelos de {max} de hondo o menos.', { part: room.partId, other: room.other, max: n(Math.floor(room.max)) }),
    });
  else if (room && room.current < room.usual)
    notes.push({
      level: 'info',
      text: tenon
        ? t('Esta espiga es más corta que lo común: adentro de {part} se encuentra con la de {other}. Si la querés más larga, cortales la punta a inglete a las dos.', { part: room.partId, other: room.other })
        : t('Estos agujeros son menos hondos que lo común: adentro de {part} se encuentran con el corte de {other}.', { part: room.partId, other: room.other }),
    });
  if (tenon) {
    const a = project.parts.find((p) => p.id === joint.partA);
    const b = project.parts.find((p) => p.id === joint.partB);
    const e = a && b && endJoint(partBox(a), partBox(b));
    const shoulder = joint.params.shoulder ?? (a && b ? defaultJointParams('mortaja', partBox(a), partBox(b))?.shoulder : undefined) ?? 0;
    const count = joint.params.count ?? 1;
    const width = e ? tenonWidth(e.section.max[e.wide] - e.section.min[e.wide], { shoulder, count, gap: joint.params.gap }) : Infinity;
    if (width < MIN_TENON_WIDTH)
      notes.push({
        level: 'warn',
        text:
          count > 1
            ? t('Cada espiga queda de {w} de ancho: con menos de {min} se puede quebrar. Achicá los hombros o la separación, o hacé una sola.', { w: n(Math.max(0, width)), min: n(MIN_TENON_WIDTH) })
            : t('La espiga queda de {w} de ancho: con menos de {min} se puede quebrar. Achicá los hombros.', { w: n(Math.max(0, width)), min: n(MIN_TENON_WIDTH) }),
      });
  }
  return notes;
}
