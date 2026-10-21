import { useEffect } from 'react';
import { faceLabel, t, tk } from '@kitc/core';
import { IconArc, IconChamfer, IconCircle, IconCopy, IconRect, IconRound } from './icons';
import { MeasureBubble } from './MeasureBubble';
import { useEditor, useSelectedPart } from './store';
import styles from './Editor.module.css';

/** Una frase corta por paso. El paso en curso se marca; los hechos llevan tilde. */
interface Step {
  text: string;
  /** Lo que quedó elegido en un paso ya hecho, en lugar de la instrucción. */
  done?: React.ReactNode;
}

const STEP2_DRAW = { rect: tk('Arrastrá de esquina a esquina'), circle: tk('Arrastrá desde el centro hacia afuera'), arc: tk('Arrastrá de punta a punta del arco') };

/**
 * Tarjeta de pasos de la herramienta elegida: qué hacer ahora y qué viene después, con los botones propios de la
 * herramienta (figura, bisel o redondeo, dejar copia, Listo). En el celular se ve solo el paso en curso.
 */
export function ToolGuide() {
  const tool = useEditor((s) => s.tool);
  const drawFace = useEditor((s) => s.drawFace);
  const drawShape = useEditor((s) => s.drawShape);
  const arcChord = useEditor((s) => s.arcChord);
  const bevelRound = useEditor((s) => s.bevelRound);
  const copyMove = useEditor((s) => s.copyMove);
  const dragging = useEditor((s) => s.dragging);
  const bubble = useEditor((s) => s.bubble);
  const { setDrawFace, setDrawShape, setBevelRound, setCopyMove } = useEditor.getState();
  const selected = useSelectedPart();

  // Con una pieza elegida, el panel ya dice qué hacer: la ayuda de Elegir no hace falta.
  if (tool === 'select' && selected) return null;
  let steps: Step[];
  let active = 0;
  let controls: React.ReactNode = null;
  let action: React.ReactNode = null;
  switch (tool) {
    case 'select':
      steps = [{ text: t('Tocá una pieza para editarla. Arrastrá el fondo para girar la vista.') }];
      break;
    case 'push':
      steps = [{ text: t('Arrastrá una cara para estirar o acortar') }, { text: t('Si querés, escribí la medida exacta') }];
      active = bubble?.target.kind === 'push' ? 1 : 0;
      break;
    case 'move':
      steps = [{ text: copyMove ? t('Arrastrá la pieza: queda una copia') : t('Arrastrá la pieza por el piso') }, { text: t('Soltala donde va: se pega a las otras') }];
      active = dragging ? 1 : 0;
      controls = (
        <button type="button" className={styles.guideToggle} aria-pressed={copyMove} onClick={() => setCopyMove(!copyMove)}>
          <IconCopy />
          {t('Dejar copia')}
        </button>
      );
      break;
    case 'draw':
      steps = [
        {
          text: t('Tocá la cara donde vas a dibujar'),
          done: drawFace && (
            <>
              {t('En {face} de', { face: faceLabel(drawFace) })} <strong>{drawFace.partId}</strong>
            </>
          ),
        },
        { text: arcChord ? t('Tocá hasta dónde se curva') : t(STEP2_DRAW[drawShape]) },
        { text: t('Elegí vaciado o calado y qué tan hondo') },
      ];
      active = bubble?.target.kind === 'pocket' ? 2 : drawFace ? 1 : 0;
      controls = (
        <div className={styles.shapes} role="group" aria-label={t('Figura')}>
          <button type="button" aria-pressed={drawShape === 'rect'} aria-label={t('Rectángulo')} title={t('Rectángulo')} onClick={() => setDrawShape('rect')}>
            <IconRect />
          </button>
          <button type="button" aria-pressed={drawShape === 'circle'} aria-label={t('Círculo')} title={t('Círculo')} onClick={() => setDrawShape('circle')}>
            <IconCircle />
          </button>
          <button type="button" aria-pressed={drawShape === 'arc'} aria-label={t('Arco')} title={t('Arco')} onClick={() => setDrawShape('arc')}>
            <IconArc />
          </button>
        </div>
      );
      if (drawFace)
        action = (
          <button type="button" className={styles.done} onClick={() => setDrawFace(null)}>
            {t('Listo')}
          </button>
        );
      break;
    case 'bevel':
      steps = [
        { text: bevelRound ? t('Arrastrá desde una arista hacia adentro para redondear') : t('Arrastrá desde una arista hacia adentro') },
        { text: t('Si querés, escribí la medida exacta') },
      ];
      active = bubble?.target.kind === 'bevel' ? 1 : 0;
      controls = (
        <div className={styles.shapes} role="group" aria-label={t('Forma del canto')}>
          <button type="button" aria-pressed={!bevelRound} aria-label={t('Bisel recto')} title={t('Bisel recto')} onClick={() => setBevelRound(false)}>
            <IconChamfer />
          </button>
          <button type="button" aria-pressed={bevelRound} aria-label={t('Redondeo')} title={t('Redondeo')} onClick={() => setBevelRound(true)}>
            <IconRound />
          </button>
        </div>
      );
      break;
    case 'section':
      steps = [{ text: t('Arrastrá a lo largo de una pata o listón') }, { text: t('Ajustá el ancho y el fondo en el panel') }];
      active = selected && selected.sections.length > 0 ? 1 : 0;
      break;
    case 'turn':
      steps = [{ text: t('Tocá una pieza larga, como una pata') }, { text: t('Elegí un modelo y ajustalo en el panel') }];
      active = selected?.turning ? 1 : 0;
      break;
  }

  const numbered = steps.length > 1;
  return (
    <div className={styles.guide} data-tool={tool}>
      {controls}
      <ol className={styles.steps} aria-label={t('Pasos')} data-numbered={numbered || undefined}>
        {steps.map((s, i) => (
          <li
            key={i}
            aria-current={i === active ? 'step' : undefined}
            data-done={i < active || undefined}
            data-detail={(i < active && !!s.done) || undefined}
            data-next={i === active + 1 || undefined}
          >
            {numbered && (
              <span className={styles.stepNum} aria-hidden="true">
                {i < active ? '✓' : i + 1}
              </span>
            )}
            <span className={styles.stepText}>{i < active && s.done ? s.done : s.text}</span>
          </li>
        ))}
      </ol>
      <span className={styles.srOnly} role="status">
        {numbered ? t('Paso {n} de {total}: {text}', { n: active + 1, total: steps.length, text: steps[active]!.text }) : ''}
      </span>
      {action}
      {bubble && (
        <div className={styles.mobileOnly}>
          <MeasureBubble docked />
        </div>
      )}
    </div>
  );
}

/** Aviso de lo que acaba de cambiar, con Deshacer a mano. Se va solo a los 7 segundos. */
export function ChangeNotice() {
  const notice = useEditor((s) => s.notice);
  const { undo, dismissNotice } = useEditor.getState();
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(dismissNotice, 7000);
    return () => clearTimeout(timer);
  }, [notice, dismissNotice]);
  if (!notice) return null;
  return (
    <div className={styles.notice} role="status" key={notice.key}>
      <span>{notice.text}</span>
      {notice.undo !== false && (
        <button type="button" onClick={undo}>
          {t('Deshacer')}
        </button>
      )}
    </div>
  );
}
