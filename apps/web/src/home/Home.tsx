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
import { HELP_ROUTE, navigate, sectionHref } from '../routes';
import { useInstall } from '../pwa';
import { projectName, switchLang } from '../i18n';
import { JointMeta } from '../help/Help';
import { startPracticeStool } from '../help/practice';
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
  {
    id: 'patas-abiertas',
    name: tk('Taburete de patas abiertas'),
    icon: (
      <svg {...icon}>
        <rect x="7" y="7" width="18" height="4" rx="1" />
        <path d="M10 11 5 27M22 11l5 16" />
      </svg>
    ),
  },
  {
    id: 'silla',
    name: tk('Silla'),
    icon: (
      <svg {...icon}>
        <path d="M10 3l2 14M22 3l-2 14M11 6.5h10" />
        <rect x="6" y="16" width="20" height="3" rx="1" />
        <path d="M9 19 6 29M23 19l3 10" />
      </svg>
    ),
  },
  {
    id: 'banco-rustico',
    name: tk('Banco rústico'),
    icon: (
      <svg {...icon}>
        <rect x="2" y="11" width="28" height="4" rx="1" />
        <path d="M6 15 3 27M26 15l3 12M4.5 22h23" />
      </svg>
    ),
  },
] as const;

const IconSave = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </svg>
);

const IconOpen = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);

const templateIcon = (
  <svg width="24" height="24" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
    <rect x="4" y="4" width="10" height="10" rx="1.5" />
    <rect x="18" y="4" width="10" height="10" rx="1.5" />
    <rect x="4" y="18" width="10" height="10" rx="1.5" />
    <rect x="18" y="18" width="10" height="10" rx="1.5" />
  </svg>
);

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
  return { schemaVersion: SCHEMA_VERSION, id: `proyecto-${now}`, name: t('Proyecto nuevo'), units: 'cm', createdAt: now, updatedAt: now, parts: [], joints: [], components: [], groups: [] };
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

/** El ⋮ de un proyecto: ir al plano, exportar o eliminar. */
function ProjectMenu({ project, onExported, onChanged, align = 'end' }: { project: Project; onExported: (at: string) => void; onChanged: () => void; align?: 'end' | 'start' }) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div ref={ref} className={styles.menuWrap}>
      <button type="button" className={styles.more} aria-label={t('Más opciones de {name}', { name: projectName(project.name) })} aria-expanded={open} onClick={() => {
        setOpen(!open);
        setRenaming(false);
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>
      {open && renaming && (
        <form
          className={`${styles.menu} ${styles.renameForm}`}
          data-align={align}
          onSubmit={async (e) => {
            e.preventDefault();
            const v = String(new FormData(e.currentTarget).get('nombre') ?? '').trim();
            setOpen(false);
            if (!v || v === projectName(project.name)) return;
            await saveProject({ ...project, name: v, updatedAt: new Date().toISOString() });
            onChanged();
          }}
        >
          <label htmlFor={`nombre-${project.id}`}>{t('Nombre del proyecto')}</label>
          <input id={`nombre-${project.id}`} name="nombre" autoFocus maxLength={80} defaultValue={projectName(project.name)} onFocus={(e) => e.currentTarget.select()} />
          <span className={styles.renameActions}>
            <button type="button" onClick={() => setOpen(false)}>
              {t('Cancelar')}
            </button>
            <button type="submit" className={styles.renameSave}>
              {t('Guardar')}
            </button>
          </span>
        </form>
      )}
      {open && !renaming && (
        <div className={styles.menu} role="menu" data-align={align}>
          <button type="button" role="menuitem" onClick={() => setRenaming(true)}>
            {t('Cambiar nombre')}
          </button>
          <button type="button" role="menuitem" onClick={() => navigate(sectionHref(project.id, 'plano'))}>
            {t('Ir al plano')}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onExported(download(project));
              setOpen(false);
            }}
          >
            {t('Exportar archivo')}
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.dangerItem}
            onClick={async () => {
              setOpen(false);
              if (!confirm(t('¿Eliminar "{name}" de este dispositivo? No se puede deshacer.', { name: projectName(project.name) }))) return;
              await deleteProject(project.id);
              onChanged();
            }}
          >
            {t('Eliminar')}
          </button>
        </div>
      )}
    </div>
  );
}

/** Si el proyecto tiene una copia en archivo al día: los proyectos viven solo en el navegador. */
function useBackup(project: Project) {
  const [exportedAt, setExportedAt] = useState(() => readExported(project.id));
  const pending = project.parts.length > 0 && (!exportedAt || exportedAt < project.updatedAt);
  return { exportedAt, setExportedAt, pending };
}

function BackupTag({ pending, exportedAt }: { pending: boolean; exportedAt: string | null }) {
  return (
    <span className={styles.tag} data-warn={pending || undefined}>
      {pending ? (exportedAt ? t('Cambió desde la copia') : t('Sin copia en archivo')) : t('Copia al día')}
    </span>
  );
}

/** El último proyecto que se tocó, grande, para seguir donde se dejó. */
function LastProject({ project, onOpen, onChanged }: { project: Project; onOpen: (id: string) => void; onChanged: () => void }) {
  const { size, meta } = summary(project);
  const { exportedAt, setExportedAt, pending } = useBackup(project);
  return (
    <article className={styles.lastCard} aria-labelledby="ultimo-nombre">
      <div className={styles.lastTop}>
        <span className={styles.live}>
          <span aria-hidden="true" />
          {t('Seguí donde lo dejaste')}
        </span>
        <BackupTag pending={pending} exportedAt={exportedAt} />
        <ProjectMenu project={project} onExported={setExportedAt} onChanged={onChanged} />
      </div>
      <div className={styles.lastBody}>
        <div className={styles.lastText}>
          <h3 id="ultimo-nombre" className={styles.lastName}>
            {projectName(project.name)}
          </h3>
          <span className={styles.projectSize}>{size}</span>
          <span className={styles.muted}>{meta}</span>
        </div>
        <span className={`${styles.thumb} ${styles.lastThumb}`} aria-hidden="true">
          <BrandMark height={34} />
        </span>
      </div>
      <div className={styles.cardActions}>
        <button type="button" className={styles.primaryBtn} onClick={() => onOpen(project.id)}>
          {t('Continuar diseño')}
        </button>
        <button type="button" className={styles.smallBtn} onClick={() => setExportedAt(download(project))}>
          <IconSave />
          {t('Guardar copia')}
        </button>
      </div>
    </article>
  );
}

function ProjectCard({ project, onOpen, onChanged }: { project: Project; onOpen: (id: string) => void; onChanged: () => void }) {
  const { size, meta } = summary(project);
  const { exportedAt, setExportedAt, pending } = useBackup(project);
  return (
    <li className={styles.project}>
      <div className={styles.projectTop}>
        <span className={styles.thumb} aria-hidden="true">
          <BrandMark height={26} />
        </span>
        <span className={styles.projectText}>
          <span className={styles.projectName}>{projectName(project.name)}</span>
          <span className={styles.projectSize}>{size}</span>
          <span className={styles.muted}>{meta}</span>
        </span>
        <ProjectMenu project={project} onExported={setExportedAt} onChanged={onChanged} />
      </div>
      <BackupTag pending={pending} exportedAt={exportedAt} />
      <div className={styles.cardActions}>
        <button type="button" className={styles.primaryBtn} onClick={() => onOpen(project.id)}>
          {t('Abrir diseño')}
        </button>
        <button type="button" className={styles.smallBtn} onClick={() => setExportedAt(download(project))}>
          <IconSave />
          {t('Guardar copia')}
        </button>
      </div>
    </li>
  );
}

/** Las plantillas que más se usan, a un toque; el resto en la ventana de todas. */
const QUICK = ['mesa', 'estante', 'cajonera', 'alacena', 'banco'];
/** Cuántas tarjetas de proyectos entran en una fila antes de "Ver más". */
const SHOWN = 3;

export function Home({ onOpen }: { onOpen: (id: string) => void }) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const refresh = () => void listProjects().then(setProjects, () => setProjects([]));
  const install = useInstall();
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const [all, setAll] = useState(false);

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

  // Para quien entra por primera vez: un taburete armado y el recorrido por el editor encima.
  const learn = async () => {
    const id = await startPracticeStool();
    if (id) onOpen(id);
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

  // El más reciente va arriba, en grande; los demás, en tarjetas.
  const sorted = [...(projects ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const [last, ...rest] = sorted;
  const q = query.trim().toLocaleLowerCase(locale());
  const found = q ? sorted.filter((p) => projectName(p.name).toLocaleLowerCase(locale()).includes(q)) : rest;
  const shown = all || q ? found : found.slice(0, SHOWN);
  const hidden = found.length - shown.length;
  const quick = QUICK.map((id) => TEMPLATES.find((x) => x.id === id)!);

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <span className={styles.brand}>
            <BrandMark height={40} />
            <BrandWordmark height={26} />
          </span>
          <span className={styles.headerActions}>
            <span className={styles.lang} role="group" aria-label="Idioma · Language">
              {(['es', 'en'] as const).map((l) => (
                <button key={l} type="button" lang={l} aria-pressed={getLang() === l} aria-label={l === 'es' ? 'Español' : 'English'} onClick={() => getLang() !== l && switchLang(l)}>
                  {l.toUpperCase()}
                </button>
              ))}
            </span>
            <a className={`${styles.learn} ${styles.helpLink}`} href={HELP_ROUTE} aria-label={t('Ayuda')} title={t('Centro de ayuda')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6M12 17.2v.1" />
              </svg>
              <span className={styles.learnLong}>{t('Ayuda')}</span>
            </a>
            <button type="button" className={styles.learn} onClick={() => void learn()}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5.5v13l10-6.5z" />
              </svg>
              <span className={styles.learnLong}>{t('Aprender con un taburete')}</span>
              <span className={styles.learnShort}>{t('Aprender')}</span>
            </button>
            {install && (
              <button type="button" className={styles.install} onClick={install}>
                <IconSave />
                {t('Instalar la app')}
              </button>
            )}
          </span>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.create} aria-labelledby="nuevo">
          <h1 className={styles.title}>{t('¿Qué mueble vas a hacer?')}</h1>
          <div className={styles.createCard}>
            <h2 id="nuevo" className={styles.h3}>
              {t('Crear un proyecto nuevo')}
            </h2>
            <div className={styles.starts}>
              <button type="button" className={`${styles.start} ${styles.startMain}`} onClick={() => setPicking(true)} aria-haspopup="dialog">
                <span className={styles.startIcon}>{templateIcon}</span>
                <span className={styles.startText}>
                  <strong>{t('Desde una plantilla')}</strong>
                  <span>{t('Mesa, taburete, cajonera y {n} más, ya con sus encastres', { n: TEMPLATES.length - 3 })}</span>
                </span>
                <span className={styles.startArrow} aria-hidden="true">
                  <IconArrow />
                </span>
              </button>
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
                <span className={styles.startArrow} aria-hidden="true">
                  <IconArrow />
                </span>
              </a>
              <button type="button" className={styles.start} onClick={() => void create('blanco')}>
                <span className={styles.startIcon}>{blankIcon}</span>
                <span className={styles.startText}>
                  <strong>{t('En blanco')}</strong>
                  <span>{t('Armalo pieza por pieza, para un mueble que no está en las plantillas')}</span>
                </span>
                <span className={styles.startArrow} aria-hidden="true">
                  <IconArrow />
                </span>
              </button>
            </div>
          </div>
        </section>

        <section className={styles.last} aria-labelledby="ultimo">
          <div className={styles.sectionHead}>
            <h2 id="ultimo" className={styles.h2}>
              {t('Último proyecto')}
            </h2>
          </div>
          {last ? (
            <LastProject key={last.id} project={last} onOpen={onOpen} onChanged={refresh} />
          ) : (
            projects && (
              <div className={styles.empty}>
                <BrandMark height={36} />
                <p>{t('Todavía no hay proyectos. Empezá con una plantilla: en un minuto tenés el mueble armado.')}</p>
              </div>
            )
          )}
        </section>

        <section className={styles.quick} aria-labelledby="rapidas">
          <div className={styles.sectionHead}>
            <h2 id="rapidas" className={styles.h2}>
              {t('Plantillas rápidas')}
            </h2>
            <button type="button" className={styles.link} onClick={() => setPicking(true)} aria-haspopup="dialog">
              {t('Ver todas las plantillas')}
              <IconArrow />
            </button>
          </div>
          <ul className={styles.quickList}>
            {quick.map((tpl) => (
              <li key={tpl.id}>
                <button type="button" className={styles.quickItem} onClick={() => void create(tpl.id)}>
                  <span className={styles.quickArt}>{tpl.icon}</span>
                  <span className={styles.quickName}>{t(tpl.name)}</span>
                  <span className={styles.quickSize}>{templateSize(tpl.id)}</span>
                </button>
              </li>
            ))}
            <li>
              <button type="button" className={`${styles.quickItem} ${styles.quickMore}`} onClick={() => setPicking(true)} aria-haspopup="dialog">
                <span className={styles.plus} aria-hidden="true">
                  +
                </span>
                <span className={styles.quickName}>{t('Explorar')}</span>
                <span className={styles.quickSize}>{t('{n} plantillas más', { n: TEMPLATES.length - QUICK.length })}</span>
              </button>
            </li>
          </ul>
        </section>

        <section className={styles.mine} aria-labelledby="mis">
          <div className={styles.sectionHead}>
            <h2 id="mis" className={styles.h2}>
              {t('Mis proyectos')}
              {projects && projects.length > 0 && <span className={styles.count}>{projects.length}</span>}
            </h2>
            <span className={styles.mineTools}>
              {sorted.length > 1 && (
                <label className={styles.search}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="6" />
                    <path d="m20 20-4.5-4.5" />
                  </svg>
                  <span className={styles.srOnly}>{t('Buscar proyectos')}</span>
                  <input type="search" placeholder={t('Buscar proyectos…')} value={query} onChange={(e) => setQuery(e.target.value)} />
                </label>
              )}
              <button type="button" className={styles.smallBtn} onClick={() => fileRef.current?.click()}>
                <IconOpen />
                {t('Abrir archivo')}
              </button>
            </span>
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
          <div className={styles.projectsScroll} data-all={all || undefined}>
            {projects && found.length === 0 && (
              <p className={styles.none}>
                {q ? t('Ningún proyecto se llama así.') : sorted.length ? t('Acá aparecen los demás proyectos cuando tengas más de uno.') : t('Tus proyectos van a aparecer acá.')}
              </p>
            )}
            <ul className={styles.projects}>
              {shown.map((p) => (
                <ProjectCard key={p.id} project={p} onOpen={onOpen} onChanged={refresh} />
              ))}
              {hidden > 0 && (
                <li>
                  <button type="button" className={styles.moreCard} onClick={() => setAll(true)}>
                    <span className={styles.plus} aria-hidden="true">
                      +
                    </span>
                    <strong>{hidden === 1 ? t('Ver 1 proyecto más') : t('Ver {n} proyectos más', { n: hidden })}</strong>
                    <span>{t('Del más nuevo al más viejo')}</span>
                  </button>
                </li>
              )}
            </ul>
          </div>
        </section>
      </main>
      <footer className={styles.footer}>
        <p>{t('Los proyectos se guardan solo en este navegador. Si borrás los datos de navegación, se pierden: guardá una copia en archivo de vez en cuando.')}</p>
        {/* En el celular el encabezado no tiene lugar para Ayuda: va acá. */}
        <a className={styles.footHelp} href={HELP_ROUTE}>
          {t('Centro de ayuda')}
        </a>
        {import.meta.env.DEV && <a href={`${import.meta.env.BASE_URL}geometria.html`}>{t('Probar el motor de geometría en este dispositivo')}</a>}
      </footer>
      <TemplatePicker open={picking} onClose={() => setPicking(false)} onPick={(id) => void create(id)} />
    </div>
  );
}

const IconArrow = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 6 6 6-6 6" />
  </svg>
);

/** Las diez plantillas, en una ventana que se abre desde "Desde una plantilla". */
function TemplatePicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (id: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={styles.picker}
      aria-labelledby="elegir-plantilla"
      onClose={onClose}
      onClick={(e) => {
        // Tocar afuera de la ventana la cierra.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.pickerBody}>
        <div className={styles.pickerHead}>
          <div>
            <h2 id="elegir-plantilla" className={styles.h2}>
              {t('Elegí una plantilla')}
            </h2>
            <p className={styles.sub}>{t('Se arma con sus encastres y después ajustás cada medida.')}</p>
          </div>
          <button type="button" className={styles.close} aria-label={t('Cerrar')} onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className={styles.templates}>
          {TEMPLATES.map((tpl) => {
            const joint = templateById(tpl.id)?.joints?.default;
            return (
              <button key={tpl.id} type="button" className={styles.template} onClick={() => onPick(tpl.id)}>
                <span className={styles.templateArt}>{tpl.icon}</span>
                <span className={styles.templateName}>{t(tpl.name)}</span>
                <span className={styles.templateSize}>{templateSize(tpl.id)}</span>
                {joint && <JointMeta type={joint} short />}
              </button>
            );
          })}
        </div>
      </div>
    </dialog>
  );
}
