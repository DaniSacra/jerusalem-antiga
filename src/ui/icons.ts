/** Small inline SVG icons of the HTML interface (no image files: the game is an offline app). */

const svg = (body: string, view = '0 0 24 24') => `<svg viewBox="${view}" aria-hidden="true">${body}</svg>`;

export const ICONS: Record<string, string> = {
  silver: svg('<circle cx="12" cy="12" r="9" fill="#d9dde2" stroke="#7d848c" stroke-width="2"/><circle cx="12" cy="12" r="5" fill="none" stroke="#9aa2ab" stroke-width="1.6"/>'),
  food: svg('<path d="M3 14c0-5 4-8 9-8s9 3 9 8c0 2-1 3-3 3H6c-2 0-3-1-3-3z" fill="#d79a4a" stroke="#7a4e1e" stroke-width="1.6"/><path d="M8 9l1 3M12 8v4M16 9l-1 3" stroke="#7a4e1e" stroke-width="1.4" stroke-linecap="round"/>'),
  wood: svg('<rect x="3" y="7" width="18" height="5" rx="2.5" fill="#a0683a" stroke="#5a3a1c" stroke-width="1.5"/><rect x="5" y="13" width="16" height="5" rx="2.5" fill="#8c5a30" stroke="#5a3a1c" stroke-width="1.5"/><circle cx="19" cy="9.5" r="1.3" fill="#e2b98a"/>'),
  stone: svg('<path d="M4 17l2-7 5-3 6 2 3 6-3 3H7z" fill="#a8a29a" stroke="#5e5952" stroke-width="1.6" stroke-linejoin="round"/>'),
  people: svg('<circle cx="9" cy="7" r="3" fill="#e8c9a0"/><path d="M4 21v-5a5 5 0 0 1 10 0v5z" fill="#4f7fb0"/><circle cx="17" cy="9" r="2.4" fill="#e8c9a0"/><path d="M13.5 21v-4a3.5 3.5 0 0 1 7 0v4z" fill="#c0503c"/>'),
  'mood-happy': svg('<circle cx="12" cy="12" r="9" fill="#ffd25a"/><path d="M8 14c1 2 7 2 8 0" stroke="#5a3a1c" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="9" cy="10" r="1.2" fill="#5a3a1c"/><circle cx="15" cy="10" r="1.2" fill="#5a3a1c"/>'),
  'mood-neutral': svg('<circle cx="12" cy="12" r="9" fill="#f0d27a"/><path d="M8 15h8" stroke="#5a3a1c" stroke-width="1.8" stroke-linecap="round"/><circle cx="9" cy="10" r="1.2" fill="#5a3a1c"/><circle cx="15" cy="10" r="1.2" fill="#5a3a1c"/>'),
  'mood-sad': svg('<circle cx="12" cy="12" r="9" fill="#e0b070"/><path d="M8 16c1-2 7-2 8 0" stroke="#5a3a1c" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="9" cy="10" r="1.2" fill="#5a3a1c"/><circle cx="15" cy="10" r="1.2" fill="#5a3a1c"/>'),
  autumn: svg('<path d="M12 3c4 3 6 7 4 11-1 3-4 4-4 7-1-3-4-4-5-7-2-4 1-8 5-11z" fill="#d07a2c"/>'),
  winter: svg('<path d="M12 2v20M3 7l18 10M3 17L21 7" stroke="#cfe6ff" stroke-width="2" stroke-linecap="round"/>'),
  spring: svg('<circle cx="12" cy="12" r="3" fill="#ffd25a"/><g fill="#f4a6c4"><circle cx="12" cy="6" r="3"/><circle cx="18" cy="12" r="3"/><circle cx="12" cy="18" r="3"/><circle cx="6" cy="12" r="3"/></g>'),
  summer: svg('<circle cx="12" cy="12" r="5" fill="#ffc83a"/><g stroke="#ffc83a" stroke-width="2" stroke-linecap="round"><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/></g>'),
  drought: svg('<circle cx="12" cy="9" r="5" fill="#ff9a3a"/><path d="M4 20l3-4 3 3 3-5 3 4 4-3" stroke="#a0683a" stroke-width="2" fill="none"/>'),
  view: svg('<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V5.5a1.5 1.5 0 0 1 3 0V13M17 12v-1.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1a7 7 0 0 1-6-3.4L3.6 14a1.5 1.5 0 0 1 2.6-1.5L8 15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'),
  road: svg('<path d="M9 3L5 21M15 3l4 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M12 4v3M12 10v3M12 16v3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  clear: svg('<path d="M14 4l6 6-3 3-6-6zM11 7L3 15l3 3 8-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M4 21h9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  turnLeft: svg('<path d="M5 12a7 7 0 1 0 2.1-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M3.5 3.5v5h5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'),
  turnRight: svg('<g transform="matrix(-1 0 0 1 24 0)"><path d="M5 12a7 7 0 1 0 2.1-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M3.5 3.5v5h5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></g>'),
  pause: svg('<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/>'),
  gear: svg('<path d="M12 2l1.6 2.6 3-.8.6 3 2.8 1.3-1.2 2.9 1.2 2.9-2.8 1.3-.6 3-3-.8L12 22l-1.6-2.6-3 .8-.6-3-2.8-1.3L5.2 13 4 10.1l2.8-1.3.6-3 3 .8z" fill="currentColor"/><circle cx="12" cy="12" r="3.4" fill="#24190e"/>'),
  arrow: svg('<path d="M20 56L0 34h12V2h16v32h12z" fill="#ffd77a" stroke="#3b2a1a" stroke-width="3" stroke-linejoin="round"/>', '-2 0 44 58'),
};
