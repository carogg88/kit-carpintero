import { useEffect, useState, type ReactNode } from 'react';
import { getLang, t, tk } from '@kitc/core';
import { BrandMark, BrandWordmark } from '../brand/Brand';
import { switchLang } from '../i18n';
import { helpHref, HELP_ROUTE, HOME_ROUTE, navigate, sectionHref } from '../routes';
import { startPracticeStool } from '../help/practice';
import styles from './Landing.module.css';

/** Las capturas son de la app real, con la silla de la plantilla (scripts/capturas-inicio.mjs), en el idioma de la página. */
const shot = (name: string) => `${import.meta.env.BASE_URL}inicio/${getLang() === 'en' ? 'en' : 'es'}/${name}.jpg`;

const svg = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;
const Icon = {
  arrow: (
    <svg {...svg} width={18} height={18} strokeWidth={2}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  check: (
    <svg {...svg} width={16} height={16} strokeWidth={2.4}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  ),
  help: (
    <svg {...svg} width={18} height={18} strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6M12 17.2v.1" />
    </svg>
  ),
  play: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13l10-6.5z" />
    </svg>
  ),
  cube: (
    <svg {...svg}>
      <path d="M12 3 4 7.5v9L12 21l8-4.5v-9z" />
      <path d="M4 7.5 12 12l8-4.5M12 12v9" />
    </svg>
  ),
  joint: (
    <svg {...svg}>
      <path d="M3 9h7v6H3zM10 11h4v2h-4z" />
      <path d="M14 5h7v14h-7z" />
    </svg>
  ),
  saw: (
    <svg {...svg}>
      <path d="M3 17 17 3l4 4L7 21H3z" />
      <path d="m7 13 1.5 1.5M10 10l1.5 1.5M13 7l1.5 1.5" />
    </svg>
  ),
  sheet: (
    <svg {...svg}>
      <path d="M4 4h16v16H4z" />
      <path d="M8 8h5v5H8zM15 15h2M4 16h6v4" />
    </svg>
  ),
  steps: (
    <svg {...svg}>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="m3.5 6 1.2 1.2L7 5M3.5 12l1.2 1.2L7 11" />
      <circle cx="5" cy="18" r="1.3" />
    </svg>
  ),
  phone: (
    <svg {...svg}>
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </svg>
  ),
  budget: (
    <svg {...svg}>
      <path d="M4 7h16v12H4z" />
      <path d="M4 7l2-3h12l2 3M12 11v5M10 12.2c0-.8.9-1.2 2-1.2s2 .5 2 1.3c0 1.7-4 1-4 2.7 0 .8.9 1.3 2 1.3s2-.4 2-1.2" />
    </svg>
  ),
  templates: (
    <svg {...svg}>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </svg>
  ),
  photo: (
    <svg {...svg}>
      <path d="M4 7h3l2-3h6l2 3h3v13H4z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  ),
  ruler: (
    <svg {...svg}>
      <path d="m3 16 13-13 5 5L8 21z" />
      <path d="m7 12 2 2M10 9l2 2M13 6l2 2" />
    </svg>
  ),
  review: (
    <svg {...svg}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 3 3 5-6" />
    </svg>
  ),
  share: (
    <svg {...svg}>
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6" />
    </svg>
  ),
  offline: (
    <svg {...svg}>
      <path d="M12 3v12M7 10l5 5 5-5M5 20h14" />
    </svg>
  ),
  lock: (
    <svg {...svg}>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  ),
  globe: (
    <svg {...svg}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.5 5.6 3.5 9s-1 6.4-3.5 9c-2.5-2.6-3.5-5.6-3.5-9S9.5 5.6 12 3z" />
    </svg>
  ),
};

/** Lo que muestra cada tarjeta de funciones: la captura y qué parte de la captura se ve (izquierda, arriba y ancho, en fracciones de la captura). */
const FEATURES = [
  { id: 'uniones', icon: Icon.joint, title: tk('Encastres de verdad'), text: tk('La app encuentra dónde se tocan las piezas y te ofrece solo los encastres posibles.'), crop: [0.24, 0.1, 0.62] },
  { id: 'cortes', icon: Icon.saw, title: tk('Lista de cortes'), text: tk('Medidas de corte con espigas incluidas, tablas para comprar y el desperdicio.'), crop: [0.02, 0.12, 0.52] },
  { id: 'plano', icon: Icon.sheet, title: tk('Plano para imprimir'), text: tk('Vistas, despiece acotado y cada encastre en detalle, en PDF.'), crop: [0.25, 0.13, 0.6] },
  { id: 'armado', icon: Icon.steps, title: tk('Orden de armado'), text: tk('De la madera cortada al mueble terminado, paso por paso.'), crop: [0.08, 0.06, 0.6] },
];

const CRAFT = [
  { icon: Icon.joint, title: tk('13 tipos de encastre'), text: tk('Mortaja y espiga, cola de milano, media madera, dedos, inglete y más, con sus medidas.') },
  { icon: Icon.saw, title: tk('Plano de cortes'), text: tk('Saca las piezas de tablas y placas que se consiguen, con el menor desperdicio.') },
  { icon: Icon.phone, title: tk('Modo taller'), text: tk('Una pieza por pantalla, en letra grande, para el celu en el banco de trabajo.') },
  { icon: Icon.budget, title: tk('Herrajes y presupuesto'), text: tk('Lo que hay que comprar en la maderera y la ferretería, con tus precios.') },
];

const STEPS = [
  { title: tk('Elegí un mueble'), text: tk('Empezá de una plantilla, de una foto con una medida conocida o en blanco.') },
  { title: tk('Ajustalo a tu medida'), text: tk('Estirá, mové y dibujá cada pieza. Las uniones se acomodan solas.') },
  { title: tk('Llevalo al taller'), text: tk('Imprimí el plano, comprá con la lista y seguí los pasos en el celu.') },
];

const MORE = [
  { icon: Icon.templates, text: tk('13 plantillas: mesas, sillas, cajoneras, bibliotecas') },
  { icon: Icon.photo, text: tk('Desde una foto, calcando las piezas') },
  { icon: Icon.ruler, text: tk('Medidas en centímetros o pulgadas') },
  { icon: Icon.review, text: tk('Revisión del diseño y proporción áurea') },
  { icon: Icon.share, text: tk('Compartí el proyecto con un enlace') },
  { icon: Icon.offline, text: tk('Se instala y anda sin internet') },
  { icon: Icon.lock, text: tk('Tus proyectos quedan en tu equipo') },
  { icon: Icon.globe, text: tk('En español y en inglés') },
];

/** Recorta la captura (16:10) a la parte que importa, en un marco 4:3. */
function cropStyle([left, top, width]: readonly number[]) {
  return { width: `${100 / width!}%`, left: `${(-left! / width!) * 100}%`, top: `${((-top! / width!) * (900 / 1440) * 100) / 0.75}%` };
}

/** Lleva a una sección de esta página sin tocar la ruta (el # es de la app). */
function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}

function Start({ children = t('Comenzar ahora'), small }: { children?: ReactNode; small?: boolean }) {
  return (
    <a href={HOME_ROUTE} className={`${styles.cta} ${small ? styles.ctaSmall : ''}`}>
      {children}
      {Icon.arrow}
    </a>
  );
}

function LangSwitch() {
  return (
    <span className={styles.lang} role="group" aria-label="Idioma · Language">
      {(['es', 'en'] as const).map((l) => (
        <button key={l} type="button" lang={l} aria-pressed={getLang() === l} aria-label={l === 'es' ? 'Español' : 'English'} onClick={() => getLang() !== l && switchLang(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </span>
  );
}

/** Página de presentación: qué es Calibre Studio y para quién. Todo lleva al inicio de la app (Mis proyectos) o a la ayuda. */
export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    document.title = t('Calibre Studio · Diseño de muebles para carpinteros');
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.title = 'Calibre Studio';
    };
  }, []);

  const learn = async () => {
    const id = await startPracticeStool();
    if (id) navigate(sectionHref(id, 'modelo'));
  };

  const nav = [
    { id: 'funciones', label: t('Funciones') },
    { id: 'taller', label: t('Para el taller') },
    { id: 'como', label: t('Cómo funciona') },
  ];

  return (
    <div className={styles.page}>
      <a className={styles.skip} href={HOME_ROUTE}>
        {t('Ir a mis proyectos')}
      </a>
      <header className={styles.header} data-scrolled={scrolled || undefined}>
        <div className={styles.headerInner}>
          <a className={styles.brand} href={HOME_ROUTE} aria-label={t('Calibre Studio: ir a mis proyectos')}>
            <BrandMark height={38} />
            <BrandWordmark height={24} />
          </a>
          <nav className={styles.nav} aria-label={t('Secciones')}>
            {nav.map((n) => (
              <button key={n.id} type="button" onClick={() => scrollTo(n.id)}>
                {n.label}
              </button>
            ))}
            <a href={HELP_ROUTE}>{t('Ayuda')}</a>
          </nav>
          <span className={styles.headerActions}>
            <LangSwitch />
            <a className={styles.helpIcon} href={HELP_ROUTE} aria-label={t('Ayuda')}>
              {Icon.help}
            </a>
            <Start small />
          </span>
        </div>
      </header>

      <main>
        <section className={styles.hero} aria-labelledby="titulo">
          <div className={styles.heroText}>
            <span className={styles.eyebrow}>{t('Para carpinteros y ebanistas')}</span>
            <h1 id="titulo" className={styles.heroTitle}>
              {t('Diseñá el mueble.')} <span>{t('Llevá el plano al taller.')}</span>
            </h1>
            <p className={styles.lead}>{t('Armá tu mueble en 3D pieza por pieza, con sus encastres. Calibre Studio te da la lista de cortes, el plano y un modo taller que te acompaña paso a paso.')}</p>
            <div className={styles.actions}>
              <Start />
              <a href={HELP_ROUTE} className={styles.ghost}>
                {Icon.help}
                {t('Ver cómo se usa')}
              </a>
            </div>
            <ul className={styles.proof}>
              {[t('Gratis'), t('Sin cuenta'), t('Anda sin internet')].map((x) => (
                <li key={x}>
                  <span className={styles.tick}>{Icon.check}</span>
                  {x}
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.heroArt}>
            <figure className={styles.window}>
              <span className={styles.windowBar} aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <img src={shot('modelo')} width={1440} height={900} alt={t('La pantalla Modelo de Calibre Studio con una silla en 3D y el panel del mueble')} fetchPriority="high" />
            </figure>
            <figure className={styles.phone}>
              <img src={shot('taller')} width={390} height={844} alt={t('El modo taller en el celular: la pieza con sus medidas grandes y los pasos para hacerla')} loading="lazy" decoding="async" />
            </figure>
          </div>
        </section>

        <section id="funciones" className={styles.section} aria-labelledby="funciones-titulo">
          <div className={styles.sectionHead}>
            <span className={styles.eyebrow}>{t('Funciones')}</span>
            <h2 id="funciones-titulo" className={styles.h2}>
              {t('De la idea al mueble, en un solo lugar')}
            </h2>
            <p className={styles.sub}>{t('Lo que dibujás en el Modelo llega solo a las uniones, los cortes, el plano y el armado.')}</p>
          </div>
          <ul className={styles.features}>
            {FEATURES.map((f) => (
              <li key={f.id} className={styles.feature}>
                <div className={styles.featureHead}>
                  <span className={styles.featureIcon}>{f.icon}</span>
                  <span>
                    <h3 className={styles.h3}>{t(f.title)}</h3>
                    <p>{t(f.text)}</p>
                  </span>
                </div>
                <span className={styles.featureShot}>
                  <img src={shot(f.id)} width={1440} height={900} alt="" loading="lazy" decoding="async" style={cropStyle(f.crop)} />
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section id="taller" className={styles.craft} aria-labelledby="taller-titulo">
          <div className={styles.craftInner}>
            <div className={styles.craftText}>
              <h2 id="taller-titulo" className={styles.craftTitle}>
                {t('Hecha para quien')} <span>{t('trabaja la madera')}</span>
              </h2>
              <p>{t('Para carpinteros y ebanistas que diseñan sus muebles: con encastres de verdad, un plano de cortes que aprovecha la madera y un modo taller para el celu.')}</p>
              <Start />
            </div>
            <ul className={styles.craftList}>
              {CRAFT.map((c) => (
                <li key={c.title}>
                  <span className={styles.craftIcon}>{c.icon}</span>
                  <h3>{t(c.title)}</h3>
                  <p>{t(c.text)}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="como" className={styles.section} aria-labelledby="como-titulo">
          <div className={styles.sectionHead}>
            <span className={styles.eyebrow}>{t('Cómo funciona')}</span>
            <h2 id="como-titulo" className={styles.h2}>
              {t('Tres pasos, del diseño al banco de trabajo')}
            </h2>
          </div>
          <ol className={styles.steps}>
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className={styles.stepNum}>{i + 1}</span>
                <h3 className={styles.h3}>{t(s.title)}</h3>
                <p>{t(s.text)}</p>
              </li>
            ))}
          </ol>
          <ul className={styles.more} aria-label={t('Además')}>
            {MORE.map((m) => (
              <li key={m.text}>
                <span>{m.icon}</span>
                {t(m.text)}
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.final} aria-labelledby="final-titulo">
          <div className={styles.finalInner}>
            <BrandMark height={56} />
            <h2 id="final-titulo" className={styles.h2}>
              {t('Tu próximo mueble empieza acá')}
            </h2>
            <p className={styles.sub}>{t('Gratis y sin cuenta. Si es tu primera vez, aprendé con un taburete ya armado.')}</p>
            <div className={styles.actions}>
              <Start />
              <button type="button" className={styles.ghost} onClick={() => void learn()}>
                {Icon.play}
                {t('Aprender con un taburete')}
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <span className={styles.brand}>
              <BrandMark height={34} />
              <BrandWordmark height={22} />
            </span>
            <p>{t('Diseño de muebles para carpinteros y ebanistas.')}</p>
            <LangSwitch />
          </div>
          <nav className={styles.footerCol} aria-labelledby="pie-app">
            <h3 id="pie-app">{t('La app')}</h3>
            <a href={HOME_ROUTE}>{t('Mis proyectos')}</a>
            <a href="#/foto">{t('Nuevo desde foto')}</a>
            <button type="button" onClick={() => void learn()}>
              {t('Aprender con un taburete')}
            </button>
          </nav>
          <nav className={styles.footerCol} aria-labelledby="pie-ayuda">
            <h3 id="pie-ayuda">{t('Ayuda')}</h3>
            <a href={HELP_ROUTE}>{t('Centro de ayuda')}</a>
            <a href={helpHref('empezar')}>{t('Primeros pasos')}</a>
            <a href={helpHref('encastres')}>{t('Uniones')}</a>
            <a href={helpHref('atajos')}>{t('Atajos de teclado')}</a>
          </nav>
        </div>
        <div className={styles.footerBar}>
          <span>© 2026 Calibre Studio</span>
          <span>{t('Gratis, sin cuenta y sin publicidad.')}</span>
        </div>
      </footer>
    </div>
  );
}
