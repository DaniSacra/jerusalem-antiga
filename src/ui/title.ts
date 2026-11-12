import { install, installOffer, onInstallChange } from '../app/install';
import { DIFFICULTIES, type Difficulty } from '../core';
import { T } from '../game/strings';
import { tutorialSeen } from '../game/tutorialStore';
import { ICONS } from './icons';
import { applyPalette, formOf, h, onTap } from './dom';
import './ui.css';

/** The open title screen: what the player chose, and `reveal` once the city is drawn behind it. */
export interface TitleScreen {
  chosen: Promise<{ tutorial: boolean; difficulty: Difficulty }>;
  /** The warm backdrop fades to a vignette and the living city shows around the card. */
  reveal(): void;
}

/**
 * The title screen of the 3D game in HTML: the name, how to play, the controls, the difficulty and "Começar"
 * (Enter on PC); once the tutorial was seen, "Ver tutorial de novo" too. "Instalar app" shows when
 * the browser can install it. It opens at once on a warm backdrop; the game's city opens behind it
 * while Three.js and the models download, and `reveal` lets it show.
 */
export function showTitle(last: Difficulty = 'normal', parent: HTMLElement = document.body): TitleScreen {
  let reveal = () => {};
  const chosen = new Promise<{ tutorial: boolean; difficulty: Difficulty }>((resolve) => {
    const root = h('div', { id: 'hud', class: 'title-screen', 'data-form': formOf() });
    applyPalette(root);
    const done = (tutorial: boolean) => {
      removeEventListener('keydown', onKey);
      offInstall();
      root.remove();
      resolve({ tutorial, difficulty: picked });
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
    // Tranquilo / Normal / Difícil (plano-dificuldade F): the last one chosen comes marked.
    let picked = last;
    const D = T.difficulty;
    const cards = DIFFICULTIES.map((d) => {
      const b = h('button.diff', { 'data-spot': `difficulty-${d}`, 'aria-pressed': String(d === picked) }, h('b', {}, D.name[d]), h('small', {}, D.about[d]));
      onTap(b, () => {
        picked = d;
        for (const [k, c] of cards) c.setAttribute('aria-pressed', String(k === d));
      });
      return [d, b] as const;
    });
    const levels = h('div.diffs', {}, ...cards.map(([, b]) => b));
    const card = h('div.card', {}, list, h('p.controls', {}, T.controls), levels, acts);
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
    const crest = h('span.crest');
    crest.innerHTML = ICONS.crest;
    // The name beside the card, over the city: the crest, the name in gold, a line and the subtitle.
    const brand = h('div.brand', {}, crest, h('h1', {}, T.title), h('div.orn'), h('p', {}, T.subtitle));
    root.append(h('div.modal.title-bg', {}, brand, card), corner);
    parent.append(root);
    addEventListener('keydown', onKey);
    reveal = () => root.classList.add('live');
  });
  return { chosen, reveal: () => reveal() };
}
