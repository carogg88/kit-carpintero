import { t } from '@kitc/core';
import { HELP_ROUTE } from '../routes';

/** Botón de Ayuda: abre el Centro de ayuda. El proyecto queda abierto para volver con Volver al proyecto. */
export function HelpButton({ className, iconClass }: { className?: string; iconClass?: string }) {
  return (
    <a className={className} href={HELP_ROUTE} data-tour="help" aria-label={t('Ayuda')} title={t('Centro de ayuda')}>
      <svg className={iconClass} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6M12 17.2v.1" />
      </svg>
    </a>
  );
}
