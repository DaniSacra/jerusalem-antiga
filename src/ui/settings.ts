import { saveSettings, settings } from '../render/settings';
import { T } from '../render/strings';
import { h, onTap } from './dom';

/** The gear's panel: day and night, and which map the game opens with (3D or the classic 2D). */
export class SettingsPanel {
  readonly el = h('div.settings.panel.hidden');

  constructor(private o: { standalone: boolean; toClassic: () => void }) {}

  get open() {
    return !this.el.classList.contains('hidden');
  }

  close() {
    this.el.classList.add('hidden');
  }

  toggle() {
    if (this.open) this.close();
    else this.draw();
  }

  private draw() {
    const S = T.nova.settings;
    const row = (label: string, value: string, spot: string, fn: () => void, note?: string) => {
      const b = h('button.act', { 'data-spot': spot }, value);
      onTap(b, fn);
      return h('div.row', {}, h('span', {}, label), b, note ? h('small.t-muted', {}, note) : null);
    };
    this.el.replaceChildren(
      h('h3', {}, T.nova.buttons.settings),
      row(S.dayNight, settings.dayNight ? S.on : S.off, 'set-daynight', () => {
        settings.dayNight = !settings.dayNight;
        saveSettings();
        this.draw();
      }),
      row(S.view, S.view3d, 'set-view', () => {
        settings.view = '2d';
        saveSettings();
        this.close();
        this.o.toClassic();
      }, this.o.standalone ? S.viewNewGame : undefined),
    );
    this.el.classList.remove('hidden');
  }
}
