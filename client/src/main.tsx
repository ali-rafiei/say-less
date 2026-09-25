import '@fontsource-variable/fredoka';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import './styles/global.css';
import './styles/characters.css';
import './styles/screens.css';
import './styles/art.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';

// Displayed text is game content: block copy, long-press menus and drag on everything but inputs.
document.addEventListener('contextmenu', (event) => {
  if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) {
    event.preventDefault();
  }
});
document.addEventListener('copy', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
    event.preventDefault();
  }
});
document.addEventListener('dragstart', (event) => event.preventDefault());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
