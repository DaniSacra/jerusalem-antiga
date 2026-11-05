import { install, installOffer, onInstallChange } from '../render/install';
import { T } from '../render/strings';
import { tutorialSeen } from '../game/tutorial';
import { formOf, h, onTap } from './dom';
import { NOVA_CSS, NOVA_FONT } from '../render/palette';
import './ui.css';

/**
 * The title screen of the 3D game in HTML: the name, how to play, the controls and "Começar"
 * (Enter on PC); once the tutorial was seen, "Ver tutorial de novo" too. "Instalar app" shows when
 * the browser can install it. Resolves with whether the tutorial was asked for.
 */
export function showTitle(parent: HTMLElement = document.body): Promise<{ tutorial: boolean }> {
  return new Promise((resolve) => {
    const root = h('div', { id: 'hud', class: 'title-screen', 'data-form': formOf() });
    root.style.setProperty('--c-ink', NOVA_CSS.ink);
    root.style.setProperty('--c-muted', NOVA_CSS.muted);
    root.style.setProperty('--c-gold', NOVA_CSS.gold);
    root.style.setProperty('--c-parchment', '#f4e8cc');
    root.style.setProperty('--font', NOVA_FONT);
    const done = (tutorial: boolean) => {
      removeEventListener('keydown', onKey);
      offInstall();
      root.remove();
      resolve({ tutorial });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') done(false);
    };
    const start = h('button.act.gold', { 'data-spot': 'start' }, T.start);
    onTap(start, () => done(false));
    const acts = h('div.acts', {}, start);
    if (tutorialSeen()) {
      const again = h('button.act', { 'data-spot': 'tutorial-again' }, T.tutorial.again);
      onTap(again, () => done(true));
      acts.append(again);
    }
    const list = h('ol', {}, ...T.howTo.map((line) => h('li', {}, line)));
    const card = h('div.card', {}, h('h1', {}, T.title), list, h('p.controls', {}, T.controls), acts);
    const corner = h('div.install');
    const paint = () => {
      corner.replaceChildren();
      const offer = installOffer();
      if (offer === 'prompt') {
        const b = h('button.act.gold', {}, T.install);
        onTap(b, () => void install());
        corner.append(b);
      } else if (offer === 'ios') corner.append(h('p', {}, T.installIos));
    };
    paint();
    const offInstall = onInstallChange(paint);
    root.append(h('div.modal.title-bg', {}, card), corner);
    parent.append(root);
    addEventListener('keydown', onKey);
  });
}
