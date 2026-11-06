import { stepVolume } from '../game/music/mix';
import { saveSettings, settings } from '../game/settings';
import { T } from '../game/strings';
import { h, onTap } from './dom';

/** The gear's panel: day and night, the music and its volume. */
export class SettingsPanel {
  readonly el = h('div.settings.panel.hidden');

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
      row(S.music, settings.music ? S.on : S.off, 'set-music', () => {
        settings.music = !settings.music;
        saveSettings();
        this.draw();
      }),
      this.volumeRow(),
    );
    this.el.classList.remove('hidden');
  }

  /** Volume: − and + around the value (steps of 10%; same buttons as the other rows). */
  private volumeRow() {
    const S = T.nova.settings;
    const step = (dir: 1 | -1, label: string, spot: string) => {
      const b = h('button.act', { 'data-spot': spot, 'aria-label': `${S.volume} ${label}` }, label);
      onTap(b, () => {
        settings.musicVolume = stepVolume(settings.musicVolume, dir);
        saveSettings();
        this.draw();
      });
      return b;
    };
    const value = h('span.value', { 'data-spot': 'set-volume' }, S.volumeValue(settings.musicVolume));
    return h('div.row', {}, h('span', {}, S.volume), h('div.volume', {}, step(-1, '−', 'set-volume-down'), value, step(1, '+', 'set-volume-up')));
  }
}
