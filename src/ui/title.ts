import { install, installOffer, onInstallChange } from '../app/install';
import { T } from '../game/strings';
import { tutorialSeen } from '../game/tutorialStore';
import { formOf, h, onTap } from './dom';
import { NOVA_CSS, NOVA_FONT, TITLE_FONT } from '../game/palette';
import './ui.css';

/** The open title screen: what the player chose, and `reveal` once the city is drawn behind it. */
export interface TitleScreen {
  chosen: Promise<{ tutorial: boolean }>;
  /** The warm backdrop fades to a vignette and the living city shows around the card. */
  reveal(): void;
}

/**
 * The title screen of the 3D game in HTML: the name, how to play, the controls and "Começar"
 * (Enter on PC); once the tutorial was seen, "Ver tutorial de novo" too. "Instalar app" shows when
 * the browser can install it. It opens at once on a warm backdrop; the game's city opens behind it
 * while Three.js and the models download, and `reveal` lets it show.
 */
export function showTitle(parent: HTMLElement = document.body): TitleScreen {
  let reveal = () => {};
  const chosen = new Promise<{ tutorial: boolean }>((resolve) => {
    const root = h('div', { id: 'hud', class: 'title-screen', 'data-form': formOf() });
    root.style.setProperty('--c-ink', NOVA_CSS.ink);
    root.style.setProperty('--c-muted', NOVA_CSS.muted);
    root.style.setProperty('--c-gold', NOVA_CSS.gold);
    root.style.setProperty('--c-parchment', NOVA_CSS.parchment);
    root.style.setProperty('--font', NOVA_FONT);
    root.style.setProperty('--title-font', TITLE_FONT);
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
    reveal = () => root.classList.add('live');
  });
  return { chosen, reveal: () => reveal() };
}
