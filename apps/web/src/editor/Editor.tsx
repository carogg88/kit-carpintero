import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { formatLength, t, tk } from '@kitc/core';
import { sectionHref, type Section } from '../routes';
import { projectName } from '../i18n';
import { saveProject } from '../storage/db';
import { BrandMark, BrandWordmark } from '../brand/Brand';
import { AssemblyView } from './AssemblyView';
import { CutsView } from './CutsView';
import { ShareButton } from './Share';
import {
  IconBack,
  IconBevel,
  IconSection,
  IconTurn,
  IconDraw,
  IconCuts,
  IconJoints,
  IconModel,
  IconMore,
  IconMove,
  IconPlan,
  IconAssembly,
  IconPlus,
  IconPush,
  IconRedo,
  IconSelect,
  IconUndo,
  IconXray,
} from './icons';
import { JointsView } from './JointsView';
import { PlanView } from './PlanView';
import { ADD_OPTIONS, FITTING_OPTIONS, PartPanel, UnitsToggle, useAddPart } from './PartPanel';
import { useEditor, useSelectedPart, type DragHint, type Tool, type View } from './store';
import { useExactMeshes } from './useGeometry';
import { ToolGuide, ChangeNotice } from './ToolGuide';
import { MeasureBubble } from './MeasureBubble';
import { NextSteps, useVisitSection } from './NextSteps';
import { Viewport } from './Viewport';
import styles from './Editor.module.css';

/**
 * Herramientas: id, nombre completo (para lectores de pantalla y el cartel), nombre corto bajo el ícono, atajo e ícono.
 * Las últimas tres son de terminación: en el celular van en "Más", para que las de todos los días entren grandes.
 */
const TOOLS: [Tool, string, string, string, () => React.JSX.Element][] = [
  ['select', tk('Seleccionar'), tk('Elegir'), 'V', IconSelect],
  ['push', tk('Empujar o tirar una cara'), tk('Estirar'), 'P', IconPush],
  ['move', tk('Mover pieza'), tk('Mover'), 'M', IconMove],
  ['draw', tk('Dibujar en una cara'), tk('Dibujar'), 'D', IconDraw],
  ['bevel', tk('Biselar o redondear'), tk('Biselar'), 'B', IconBevel],
  ['section', tk('Agrandar o achicar un tramo'), tk('Tramo'), 'T', IconSection],
  ['turn', tk('Tornear'), tk('Tornear'), 'R', IconTurn],
];
const ADVANCED = new Set<Tool>(['bevel', 'section', 'turn']);
/** Qué hace cada herramienta de "Más", en una línea, para elegir sin probar. */
const ADVANCED_USES: Partial<Record<Tool, string>> = {
  bevel: tk('Bisel o canto redondeado en una arista'),
  section: tk('Una parte más gruesa o más fina, como en una pata'),
  turn: tk('Pata o barrote torneado, con modelos'),
};

/** En el celular: las herramientas de terminación y Rayos X, en un menú. Si una está en uso, el botón la muestra. */
function MoreTools({ disabled }: { disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const tool = useEditor((s) => s.tool);
  const xray = useEditor((s) => s.xray);
  const { setTool, setXray } = useEditor.getState();
  const current = TOOLS.find(([id]) => id === tool && ADVANCED.has(id));
  const Icon = current?.[4] ?? IconMore;
  return (
    <span className={styles.moreWrap}>
      <button
        type="button"
        className={styles.moreBtn}
        aria-expanded={open}
        aria-pressed={!!current || xray}
        aria-label={t('Más herramientas')}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        <Icon />
        <span aria-hidden="true">{current ? t(current[2]) : t('Más')}</span>
      </button>
      {open && (
        <div className={styles.moreMenu} role="menu" aria-label={t('Más herramientas')}>
          {TOOLS.filter(([id]) => ADVANCED.has(id)).map(([id, label, , , ToolIcon]) => (
            <button
              key={id}
              type="button"
              role="menuitemradio"
              aria-checked={tool === id}
              onClick={() => {
                setTool(id);
                setOpen(false);
              }}
            >
              <ToolIcon />
              <span>
                <strong>{t(label)}</strong>
                <span>{t(ADVANCED_USES[id] ?? '')}</span>
              </span>
            </button>
          ))}
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={xray}
            onClick={() => {
              setXray(!xray);
              setOpen(false);
            }}
          >
            <IconXray />
            <span>
              <strong>{t('Rayos X')}</strong>
              <span>{t('Ver a través de las piezas, para ver los encastres')}</span>
            </span>
          </button>
        </div>
      )}
    </span>
  );
}

const VIEWS: [View, string, string][] = [
  ['iso', tk('3D'), tk('3D')],
  ['front', tk('Frente'), tk('Frente')],
  ['side', tk('Costado'), tk('Costado')],
  ['top', tk('Arriba'), tk('Arriba')],
];

type SaveState = 'saved' | 'saving' | 'error';

/** Guarda el proyecto en el dispositivo medio segundo después del último cambio. */
/** Cartel junto al dedo mientras se arrastra. Si no entra a la derecha, va a la izquierda. */
function HintLabel({ hint }: { hint: DragHint }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const width = el?.parentElement?.clientWidth;
    if (el && width) el.toggleAttribute('data-flip', hint.x + 14 + el.offsetWidth > width - 8);
  }, [hint]);
  return (
    <span ref={ref} className={styles.hint} style={{ left: hint.x, top: hint.y }}>
      {hint.text}
      {hint.warn && <span className={styles.hintWarn}>{hint.warn}</span>}
      {!hint.warn && hint.snap && <span className={styles.snap}>{t('Imán: {snap}', { snap: hint.snap })}</span>}
    </span>
  );
}

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
      // Sin piezas, las herramientas no tienen sobre qué trabajar: solo queda Elegir.
      const none = !s.project?.parts.length;
      if (k === 'v') s.setTool('select');
      else if (none && 'pmdbtr'.includes(k)) return;
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
    ['armado', t('Armado'), IconAssembly],
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
          {FITTING_OPTIONS.map(([k, label, what]) => (
            <button
              key={k}
              type="button"
              role="menuitem"
              onClick={() => {
                useEditor.getState().setFitting(k);
                setOpen(false);
              }}
            >
              <strong>{t(label)}</strong>
              <span className={styles.addWhat}>{t(what)}</span>
            </button>
          ))}
        </div>
      )}
      <button type="button" className={styles.fab} aria-label={t('Agregar pieza')} aria-expanded={open} onClick={() => setOpen(!open)}>
        <IconPlus />
        <span>{t('Pieza')}</span>
      </button>
    </div>
  );
}

/** Qué es cada pieza nueva, en una línea: para elegir la primera sin saber de medidas. */
const ADD_USES: Record<string, string> = {
  tabla: tk('Para tapas, laterales, estantes y faldones'),
  liston: tk('Para patas, travesaños y marcos'),
  tablero: tk('Para fondos, cajones y tapas grandes'),
};

/**
 * Proyecto en blanco: en lugar de una cuadrícula vacía, cómo empezar. Se elige la primera pieza (después se estira a
 * la medida y se suman las demás), o se vuelve a las plantillas.
 */
function EmptyStart() {
  const add = useAddPart();
  return (
    <div className={styles.emptyStart} role="region" aria-labelledby="empezar">
      <h2 id="empezar">{t('Empezá con una pieza')}</h2>
      <p>{t('Elegí la primera. Después la estirás a la medida con Estirar y le sumás las demás: se pegan solas cuando se tocan.')}</p>
      <div className={styles.emptyOptions}>
        {ADD_OPTIONS.map(([k, label, size]) => (
          <button key={k} type="button" onClick={() => add(k)}>
            <strong>{t(label)}</strong>
            <span className={styles.emptyUse}>{t(ADD_USES[k] ?? '')}</span>
            <span className={styles.emptySize}>{t(size)}</span>
          </button>
        ))}
      </div>
      <a href="#/" className={styles.emptyLink}>
        {t('¿Es una mesa, una cajonera, una biblioteca o un banco? Empezá desde una de las diez plantillas')}
      </a>
    </div>
  );
}

const SECTION_TITLES: Record<Section, string> = { modelo: '', uniones: tk('Uniones'), cortes: tk('Cortes y compras'), plano: tk('Plano'), armado: tk('Cómo armarlo') };

export function Editor({ section, onExit }: { section: Section; onExit: () => void }) {
  const project = useEditor((s) => s.project);
  const tool = useEditor((s) => s.tool);
  const xray = useEditor((s) => s.xray);
  // Dibujando de frente a la cara: la vista no se cambia, así que en el celular la barra de vistas sobra.
  const framed = useEditor((s) => !!s.drawFace && s.drawFramed);
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
  useVisitSection(project?.id, section);
  const noParts = !!project && project.parts.length === 0;
  // Si se borra la última pieza con otra herramienta en la mano, se vuelve a Elegir.
  useEffect(() => {
    if (noParts && tool !== 'select') setTool('select');
  }, [noParts, tool, setTool]);
  if (!project) return null;
  const modelo = section === 'modelo';
  const back = modelo ? onExit : () => (location.hash = sectionHref(project.id, 'modelo'));

  const warnings = [...meshes.values()].filter((m) => m.warning).length;
  const saveText = saveState === 'error' ? t('No se pudo guardar') : saveState === 'saving' ? t('Guardando…') : t('Guardado en este dispositivo');
  const engineText = engineStatus === 'loading' ? t('Preparando los cortes exactos…') : engineStatus === 'error' ? t('No se pudieron calcular los cortes') : null;
  const jointCount = project.joints.length;
  // Sin piezas no hay nada que estirar ni dibujar: solo se puede agregar la primera.
  const empty = noParts;
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
            aria-label="Calibre Studio"
            onClick={(e) => {
              e.preventDefault();
              onExit();
            }}
          >
            <BrandMark height={34} />
            <BrandWordmark className={styles.brandText} height={24} />
          </a>
        </span>
        <div className={styles.titleBlock}>
          {modelo ? (
            <>
              <h1>{projectName(project.name)}</h1>
              <span className={saveState === 'error' ? styles.errorText : styles.muted} role="status">
                {saveText}
              </span>
            </>
          ) : (
            <>
              <span className={`${styles.muted} ${styles.overline}`}>{projectName(project.name)}</span>
              <span className={styles.sectionTitle}>{SECTION_TITLES[section] && t(SECTION_TITLES[section])}</span>
              <span className={styles.desktopTitle}>{projectName(project.name)}</span>
              <span className={styles.srOnly} role="status">
                {saveState === 'saved' ? '' : saveText}
              </span>
            </>
          )}
        </div>
        {modelo && jointCount > 0 && (
          <span className={styles.desktopOnly}>
            <NextSteps key={project.id} projectId={project.id} variant="chip" />
          </span>
        )}
        <div className={styles.desktopOnly}>
          <SectionNav projectId={project.id} section={section} jointCount={jointCount} variant="tabs" />
        </div>
        <div className={styles.headerActions}>
          <ShareButton project={project} />
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
      {section === 'plano' && <PlanView project={project} meshes={meshes} />}
      {section === 'armado' && <AssemblyView project={project} />}
      {modelo && (
        <>
        {/* Uniones, cortes y plano tienen sentido cuando ya hay piezas que se tocan. */}
        {jointCount > 0 && (
          <span className={styles.mobileOnly}>
            <NextSteps key={project.id} projectId={project.id} busy={tool !== 'select'} />
          </span>
        )}
        <main className={styles.main}>
          <section className={styles.stage} aria-label={t('Vista 3D')} data-tool={tool} data-framed={framed || undefined}>
            <Viewport meshes={meshes} label={selected ? t('Modelo 3D de {name}, con {part} elegida', { name: projectName(project.name), part: selected.name }) : t('Modelo 3D de {name}', { name: projectName(project.name) })} />
            <div className={styles.toolbar} role="toolbar" aria-label={t('Herramientas')}>
              {TOOLS.map(([id, label, short, key, Icon]) => (
                <button
                  key={id}
                  type="button"
                  data-advanced={ADVANCED.has(id) || undefined}
                  aria-pressed={tool === id}
                  aria-label={`${t(label)} (${key})`}
                  title={empty && id !== 'select' ? t('Primero agregá una pieza') : `${t(label)} (${key})`}
                  disabled={empty && id !== 'select'}
                  onClick={() => setTool(id)}
                >
                  <Icon />
                  <span aria-hidden="true">{t(short)}</span>
                </button>
              ))}
              <span className={styles.toolSep} aria-hidden="true" data-advanced />
              <MoreTools disabled={empty} />
              <button type="button" data-advanced aria-pressed={xray} aria-label={t('Rayos X (X)')} title={t('Rayos X (X)')} onClick={() => setXray(!xray)}>
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
            {empty ? <EmptyStart /> : <ToolGuide />}
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
            {hint && <HintLabel hint={hint} />}
            {tool === 'select' && !empty && (
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
