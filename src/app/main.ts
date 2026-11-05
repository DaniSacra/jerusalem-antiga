import { watchInstall } from '../render/install';
import { chooseView } from './view';

/**
 * Boot: picks the view (2D or 3D) and loads only its code, so who plays in 3D never downloads
 * Phaser and who plays in 2D only downloads Three.js when the 3D button is pressed.
 */
watchInstall();

const view = chooseView(location.search);
if (view === '3d') void import('./start3d').then((m) => m.start3d());
else void import('./start2d').then((m) => m.start2d());

// Installable app: the service worker lets the game open offline (production builds only, so the
// dev server keeps hot reload).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
