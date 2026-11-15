import { apiRequest } from './api.js';
import { getActiveUser, getToken } from './authState.js';
import { openAuth } from './auth.js';
import { setAdminMode } from './admin.js';
import { loadExamResults, openExamForm } from './exams.js';
import { openReviewForm } from './reviews.js';
import { formatCurrency, formatDate, scheduleSummary, toApiDateTime } from './formatters.js';
import { makeActionButton, runFormSubmission, setFormMessage, showToast } from './ui.js';

const bookingDialog = document.querySelector('#booking-dialog');
const bookingForm = document.querySelector('#booking-form');
const bookingMessage = document.querySelector('#booking-message');
const appointmentSection = document.querySelector('#appointments-section');
const appointmentList = document.querySelector('#appointment-list');
const adminAppointmentList = document.querySelector('#admin-appointment-list');

let appointmentView = 'upcoming';

export function openBooking(doctor) {
  if (!getToken() || !getActiveUser()) {
    showToast('Inicia sesión o crea una cuenta para agendar una cita.');
    openAuth('login');
    return;
  }
  if (getActiveUser().role !== '2') {
    showToast('La reserva de citas está disponible para cuentas de paciente.', true);
    return;
  }

  bookingForm.reset();
  bookingForm.elements.doctorId.value = doctor.doctor_id;
  document.querySelector('#booking-doctor-name').textContent =
    `Dr. ${doctor.doctor_first_names} ${doctor.doctor_last_names} · ${doctor.doctor_specialty}`;
  document.querySelector('#booking-doctor-schedule').textContent =
    `Horario de atención: ${scheduleSummary(doctor.schedules)}`;
  const localNow = new Date();
  localNow.setMinutes(localNow.getMinutes() - localNow.getTimezoneOffset());
  bookingForm.elements.appointmentDatetime.min = localNow.toISOString().slice(0, 16);
  setFormMessage(bookingMessage, '');
  bookingDialog.showModal();
}

function appointmentTitle(appointment, isAdmin) {
  if (isAdmin) {
    return `${appointment.user_first_names} ${appointment.user_last_names} · Dr. ${appointment.doctor_first_names} ${appointment.doctor_last_names}`;
  }
  return `Dr. ${appointment.doctor_first_names} ${appointment.doctor_last_names}`;
}

function appointmentDetail(appointment, isAdmin) {
  const personOrSpecialty = isAdmin
    ? `${appointment.user_email || 'Paciente'} · ${appointment.doctor_specialty || 'Consulta'}`
    : (appointment.doctor_specialty || 'Consulta');
  return `${personOrSpecialty} · ${formatCurrency(appointment.appointment_fee)}`;
}

function createAppointmentInfo(appointment, isAdmin) {
  const info = document.createElement('div');
  info.className = 'appointment-info';
  const title = document.createElement('h3');
  title.textContent = appointmentTitle(appointment, isAdmin);
  const date = document.createElement('p');
  date.textContent = formatDate(appointment.appointment_datetime);
  const detail = document.createElement('p');
  detail.textContent = appointmentDetail(appointment, isAdmin);
  const status = document.createElement('span');
  status.className = `appointment-status ${appointment.appointment_status}`;
  status.textContent = appointment.appointment_status;
  info.append(title, date, detail, status);

  if (isAdmin && appointment.user_email) {
    const email = document.createElement('p');
    email.textContent = appointment.user_email;
    info.append(email);
  }
  return info;
}

function createAppointmentActions(appointment, isAdmin) {
  const actions = document.createElement('div');
  actions.className = 'admin-record-actions';

  if (isAdmin && appointment.appointment_status === 'scheduled') {
    actions.append(
      makeActionButton('Marcar atendida', 'button-primary', () => updateAppointmentStatus(appointment.appointment_id, 'completed')),
      makeActionButton('Cancelar cita', 'cancel-button', () => updateAppointmentStatus(appointment.appointment_id, 'canceled'))
    );
  }
  if (isAdmin && appointment.appointment_status !== 'canceled') {
    actions.append(makeActionButton('Registrar examen', 'button-outline', () => openExamForm(appointment.appointment_id)));
  } else if (!isAdmin && isAppointmentCancelable(appointment)) {
    actions.append(makeActionButton('Cancelar cita', 'cancel-button', () => cancelAppointment(appointment.appointment_id)));
  } else if (!isAdmin && appointment.appointment_status === 'completed') {
    actions.append(makeActionButton('Calificar atención', 'button-outline', () => openReviewForm(appointment.appointment_id)));
  }
  return actions;
}

function isAppointmentCancelable(appointment) {
  const appointmentDate = new Date(String(appointment.appointment_datetime).replace(' ', 'T'));
  return appointment.appointment_status === 'scheduled' && appointmentDate >= new Date();
}

function renderAppointments(items, isAdmin, target = appointmentList) {
  target.replaceChildren();
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = isAdmin
      ? 'No hay citas registradas para hoy.'
      : 'Todavía no tienes citas. Puedes agendar una con cualquiera de nuestros médicos.';
    target.append(empty);
    return;
  }

  for (const appointment of items) {
    const card = document.createElement('article');
    card.className = 'appointment-card';
    const info = createAppointmentInfo(appointment, isAdmin);
    const actions = createAppointmentActions(appointment, isAdmin);
    card.append(info);
    if (actions.childElementCount) card.append(actions);
    target.append(card);
  }
}

function getPatientAppointmentEndpoint() {
  if (appointmentView === 'history') return '/appointments/me/history';
  if (appointmentView === 'all') return '/appointments/me';
  return '/appointments/me/upcoming';
}

export async function loadAppointments() {
  if (!getActiveUser() || !getToken()) return;
  const isAdmin = getActiveUser().role === '1';
  const target = isAdmin ? adminAppointmentList : appointmentList;
  target.innerHTML = '<div class="loading-card">Cargando citas…</div>';
  try {
    const endpoint = isAdmin ? '/appointments/admin/today' : getPatientAppointmentEndpoint();
    const result = await apiRequest(endpoint, { authenticated: true });
    renderAppointments(result.appointments || [], isAdmin, target);
    if (!isAdmin) loadExamResults();
  } catch (error) {
    target.replaceChildren();
    const message = document.createElement('div');
    message.className = 'empty-state';
    message.textContent = error.message;
    target.append(message);
  }
}

async function updateAppointmentStatus(appointmentId, status) {
  const prompt = status === 'completed' ? '¿Confirmas que esta cita fue atendida?' : '¿Quieres cancelar esta cita?';
  if (!window.confirm(prompt)) return;
  try {
    await apiRequest(`/appointments/${appointmentId}`, {
      method: 'PATCH',
      authenticated: true,
      body: { status }
    });
    showToast(status === 'completed' ? 'Cita marcada como atendida.' : 'Cita cancelada.');
    await loadAppointments();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function cancelAppointment(appointmentId) {
  if (!window.confirm('¿Quieres cancelar esta cita?')) return;
  try {
    await apiRequest(`/appointments/${appointmentId}`, {
      method: 'PATCH',
      authenticated: true,
      body: { status: 'canceled' }
    });
    showToast('La cita se canceló correctamente.');
    await loadAppointments();
  } catch (error) {
    showToast(error.message, true);
  }
}

export function bindAppointmentEvents() {
  document.querySelector('#booking-close').addEventListener('click', () => bookingDialog.close());
  document.querySelector('#my-appointments-link').addEventListener('click', () => {
    if (getActiveUser()?.role === '1') {
      setAdminMode('agenda');
      document.querySelector('#admin-section').scrollIntoView({ behavior: 'smooth' });
      return;
    }
    appointmentSection.scrollIntoView({ behavior: 'smooth' });
    loadAppointments();
  });
  document.querySelector('#refresh-appointments').addEventListener('click', loadAppointments);
  document.querySelectorAll('[data-appointment-view]').forEach((button) => {
    button.addEventListener('click', () => {
      appointmentView = button.dataset.appointmentView;
      document.querySelectorAll('[data-appointment-view]').forEach((tab) => {
        tab.classList.toggle('active', tab === button);
      });
      loadAppointments();
    });
  });
  bookingForm.addEventListener('submit', (event) => {
    event.preventDefault();
    runFormSubmission(bookingForm, bookingMessage, async (formData) => {
      await apiRequest('/appointments', {
        method: 'POST',
        authenticated: true,
        body: {
          doctorId: Number(formData.get('doctorId')),
          appointmentDatetime: toApiDateTime(formData.get('appointmentDatetime')),
          reason: formData.get('reason') || undefined
        }
      });
      bookingDialog.close();
      bookingForm.reset();
      showToast('Tu cita quedó agendada.');
      await loadAppointments();
      appointmentSection.scrollIntoView({ behavior: 'smooth' });
    });
  });
}
