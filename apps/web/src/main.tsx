import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { t } from '@kitc/core';
import './styles/tokens.css';
import './styles/base.css';
import { App } from './App';
import { setUpApp } from './pwa';
import { initLang } from './i18n';

initLang();

const root = document.getElementById('root');
if (!root) throw new Error(t('Falta el elemento #root'));

setUpApp();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
