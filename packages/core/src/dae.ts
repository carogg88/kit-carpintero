/**
 * Modelo 3D en COLLADA (.dae), el formato que importan SketchUp, Blender y casi todos los programas de 3D.
 * Cada pieza va como un objeto con su nombre y el color de su madera, en mm y con el alto hacia arriba (Y).
 */

/** Malla de una pieza ya armada: tres números por vértice y tres índices por triángulo. */
export interface DaePiece {
  name: string;
  color: string;
  vertices: ArrayLike<number>;
  normals: ArrayLike<number>;
  triangles: ArrayLike<number>;
}

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const num = (x: number) => String(Math.round(x * 1000) / 1000 + 0);

function list(a: ArrayLike<number>, f: (x: number) => string = num): string {
  const out: string[] = new Array<string>(a.length);
  for (let i = 0; i < a.length; i++) out[i] = f(a[i]!);
  return out.join(' ');
}

/** '#D9BC8C' -> '0.851 0.737 0.549 1'. */
function rgba(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const v = m ? parseInt(m[1]!, 16) : 0xc8a77a;
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => num(c / 255)).join(' ') + ' 1';
}

export function piecesDae(pieces: DaePiece[], title: string, now = new Date()): string {
  const colors = [...new Set(pieces.map((p) => p.color.toUpperCase()))];
  const mat = (color: string) => `mat${colors.indexOf(color.toUpperCase())}`;
  const when = now.toISOString().replace(/\.\d+Z$/, 'Z');
  const out: string[] = [];
  out.push(
    '<?xml version="1.0" encoding="utf-8"?>',
    '<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">',
    '  <asset>',
    '    <contributor><authoring_tool>Calibre Studio</authoring_tool></contributor>',
    `    <created>${when}</created>`,
    `    <modified>${when}</modified>`,
    `    <title>${xml(title)}</title>`,
    '    <unit name="millimeter" meter="0.001"/>',
    '    <up_axis>Y_UP</up_axis>',
    '  </asset>',
    '  <library_effects>',
  );
  colors.forEach((c, i) =>
    out.push(
      `    <effect id="fx${i}"><profile_COMMON><technique sid="common"><lambert>`,
      `      <diffuse><color>${rgba(c)}</color></diffuse>`,
      '    </lambert></technique></profile_COMMON></effect>',
    ),
  );
  out.push('  </library_effects>', '  <library_materials>');
  colors.forEach((c, i) => out.push(`    <material id="mat${i}" name="${xml(c)}"><instance_effect url="#fx${i}"/></material>`));
  out.push('  </library_materials>', '  <library_geometries>');
  pieces.forEach((p, i) => {
    const n = p.vertices.length;
    const id = `g${i}`;
    out.push(
      `    <geometry id="${id}" name="${xml(p.name)}"><mesh>`,
      `      <source id="${id}-pos"><float_array id="${id}-pos-a" count="${n}">${list(p.vertices)}</float_array>`,
      `        <technique_common><accessor source="#${id}-pos-a" count="${n / 3}" stride="3"><param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/></accessor></technique_common></source>`,
      `      <source id="${id}-nor"><float_array id="${id}-nor-a" count="${p.normals.length}">${list(p.normals)}</float_array>`,
      `        <technique_common><accessor source="#${id}-nor-a" count="${p.normals.length / 3}" stride="3"><param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/></accessor></technique_common></source>`,
      `      <vertices id="${id}-v"><input semantic="POSITION" source="#${id}-pos"/></vertices>`,
      `      <triangles material="m" count="${p.triangles.length / 3}">`,
      `        <input semantic="VERTEX" source="#${id}-v" offset="0"/><input semantic="NORMAL" source="#${id}-nor" offset="0"/>`,
      `        <p>${list(p.triangles, String)}</p>`,
      '      </triangles>',
      '    </mesh></geometry>',
    );
  });
  out.push('  </library_geometries>', '  <library_visual_scenes>', '    <visual_scene id="scene" name="Scene">');
  pieces.forEach((p, i) =>
    out.push(
      `      <node id="n${i}" name="${xml(p.name)}"><instance_geometry url="#g${i}">`,
      `        <bind_material><technique_common><instance_material symbol="m" target="#${mat(p.color)}"/></technique_common></bind_material>`,
      '      </instance_geometry></node>',
    ),
  );
  out.push('    </visual_scene>', '  </library_visual_scenes>', '  <scene><instance_visual_scene url="#scene"/></scene>', '</COLLADA>', '');
  return out.join('\n');
}
