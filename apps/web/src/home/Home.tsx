import { useEffect, useRef, useState } from 'react';
import {
  formatNumber,
  getLang,
  loadProject,
  locale,
  partBox,
  SCHEMA_VERSION,
  t,
  templateById,
  templateDefaults,
  tk,
  woodById,
  type Project,
} from '@kitc/core';
import { deleteProject, listProjects, saveProject } from '../storage/db';
import { warmUpEngine } from '../editor/useGeometry';
import { BrandMark, BrandWordmark } from '../brand/Brand';
import { navigate } from '../routes';
import { useInstall } from '../pwa';
import { projectName, switchLang } from '../i18n';
import { JointMeta } from '../help/Help';
import styles from './Home.module.css';

const icon = { width: 40, height: 40, viewBox: '0 0 32 32', fill: 'none', stroke: 'currentColor', strokeWidth: 2, 'aria-hidden': true } as const;
const TEMPLATES = [
  {
    id: 'mesa',
    name: tk('Mesa'),
    icon: (
      <svg {...icon}>
        <rect x="3" y="9" width="26" height="4" rx="1" />
        <path d="M6 13v13M26 13v13" />
      </svg>
    ),
  },
  {
    id: 'taburete',
    name: tk('Taburete'),
    icon: (
      <svg {...icon}>
        <rect x="8" y="6" width="16" height="4" rx="1" />
        <path d="M10 10 8 27M22 10l2 17M9 20h14" />
      </svg>
    ),
  },
  {
    id: 'estante',
    name: tk('Estante'),
    icon: (
      <svg {...icon}>
        <rect x="6" y="3" width="20" height="26" rx="1" />
        <path d="M6 12h20M6 20h20" />
      </svg>
    ),
  },
  {
    id: 'caja',
    name: tk('Caja de té'),
    icon: (
      <svg {...icon}>
        <rect x="4" y="12" width="24" height="14" rx="1" />
        <path d="M3 8h26v4H3zM16 12v14" />
      </svg>
    ),
  },
  {
    id: 'mesa-luz',
    name: tk('Mesa de luz'),
    icon: (
      <svg {...icon}>
        <rect x="7" y="5" width="18" height="21" rx="1" />
        <path d="M7 12h18M14 8.5h4M7 22h18M9 26v2M23 26v2" />
      </svg>
    ),
  },
  {
    id: 'cajonera',
    name: tk('Cajonera'),
    icon: (
      <svg {...icon}>
        <rect x="5" y="4" width="22" height="23" rx="1" />
        <path d="M5 10h22M5 16h22M5 22h22M14 7h4M14 13h4M14 19h4" />
      </svg>
    ),
  },
  {
    id: 'biblioteca',
    name: tk('Biblioteca'),
    icon: (
      <svg {...icon}>
        <rect x="7" y="2" width="18" height="27" rx="1" />
        <path d="M7 8h18M7 14h18M7 19h18M16 19v10M14 23v2M18 23v2" />
      </svg>
    ),
  },
  {
    id: 'alacena',
    name: tk('Alacena'),
    icon: (
      <svg {...icon}>
        <rect x="5" y="7" width="22" height="16" rx="1" />
        <path d="M16 7v16M13.5 15v2M18.5 15v2M3 4h26" />
      </svg>
    ),
  },
  {
    id: 'mesa-ratona',
    name: tk('Mesa ratona'),
    icon: (
      <svg {...icon}>
        <rect x="2" y="15" width="28" height="4" rx="1" />
        <path d="M5 19v7M27 19v7" />
      </svg>
    ),
  },
  {
    id: 'banco',
    name: tk('Banco'),
    icon: (
      <svg {...icon}>
        <rect x="2" y="12" width="28" height="4" rx="1" />
        <path d="M5 16l-1 10M27 16l1 10M4.5 22h23" />
      </svg>
    ),
  },
] as const;

const blankIcon = (
  <svg width="24" height="24" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
    <rect x="5" y="5" width="22" height="22" rx="2" strokeDasharray="3 3" />
    <path d="M16 11v10M11 16h10" />
  </svg>
);

/** Medidas de siempre de la plantilla, por fuera: "180 × 90 × 75 cm". */
function templateSize(id: string): string {
  const def = templateById(id);
  if (!def) return '';
  const v = templateDefaults(def);
  const dims = [v.width, v.depth ?? v.width, v.height].filter((x): x is number => x !== undefined);
  return `${dims.map((mm) => formatNumber(mm, 'cm')).join(' × ')} cm`;
}

function emptyProject(): Project {
  const now = new Date().toISOString();
  return { schemaVersion: SCHEMA_VERSION, id: `proyecto-${now}`, name: t('Proyecto nuevo'), units: 'cm', createdAt: now, updatedAt: now, parts: [], joints: [], components: [] };
}

/** "hoy", "ayer" o la fecha corta. */
function when(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days <= 0) return t('hoy');
  if (days === 1) return t('ayer');
  return d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
}

function summary(p: Project): { size: string; meta: string } {
  const boxes = p.parts.filter((x) => x.base.kind === 'box').map(partBox);
  const unit = p.units === 'cm' ? ' cm' : '″';
  let size = t('Sin piezas');
  if (boxes.length) {
    const ext = [0, 1, 2].map((k) => Math.max(...boxes.map((b) => b.max[k]!)) - Math.min(...boxes.map((b) => b.min[k]!)));
    size = [ext[0]!, ext[2]!, ext[1]!].map((mm) => formatNumber(mm, p.units)).join(' × ') + unit;
  }
  const woodName = woodById(p.parts[0]?.wood ?? '')?.name;
  const wood = woodName && t(woodName);
  const count = p.parts.length === 1 ? t('1 pieza') : t('{n} piezas', { n: p.parts.length });
  const meta = [wood, count, when(p.updatedAt)].filter(Boolean).join(' · ');
  return { size, meta };
}

/** Cuándo se exportó cada proyecto por última vez, en este navegador. */
const exportKey = (id: string) => `kitc:exportado:${id}`;
function readExported(id: string): string | null {
  try {
    return localStorage.getItem(exportKey(id));
  } catch {
    return null;
  }
}

function download(p: Project) {
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${p.name.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || t('proyecto')}.kitc.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  const at = new Date().toISOString();
  try {
    localStorage.setItem(exportKey(p.id), at);
  } catch {
    // Sin almacenamiento: el recordatorio vuelve a aparecer.
  }
  return at;
}

function ProjectRow({ project, onOpen, onChanged }: { project: Project; onOpen: (id: string) => void; onChanged: () => void }) {
  const [menu, setMenu] = useState(false);
  const { size, meta } = summary(project);
  const [exportedAt, setExportedAt] = useState(() => readExported(project.id));
  const backup = project.parts.length > 0 && (!exportedAt || exportedAt < project.updatedAt);
  return (
    <li className={styles.project}>
      <button type="button" className={styles.projectMain} onClick={() => onOpen(project.id)}>
        <span className={styles.thumb} aria-hidden="true">
          <BrandMark height={30} />
        </span>
        <span className={styles.projectText}>
          <span className={styles.projectName}>{projectName(project.name)}</span>
          <span className={styles.projectSize}>{size}</span>
          <span className={styles.muted}>{meta}</span>
        </span>
      </button>
      <button type="button" className={styles.more} aria-label={t('Más opciones de {name}', { name: projectName(project.name) })} aria-expanded={menu} onClick={() => setMenu(!menu)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>
      {backup && (
        <div className={styles.backup}>
          <span>{exportedAt ? t('Cambió desde la última copia en archivo.') : t('Todavía no tiene copia en archivo.')}</span>
          <button type="button" className={styles.link} onClick={() => setExportedAt(download(project))}>
            {t('Guardar copia')}
          </button>
        </div>
      )}
      {menu && (
        <div className={styles.menu} role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setExportedAt(download(project));
              setMenu(false);
            }}
          >
            {t('Exportar archivo')}
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.dangerItem}
            onClick={async () => {
              setMenu(false);
              if (!confirm(t('¿Eliminar "{name}" de este dispositivo? No se puede deshacer.', { name: projectName(project.name) }))) return;
              await deleteProject(project.id);
              onChanged();
            }}
          >
            {t('Eliminar')}
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
  const install = useInstall();

  useEffect(() => {
    refresh();
    // El motor de cortes tarda un par de segundos en abrir: se prepara mientras se elige qué hacer.
    const timer = setTimeout(warmUpEngine, 1200);
    return () => clearTimeout(timer);
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
      setFileError(t('El archivo no es un proyecto de Calibre Studio.'));
    }
  };

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.brand}>
          <BrandMark height={52} />
          <BrandWordmark height={36} />
        </span>
        <span className={styles.headerActions}>
          {install && (
            <button type="button" className={styles.install} onClick={install}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
              </svg>
              {t('Instalar la app')}
            </button>
          )}
          <span className={styles.lang} role="group" aria-label="Idioma · Language">
            {(['es', 'en'] as const).map((l) => (
              <button key={l} type="button" lang={l} aria-pressed={getLang() === l} onClick={() => getLang() !== l && switchLang(l)}>
                {l === 'es' ? 'Español' : 'English'}
              </button>
            ))}
          </span>
        </span>
      </header>
      <p className={styles.lead}>{t('Sin cuenta. Tus proyectos se guardan en este dispositivo.')}</p>

      <section className={styles.section} aria-labelledby="nuevo">
        <h1 id="nuevo" className={styles.title}>
          {t('¿Qué mueble vas a hacer?')}
        </h1>
        <p className={styles.sub}>{t('Elegí una plantilla: se arma con sus encastres y después ajustás cada medida.')}</p>
        <div className={styles.templates} id="plantillas">
          {TEMPLATES.map((tpl) => {
            const joint = templateById(tpl.id)?.joints?.default;
            return (
              <button key={tpl.id} type="button" className={styles.template} onClick={() => void create(tpl.id)}>
                <span className={styles.templateArt}>{tpl.icon}</span>
                <span className={styles.templateName}>{t(tpl.name)}</span>
                <span className={styles.templateSize}>{templateSize(tpl.id)}</span>
                {joint && <JointMeta type={joint} short />}
              </button>
            );
          })}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="otras">
        <h2 id="otras" className={styles.h2}>
          {t('Otras formas de empezar')}
        </h2>
        <div className={styles.starts}>
          <a href="#/foto" className={styles.start}>
            <span className={styles.startIcon} aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h3l2-3h6l2 3h3v13H4z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </span>
            <span className={styles.startText}>
              <strong>{t('Desde una foto')}</strong>
              <span>{t('Marcá una medida que conozcas y calcá las piezas')}</span>
            </span>
          </a>
          <button type="button" className={styles.start} onClick={() => void create('blanco')}>
            <span className={styles.startIcon}>{blankIcon}</span>
            <span className={styles.startText}>
              <strong>{t('En blanco')}</strong>
              <span>{t('Armalo pieza por pieza, para un mueble que no está en las plantillas')}</span>
            </span>
          </button>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="mis">
        <div className={styles.sectionHead}>
          <h2 id="mis" className={styles.h2}>
            {t('Mis proyectos')}
          </h2>
          <button type="button" className={styles.link} onClick={() => fileRef.current?.click()}>
            {t('Abrir archivo')}
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
        {projects && projects.length === 0 && <p className={styles.muted}>{t('Todavía no hay proyectos. Empezá con una plantilla.')}</p>}
        <ul className={styles.projects}>
          {projects?.map((p) => (
            <ProjectRow key={p.id} project={p} onOpen={onOpen} onChanged={refresh} />
          ))}
        </ul>
      </section>
      <p className={styles.foot}>{t('Los proyectos se guardan solo en este navegador. Si borrás los datos de navegación, se pierden: guardá una copia en archivo de vez en cuando.')}</p>
      {import.meta.env.DEV && (
        <p className={styles.foot}>
          <a href={`${import.meta.env.BASE_URL}geometria.html`}>{t('Probar el motor de geometría en este dispositivo')}</a>
        </p>
      )}
    </div>
  );
}
