import { useEffect, useMemo, useRef, useState } from 'react';
import { cutList, cutPlan, encodeShare, hardwareList, locale, SHARE_ROUTE, shoppingList, t, type Project } from '@kitc/core';
import { download, readExported } from '../storage/backup';
import { shopText } from './cutsData';
import { exportDae, exportDxf } from './exportFiles';
import { IconShare } from './icons';
import { openPhoto } from './PhotoDialog';
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

/** "hoy a las 10:40", "ayer a las 18:05" o "12 oct a las 9:30". */
function exportedWhen(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);
  const time = d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  if (days <= 0) return t('hoy a las {time}', { time });
  if (days === 1) return t('ayer a las {time}', { time });
  return t('{day} a las {time}', { day: d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' }), time });
}

/** Botón del encabezado y el cuadro para compartir el proyecto por enlace o en archivo, o la lista de compras como texto. */
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
  const [exportedAt, setExportedAt] = useState(() => readExported(project.id));
  const [busy, setBusy] = useState<'dxf' | 'dae' | null>(null);
  const current = !!exportedAt && exportedAt >= project.updatedAt;
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

  const other = async (what: 'dxf' | 'dae') => {
    setBusy(what);
    setDone(t('Preparando el archivo…'));
    try {
      await (what === 'dxf' ? exportDxf(project) : exportDae(project));
      setDone(what === 'dxf' ? t('Exportaste el despiece en DXF.') : t('Exportaste el modelo 3D en DAE.'));
    } catch {
      setDone(t('No se pudo armar el archivo. Probá de nuevo en un momento.'));
    } finally {
      setBusy(null);
    }
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
        {link && link.length > LONG_LINK && <p className={styles.muted}>{t('Es un enlace largo: si alguna app lo corta, exportá el archivo acá abajo y mandá el archivo.')}</p>}
        <button type="button" className={styles.primaryBtn} disabled={!link} onClick={() => void send('link')}>
          {share ? t('Compartir enlace') : t('Copiar enlace')}
        </button>
      </section>

      <section className={styles.shareSection} aria-labelledby="compartir-foto">
        <h3 id="compartir-foto">{t('Una foto del mueble')}</h3>
        <p className={styles.muted}>{t('Con luz de estudio y sombra en el piso, para mostrarlo o mandarlo por WhatsApp. Se arma en este equipo.')}</p>
        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={() => {
            onClose();
            openPhoto();
          }}
        >
          {t('Sacar la foto')}
        </button>
      </section>

      <section className={styles.shareSection} aria-labelledby="compartir-archivo">
        <h3 id="compartir-archivo">{t('El proyecto, en un archivo')}</h3>
        <p className={styles.muted}>{t('Una copia para guardar o mandar por mail. Se abre desde el inicio, con Abrir archivo.')}</p>
        <p className={styles.shareStatus} data-current={current || undefined}>
          {exportedAt
            ? current
              ? t('Copia al día: la exportaste {when}.', { when: exportedWhen(exportedAt) })
              : t('Cambió desde la última copia, que exportaste {when}.', { when: exportedWhen(exportedAt) })
            : t('Todavía no exportaste una copia de este proyecto.')}
        </p>
        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={() => {
            setExportedAt(download(project));
            setDone(t('Exportaste el archivo.'));
          }}
        >
          {t('Exportar archivo')}
        </button>
      </section>

      <section className={styles.shareSection} aria-labelledby="compartir-otros">
        <h3 id="compartir-otros">{t('Para otros programas')}</h3>
        <p className={styles.muted}>
          {t('DXF: cada pieza a tamaño real, para una CNC, una cortadora láser o un programa de dibujo. DAE: el mueble en 3D, para SketchUp, Blender y otros.')}
        </p>
        <div className={styles.shareRow}>
          <button type="button" className={styles.secondaryBtn} disabled={!!busy} aria-busy={busy === 'dxf'} onClick={() => void other('dxf')}>
            {busy === 'dxf' ? t('Armando…') : t('Despiece en DXF')}
          </button>
          <button type="button" className={styles.secondaryBtn} disabled={!!busy} aria-busy={busy === 'dae'} onClick={() => void other('dae')}>
            {busy === 'dae' ? t('Armando…') : t('Modelo 3D en DAE')}
          </button>
        </div>
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
