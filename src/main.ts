import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { TitleScene } from './scenes/TitleScene';
import { UIScene } from './scenes/UIScene';
import { GAME_H, GAME_W } from './render/layout';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#6b5236',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 3 },
  scene: [TitleScene, GameScene, UIScene],
});
