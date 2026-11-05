import Phaser from 'phaser';
import { GameScene } from '../scenes/GameScene';
import { TitleScene } from '../scenes/TitleScene';
import { UIScene } from '../scenes/UIScene';
import { WeatherScene } from '../scenes/WeatherScene';
import { GAME_H, GAME_W } from '../render/layout';

/** The classic 2D game (Phaser): title, map, weather and interface scenes. Plan B until the 3D has parity. */
export function start2d() {
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
}
