import { useEffect, useRef, useState } from 'react';
import { formatLength, parseLength } from '@kitc/core';
import { sectionHref, type Section } from '../routes';
import { saveProject } from '../storage/db';
import { CutsView } from './CutsView';
import {
  IconBack,
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
  IconCopy,
  IconXray,
} from './icons';
import { JointsView } from './JointsView';
import { PlanView } from './PlanView';
import { ADD_OPTIONS, PartPanel, UnitsToggle, useAddPart } from './PartPanel';
import { useEditor, useSelectedPart, type Tool, type View } from './store';
import { useExactMeshes } from './useGeometry';
import { Viewport } from './Viewport';
import styles from './Editor.module.css';

const TOOLS: [Tool, string, string, () => React.JSX.Element][] = [
  ['select', 'Seleccionar', 'V', IconSelect],
  ['push', 'Empujar o tirar una cara', 'P', IconPush],
  ['move', 'Mover pieza', 'M', IconMove],
];
const VIEWS: [View, string, string][] = [
  ['iso', 'Iso', 'Iso'],
  ['front', 'Frente', 'Frente'],
  ['side', 'Lateral', 'Lado'],
  ['top', 'Planta', 'Planta'],
];
const TIPS: Record<Tool, string> = {
  select: 'Tocá una pieza para editarla. Arrastrá el fondo para girar la vista y pellizcá o usá la rueda para acercar.',
  push: 'Arrastrá una cara para estirar o acortar la pieza. Se pega a las caras cercanas; después escribí la medida exacta.',
  move: 'Arrastrá una pieza sobre el piso. Se pega a las caras de las otras piezas. Con Ctrl (u Opción en Mac) o el botón de copiar, deja una copia.',
};

type SaveState = 'saved' | 'saving' | 'error';

/** Guarda el proyecto en el dispositivo medio segundo después del último cambio. */
function useAutosave(): SaveState {
  const project = useEditor((s) => s.project);
  const dragging = useEditor((s) => s.dragging);
  const [state, setState] = useState<SaveState>('saved');
  const first = useRef(project?.updatedAt);
  useEffect(() => {
    if (!project || dragging || project.updatedAt === first.current) return;
    const t = setTimeout(() => {
      setState('saving');
      saveProject(project).then(
        () => setState('saved'),
        () => setState('error'),
      );
    }, 500);
    return () => clearTimeout(t);
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
        if (typing) return;
        e.preventDefault();
        if (k === 'y' || e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (!modelo || typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (k === 'v') s.setTool('select');
      else if (k === 'p') s.setTool('push');
      else if (k === 'm') s.setTool('move');
      else if (k === 'x') s.setXray(!s.xray);
      else if (k === 'escape') s.select(null);
      else if ((k === 'delete' || k === 'backspace') && s.selectedId) {
        const id = s.selectedId;
        s.commit((d) => void (d.parts = d.parts.filter((p) => p.id !== id)));
      } else if (/^[0-9]$/.test(k) && s.lastPush) {
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
    ['modelo', 'Modelo', IconModel],
    ['uniones', 'Uniones', IconJoints],
    ['cortes', 'Cortes', IconCuts],
    ['plano', 'Plano', IconPlan],
  ];
  return (
    <nav aria-label="Secciones del proyecto" className={variant === 'tabs' ? styles.tabs : styles.bottomNav}>
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

/** "Medida": escribe el largo exacto de la última cara empujada. */
function MeasureBox() {
  const lastPush = useEditor((s) => s.lastPush);
  const units = useEditor((s) => s.project?.units ?? 'cm');
  const commit = useEditor((s) => s.commit);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const apply = () => {
    if (!text.trim() || !lastPush) return;
    const v = parseLength(text, units);
    if (v === null || v < 3) return setError('Medida no válida');
    setError(null);
    commit((d) => {
      const q = d.parts.find((p) => p.id === lastPush.id);
      if (!q || q.base.kind !== 'box') return;
      const max = q.position[lastPush.axis] + q.base.size[lastPush.axis];
      if (lastPush.sign < 0) q.position[lastPush.axis] = max - v;
      q.base.size[lastPush.axis] = v;
    });
    setText('');
  };
  return (
    <form
      className={styles.measure}
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
    >
      <label htmlFor="medida">Medida</label>
      <input
        id="medida"
        className={styles.num}
        inputMode="decimal"
        placeholder={lastPush ? lastPush.id : '—'}
        disabled={!lastPush}
        value={text}
        aria-invalid={!!error}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
        onBlur={apply}
      />
      {error && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
    </form>
  );
}

function AddPartButton() {
  const [open, setOpen] = useState(false);
  const add = useAddPart();
  return (
    <div className={styles.fabWrap}>
      {open && (
        <div className={styles.addMenu} role="menu" aria-label="Agregar pieza">
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
              <strong>{label}</strong>
              <span>{size}</span>
            </button>
          ))}
        </div>
      )}
      <button type="button" className={styles.fab} aria-label="Agregar pieza" aria-expanded={open} onClick={() => setOpen(!open)}>
        <IconPlus />
      </button>
    </div>
  );
}

const SECTION_TITLES: Record<Section, string> = { modelo: '', uniones: 'Uniones', cortes: 'Lista de compras', plano: 'Plano' };

export function Editor({ section, onExit }: { section: Section; onExit: () => void }) {
  const project = useEditor((s) => s.project);
  const tool = useEditor((s) => s.tool);
  const xray = useEditor((s) => s.xray);
  const copyMove = useEditor((s) => s.copyMove);
  const view = useEditor((s) => s.view);
  const hint = useEditor((s) => s.hint);
  const dragging = useEditor((s) => s.dragging);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const hasPush = useEditor((s) => s.lastPush !== null);
  const { undo, redo, setTool, setXray, setView, setCopyMove } = useEditor.getState();
  const selected = useSelectedPart();
  const saveState = useAutosave();
  const { engineStatus, meshes } = useExactMeshes(project, dragging);
  useShortcuts(section === 'modelo');
  if (!project) return null;
  const modelo = section === 'modelo';
  const back = modelo ? onExit : () => (location.hash = sectionHref(project.id, 'modelo'));

  const warnings = [...meshes.values()].filter((m) => m.warning).length;
  const saveText = saveState === 'error' ? 'No se pudo guardar' : saveState === 'saving' ? 'Guardando…' : 'Guardado en este dispositivo';
  const engineText = engineStatus === 'loading' ? 'Preparando los cortes exactos…' : engineStatus === 'error' ? 'No se pudieron calcular los cortes' : null;
  const jointCount = project.joints.length;
  const selDims = selected?.base.kind === 'box' ? [...selected.base.size].sort((a, b) => b - a) : null;

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.mobileOnly}>
          <button
            type="button"
            className={`${styles.iconBtn} ${styles.backBtn}`}
            aria-label={modelo ? 'Volver a mis proyectos' : 'Volver al modelo'}
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
              <span className={styles.sectionTitle}>{SECTION_TITLES[section]}</span>
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
          <button type="button" className={styles.iconBtn} aria-label="Deshacer (Ctrl+Z)" disabled={!canUndo} onClick={undo}>
            <IconUndo />
          </button>
          <button type="button" className={styles.iconBtn} aria-label="Rehacer (Ctrl+Y)" disabled={!canRedo} onClick={redo}>
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
          <section className={styles.stage} aria-label="Vista 3D" data-tool={tool}>
            <Viewport meshes={meshes} label={`Modelo 3D de ${project.name}${selected ? `, con ${selected.name} elegida` : ''}`} />
            <div className={styles.toolbar} role="toolbar" aria-label="Herramientas">
              {TOOLS.map(([t, label, key, Icon]) => (
                <button key={t} type="button" aria-pressed={tool === t} aria-label={`${label} (${key})`} title={`${label} (${key})`} onClick={() => setTool(t)}>
                  <Icon />
                </button>
              ))}
              {tool === 'move' && (
                <button
                  type="button"
                  aria-pressed={copyMove}
                  aria-label="Copiar al mover (o mantené Ctrl)"
                  title="Copiar al mover (o mantené Ctrl)"
                  onClick={() => setCopyMove(!copyMove)}
                >
                  <IconCopy />
                </button>
              )}
              <span className={styles.toolSep} aria-hidden="true" />
              <button type="button" aria-pressed={xray} aria-label="Rayos X (X)" title="Rayos X (X)" onClick={() => setXray(!xray)}>
                <IconXray />
              </button>
            </div>
            <div className={styles.views} role="group" aria-label="Vista">
              {VIEWS.map(([v, label, short]) => (
                <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>
                  <span className={styles.desktopOnly}>{label}</span>
                  <span className={styles.mobileOnly}>{short}</span>
                </button>
              ))}
            </div>
            {selected && selDims && (
              <span className={`${styles.chip} ${styles.desktopOnly}`}>
                <strong>{selected.id}</strong> {selected.name}
                <span className={styles.chipNum}>{selDims.map((mm) => formatLength(mm, project.units).replace(/ cm|″/, '')).join(' × ')}{project.units === 'cm' ? ' cm' : '″'}</span>
              </span>
            )}
            {(engineText || warnings > 0) && (
              <span className={styles.engine} role="status">
                {engineText ?? `${warnings} ${warnings === 1 ? 'pieza no se pudo' : 'piezas no se pudieron'} cortar del todo`}
              </span>
            )}
            {hint && (
              <span className={styles.hint} style={{ left: hint.x, top: hint.y }}>
                {hint.text}
                {hint.snap && <span className={styles.snap}>Imán: {hint.snap}</span>}
              </span>
            )}
            <span className={styles.mobileOnly}>
              <AddPartButton />
            </span>
          </section>

          <aside className={styles.panel} aria-label={selected ? 'Pieza seleccionada' : 'Piezas del proyecto'}>
            <span className={styles.grabber} aria-hidden="true" />
            <PartPanel />
          </aside>
        </main>

        <footer className={`${styles.footer} ${hasPush || tool === 'push' ? '' : styles.footerIdle}`}>
          <span>{TIPS[tool]}</span>
          <MeasureBox />
        </footer>
        </>
      )}
      <div className={styles.mobileOnly}>
        <SectionNav projectId={project.id} section={section} jointCount={jointCount} variant="bar" />
      </div>
    </div>
  );
}
