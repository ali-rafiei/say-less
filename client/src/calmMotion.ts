const KEY = 'say-less.calm';

/** Calm motion stops the bouncing and shaking for this game, like the OS reduced-motion
 *  setting; remembered per device. */
export function loadCalmMotion(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setCalmMotion(on: boolean): void {
  document.documentElement.dataset.motion = on ? 'calm' : '';
  try {
    if (on) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    // storage unavailable: the choice lasts until the page reloads
  }
}
