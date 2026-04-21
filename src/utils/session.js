const SESSION_TOKEN_KEY = "secure-vote-session-token";

export function getStoredToken() {
  return window.localStorage.getItem(SESSION_TOKEN_KEY);
}

export function setStoredToken(token) {
  window.localStorage.setItem(SESSION_TOKEN_KEY, token);
}

export function clearStoredToken() {
  window.localStorage.removeItem(SESSION_TOKEN_KEY);
}
