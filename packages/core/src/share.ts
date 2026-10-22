import { loadProject, type LoadResult, type Project } from './project';
import { t } from './i18n';

/**
 * Compartir por enlace, sin servidor: el proyecto va adentro del enlace, comprimido y en base64 de URL.
 * Se sacan los valores que el esquema completa solo (listas vacías, rotación cero) para que el enlace sea corto.
 */

/** Ruta de un proyecto compartido: #/compartido/<datos>. */
export const SHARE_ROUTE = '#/compartido/';

function slim(project: Project): unknown {
  return {
    ...project,
    parts: project.parts.map((p) => {
      const out: Record<string, unknown> = { ...p };
      for (const k of ['ops', 'pockets', 'bevels', 'sections'] as const) if (!p[k].length) delete out[k];
      if (p.rotation.every((v) => v === 0)) delete out.rotation;
      return out;
    }),
  };
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

const toBase64Url = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (text: string) => {
  const s = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

/** Los datos del enlace: el proyecto comprimido. */
export async function encodeShare(project: Project): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(slim(project)));
  return toBase64Url(await pipe(json, new CompressionStream('deflate-raw')));
}

/** Abre los datos de un enlace: los descomprime, los migra y los valida como cualquier proyecto guardado. */
export async function decodeShare(data: string): Promise<LoadResult> {
  try {
    const bytes = await pipe(fromBase64Url(decodeURIComponent(data)), new DecompressionStream('deflate-raw'));
    return loadProject(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return { ok: false, error: t('El enlace está incompleto o roto. Pedí que te lo vuelvan a mandar.') };
  }
}
