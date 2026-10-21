import { useEffect, useRef, useState } from 'react';
import { formatLength, t, tk } from '@kitc/core';
import { sectionHref, type Section } from '../routes';
import { saveProject } from '../storage/db';
import { CutsView } from './CutsView';
import {
  IconBack,
  IconBevel,
  IconSection,
  IconTurn,
  IconDraw,
  IconCuts,
  IconJoints,
  IconLogo,
  IconModel,
  IconMove,
  IconPlan,
  IconPlus,
  IconPush,
  IconRedo,
  IconSelect,
  IconUndo,
  IconXray,
} from './icons';
import { JointsView } from './JointsView';
import { PlanView } from './PlanView';
import { ADD_OPTIONS, PartPanel, UnitsToggle, useAddPart } from './PartPanel';
import { useEditor, useSelectedPart, type Tool, type View } from './store';
import { useExactMeshes } from './useGeometry';
import { ToolGuide, ChangeNotice } from './ToolGuide';
import { MeasureBubble } from './MeasureBubble';
import { Viewport } from './Viewport';
import styles from './Editor.module.css';

/** Herramientas: id, nombre completo (para lectores de pantalla y el cartel), nombre corto bajo el ícono, atajo e ícono. */
const TOOLS: [Tool, string, string, string, () => React.JSX.Element][] = [
  ['select', tk('Seleccionar'), tk('Elegir'), 'V', IconSelect],
  ['push', tk('Empujar o tirar una cara'), tk('Estirar'), 'P', IconPush],
  ['move', tk('Mover pieza'), tk('Mover'), 'M', IconMove],
  ['draw', tk('Dibujar en una cara'), tk('Dibujar'), 'D', IconDraw],
  ['bevel', tk('Biselar o redondear'), tk('Biselar'), 'B', IconBevel],
  ['section', tk('Agrandar o achicar un tramo'), tk('Tramo'), 'T', IconSection],
  ['turn', tk('Tornear'), tk('Tornear'), 'R', IconTurn],
];
const VIEWS: [View, string, string][] = [
  ['iso', tk('Iso'), tk('Iso')],
  ['front', tk('Frente'), tk('Frente')],
  ['side', tk('Lateral'), tk('Lado')],
  ['top', tk('Planta'), tk('Planta')],
];

type SaveState = 'saved' | 'saving' | 'error';

/** Guarda el proyecto en el dispositivo medio segundo después del último cambio. */
function useAutosave(): SaveState {
  const project = useEditor((s) => s.project);
  const dragging = useEditor((s) => s.dragging);
  const [state, setState] = useState<SaveState>('saved');
  const first = useRef(project?.updatedAt);
  useEffect(() => {
    if (!project || dragging || project.updatedAt === first.current) return;
    const timer = setTimeout(() => {
      setState('saving');
      saveProject(project).then(
        () => setState('saved'),
        () => setState('error'),
      );
    }, 500);
    return () => clearTimeout(timer);
  }, [project, dragging]);
  return state;
}

/** Atajos de teclado. Las herramientas y borrar piezas solo valen en Modelo; deshacer, en todas. */
function useShortcuts(modelo: boolean) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useEditor.getState();
      const typing = e.target instanceof HTMLElement && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName);
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'y')) {
        // En Medida vacía, deshacer vuelve atrás el último cambio del modelo, no el texto.
        if (typing && !(e.target instanceof HTMLInputElement && e.target.id === 'medida' && !e.target.value)) return;
        e.preventDefault();
        if (k === 'y' || e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (!modelo || typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (k === 'v') s.setTool('select');
      else if (k === 'p') s.setTool('push');
      else if (k === 'm') s.setTool('move');
      else if (k === 'd') s.setTool('draw');
      else if (k === 'b') s.setTool('bevel');
      else if (k === 't') s.setTool('section');
      else if (k === 'r') s.setTool('turn');
      else if (k === 'x') s.setXray(!s.xray);
      else if (k === 'escape') {
        if (s.drawFace) s.setDrawFace(null);
        else s.select(null);
      }
      else if ((k === 'delete' || k === 'backspace') && s.selectedId) {
        const id = s.selectedId;
        s.commit((d) => void (d.parts = d.parts.filter((p) => p.id !== id)), t('Borraste {id}', { id }));
      } else if (/^[0-9]$/.test(k) && s.bubble) {
        document.getElementById('medida')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modelo]);
}

interface NavProps {
  projectId: string;
  section: Section;
  jointCount: number;
  variant: 'tabs' | 'bar';
}

function SectionNav({ projectId, section, jointCount, variant }: NavProps) {
  const items: [Section, string, () => React.JSX.Element][] = [
    ['modelo', t('Modelo'), IconModel],
    ['uniones', t('Uniones'), IconJoints],
    ['cortes', t('Cortes'), IconCuts],
    ['plano', t('Plano'), IconPlan],
  ];
  return (
    <nav aria-label={t('Secciones del proyecto')} className={variant === 'tabs' ? styles.tabs : styles.bottomNav}>
      {items.map(([key, label, Icon]) => (
        <a key={key} href={sectionHref(projectId, key)} aria-current={section === key ? 'page' : undefined}>
          {variant === 'bar' && <Icon />}
          {label}
          {key === 'uniones' && variant === 'tabs' && <span className={styles.badge}>{jointCount}</span>}
        </a>
      ))}
    </nav>
  );
}

function AddPartButton() {
  const [open, setOpen] = useState(false);
  const add = useAddPart();
  return (
    <div className={styles.fabWrap}>
      {open && (
        <div className={styles.addMenu} role="menu" aria-label={t('Agregar pieza')}>
          {ADD_OPTIONS.map(([k, label, size]) => (
            <button
              key={k}
              type="button"
              role="menuitem"
              onClick={() => {
                add(k);
                setOpen(false);
              }}
            >
              <strong>{t(label)}</strong>
              <span>{t(size)}</span>
            </button>
          ))}
        </div>
      )}
      <button type="button" className={styles.fab} aria-label={t('Agregar pieza')} aria-expanded={open} onClick={() => setOpen(!open)}>
        <IconPlus />
      </button>
    </div>
  );
}

const SECTION_TITLES: Record<Section, string> = { modelo: '', uniones: tk('Uniones'), cortes: tk('Lista de compras'), plano: tk('Plano') };

export function Editor({ section, onExit }: { section: Section; onExit: () => void }) {
  const project = useEditor((s) => s.project);
  const tool = useEditor((s) => s.tool);
  const xray = useEditor((s) => s.xray);
  const view = useEditor((s) => s.view);
  const hint = useEditor((s) => s.hint);
  const dragging = useEditor((s) => s.dragging);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const { undo, redo, setTool, setXray, setView } = useEditor.getState();
  const selected = useSelectedPart();
  const saveState = useAutosave();
  const { engineStatus, meshes } = useExactMeshes(project, dragging);
  useShortcuts(section === 'modelo');
  if (!project) return null;
  const modelo = section === 'modelo';
  const back = modelo ? onExit : () => (location.hash = sectionHref(project.id, 'modelo'));

  const warnings = [...meshes.values()].filter((m) => m.warning).length;
  const saveText = saveState === 'error' ? t('No se pudo guardar') : saveState === 'saving' ? t('Guardando…') : t('Guardado en este dispositivo');
  const engineText = engineStatus === 'loading' ? t('Preparando los cortes exactos…') : engineStatus === 'error' ? t('No se pudieron calcular los cortes') : null;
  const jointCount = project.joints.length;
  const selDims = selected?.base.kind === 'box' ? [...selected.base.size].sort((a, b) => b - a) : null;

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.mobileOnly}>
          <button
            type="button"
            className={`${styles.iconBtn} ${styles.backBtn}`}
            aria-label={modelo ? t('Volver a mis proyectos') : t('Volver al modelo')}
            onClick={back}
          >
            <IconBack />
          </button>
        </span>
        <span className={styles.desktopOnly}>
          <a
            href="#/"
            className={styles.brand}
            onClick={(e) => {
              e.preventDefault();
              onExit();
            }}
          >
            <IconLogo />
            <span>
              Kit <span className={styles.brandWood}>Carpintero</span>
            </span>
          </a>
        </span>
        <div className={styles.titleBlock}>
          {modelo ? (
            <>
              <h1>{project.name}</h1>
              <span className={saveState === 'error' ? styles.errorText : styles.muted} role="status">
                {saveText}
              </span>
            </>
          ) : (
            <>
              <span className={`${styles.muted} ${styles.overline}`}>{project.name}</span>
              <span className={styles.sectionTitle}>{SECTION_TITLES[section] && t(SECTION_TITLES[section])}</span>
              <span className={styles.desktopTitle}>{project.name}</span>
              <span className={styles.srOnly} role="status">
                {saveState === 'saved' ? '' : saveText}
              </span>
            </>
          )}
        </div>
        <div className={styles.desktopOnly}>
          <SectionNav projectId={project.id} section={section} jointCount={jointCount} variant="tabs" />
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.iconBtn} aria-label={t('Deshacer (Ctrl+Z)')} disabled={!canUndo} onClick={undo}>
            <IconUndo />
          </button>
          <button type="button" className={styles.iconBtn} aria-label={t('Rehacer (Ctrl+Y)')} disabled={!canRedo} onClick={redo}>
            <IconRedo />
          </button>
          <span className={styles.desktopOnly}>
            <UnitsToggle units={project.units} />
          </span>
        </div>
      </header>

      {section === 'uniones' && <JointsView project={project} meshes={meshes} />}
      {section === 'cortes' && <CutsView project={project} />}
      {section === 'plano' && <PlanView project={project} />}
      {modelo && (
        <>
        <main className={styles.main}>
          <section className={styles.stage} aria-label={t('Vista 3D')} data-tool={tool}>
            <Viewport meshes={meshes} label={selected ? t('Modelo 3D de {name}, con {part} elegida', { name: project.name, part: selected.name }) : t('Modelo 3D de {name}', { name: project.name })} />
            <div className={styles.toolbar} role="toolbar" aria-label={t('Herramientas')}>
              {TOOLS.map(([id, label, short, key, Icon]) => (
                <button key={id} type="button" aria-pressed={tool === id} aria-label={`${t(label)} (${key})`} title={`${t(label)} (${key})`} onClick={() => setTool(id)}>
                  <Icon />
                  <span aria-hidden="true">{t(short)}</span>
                </button>
              ))}
              <span className={styles.toolSep} aria-hidden="true" />
              <button type="button" aria-pressed={xray} aria-label={t('Rayos X (X)')} title={t('Rayos X (X)')} onClick={() => setXray(!xray)}>
                <IconXray />
                <span aria-hidden="true">{t('Rayos X')}</span>
              </button>
            </div>
            <div className={styles.views} role="group" aria-label={t('Vista')}>
              {VIEWS.map(([v, label, short]) => (
                <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>
                  <span className={styles.desktopOnly}>{t(label)}</span>
                  <span className={styles.mobileOnly}>{t(short)}</span>
                </button>
              ))}
            </div>
            <ToolGuide />
            <ChangeNotice />
            <div className={styles.desktopOnly}>
              <MeasureBubble />
            </div>
            {selected && selDims && (
              <span className={`${styles.chip} ${styles.desktopOnly}`}>
                <strong>{selected.id}</strong> {selected.name}
                <span className={styles.chipNum}>{selDims.map((mm) => formatLength(mm, project.units).replace(/ cm|″/, '')).join(' × ')}{project.units === 'cm' ? ' cm' : '″'}</span>
              </span>
            )}
            {(engineText || warnings > 0) && (
              <span className={styles.engine} role="status">
                {engineText ?? (warnings === 1 ? t('1 pieza no se pudo cortar del todo') : t('{n} piezas no se pudieron cortar del todo', { n: warnings }))}
              </span>
            )}
            {hint && (
              <span className={styles.hint} style={{ left: hint.x, top: hint.y }}>
                {hint.text}
                {hint.snap && <span className={styles.snap}>{t('Imán: {snap}', { snap: hint.snap })}</span>}
              </span>
            )}
            {tool === 'select' && (
              <span className={styles.mobileOnly}>
                <AddPartButton />
              </span>
            )}
          </section>

          <aside className={styles.panel} aria-label={selected ? t('Pieza seleccionada') : t('Piezas del proyecto')}>
            <span className={styles.grabber} aria-hidden="true" />
            <PartPanel />
          </aside>
        </main>

        </>
      )}
      <div className={styles.mobileOnly}>
        <SectionNav projectId={project.id} section={section} jointCount={jointCount} variant="bar" />
      </div>
    </div>
  );
}
