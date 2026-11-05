import { T } from '../game/strings';
import { watchInstall } from './install';
import { hasWebGL2 } from './view';

/** Boot: the 3D game (it needs WebGL 2; without it, a short note instead). */
watchInstall();

if (hasWebGL2()) void import('./start3d').then((m) => m.start3d());
else {
  const note = document.createElement('p');
  note.textContent = T.noWebGL;
  note.style.cssText = 'font: 18px sans-serif; color: #fff4dc; padding: 24px; text-align: center;';
  document.body.append(note);
}

// Installable app: the service worker lets the game open offline (production builds only, so the
// dev server keeps hot reload).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
