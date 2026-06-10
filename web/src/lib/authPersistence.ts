const autoLoginStorageKey = "copula.auto-login";

export function readAutoLoginPreference() {
  try {
    return window.localStorage.getItem(autoLoginStorageKey) !== "false";
  } catch {
    return true;
  }
}

export function setAutoLoginPreference(enabled: boolean) {
  try {
    window.localStorage.setItem(autoLoginStorageKey, String(enabled));
  } catch {
    // Keep the current session behavior when browser storage is unavailable.
  }
}

export const authSessionStorage = {
  getItem(key: string) {
    const preferredStorage = readAutoLoginPreference() ? window.localStorage : window.sessionStorage;
    const fallbackStorage = readAutoLoginPreference() ? window.sessionStorage : window.localStorage;
    return preferredStorage.getItem(key) ?? fallbackStorage.getItem(key);
  },

  setItem(key: string, value: string) {
    const persistent = readAutoLoginPreference();
    const targetStorage = persistent ? window.localStorage : window.sessionStorage;
    const staleStorage = persistent ? window.sessionStorage : window.localStorage;
    targetStorage.setItem(key, value);
    staleStorage.removeItem(key);
  },

  removeItem(key: string) {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  }
};
