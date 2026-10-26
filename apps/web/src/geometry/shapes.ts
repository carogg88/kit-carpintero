import { assembleWire, basicFaceExtrusion, cast, GCWithScope, getOC, makeBox, makeCylinder, makeFace, makeLine, makeThreePointArc, makePolygon, ProjectionCamera, revolution, Vector, type Shape3D } from 'replicad';
import { bevelSolid, engineCamera, FOLLOW_JOINTS, followMortise, leanFollow, leanFrame, leanStock, otherAxes, sectionBox, sectionCutBox, jointGeometry, partBox, pocketSolid, t, turnSegments, type Box, type Vec3, type EngineView, isLeaning, type LeanFrame, type Part, type Project, type Solid, type Turning } from '@kitc/core';

/**
 * Formas exactas con replicad (OpenCascade), sin nada del navegador: las usan el worker y las pruebas.
 * El motor tiene que estar abierto (`setOC`) antes de llamar a estas funciones.
 */

const solid = (b: Box) => makeBox(b.min, b.max) as Shape3D;

function toShape(s: Solid): Shape3D {
  switch (s.kind) {
    case 'box':
      return solid(s.box);
    case 'cylinder': {
      const direction: [number, number, number] = [0, 0, 0];
      direction[s.axis] = s.dir;
      return makeCylinder(s.radius, s.length, s.start, direction) as Shape3D;
    }
    case 'bore':
      return makeCylinder(s.radius, s.length, s.start, s.dir) as Shape3D;
    case 'arc': {
      const at = (p: [number, number]): [number, number, number] => {
        const q: [number, number, number] = [0, 0, 0];
        q[s.u] = p[0];
        q[s.v] = p[1];
        q[s.axis] = s.from;
        return q;
      };
      const corners = [s.b, ...s.rest, s.a];
      const edges = [makeThreePointArc(at(s.a), at(s.mid), at(s.b)), ...corners.slice(1).map((p, i) => makeLine(at(corners[i]!), at(p)))];
      const wire = assembleWire(edges);
      const face = makeFace(wire);
      const along: [number, number, number] = [0, 0, 0];
      along[s.axis] = s.to - s.from;
      const shape = basicFaceExtrusion(face, new Vector(along)) as Shape3D;
      edges.forEach((e) => e.delete());
      wire.delete();
      face.delete();
      return shape;
    }
    case 'prism': {
      const at = (u: number, v: number): [number, number, number] => {
        const p: [number, number, number] = [0, 0, 0];
        p[s.u] = u;
        p[s.v] = v;
        p[s.axis] = s.from;
        return p;
      };
      const face = makePolygon(s.points.map(([u, v]) => at(u, v)));
      const along: [number, number, number] = [0, 0, 0];
      along[s.axis] = s.to - s.from;
      const shape = basicFaceExtrusion(face, new Vector(along)) as Shape3D;
      face.delete();
      return shape;
    }
  }
}

/**
 * El taco girado: el perfil (de la punta, por el contorno, a la otra punta y de vuelta por el eje) da una vuelta
 * entera sobre el eje del torneado. Lo que queda cuadrado se suma después con la sección del taco.
 */
function turnedShape(part: Part, turning: Turning): Shape3D {
  const box = partBox(part);
  const axis = turning.axis;
  const [u, v] = otherAxes(axis);
  const cu = (box.min[u] + box.max[u]) / 2;
  const cv = (box.min[v] + box.max[v]) / 2;
  const at = ([along, r]: [number, number]): [number, number, number] => {
    const q: [number, number, number] = [0, 0, 0];
    q[axis] = box.min[axis] + along;
    q[u] = cu + r;
    q[v] = cv;
    return q;
  };
  const segs = turnSegments(part, turning);
  const len = box.max[axis] - box.min[axis];
  const pts: [number, number][] = [[0, 0], segs[0]!.a];
  const edges = [];
  const line = (a: [number, number], b: [number, number]) => {
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 1e-3) edges.push(makeLine(at(a), at(b)));
  };
  line(pts[0]!, pts[1]!);
  for (const s of segs) {
    if (s.kind === 'curve' && s.mid) edges.push(makeThreePointArc(at(s.a), at(s.mid), at(s.b)));
    else line(s.a, s.b);
  }
  line(segs[segs.length - 1]!.b, [len, 0]);
  line([len, 0], [0, 0]);
  const wire = assembleWire(edges);
  const face = makeFace(wire);
  const dir: [number, number, number] = [0, 0, 0];
  dir[axis] = 1;
  let shape = revolution(face, at([0, 0]), dir) as Shape3D;
  edges.forEach((e) => e.delete());
  wire.delete();
  face.delete();
  for (const s of segs) {
    if (s.kind !== 'square') continue;
    const b: Box = { min: [...box.min], max: [...box.max] };
    b.min[axis] = box.min[axis] + s.a[0];
    b.max[axis] = box.min[axis] + s.b[0];
    if (b.max[axis] - b.min[axis] > 0.01) shape = shape.fuse(solid(b));
  }
  return shape;
}

/** Gira una forma de la pieza derecha a donde queda con la pata inclinada. */
const leaned = (shape: Shape3D, f: LeanFrame | null): Shape3D => (f ? (shape.rotate(f.angle, f.pivot, f.axis) as Shape3D) : shape);

/**
 * Espiga o mortaja de una pata inclinada: arranca en la punta de arriba y, girada, de un lado quedaría corta antes
 * del hombro horizontal. Se alarga hacia la pata para que llegue al hombro en todo el ancho.
 */
function jointSolid(s: Solid, f: LeanFrame | null): Shape3D {
  if (!f || s.kind !== 'box' || Math.abs(s.box.min[1] - f.pivot[1]) > 0.01) return leaned(toShape(s), f);
  const b: Box = { min: [...s.box.min], max: [...s.box.max] };
  b.min[1] -= 2 * f.rise + 1;
  return leaned(solid(b), f);
}

/** La pata inclinada recortada a la altura de la pieza derecha: corta las puntas de una forma ya girada. */
function trimLean(shape: Shape3D, part: Part, f: LeanFrame): Shape3D {
  const box = partBox(part);
  const reach = f.length + 100;
  const slab: Box = { min: [box.min[0] - reach, box.min[1], box.min[2] - reach], max: [box.max[0] + reach, box.max[1], box.max[2] + reach] };
  return shape.intersect(solid(slab));
}

/** El cuerpo de una pata inclinada, sin encastres: lo que recorta la punta de un travesaño que entra en ella. */
const leanBody = (leg: Part, f: LeanFrame): Shape3D => trimLean(leaned(solid(leanStock(leg, f)), f), leg, f);

/**
 * Arma una pieza exacta: forma base (el taco, o torneada), redondeos, espigas sumadas y mortajas restadas.
 * Una pata inclinada se arma derecha y más larga, se gira y se le cortan las puntas horizontales; los encastres
 * que entran con ella en otra pieza se giran igual, así la mortaja sigue el ángulo de la espiga.
 * Un faldón o travesaño que entra en patas inclinadas se corre con ellas, se estira hasta adentro de cada pata y
 * la pata le recorta el hombro; la espiga y la mortaja van derechas, a lo largo de la pieza.
 */
export function partShape(part: Part, project: Project): { shape: Shape3D; warning?: string } {
  const lean = leanFrame(part);
  const follow = leanFollow(project, part);
  // La pieza que sigue a las patas se arma en su lugar de siempre, estirada, y se corre al final.
  const base = follow
    ? { min: follow.box.min.map((v, k) => v - follow.shift[k]!) as Vec3, max: follow.box.max.map((v, k) => v - follow.shift[k]!) as Vec3 }
    : lean
      ? leanStock(part, lean)
      : partBox(part);
  let shape = solid(base);
  let warning: string | undefined;

  if (part.turning) {
    try {
      const turned = turnedShape(part, part.turning);
      shape.delete();
      shape = turned;
    } catch {
      warning = t('No se pudo tornear esta pieza');
    }
  }

  // Tramos primero: sacan la pieza a lo largo del tramo y ponen la sección nueva, y lo demás se hace sobre eso.
  for (const s of part.sections) {
    try {
      shape = shape.cut(solid(sectionCutBox(part, s))).fuse(solid(sectionBox(part, s)));
    } catch {
      warning = t('No se pudo hacer el tramo {id}', { id: s.id });
    }
  }

  // Los cantos redondeados o chaflanados son de una pieza escuadrada: en una torneada no van.
  for (const op of part.turning ? [] : part.ops) {
    try {
      shape = op.kind === 'round' ? shape.fillet(op.radius) : shape.chamfer(op.size);
    } catch {
      warning = op.kind === 'round' ? t('No se pudo redondear esta pieza') : t('No se pudo chaflanar esta pieza');
    }
  }

  for (const p of part.pockets) {
    try {
      shape = shape.cut(toShape(pocketSolid(part, p)));
    } catch {
      warning = p.through ? t('No se pudo hacer el calado {id}', { id: p.id }) : t('No se pudo hacer el vaciado {id}', { id: p.id });
    }
  }

  for (const b of part.bevels) {
    try {
      shape = shape.cut(toShape(bevelSolid(part, b)));
    } catch {
      warning = t('No se pudo hacer el bisel {id}', { id: b.id });
    }
  }

  if (lean) shape = trimLean(leaned(shape, lean), part, lean);
  if (follow) {
    if (follow.shift.some((d) => Math.abs(d) > 1e-6)) shape = shape.translate(follow.shift) as Shape3D;
    for (const end of follow.ends) {
      try {
        shape = shape.cut(leanBody(end.leg, end.frame));
      } catch {
        warning = t('No se pudo cortar el encastre con {id}', { id: end.leg.id });
      }
    }
  }

  for (const j of project.joints) {
    if (j.partA !== part.id && j.partB !== part.id) continue;
    const a = project.parts.find((p) => p.id === j.partA);
    const b = project.parts.find((p) => p.id === j.partB);
    if (!a || !b) continue;
    const geo = jointGeometry(j.type, partBox(a), partBox(b), j.params);
    if (!geo) continue;
    const isA = part.id === j.partA;
    const other = isA ? j.partB : j.partA;
    // Un faldón o travesaño que entra en una pata inclinada: espiga y mortaja derechas, a lo largo de la pieza.
    if (leanFrame(a)) {
      const f = isLeaning(b) ? null : leanFollow(project, b);
      const end = f?.ends.find((e) => e.joint.id === j.id);
      if (!f || !end || !FOLLOW_JOINTS.has(j.type)) {
        if (geo.cutA.length + geo.addB.length + geo.cutB.length) warning = t('El encastre con {id} todavía no sigue la pata inclinada', { id: other });
        continue;
      }
      const m = j.type === 'mortaja' ? followMortise(f, end, b) : null;
      if (!m) continue;
      try {
        shape = isA ? shape.cut(solid(m.mortise)) : shape.fuse(solid(m.tenon));
      } catch {
        warning = t('No se pudo cortar el encastre con {id}', { id: other });
      }
      continue;
    }
    const tilt = leanFrame(b);
    try {
      for (const s of isA ? [] : geo.addB) shape = shape.fuse(jointSolid(s, tilt));
      for (const s of isA ? geo.cutA : geo.cutB) shape = shape.cut(jointSolid(s, tilt));
    } catch {
      warning = t('No se pudo cortar el encastre con {id}', { id: other });
    }
  }
  return warning ? { shape, warning } : { shape };
}

/**
 * Proyección con líneas ocultas de varias piezas juntas. Devuelve tramos rectos en el plano del dibujo:
 * cuatro números por tramo (u, v de cada punta) y, aparte, si cada tramo está oculto.
 * Las curvas se parten en tramos de a lo sumo `step` mm.
 */
export function projectShapes(shapes: Shape3D[], view: Pick<EngineView, 'projection'>, step = 2): { segments: Float32Array; hidden: Uint8Array } {
  const oc = getOC();
  const r = GCWithScope();
  const cam = engineCamera(view.projection);
  const camera = new ProjectionCamera([0, 0, 0], cam.dir, cam.xAxis);
  // Compuesto armado a mano: `makeCompound` de replicad borra las piezas, y el worker las guarda para reusarlas.
  let compound = shapes[0]!.wrapped;
  if (shapes.length > 1) {
    const builder = r(new oc.TopoDS_Builder());
    const c = r(new oc.TopoDS_Compound());
    builder.MakeCompound(c);
    for (const s of shapes) builder.Add(c, s.wrapped);
    compound = c;
  }
  const algo = r(new oc.HLRBRep_Algo());
  algo.Add(compound, 0);
  algo.Projector(r(new oc.HLRAlgo_Projector(camera.wrapped)));
  algo.Update();
  algo.Hide();
  const out = r(new oc.HLRBRep_HLRToShape(algo));

  const segs: number[] = [];
  const hidden: number[] = [];
  const flip = cam.flipV ? -1 : 1;
  // Aristas vivas y siluetas. Las costuras de los redondeos (donde la curva se junta con la cara plana) no van en un plano de taller.
  const groups = [
    [out.VCompound(), false],
    [out.OutLineVCompound(), false],
    [out.HCompound(), true],
    [out.OutLineHCompound(), true],
  ] as const;
  for (const [c, isHidden] of groups) {
    if (c.IsNull()) continue;
    for (const edge of cast(c).edges) {
      oc.BRepLib.BuildCurves3d(edge.wrapped);
      const pts: [number, number][] = [];
      if (edge.geomType === 'LINE') {
        pts.push(xy(edge.startPoint), xy(edge.endPoint));
      } else {
        const n = Math.min(96, Math.max(6, Math.ceil(edge.length / step)));
        for (let i = 0; i <= n; i++) pts.push(xy(edge.pointAt(i / n)));
      }
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]!;
        const b = pts[i]!;
        if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-3) continue;
        segs.push(a[0], a[1] * flip, b[0], b[1] * flip);
        hidden.push(isHidden ? 1 : 0);
      }
      edge.delete();
    }
    c.delete();
  }
  camera.delete();
  return { segments: new Float32Array(segs), hidden: new Uint8Array(hidden) };
}

function xy(v: { x: number; y: number; delete(): void }): [number, number] {
  const p: [number, number] = [v.x, v.y];
  v.delete();
  return p;
}
