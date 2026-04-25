export function readStorageJson(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeStorageJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures and keep the console usable.
  }
}

export function clearStorageKey(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures and continue reboot.
  }
}
