import Dexie, { type EntityTable } from 'dexie';
import { loadProject, type Project } from '@kitc/core';

/** Proyecto guardado en este dispositivo. `data` es el archivo de proyecto tal cual. */
interface StoredProject {
  id: string;
  name: string;
  updatedAt: string;
  data: unknown;
}

const db = new Dexie('kit-carpintero') as Dexie & { projects: EntityTable<StoredProject, 'id'> };
db.version(1).stores({ projects: 'id, updatedAt' });

export async function saveProject(p: Project): Promise<void> {
  await db.projects.put({ id: p.id, name: p.name, updatedAt: p.updatedAt, data: p });
}

export async function readProject(id: string): Promise<Project | null> {
  const row = await db.projects.get(id);
  if (!row) return null;
  const r = loadProject(row.data);
  return r.ok ? r.project : null;
}

/** Proyectos del dispositivo, el último que se tocó primero. Los que no se pueden abrir se saltean. */
export async function listProjects(): Promise<Project[]> {
  const rows = await db.projects.orderBy('updatedAt').reverse().toArray();
  return rows.flatMap((row) => {
    const r = loadProject(row.data);
    return r.ok ? [r.project] : [];
  });
}

export async function deleteProject(id: string): Promise<void> {
  await db.projects.delete(id);
}
