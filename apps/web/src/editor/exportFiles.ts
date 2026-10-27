import { cutList, drawPart, dxfBytes, formatNumber, piecesDae, piecesDxf, t, woodById, type Project } from '@kitc/core';
import { fileName, saveFile } from '../storage/backup';
import { woodName } from './cutsData';
import { engineDrawings, engineMeshes } from './useGeometry';

/** Despiece en DXF: cada pieza distinta a 1:1, con su forma exacta, para CNC, láser o un programa de dibujo. */
export async function exportDxf(project: Project): Promise<void> {
  const n = (mm: number) => formatNumber(mm, project.units);
  const rows = cutList(project);
  const parts = rows.map((r) => project.parts.find((p) => p.id === r.ids[0])!);
  const drawings = await engineDrawings(
    project,
    parts.map((p) => drawPart(project, p)),
  );
  const pieces = rows.map((r, i) => ({
    label: `${r.ids.join(', ')} · ${r.name} · × ${r.ids.length} · ${woodName(r.wood)} · ${t('espesor {n}', { n: n(Math.min(...r.cut)) })} ${project.units === 'in' ? 'in' : 'cm'}`,
    drawing: drawings[i]!,
  }));
  saveFile(`${fileName(project)}.dxf`, dxfBytes(piecesDxf(pieces, project.units)), 'application/dxf');
}

/** El mueble armado en 3D, en COLLADA: cada pieza con su nombre y el color de su madera. */
export async function exportDae(project: Project): Promise<void> {
  const meshes = new Map((await engineMeshes(project)).map((m) => [m.id, m]));
  const pieces = project.parts.flatMap((p) => {
    const m = meshes.get(p.id);
    return m ? [{ name: `${p.id} ${p.name}`, color: woodById(p.wood)?.color ?? '#C8A77A', vertices: m.vertices, normals: m.normals, triangles: m.triangles }] : [];
  });
  saveFile(`${fileName(project)}.dae`, piecesDae(pieces, project.name), 'model/vnd.collada+xml');
}
