import { useEffect, useMemo, useRef, useState } from 'react';
import { cutList, cutPlan, encodeShare, hardwareList, SHARE_ROUTE, shoppingList, t, type Project } from '@kitc/core';
import { shopText } from './cutsData';
import { IconShare } from './icons';
import styles from './Editor.module.css';

/** Un enlace más largo que esto puede cortarse en algunas apps de mensajes. */
const LONG_LINK = 8000;

const canShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Botón del encabezado y el cuadro para compartir el proyecto por enlace o la lista de compras como texto. */
export function ShareButton({ project }: { project: Project }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={styles.iconBtn}
        data-tour="share"
        aria-label={t('Compartir')}
        title={t('Compartir')}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true);
          dialog.current?.showModal();
        }}
      >
        <IconShare />
      </button>
      <dialog ref={dialog} className={styles.shareDialog} aria-labelledby="compartir-titulo" onClose={() => setOpen(false)}>
        {open && <ShareBody project={project} onClose={() => dialog.current?.close()} />}
      </dialog>
    </>
  );
}

function ShareBody({ project, onClose }: { project: Project; onClose: () => void }) {
  const [link, setLink] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const text = useMemo(() => {
    const plan = cutPlan(project);
    return shopText(project, plan, cutList(project), shoppingList(plan), hardwareList(project, plan));
  }, [project]);

  useEffect(() => {
    let alive = true;
    void encodeShare(project).then((data) => {
      if (alive) setLink(`${location.origin}${location.pathname}${SHARE_ROUTE}${data}`);
    });
    return () => {
      alive = false;
    };
  }, [project]);

  const send = async (what: 'link' | 'list') => {
    const payload = what === 'link' ? { title: project.name, url: link ?? '' } : { title: project.name, text };
    if (canShare()) {
      try {
        await navigator.share(payload);
        return;
      } catch (e) {
        // Si la persona cerró el menú de compartir, no hay nada que hacer; si falló, se copia.
        if (e instanceof DOMException && e.name === 'AbortError') return;
      }
    }
    const ok = await copy(what === 'link' ? (link ?? '') : text);
    setDone(ok ? (what === 'link' ? t('Copiaste el enlace.') : t('Copiaste la lista.')) : t('No se pudo copiar: seleccioná el texto y copialo a mano.'));
  };

  const share = canShare();
  return (
    <div className={styles.shareBody}>
      <div className={styles.shareHead}>
        <h2 id="compartir-titulo">{t('Compartir')}</h2>
        <button type="button" className={styles.iconBtn} aria-label={t('Cerrar')} onClick={onClose}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      <section className={styles.shareSection} aria-labelledby="compartir-enlace">
        <h3 id="compartir-enlace">{t('El proyecto, en un enlace')}</h3>
        <p className={styles.muted}>
          {t('El mueble va adentro del enlace: quien lo abre lo ve y puede guardar una copia para editarla. No hace falta cuenta y no se sube a ningún lado.')}
        </p>
        <input className={styles.shareLink} readOnly value={link ?? t('Armando el enlace…')} aria-label={t('Enlace del proyecto')} onFocus={(e) => e.currentTarget.select()} />
        {link && link.length > LONG_LINK && <p className={styles.muted}>{t('Es un enlace largo: si alguna app lo corta, guardá una copia en archivo desde el inicio y mandá el archivo.')}</p>}
        <button type="button" className={styles.primaryBtn} disabled={!link} onClick={() => void send('link')}>
          {share ? t('Compartir enlace') : t('Copiar enlace')}
        </button>
      </section>

      <section className={styles.shareSection} aria-labelledby="compartir-lista">
        <h3 id="compartir-lista">{t('La lista de compras, como texto')}</h3>
        <p className={styles.muted}>{t('Para mandar a la maderera o al corralón: tablas, placas con su despiece y herrajes.')}</p>
        <pre className={styles.shareText} tabIndex={0} aria-label={t('Lista de compras')}>
          {text}
        </pre>
        <button type="button" className={styles.secondaryBtn} onClick={() => void send('list')}>
          {share ? t('Compartir lista') : t('Copiar lista')}
        </button>
      </section>
      <p className={styles.shareDone} role="status">
        {done}
      </p>
    </div>
  );
}
