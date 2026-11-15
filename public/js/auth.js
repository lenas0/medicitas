import { apiRequest, setUnauthorizedHandler } from './api.js';
import {
  clearStoredSession,
  getActiveUser,
  getToken,
  persistActiveUser,
  saveSession,
  setActiveUser
} from './authState.js';
import { setAdminMode } from './admin.js';
import { loadAppointments } from './appointments.js';
import { renderDoctors } from './doctors.js';
import { runFormSubmission, setFormMessage, showToast } from './ui.js';

const authDialog = document.querySelector('#auth-dialog');
const authForm = document.querySelector('#auth-form');
const authMessage = document.querySelector('#auth-message');
const heroSearchActions = document.querySelector('.hero-search-actions');
const doctorSearchStatus = document.querySelector('#doctor-search-status');
const appointmentSection = document.querySelector('#appointments-section');
const adminSection = document.querySelector('#admin-section');
const appointmentList = document.querySelector('#appointment-list');

let authMode = 'login';

function setAuthMode(mode) {
  authMode = mode;
  const registering = mode === 'register';
  authForm.elements.firstNames.required = registering;
  authForm.elements.lastNames.required = registering;
  authForm.elements.phone.required = registering;
  document.querySelector('#auth-eyebrow').textContent = registering ? 'Empieza tu camino de cuidado' : 'Bienvenido a MediCita';
  document.querySelector('#auth-title').textContent = registering ? 'Crea tu cuenta' : 'Inicia sesión';
  document.querySelector('#auth-description').textContent = registering
    ? 'Regístrate para solicitar y gestionar tus citas.'
    : 'Accede para gestionar tus citas.';
  document.querySelector('#register-fields').classList.toggle('hidden', !registering);
  document.querySelector('#password-hint').classList.toggle('hidden', !registering);
  document.querySelector('#auth-submit').textContent = registering ? 'Crear cuenta' : 'Iniciar sesión';
  document.querySelector('#switch-copy').textContent = registering ? '¿Ya tienes cuenta?' : '¿Aún no tienes cuenta?';
  document.querySelector('#switch-auth-mode').textContent = registering ? 'Inicia sesión' : 'Regístrate';
  authForm.elements.password.autocomplete = registering ? 'new-password' : 'current-password';
  setFormMessage(authMessage, '');
}

export function openAuth(mode) {
  setAuthMode(mode);
  authDialog.showModal();
  authForm.elements.email.focus();
}

function applySessionVisibility(signedIn, isAdmin) {
  document.body.classList.toggle('admin-view', isAdmin);
  heroSearchActions.classList.toggle('hidden', isAdmin);
  doctorSearchStatus.classList.toggle('hidden', isAdmin);
  document.querySelector('#login-open').classList.toggle('hidden', signedIn);
  document.querySelector('#register-open').classList.toggle('hidden', signedIn);
  document.querySelector('#logout-button').classList.toggle('hidden', !signedIn);
  document.querySelector('#my-appointments-link').classList.toggle('hidden', !signedIn || isAdmin);
  document.querySelector('#admin-panel-link').classList.toggle('hidden', !isAdmin);
  appointmentSection.classList.toggle('hidden', !signedIn || isAdmin);
  adminSection.classList.toggle('hidden', !isAdmin);
  document.querySelector('#patient-appointment-filters').classList.toggle('hidden', !signedIn || isAdmin);
  document.querySelector('#exam-results').classList.toggle('hidden', !signedIn || isAdmin);
}

function applySessionCopy(isAdmin) {
  document.querySelector('#admin-section h2').textContent = isAdmin ? 'Panel de administración' : 'Gestionar el centro';
  document.querySelector('#my-appointments-link').textContent = 'Mis citas';
  document.querySelector('#appointments-eyebrow').textContent = isAdmin ? 'Supervisión de agenda' : 'Tu espacio personal';
  document.querySelector('#appointments-title').textContent = isAdmin ? 'Citas programadas para hoy' : 'Mis citas';
}

function updateSessionUi() {
  const user = getActiveUser();
  const signedIn = Boolean(user && getToken());
  const isAdmin = signedIn && user.role === '1';

  applySessionVisibility(signedIn, isAdmin);
  applySessionCopy(isAdmin);

  if (isAdmin) {
    appointmentSection.classList.remove('hidden');
    setAdminMode('patients');
  }

  renderDoctors();
  if (signedIn) loadAppointments();
  else appointmentList.replaceChildren();
}

function storeSession(result) {
  saveSession(result.token, result.user);
  updateSessionUi();
}

function clearSession() {
  clearStoredSession();
  updateSessionUi();
}

export async function restoreSession() {
  if (!getToken() || !getActiveUser()) {
    clearSession();
    return;
  }
  try {
    const result = await apiRequest('/auth/me', { authenticated: true });
    setActiveUser(result.user);
    persistActiveUser();
    updateSessionUi();
  } catch {
    clearSession();
  }
}

export function bindAuthEvents() {
  document.querySelector('#login-open').addEventListener('click', () => openAuth('login'));
  document.querySelector('#register-open').addEventListener('click', () => openAuth('register'));
  document.querySelector('#auth-close').addEventListener('click', () => authDialog.close());
  document.querySelector('#switch-auth-mode').addEventListener('click', () => setAuthMode(authMode === 'login' ? 'register' : 'login'));
  document.querySelector('#logout-button').addEventListener('click', () => {
    clearSession();
    showToast('Has cerrado sesión.');
  });
  authForm.addEventListener('submit', (event) => {
    event.preventDefault();
    runFormSubmission(authForm, authMessage, async (formData) => {
      const body = {
        email: formData.get('email'),
        password: formData.get('password')
      };
      if (authMode === 'register') {
        body.firstNames = formData.get('firstNames');
        body.lastNames = formData.get('lastNames');
        body.phone = formData.get('phone') || undefined;
      }
      const result = await apiRequest(authMode === 'register' ? '/users' : '/sessions', { method: 'POST', body });
      storeSession(result);
      authDialog.close();
      authForm.reset();
      showToast(authMode === 'register' ? 'Tu cuenta se creó correctamente.' : `¡Bienvenido/a, ${result.user.firstNames}!`);
    });
  });
}

setUnauthorizedHandler(() => clearSession());
