import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/base.css';
import { App } from './App';
import { setUpApp } from './pwa';

const root = document.getElementById('root');
if (!root) throw new Error('Falta el elemento #root');

setUpApp();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
