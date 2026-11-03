import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { TitleScene } from './scenes/TitleScene';
import { UIScene } from './scenes/UIScene';
import { WeatherScene } from './scenes/WeatherScene';
import { GAME_H, GAME_W } from './render/layout';
import { watchInstall } from './render/install';

watchInstall();

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#6b5236',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 3 },
  scene: [TitleScene, GameScene, WeatherScene, UIScene],
});

// Installable app: the service worker lets the game open offline (production builds only, so the
// dev server keeps hot reload).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
