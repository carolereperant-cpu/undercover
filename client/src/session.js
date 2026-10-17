// La session (code de salle + jeton secret) est gardée dans le navigateur du joueur.
// Si le téléphone se met en veille ou perd le réseau, on se reconnecte à la même place.
const KEY = 'undercover.session';
const NAME_KEY = 'undercover.name';

export function loadSession() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && typeof s.code === 'string' && typeof s.token === 'string' ? s : null;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* navigation privée : on continue sans mémoire */
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* rien à faire */
  }
}

export function loadName() {
  try {
    return localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
}

export function saveName(name) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* rien à faire */
  }
}
