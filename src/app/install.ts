/**
 * "Install the app": Chrome and Edge fire `beforeinstallprompt` when the site can be installed; we
 * keep it so the title screen can offer its own button. Safari on iPhone has no prompt, so there
 * we only show how to add it to the home screen. Nothing is offered once running as the app.
 */
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();

export function watchInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // our own button instead of the browser's mini bar
    deferred = e as InstallPrompt;
    listeners.forEach((f) => f());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((f) => f());
  });
}

const standalone = () => window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || (navigator as { standalone?: boolean }).standalone === true;

/** 'prompt': our button can install; 'ios': show the Safari hint; null: nothing to offer. */
export function installOffer(): 'prompt' | 'ios' | null {
  if (standalone()) return null;
  if (deferred) return 'prompt';
  return /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'ios' : null;
}

export async function install() {
  if (!deferred) return;
  const p = deferred;
  deferred = null;
  await p.prompt();
  await p.userChoice.catch(() => null);
  listeners.forEach((f) => f());
}

/** Called when the offer changes (the prompt arrived, or the app was installed). Returns an unsubscribe. */
export function onInstallChange(f: () => void) {
  listeners.add(f);
  return () => listeners.delete(f);
}
