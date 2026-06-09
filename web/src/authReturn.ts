const authErrorStorageKey = "copula.auth-return-error";
const authErrorParams = ["error", "error_code", "error_description"];
let inMemoryAuthError: string | null = null;

export function captureAuthReturnError() {
  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
  const description = url.searchParams.get("error_description") ?? hashParams.get("error_description");
  const code = url.searchParams.get("error_code") ?? hashParams.get("error_code");

  if (!description && !code) return;

  inMemoryAuthError = description ?? code ?? "oauth_error";
  try {
    window.sessionStorage.setItem(authErrorStorageKey, inMemoryAuthError);
  } catch {
    // The URL is still cleaned even when session storage is unavailable.
  }
  authErrorParams.forEach((key) => {
    url.searchParams.delete(key);
    hashParams.delete(key);
  });
  url.hash = hashParams.toString() ? `#${hashParams.toString()}` : "";
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export function readStoredAuthReturnError() {
  try {
    return window.sessionStorage.getItem(authErrorStorageKey) ?? inMemoryAuthError;
  } catch {
    return inMemoryAuthError;
  }
}

export function clearStoredAuthReturnError() {
  inMemoryAuthError = null;
  try {
    window.sessionStorage.removeItem(authErrorStorageKey);
  } catch {
    // Nothing to clear when browser storage is unavailable.
  }
}
