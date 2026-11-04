import Phaser from 'phaser';
import { GameScene, type SharedCity } from '../scenes/GameScene';
import { UIScene } from '../scenes/UIScene';
import { WeatherScene } from '../scenes/WeatherScene';
import { GAME_H, GAME_W } from '../render/layout';

/**
 * The current 2D game (Phaser), hosted in the same page as the 3D proof and playing the very same
 * GameState object. Loaded on demand (Phaser is a separate download). Only the visible view runs:
 * the hidden one sleeps, so the city is never simulated twice.
 */
export class TwoD {
  private game: Phaser.Game;
  private scene: GameScene | null = null;

  constructor(parent: HTMLElement, city: SharedCity, clock: number) {
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: GAME_W,
      height: GAME_H,
      backgroundColor: '#6b5236',
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      input: { activePointers: 3 },
      scene: [],
    });
    // Same order as the game (the UI draws on top), the game scene started with the shared city.
    this.game.scene.add('game', GameScene, false);
    this.game.scene.add('weather', WeatherScene, false);
    this.game.scene.add('ui', UIScene, false);
    this.game.scene.start('game', { shared: city });
    this.game.events.once(Phaser.Core.Events.READY, () => {
      this.scene = this.game.scene.getScene('game') as GameScene;
      this.scene.events.once(Phaser.Scenes.Events.CREATE, () => this.scene?.resumeShared(clock));
    });
  }

  /** The week fraction of the 2D clock (handed back to the 3D view). */
  get clock(): number {
    return this.scene?.weekClock ?? 0;
  }

  sleep() {
    this.game.loop.sleep();
  }

  wake(clock: number) {
    this.game.loop.wake();
    this.game.scale.refresh();
    this.scene?.resumeShared(clock);
  }
}
