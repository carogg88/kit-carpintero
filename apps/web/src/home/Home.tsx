import { useEffect, useRef, useState } from 'react';
import { formatNumber, loadProject, partBox, SCHEMA_VERSION, woodById, type Project } from '@kitc/core';
import { deleteProject, listProjects, saveProject } from '../storage/db';
import { warmUpEngine } from '../editor/useGeometry';
import { IconLogo } from '../editor/icons';
import { navigate } from '../routes';
import styles from './Home.module.css';

const icon = { width: 28, height: 28, viewBox: '0 0 32 32', fill: 'none', stroke: 'currentColor', strokeWidth: 2, 'aria-hidden': true } as const;
const TEMPLATES = [
  {
    id: 'mesa',
    name: 'Mesa',
    icon: (
      <svg {...icon}>
        <rect x="3" y="9" width="26" height="4" rx="1" />
        <path d="M6 13v13M26 13v13" />
      </svg>
    ),
  },
  {
    id: 'taburete',
    name: 'Taburete',
    icon: (
      <svg {...icon}>
        <rect x="8" y="6" width="16" height="4" rx="1" />
        <path d="M10 10 8 27M22 10l2 17M9 20h14" />
      </svg>
    ),
  },
  {
    id: 'estante',
    name: 'Estante',
    icon: (
      <svg {...icon}>
        <rect x="6" y="3" width="20" height="26" rx="1" />
        <path d="M6 12h20M6 20h20" />
      </svg>
    ),
  },
  {
    id: 'caja',
    name: 'Caja de té',
    icon: (
      <svg {...icon}>
        <rect x="4" y="12" width="24" height="14" rx="1" />
        <path d="M3 8h26v4H3zM16 12v14" />
      </svg>
    ),
  },
  {
    id: 'blanco',
    name: 'En blanco',
    icon: (
      <svg {...icon}>
        <rect x="5" y="5" width="22" height="22" rx="2" strokeDasharray="3 3" />
        <path d="M16 11v10M11 16h10" />
      </svg>
    ),
  },
] as const;

function emptyProject(): Project {
  const now = new Date().toISOString();
  return { schemaVersion: SCHEMA_VERSION, id: `proyecto-${now}`, name: 'Proyecto nuevo', units: 'cm', createdAt: now, updatedAt: now, parts: [], joints: [] };
}

/** "hoy", "ayer" o la fecha corta. */
function when(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days <= 0) return 'hoy';
  if (days === 1) return 'ayer';
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

function summary(p: Project): { size: string; meta: string } {
  const boxes = p.parts.filter((x) => x.base.kind === 'box').map(partBox);
  const unit = p.units === 'cm' ? ' cm' : '″';
  let size = 'Sin piezas';
  if (boxes.length) {
    const ext = [0, 1, 2].map((k) => Math.max(...boxes.map((b) => b.max[k]!)) - Math.min(...boxes.map((b) => b.min[k]!)));
    size = [ext[0]!, ext[2]!, ext[1]!].map((mm) => formatNumber(mm, p.units)).join(' × ') + unit;
  }
  const wood = woodById(p.parts[0]?.wood ?? '')?.name;
  const meta = [wood, `${p.parts.length} ${p.parts.length === 1 ? 'pieza' : 'piezas'}`, when(p.updatedAt)].filter(Boolean).join(' · ');
  return { size, meta };
}

function download(p: Project) {
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${p.name.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'proyecto'}.kitc.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function ProjectRow({ project, onOpen, onChanged }: { project: Project; onOpen: (id: string) => void; onChanged: () => void }) {
  const [menu, setMenu] = useState(false);
  const { size, meta } = summary(project);
  return (
    <li className={styles.project}>
      <button type="button" className={styles.projectMain} onClick={() => onOpen(project.id)}>
        <span className={styles.thumb} aria-hidden="true">
          <IconLogo />
        </span>
        <span className={styles.projectText}>
          <span className={styles.projectName}>{project.name}</span>
          <span className={styles.projectSize}>{size}</span>
          <span className={styles.muted}>{meta}</span>
        </span>
      </button>
      <button type="button" className={styles.more} aria-label={`Más opciones de ${project.name}`} aria-expanded={menu} onClick={() => setMenu(!menu)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>
      {menu && (
        <div className={styles.menu} role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              download(project);
              setMenu(false);
            }}
          >
            Exportar archivo
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.dangerItem}
            onClick={async () => {
              setMenu(false);
              if (!confirm(`¿Eliminar "${project.name}" de este dispositivo? No se puede deshacer.`)) return;
              await deleteProject(project.id);
              onChanged();
            }}
          >
            Eliminar
          </button>
        </div>
      )}
    </li>
  );
}

export function Home({ onOpen }: { onOpen: (id: string) => void }) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const refresh = () => void listProjects().then(setProjects, () => setProjects([]));

  useEffect(() => {
    refresh();
    // El motor de cortes tarda un par de segundos en abrir: se prepara mientras se elige qué hacer.
    const t = setTimeout(warmUpEngine, 1200);
    return () => clearTimeout(t);
  }, []);

  const create = async (template: string) => {
    if (template !== 'blanco') {
      navigate(`#/nuevo/${template}`);
      return;
    }
    const p = emptyProject();
    await saveProject(p);
    onOpen(p.id);
  };

  const openFile = async (file: File) => {
    setFileError(null);
    try {
      const r = loadProject(JSON.parse(await file.text()));
      if (!r.ok) return setFileError(r.error);
      const p = { ...r.project, updatedAt: new Date().toISOString() };
      await saveProject(p);
      onOpen(p.id);
    } catch {
      setFileError('El archivo no es un proyecto de Kit Carpintero.');
    }
  };

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.brand}>
          <IconLogo />
          <span>
            Kit <span className={styles.brandWood}>Carpintero</span>
          </span>
        </span>
      </header>
      <p className={styles.lead}>Sin cuenta. Tus proyectos se guardan en este dispositivo.</p>

      <section className={styles.section} aria-labelledby="nuevo">
        <h1 id="nuevo" className={styles.title}>
          ¿Qué mueble vas a hacer?
        </h1>
        <div className={styles.starts}>
          <a href="#plantillas" className={`${styles.start} ${styles.startPrimary}`}>
            <span className={styles.startIcon} aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M9 21V9" />
              </svg>
            </span>
            <span className={styles.startText}>
              <strong>Desde una plantilla</strong>
              <span>Elegí un mueble y se arma con sus encastres; después ajustás cada medida</span>
            </span>
          </a>
          <a href="#/foto" className={styles.start}>
            <span className={`${styles.startIcon} ${styles.startIconSoft}`} aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h3l2-3h6l2 3h3v13H4z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </span>
            <span className={styles.startText}>
              <strong>Desde una foto</strong>
              <span>Marcá una medida que conozcas y calcá las piezas</span>
            </span>
          </a>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="plantillas" id="plantillas">
        <h2 id="plantillas-t" className={styles.h2}>
          Plantillas
        </h2>
        <div className={styles.templates}>
          {TEMPLATES.map((t) => (
            <button key={t.id} type="button" className={styles.template} onClick={() => void create(t.id)}>
              {t.icon}
              {t.name}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="mis">
        <div className={styles.sectionHead}>
          <h2 id="mis" className={styles.h2}>
            Mis proyectos
          </h2>
          <button type="button" className={styles.link} onClick={() => fileRef.current?.click()}>
            Abrir archivo
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void openFile(f);
              e.target.value = '';
            }}
          />
        </div>
        {fileError && (
          <p className={styles.error} role="alert">
            {fileError}
          </p>
        )}
        {projects && projects.length === 0 && <p className={styles.muted}>Todavía no hay proyectos. Empezá con una plantilla.</p>}
        <ul className={styles.projects}>
          {projects?.map((p) => (
            <ProjectRow key={p.id} project={p} onOpen={onOpen} onChanged={refresh} />
          ))}
        </ul>
      </section>
      <p className={styles.foot}>Para no perder un proyecto, exportalo como archivo desde el menú de cada uno.</p>
      <p className={styles.foot}>
        <a href={`${import.meta.env.BASE_URL}geometria.html`}>Probar el motor de geometría en este dispositivo</a>
      </p>
    </div>
  );
}
