import { Fragment, useEffect, useMemo, useState } from 'react';
import { t, tk } from '@kitc/core';
import { BrandMark, BrandWordmark } from '../brand/Brand';
import { useEditor } from '../editor/store';
import { startPracticeStool } from '../help/practice';
import { EDITOR_TOUR, useTour, type TourStep } from '../help/Tour';
import { helpHref, sectionHref } from '../routes';
import { articleById, helpContent, searchArticles, topicArticles, topicById } from './content';
import type { Article, Block, HelpContent, Topic, TopicIcon } from './types';
import styles from './Ayuda.module.css';

/**
 * Centro de ayuda, con la forma del soporte de Wix: un inicio con buscador y temas, la lista de cada tema y los
 * artículos con migas, índice, pasos, capturas, recuadros, preguntas frecuentes y relacionados. Si se llegó desde un
 * proyecto, el proyecto sigue abierto: Volver al proyecto y "Mostrame dónde está" vuelven a él.
 */
export default function Ayuda({ topic, article }: { topic: string | null; article: string | null }) {
  const content = helpContent();
  const t0 = topic ? topicById(content, topic) : undefined;
  const a = article ? articleById(content, article) : undefined;

  // Cada página nueva arranca arriba, como un sitio.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [topic, article]);

  let page: React.ReactNode;
  if (a && t0 && a.topic === t0.id) page = <ArticlePage content={content} topic={t0} article={a} />;
  else if (t0 && !article) page = <TopicPage content={content} topic={t0} />;
  else if (topic) page = <NotFound />;
  else page = <HelpHome content={content} />;

  return (
    <div className={styles.shell}>
      <HelpHeader />
      {page}
    </div>
  );
}

function HelpHeader() {
  const projectId = useEditor((s) => s.project?.id);
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <a className={styles.brand} href="#/" aria-label={t('Calibre Studio: ir al inicio')}>
          <BrandMark height={34} />
          <BrandWordmark height={22} />
        </a>
        <a className={styles.helpName} href={helpHref()}>
          {t('Centro de ayuda')}
        </a>
        <a className={styles.backBtn} href={projectId ? sectionHref(projectId, 'modelo') : '#/'}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {projectId ? t('Volver al proyecto') : t('Ir al inicio')}
        </a>
      </div>
    </header>
  );
}

/** Abre el proyecto en Modelo y, cuando se ve, arranca estos pasos del recorrido. */
function showInEditor(projectId: string, tour: TourStep[]) {
  useTour.getState().queue(tour);
  location.hash = sectionHref(projectId, 'modelo');
}

function HelpHome({ content }: { content: HelpContent }) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchArticles(content, query), [content, query]);
  const searching = query.trim().length > 0;
  const projectId = useEditor((s) => s.project?.id);
  const topics = content.topics.filter((x) => topicArticles(content, x.id).length > 0);

  const learn = async () => {
    const id = await startPracticeStool();
    if (id) location.hash = sectionHref(id, 'modelo');
  };

  return (
    <main className={styles.main}>
      <section className={styles.hero} aria-labelledby="ayuda-titulo">
        <h1 id="ayuda-titulo" className={styles.heroTitle}>
          {t('¿En qué te ayudamos?')}
        </h1>
        <p className={styles.heroSub}>{t('Buscá una herramienta o lo que querés hacer, o elegí un tema.')}</p>
        <form className={styles.search} role="search" onSubmit={(e) => e.preventDefault()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="6" />
            <path d="m20 20-4.5-4.5" />
          </svg>
          <label htmlFor="ayuda-buscar" className={styles.srOnly}>
            {t('Buscar en la ayuda')}
          </label>
          <input id="ayuda-buscar" type="search" placeholder={t('Por ejemplo: subir una pieza')} value={query} autoComplete="off" onChange={(e) => setQuery(e.target.value)} />
        </form>
        <div className={styles.suggest}>
          <span>{t('Probá con:')}</span>
          {content.suggestions.map((s) => (
            <button key={s} type="button" className={styles.chip} onClick={() => setQuery(s)}>
              {s}
            </button>
          ))}
        </div>
      </section>

      {searching ? (
        <section className={styles.block} aria-live="polite">
          <h2 className={styles.h2}>{results.length === 1 ? t('1 resultado') : t('{n} resultados', { n: results.length })}</h2>
          {results.length ? (
            <ArticleList content={content} articles={results} showTopic />
          ) : (
            <p className={styles.none}>{t('No encontramos nada con esas palabras. Probá con otras, o mirá los temas.')}</p>
          )}
          <button type="button" className={styles.linkBtn} onClick={() => setQuery('')}>
            {t('Ver todos los temas')}
          </button>
        </section>
      ) : (
        <>
          <section className={styles.block} aria-labelledby="temas">
            <h2 id="temas" className={styles.h2}>
              {t('Temas')}
            </h2>
            <div className={styles.topics}>
              {topics.map((x) => (
                <a key={x.id} className={styles.topic} href={helpHref(x.id)}>
                  <span className={styles.topicIcon} aria-hidden="true">
                    <TopicGlyph icon={x.icon} />
                  </span>
                  <strong>{x.title}</strong>
                  <span>{x.summary}</span>
                  <span className={styles.topicCount}>
                    {topicArticles(content, x.id).length === 1 ? t('1 artículo') : t('{n} artículos', { n: topicArticles(content, x.id).length })}
                  </span>
                </a>
              ))}
            </div>
          </section>
          <div className={styles.homeBottom}>
            <section className={styles.block} aria-labelledby="leido">
              <h2 id="leido" className={styles.h2}>
                {t('Lo más leído')}
              </h2>
              <ArticleList content={content} articles={content.popular.map((id) => articleById(content, id)).filter((x): x is Article => !!x)} />
            </section>
            <section className={styles.first} aria-labelledby="primera">
              <h2 id="primera" className={styles.firstTitle}>
                {t('¿Primera vez?')}
              </h2>
              <p>{t('Un recorrido de {n} pasos por el editor te muestra dónde está cada cosa y para qué sirve.', { n: EDITOR_TOUR.length })}</p>
              <span className={styles.firstActions}>
                {projectId && (
                  <button type="button" className={styles.primaryBtn} onClick={() => showInEditor(projectId, EDITOR_TOUR)}>
                    {t('Recorrido guiado')}
                  </button>
                )}
                <button type="button" className={projectId ? styles.secondaryBtn : styles.primaryBtn} onClick={() => void learn()}>
                  {t('Aprender con un taburete')}
                </button>
              </span>
            </section>
          </div>
        </>
      )}
    </main>
  );
}

function ArticleList({ content, articles, showTopic }: { content: HelpContent; articles: Article[]; showTopic?: boolean }) {
  return (
    <ul className={styles.list}>
      {articles.map((a) => (
        <li key={a.id}>
          <a href={helpHref(a.topic, a.id)}>
            <span className={styles.listText}>
              <strong>{a.title}</strong>
              <span>{showTopic ? `${topicById(content, a.topic)?.title ?? ''} · ${a.summary}` : a.summary}</span>
            </span>
            <svg className={styles.listArrow} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </a>
        </li>
      ))}
    </ul>
  );
}

function Crumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className={styles.crumbs} aria-label={t('Estás en')}>
      <ol>
        {items.map((c, i) => (
          <li key={i}>{c.href ? <a href={c.href}>{c.label}</a> : <span aria-current="page">{c.label}</span>}</li>
        ))}
      </ol>
    </nav>
  );
}

function TopicPage({ content, topic }: { content: HelpContent; topic: Topic }) {
  return (
    <main className={styles.main}>
      <Crumbs items={[{ label: t('Ayuda'), href: helpHref() }, { label: topic.title }]} />
      <div className={styles.topicHead}>
        <span className={styles.topicIcon} aria-hidden="true">
          <TopicGlyph icon={topic.icon} />
        </span>
        <div>
          <h1 className={styles.pageTitle}>{topic.title}</h1>
          <p className={styles.lead}>{topic.summary}</p>
        </div>
      </div>
      <ArticleList content={content} articles={topicArticles(content, topic.id)} />
    </main>
  );
}

function NotFound() {
  return (
    <main className={styles.main}>
      <h1 className={styles.pageTitle}>{t('No encontramos ese artículo')}</h1>
      <a className={styles.linkBtn} href={helpHref()}>
        {t('Ir al Centro de ayuda')}
      </a>
    </main>
  );
}

function ArticlePage({ content, topic, article }: { content: HelpContent; topic: Topic; article: Article }) {
  const projectId = useEditor((s) => s.project?.id);
  const siblings = topicArticles(content, topic.id);
  const related = (article.related ?? []).map((id) => articleById(content, id)).filter((x): x is Article => !!x);
  const toc = [...article.sections.map((s) => ({ id: s.id, title: s.title })), ...(article.faq?.length ? [{ id: 'preguntas', title: t('Preguntas frecuentes') }] : [])];
  const active = useActiveSection(toc.map((s) => s.id));
  const goTo = (id: string) => document.getElementById(`s-${id}`)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });

  const tocList = (
    <ul>
      {toc.map((s) => (
        <li key={s.id}>
          <button type="button" aria-current={active === s.id || undefined} onClick={() => goTo(s.id)}>
            {s.title}
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <main className={styles.articleMain}>
      <Crumbs items={[{ label: t('Ayuda'), href: helpHref() }, { label: topic.title, href: helpHref(topic.id) }, { label: article.title }]} />
      <div className={styles.articleGrid}>
        <nav className={styles.side} aria-label={topic.title}>
          <p className={styles.eyebrow}>{topic.title}</p>
          <ul>
            {siblings.map((s) => (
              <li key={s.id}>
                <a href={helpHref(topic.id, s.id)} aria-current={s.id === article.id ? 'page' : undefined}>
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <label className={styles.sideMobile}>
          <span className={styles.srOnly}>{t('Otros artículos de {topic}', { topic: topic.title })}</span>
          <select value={article.id} onChange={(e) => (location.hash = helpHref(topic.id, e.target.value))}>
            {siblings.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>

        <article className={styles.article}>
          <h1 className={styles.pageTitle}>{article.title}</h1>
          {article.intro.length > 0 && <Blocks content={content} blocks={article.intro} />}
          {toc.length > 1 && (
            <div className={styles.tocInline}>
              <p className={styles.eyebrow}>{t('En este artículo')}</p>
              {tocList}
            </div>
          )}
          {article.sections.map((s) => (
            <section key={s.id} id={`s-${s.id}`} className={styles.section} aria-labelledby={`h-${s.id}`}>
              <h2 id={`h-${s.id}`} className={styles.h2}>
                {s.title}
              </h2>
              <Blocks content={content} blocks={s.blocks} />
            </section>
          ))}
          {article.show && projectId && (
            <button type="button" className={styles.showBtn} onClick={() => showInEditor(projectId, [article.show!])}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="8" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              {t('Mostrame dónde está')}
            </button>
          )}
          {article.faq && article.faq.length > 0 && (
            <section id="s-preguntas" className={styles.section} aria-labelledby="h-preguntas">
              <h2 id="h-preguntas" className={styles.h2}>
                {t('Preguntas frecuentes')}
              </h2>
              <div className={styles.faq}>
                {article.faq.map((f) => (
                  <details key={f.q}>
                    <summary>
                      <Inline content={content} text={f.q} />
                    </summary>
                    <p>
                      <Inline content={content} text={f.a} />
                    </p>
                  </details>
                ))}
              </div>
            </section>
          )}
          {related.length > 0 && (
            <section className={styles.related} aria-labelledby="h-relacionados">
              <h2 id="h-relacionados" className={styles.h2}>
                {t('Artículos relacionados')}
              </h2>
              <ArticleList content={content} articles={related} />
            </section>
          )}
        </article>

        {toc.length > 1 && (
          <nav className={styles.toc} aria-label={t('En este artículo')}>
            <p className={styles.eyebrow}>{t('En este artículo')}</p>
            {tocList}
          </nav>
        )}
      </div>
    </main>
  );
}

/** La sección que se está leyendo: la última cuyo título ya pasó el primer tercio de la pantalla. */
function useActiveSection(ids: string[]): string | null {
  const key = ids.join(' ');
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  useEffect(() => {
    const list = key.split(' ');
    const onScroll = () => {
      let current = list[0] ?? null;
      for (const id of list) {
        const el = document.getElementById(`s-${id}`);
        if (el && el.getBoundingClientRect().top < window.innerHeight / 3) current = id;
      }
      setActive(current);
    };
    const frame = requestAnimationFrame(onScroll);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, [key]);
  return active;
}

function Blocks({ content, blocks }: { content: HelpContent; blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => (
        <BlockView key={i} content={content} block={b} />
      ))}
    </>
  );
}

const CALLOUT = { note: tk('Nota'), tip: tk('Consejo'), key: tk('Atajo') };

function BlockView({ content, block: b }: { content: HelpContent; block: Block }) {
  switch (b.kind) {
    case 'p':
      return (
        <p className={styles.p}>
          <Inline content={content} text={b.text} />
        </p>
      );
    case 'steps':
    case 'list': {
      const items = b.items.map((x, i) => (
        <li key={i}>
          <Inline content={content} text={x} />
        </li>
      ));
      return b.kind === 'steps' ? <ol className={styles.steps}>{items}</ol> : <ul className={styles.bullets}>{items}</ul>;
    }
    case 'note':
    case 'tip':
    case 'key':
      return (
        <div className={styles.callout} data-kind={b.kind}>
          <CalloutGlyph kind={b.kind} />
          <p>
            <strong>{t(CALLOUT[b.kind])}:</strong> <Inline content={content} text={b.text} />
          </p>
        </div>
      );
    case 'img':
      return (
        <figure className={styles.figure} data-phone={b.phone || undefined}>
          <img src={`${import.meta.env.BASE_URL}ayuda/${b.src}.jpg`} alt={b.alt} width={b.phone ? 390 : 1440} height={b.phone ? 844 : 665} loading="lazy" decoding="async" />
        </figure>
      );
    case 'table':
      return (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {b.head.map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j}>
                      <Inline content={content} text={c} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

/** **negrita**, `tecla` y [texto](artículo). */
function Inline({ content, text }: { content: HelpContent; text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([a-z0-9-]+\))/g);
  return (
    <>
      {parts.map((s, i) => {
        if (s.startsWith('**') && s.endsWith('**')) return <strong key={i}>{s.slice(2, -2)}</strong>;
        if (s.startsWith('`') && s.endsWith('`')) return <kbd key={i}>{s.slice(1, -1)}</kbd>;
        const link = s.match(/^\[([^\]]+)\]\(([a-z0-9-]+)\)$/);
        if (link) {
          const target = articleById(content, link[2]!);
          return target ? (
            <a key={i} href={helpHref(target.topic, target.id)}>
              {link[1]}
            </a>
          ) : (
            <Fragment key={i}>{link[1]}</Fragment>
          );
        }
        return <Fragment key={i}>{s}</Fragment>;
      })}
    </>
  );
}

function CalloutGlyph({ kind }: { kind: 'note' | 'tip' | 'key' }) {
  return (
    <svg className={styles.calloutIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {kind === 'note' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8v.1" />
        </>
      )}
      {kind === 'tip' && <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />}
      {kind === 'key' && (
        <>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M7 10h.01M11 10h.01M15 10h.01M8 14h8" />
        </>
      )}
    </svg>
  );
}

function TopicGlyph({ icon }: { icon: TopicIcon }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {icon === 'start' && <path d="M8 5.5v13l10-6.5z" />}
      {icon === 'tools' && (
        <>
          <path d="M14.5 5.5a3.5 3.5 0 0 0 4.6 4.6L20 11l-9 9-3-3 9-9z" />
          <path d="M4 20l3-3M5 6l3 3M3.5 4.5l2-1 2 2-1 2z" />
        </>
      )}
      {icon === 'parts' && (
        <>
          <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
          <path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
        </>
      )}
      {icon === 'joints' && (
        <>
          <path d="M4 10h6v4H4zM14 6h6v12h-6z" />
          <path d="M10 11h4v2h-4z" />
        </>
      )}
      {icon === 'cuts' && (
        <>
          <path d="M3 8h18v8H3z" />
          <path d="M9 8v8M15 8v8" strokeDasharray="1.5 2" />
        </>
      )}
      {icon === 'plans' && (
        <>
          <path d="M4 5h16v14H4z" />
          <path d="M8 9h8M8 12h8M8 15h5" />
        </>
      )}
      {icon === 'share' && (
        <>
          <circle cx="17" cy="6" r="2.5" />
          <circle cx="7" cy="12" r="2.5" />
          <circle cx="17" cy="18" r="2.5" />
          <path d="M9.2 10.8l5.6-3.4M9.2 13.2l5.6 3.4" />
        </>
      )}
      {icon === 'recipe' && (
        <>
          <path d="M9 6h11M9 12h11M9 18h11" />
          <path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" />
        </>
      )}
      {icon === 'keys' && (
        <>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M7 10h.01M11 10h.01M15 10h.01M8 14h8" />
        </>
      )}
    </svg>
  );
}
