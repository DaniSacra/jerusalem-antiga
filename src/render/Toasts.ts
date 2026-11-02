import Phaser from 'phaser';
import { GAME_W, TOP_H } from './layout';
import { C, CSS } from './palette';
import { text } from './ui';

const DURATION = 2200;
const MAX = 3;
const Y0 = TOP_H + 30;

interface Toast {
  msg: string;
  root: Phaser.GameObjects.Container;
  timer: Phaser.Time.TimerEvent;
}

export type Tone = 'info' | 'bad' | 'good';

export class Toasts {
  private list: Toast[] = [];

  constructor(private scene: Phaser.Scene) {}

  show(msg: string, tone: Tone = 'info') {
    const existing = this.list.find((t) => t.msg === msg);
    if (existing) {
      existing.timer.reset({ delay: DURATION, callback: () => this.dismiss(existing) });
      return;
    }
    const s = this.scene;
    const label = text(s, 0, 0, msg, 20, CSS.light, true).setOrigin(0.5);
    const w = label.width + 36;
    const h = 40;
    const bg = s.add.graphics();
    bg.fillStyle(C.shadow, 0.3);
    bg.fillRoundedRect(-w / 2 + 2, -h / 2 + 3, w, h, 12);
    bg.fillStyle(tone === 'bad' ? 0xa8392b : tone === 'good' ? 0x4f7f34 : C.ink, 0.95);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    const root = s.add.container(GAME_W / 2, Y0, [bg, label]).setDepth(30).setAlpha(0);
    s.tweens.add({ targets: root, alpha: 1, duration: 150 });
    const toast: Toast = { msg, root, timer: s.time.delayedCall(DURATION, () => this.dismiss(toast)) };
    this.list.unshift(toast);
    while (this.list.length > MAX) this.remove(this.list[this.list.length - 1]);
    this.layout();
  }

  private dismiss(t: Toast) {
    this.scene.tweens.add({ targets: t.root, alpha: 0, duration: 250, onComplete: () => this.remove(t) });
  }

  private remove(t: Toast) {
    const i = this.list.indexOf(t);
    if (i < 0) return;
    this.list.splice(i, 1);
    t.timer.remove();
    t.root.destroy();
    this.layout();
  }

  private layout() {
    this.list.forEach((t, k) => this.scene.tweens.add({ targets: t.root, y: Y0 + k * 46, duration: 150 }));
  }
}
