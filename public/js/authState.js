const TOKEN_KEY = 'medicitaToken';
const USER_KEY = 'medicitaUser';

function readStoredUser() {
  try {
    const storedUser = sessionStorage.getItem(USER_KEY);
    return storedUser ? JSON.parse(storedUser) : null;
  } catch {
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    return null;
  }
}

let activeUser = readStoredUser();

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getActiveUser() {
  return activeUser;
}

export function setActiveUser(user) {
  activeUser = user;
}

export function saveSession(token, user) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  activeUser = user;
}

export function persistActiveUser() {
  sessionStorage.setItem(USER_KEY, JSON.stringify(activeUser));
}

export function clearStoredSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  activeUser = null;
}
