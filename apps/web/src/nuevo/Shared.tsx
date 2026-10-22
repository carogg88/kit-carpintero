import { useEffect, useState } from 'react';
import { decodeShare, t, woodById, type Project } from '@kitc/core';
import { navigate, sectionHref } from '../routes';
import { saveProject } from '../storage/db';
import { BackHeader } from './parts';
import { Preview3D } from './Preview3D';
import styles from './Nuevo.module.css';

/** Sin campo elegido no hay cota que ubicar. */
const noLabel = () => {};

/** Un proyecto que llegó por enlace: se ve en 3D y se guarda una copia propia para editarla. */
export function Shared({ data }: { data: string }) {
  const [state, setState] = useState<{ project: Project } | { error: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void decodeShare(data).then((r) => {
      if (alive) setState(r.ok ? { project: r.project } : { error: r.error });
    });
    return () => {
      alive = false;
    };
  }, [data]);

  if (!state) return null;
  if ('error' in state) {
    return (
      <div className={styles.screen}>
        <BackHeader overline={t('Proyecto compartido')} title={t('No se pudo abrir')} back="#/" />
        <div className={styles.form}>
          <p className={styles.note}>{state.error}</p>
          <a className={styles.secondary} href="#/">
            {t('Ir al inicio')}
          </a>
        </div>
      </div>
    );
  }

  const { project } = state;
  const woods = [...new Set(project.parts.map((p) => p.wood))].map((w) => t(woodById(w)?.name ?? w)).join(', ');
  const save = async () => {
    setBusy(true);
    const now = new Date().toISOString();
    // Una copia nueva: si ya estaba en este dispositivo, no la pisa.
    const copy = { ...project, id: `compartido-${now}`, createdAt: now, updatedAt: now };
    await saveProject(copy);
    navigate(sectionHref(copy.id, 'modelo'));
  };

  return (
    <div className={styles.screen}>
      <BackHeader overline={t('Te compartieron un proyecto')} title={project.name} back="#/" />
      <div className={styles.layout}>
        <div className={styles.aside}>
          <figure className={styles.preview} aria-label={t('El mueble en 3D')}>
            <Preview3D project={project} onLabel={noLabel} />
            <figcaption>
              <strong>{project.name}</strong>
              <span>{t('{parts} piezas · {joints} uniones · {woods}', { parts: project.parts.length, joints: project.joints.length, woods })}</span>
            </figcaption>
          </figure>
        </div>
        <div className={styles.form}>
          <p className={styles.note}>
            {t('Guardá una copia para verlo entero: el modelo, los cortes, el plano y el armado. Queda en este dispositivo y los cambios que hagas no le llegan a quien te lo mandó.')}
          </p>
          <div className={styles.footer}>
            <button type="button" className={styles.primary} disabled={busy} onClick={() => void save()}>
              {t('Guardar una copia y abrirla')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
