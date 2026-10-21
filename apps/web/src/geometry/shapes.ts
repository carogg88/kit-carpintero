import { basicFaceExtrusion, cast, GCWithScope, getOC, makeBox, makeCylinder, makePolygon, ProjectionCamera, Vector, type Shape3D } from 'replicad';
import { bevelSolid, engineCamera, jointGeometry, partBox, pocketSolid, type Box, type EngineView, type Part, type Project, type Solid } from '@kitc/core';

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

/** Arma una pieza exacta: forma base, redondeos, espigas sumadas y mortajas restadas. */
export function partShape(part: Part, project: Project): { shape: Shape3D; warning?: string } {
  let shape = solid(partBox(part));
  let warning: string | undefined;

  for (const op of part.ops) {
    try {
      shape = op.kind === 'round' ? shape.fillet(op.radius) : shape.chamfer(op.size);
    } catch {
      warning = `No se pudo ${op.kind === 'round' ? 'redondear' : 'chaflanar'} esta pieza`;
    }
  }

  for (const p of part.pockets) {
    try {
      shape = shape.cut(toShape(pocketSolid(part, p)));
    } catch {
      warning = `No se pudo hacer el ${p.through ? 'calado' : 'vaciado'} ${p.id}`;
    }
  }

  for (const b of part.bevels) {
    try {
      shape = shape.cut(toShape(bevelSolid(part, b)));
    } catch {
      warning = `No se pudo hacer el bisel ${b.id}`;
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
    try {
      for (const s of isA ? [] : geo.addB) shape = shape.fuse(toShape(s));
      for (const s of isA ? geo.cutA : geo.cutB) shape = shape.cut(toShape(s));
    } catch {
      warning = `No se pudo cortar el encastre con ${isA ? j.partB : j.partA}`;
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
