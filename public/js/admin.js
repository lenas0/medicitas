import { apiRequest } from './api.js';
import { getActiveUser, getToken } from './authState.js';
import { loadAppointments } from './appointments.js';
import { loadDoctors } from './doctors.js';
import { ADMIN_RECORDS_PAGE_SIZE, DAY_NAMES_LONG, LAST_THIRTY_DAYS_OFFSET } from './constants.js';
import { formatCurrency, formatDate, formatDateInput, normalizeSearchText, scheduleMatchesDayAndTime } from './formatters.js';
import { makeActionButton, runFormSubmission, setFormMessage, showToast } from './ui.js';

const adminRecordSearch = document.querySelector('#admin-record-search');
const adminDoctorFilters = document.querySelector('#admin-doctor-filters');
const adminDoctorSpecialty = document.querySelector('#admin-doctor-specialty');
const adminDoctorFeeMin = document.querySelector('#admin-doctor-fee-min');
const adminDoctorFeeMax = document.querySelector('#admin-doctor-fee-max');
const adminDoctorDay = document.querySelector('#admin-doctor-day');
const adminDoctorTime = document.querySelector('#admin-doctor-time');
const adminRecordsStatus = document.querySelector('#admin-records-status');
const adminRecordsShowMore = document.querySelector('#admin-records-show-more');
const adminList = document.querySelector('#admin-list');
const patientDialog = document.querySelector('#patient-dialog');
const patientForm = document.querySelector('#patient-form');
const patientMessage = document.querySelector('#patient-message');
const doctorDialog = document.querySelector('#doctor-dialog');
const doctorForm = document.querySelector('#doctor-form');
const doctorMessage = document.querySelector('#doctor-message');

const ADMIN_MODES = ['patients', 'doctors', 'agenda', 'income'];

const ADMIN_SECTIONS = {
  patients: {
    listTitle: 'Pacientes registrados',
    description: 'Consulta y actualiza la información de los pacientes.',
    createLabel: 'Agregar paciente',
    searchPlaceholder: 'Nombre, correo o teléfono'
  },
  doctors: {
    listTitle: 'Profesionales médicos',
    description: 'Consulta, incorpora o actualiza el directorio y los horarios profesionales.',
    createLabel: 'Agregar médico',
    searchPlaceholder: 'Nombre, especialidad o descripción'
  },
  agenda: {
    listTitle: 'Agenda de hoy',
    description: 'Consulta y supervisa las citas programadas para hoy.',
    createLabel: 'Agregar médico',
    searchPlaceholder: 'Nombre, especialidad o descripción'
  },
  income: {
    listTitle: 'Control de ingresos por atenciones',
    description: 'Consulta el total de citas completadas entre dos fechas.',
    createLabel: 'Agregar médico',
    searchPlaceholder: 'Nombre, especialidad o descripción'
  }
};

let adminMode = 'patients';
let adminPatients = [];
let adminDoctors = [];
let adminVisibleRecordCount = ADMIN_RECORDS_PAGE_SIZE;

function resetAdminFilters() {
  adminVisibleRecordCount = ADMIN_RECORDS_PAGE_SIZE;
  adminRecordSearch.value = '';
  adminDoctorSpecialty.value = '';
  adminDoctorFeeMin.value = '';
  adminDoctorFeeMax.value = '';
  adminDoctorDay.value = '';
  adminDoctorTime.value = '';
}

function toggleAdminTab(mode, isActive) {
  const tab = document.querySelector(`#${mode}-tab`);
  tab.classList.toggle('active', isActive);
  tab.setAttribute('aria-selected', String(isActive));
}

export function setAdminMode(mode) {
  if (mode !== adminMode) resetAdminFilters();
  adminMode = mode;

  ADMIN_MODES.forEach((name) => toggleAdminTab(name, name === mode));

  const section = ADMIN_SECTIONS[mode];
  const showingRecords = mode === 'patients' || mode === 'doctors';
  document.querySelector('#admin-list-title').textContent = section.listTitle;
  document.querySelector('#admin-list-description').textContent = section.description;
  document.querySelector('#admin-create-button').classList.toggle('hidden', !showingRecords);
  adminList.classList.toggle('hidden', !showingRecords);
  document.querySelector('.admin-records-footer').classList.toggle('hidden', !showingRecords);
  document.querySelector('#admin-panel-heading').classList.toggle('hidden', !showingRecords);
  document.querySelector('#admin-record-filters').classList.toggle('hidden', !showingRecords);
  adminDoctorFilters.classList.toggle('hidden', mode !== 'doctors');
  adminRecordSearch.placeholder = section.searchPlaceholder;
  document.querySelector('#admin-agenda').classList.toggle('hidden', mode !== 'agenda');
  document.querySelector('#income-dashboard').classList.toggle('hidden', mode !== 'income');
  document.querySelector('#admin-create-button').textContent = section.createLabel;

  if (showingRecords) loadAdminRecords();
  if (mode === 'agenda') loadAppointments();
}

async function loadAdminRecords() {
  if (!getActiveUser() || getActiveUser().role !== '1' || !getToken()) return;
  const requestedMode = adminMode;
  adminVisibleRecordCount = ADMIN_RECORDS_PAGE_SIZE;
  adminRecordsStatus.textContent = '';
  adminRecordsShowMore.classList.add('hidden');
  adminList.innerHTML = '<div class="loading-card">Cargando información…</div>';
  try {
    if (requestedMode === 'patients') {
      const { patients = [] } = await apiRequest('/admin/patients', { authenticated: true });
      if (adminMode !== requestedMode) return;
      adminPatients = patients;
      renderPatients();
    } else {
      const { doctors: records = [] } = await apiRequest('/admin/doctors', { authenticated: true });
      if (adminMode !== requestedMode) return;
      adminDoctors = records;
      renderAdminDoctors();
    }
  } catch (error) {
    if (adminMode === requestedMode) renderAdminEmpty(error.message);
  }
}

function renderAdminEmpty(message) {
  adminList.replaceChildren();
  adminRecordsStatus.textContent = '';
  adminRecordsShowMore.classList.add('hidden');
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  empty.textContent = message;
  adminList.append(empty);
}

function createPatientCard(patient) {
  const card = document.createElement('article');
  card.className = 'admin-record';
  const name = document.createElement('h4');
  name.textContent = `${patient.user_first_names} ${patient.user_last_names}`;
  const email = document.createElement('p');
  email.textContent = patient.user_email;
  const phone = document.createElement('p');
  phone.textContent = patient.user_phone || 'Sin teléfono registrado';
  const actions = document.createElement('div');
  actions.className = 'admin-record-actions';
  actions.append(makeActionButton('Actualizar información', 'button-outline', () => openPatientForm(patient)));
  card.append(name, email, phone, actions);
  return card;
}

function updateRecordsFooter(visibleCount, totalCount, label) {
  adminRecordsStatus.textContent = `Mostrando ${visibleCount} de ${totalCount} ${label}.`;
  adminRecordsShowMore.textContent = `Ver más ${label}`;
  adminRecordsShowMore.classList.toggle('hidden', visibleCount >= totalCount);
}

function renderPatients() {
  const query = normalizeSearchText(adminRecordSearch.value.trim());
  const matchingPatients = adminPatients.filter((patient) =>
    normalizeSearchText(`${patient.user_first_names} ${patient.user_last_names} ${patient.user_email} ${patient.user_phone || ''}`).includes(query)
  );
  adminList.replaceChildren();
  if (!matchingPatients.length) {
    renderAdminEmpty(adminPatients.length ? 'No hay pacientes que coincidan con la búsqueda.' : 'Todavía no hay pacientes registrados.');
    return;
  }
  const patients = matchingPatients.slice(0, adminVisibleRecordCount);
  updateRecordsFooter(patients.length, matchingPatients.length, 'pacientes');
  for (const patient of patients) {
    adminList.append(createPatientCard(patient));
  }
}

function openPatientForm(patient = null) {
  patientForm.reset();
  patientForm.elements.patientId.value = patient?.user_id || '';
  patientForm.elements.firstNames.value = patient?.user_first_names || '';
  patientForm.elements.lastNames.value = patient?.user_last_names || '';
  patientForm.elements.email.value = patient?.user_email || '';
  patientForm.elements.phone.value = patient?.user_phone || '';
  patientForm.elements.password.required = !patient;
  patientForm.elements.password.value = '';
  document.querySelector('#patient-dialog-title').textContent = patient ? 'Actualizar paciente' : 'Agregar paciente';
  document.querySelector('#patient-password-optional').textContent = patient ? '(opcional)' : '(obligatoria)';
  patientForm.querySelector('button[type="submit"]').textContent = patient ? 'Guardar cambios' : 'Crear paciente';
  setFormMessage(patientMessage, '');
  patientDialog.showModal();
}

function updateAdminDoctorSpecialties() {
  const selectedSpecialty = adminDoctorSpecialty.value;
  const specialties = [...new Set(adminDoctors.map((doctor) => doctor.doctor_specialty).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, 'es'));
  adminDoctorSpecialty.replaceChildren(new Option('Todas', ''));
  for (const specialty of specialties) {
    adminDoctorSpecialty.add(new Option(specialty, specialty));
  }
  if (specialties.includes(selectedSpecialty)) adminDoctorSpecialty.value = selectedSpecialty;
}

function readAdminDoctorFilters() {
  return {
    query: normalizeSearchText(adminRecordSearch.value.trim()),
    specialty: adminDoctorSpecialty.value,
    minimumFee: adminDoctorFeeMin.value === '' ? null : Number(adminDoctorFeeMin.value),
    maximumFee: adminDoctorFeeMax.value === '' ? null : Number(adminDoctorFeeMax.value),
    day: adminDoctorDay.value,
    time: adminDoctorTime.value
  };
}

function matchesDoctorFilters(doctor, filters) {
  const searchableText = normalizeSearchText(
    `${doctor.doctor_first_names} ${doctor.doctor_last_names} ${doctor.doctor_specialty} ${doctor.doctor_description || ''}`
  );
  if (filters.query && !searchableText.includes(filters.query)) return false;
  if (filters.specialty && doctor.doctor_specialty !== filters.specialty) return false;

  const fee = Number(doctor.doctor_consultation_fee);
  if ((filters.minimumFee !== null || filters.maximumFee !== null) && !Number.isFinite(fee)) return false;
  if (filters.minimumFee !== null && fee < filters.minimumFee) return false;
  if (filters.maximumFee !== null && fee > filters.maximumFee) return false;

  return scheduleMatchesDayAndTime(doctor.schedules, filters.day, filters.time);
}

function createScheduleList(doctor) {
  const scheduleList = document.createElement('div');
  scheduleList.className = 'schedule-list';
  if (!doctor.schedules?.length) {
    const noSchedule = document.createElement('p');
    noSchedule.textContent = 'Sin horarios registrados.';
    scheduleList.append(noSchedule);
    return scheduleList;
  }

  for (const schedule of doctor.schedules) {
    const row = document.createElement('div');
    row.className = 'schedule-row';
    const label = document.createElement('span');
    const day = DAY_NAMES_LONG[Number(schedule.schedule_day_of_week) - 1];
    const start = String(schedule.schedule_start_time).slice(0, 5);
    const end = String(schedule.schedule_end_time).slice(0, 5);
    label.textContent = `${day} · ${start}–${end}`;
    row.append(label, makeActionButton('Quitar', '', () => deleteDoctorSchedule(doctor, schedule)));
    scheduleList.append(row);
  }
  return scheduleList;
}

function createScheduleForm(doctor) {
  const scheduleForm = document.createElement('form');
  scheduleForm.className = 'schedule-form';
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = 'Agregar horario';
  details.append(summary);

  const fields = document.createElement('div');
  fields.className = 'schedule-fields';
  const dayLabel = document.createElement('label');
  dayLabel.textContent = 'Día';
  const daySelect = document.createElement('select');
  daySelect.name = 'dayOfWeek';
  daySelect.required = true;
  DAY_NAMES_LONG.forEach((day, index) => {
    const option = document.createElement('option');
    option.value = String(index + 1);
    option.textContent = day;
    daySelect.append(option);
  });
  dayLabel.append(daySelect);

  const startLabel = document.createElement('label');
  startLabel.textContent = 'Desde';
  const startInput = document.createElement('input');
  startInput.type = 'time';
  startInput.name = 'startTime';
  startInput.required = true;
  startLabel.append(startInput);

  const endLabel = document.createElement('label');
  endLabel.textContent = 'Hasta';
  const endInput = document.createElement('input');
  endInput.type = 'time';
  endInput.name = 'endTime';
  endInput.required = true;
  endLabel.append(endInput);

  fields.append(dayLabel, startLabel, endLabel);

  const scheduleSubmit = document.createElement('button');
  scheduleSubmit.className = 'button button-primary';
  scheduleSubmit.type = 'submit';
  scheduleSubmit.textContent = 'Guardar horario';
  fields.append(scheduleSubmit);
  details.append(fields);
  scheduleForm.append(details);
  scheduleForm.addEventListener('submit', (event) => {
    event.preventDefault();
    addDoctorSchedule(doctor, scheduleForm, scheduleSubmit);
  });
  return scheduleForm;
}

function createAdminDoctorCard(doctor) {
  const card = document.createElement('article');
  card.className = 'admin-record';
  const top = document.createElement('div');
  top.className = 'admin-record-top';
  const identity = document.createElement('div');
  const name = document.createElement('h4');
  name.textContent = `Dr. ${doctor.doctor_first_names} ${doctor.doctor_last_names}`;
  const specialty = document.createElement('p');
  specialty.textContent = doctor.doctor_specialty;
  identity.append(name, specialty);
  const state = document.createElement('span');
  state.className = `record-state${doctor.doctor_active ? '' : ' inactive'}`;
  state.textContent = doctor.doctor_active ? 'Activo' : 'Inactivo';
  top.append(identity, state);

  const description = document.createElement('p');
  description.textContent = doctor.doctor_description || 'Sin descripción.';
  const fee = document.createElement('p');
  fee.textContent = `Consulta: ${formatCurrency(doctor.doctor_consultation_fee)}`;

  const actions = document.createElement('div');
  actions.className = 'admin-record-actions';
  actions.append(makeActionButton('Editar profesional', 'button-outline', () => openDoctorForm(doctor)));

  card.append(top, description, fee, createScheduleList(doctor), actions, createScheduleForm(doctor));
  return card;
}

function renderAdminDoctors() {
  updateAdminDoctorSpecialties();
  const filters = readAdminDoctorFilters();
  const records = adminDoctors.filter((doctor) => matchesDoctorFilters(doctor, filters));
  adminList.replaceChildren();
  if (!records.length) {
    renderAdminEmpty(adminDoctors.length ? 'No hay profesionales que coincidan con los filtros seleccionados.' : 'Todavía no hay profesionales registrados.');
    return;
  }
  const visibleRecords = records.slice(0, adminVisibleRecordCount);
  updateRecordsFooter(visibleRecords.length, records.length, 'médicos');
  for (const doctor of visibleRecords) {
    adminList.append(createAdminDoctorCard(doctor));
  }
}

function openDoctorForm(doctor = null) {
  doctorForm.reset();
  doctorForm.elements.doctorId.value = doctor?.doctor_id || '';
  doctorForm.elements.firstNames.value = doctor?.doctor_first_names || '';
  doctorForm.elements.lastNames.value = doctor?.doctor_last_names || '';
  doctorForm.elements.specialty.value = doctor?.doctor_specialty || '';
  doctorForm.elements.description.value = doctor?.doctor_description || '';
  doctorForm.elements.consultationFee.value = doctor?.doctor_consultation_fee ?? '';
  doctorForm.elements.active.checked = doctor ? Boolean(doctor.doctor_active) : true;
  document.querySelector('#doctor-dialog-title').textContent = doctor ? 'Actualizar profesional' : 'Agregar médico';
  doctorForm.querySelector('button[type="submit"]').textContent = doctor ? 'Guardar cambios' : 'Crear médico';
  setFormMessage(doctorMessage, '');
  doctorDialog.showModal();
}

async function addDoctorSchedule(doctor, form, button) {
  const values = new FormData(form);
  button.disabled = true;
  try {
    await apiRequest(`/doctors/${doctor.doctor_id}/schedules`, {
      method: 'POST',
      authenticated: true,
      body: {
        dayOfWeek: Number(values.get('dayOfWeek')),
        startTime: values.get('startTime'),
        endTime: values.get('endTime')
      }
    });
    showToast('Horario agregado.');
    await loadAdminRecords();
    await loadDoctors();
  } catch (error) {
    showToast(error.message, true);
  } finally {
    button.disabled = false;
  }
}

async function deleteDoctorSchedule(doctor, schedule) {
  if (!window.confirm('¿Quieres quitar este horario?')) return;
  try {
    await apiRequest(`/doctors/${doctor.doctor_id}/schedules/${schedule.schedule_id}`, {
      method: 'DELETE',
      authenticated: true
    });
    showToast('Horario eliminado.');
    await loadAdminRecords();
    await loadDoctors();
  } catch (error) {
    showToast(error.message, true);
  }
}

function createIncomeMetric(metric) {
  const card = document.createElement('article');
  card.className = `income-metric${metric.featured ? ' income-metric-featured' : ''}`;
  const label = document.createElement('span');
  label.textContent = metric.label;
  const value = document.createElement('strong');
  value.textContent = metric.value;
  card.append(label, value);
  return card;
}

function createIncomeSummary(totalAmount, appointmentCount, average) {
  const summary = document.createElement('div');
  summary.className = 'income-summary-grid';
  const metrics = [
    { label: 'Ingresos del período', value: formatCurrency(totalAmount), featured: true },
    { label: 'Atenciones completadas', value: String(appointmentCount) },
    { label: 'Promedio por atención', value: formatCurrency(average) }
  ];
  summary.append(...metrics.map(createIncomeMetric));
  return summary;
}

function createIncomeEmpty() {
  const empty = document.createElement('div');
  empty.className = 'income-empty';
  const title = document.createElement('strong');
  title.textContent = 'No hay atenciones en este período';
  const description = document.createElement('p');
  description.textContent = 'Prueba con otro rango de fechas. Solo aparecen las citas cuyo estado es “completada”.';
  empty.append(title, description);
  return empty;
}

function createIncomeDetailHeading(appointmentCount) {
  const heading = document.createElement('div');
  heading.className = 'income-detail-heading';
  const title = document.createElement('h4');
  title.textContent = 'Detalle de atenciones';
  const count = document.createElement('span');
  count.textContent = `${appointmentCount} registro${appointmentCount === 1 ? '' : 's'}`;
  heading.append(title, count);
  return heading;
}

function createIncomeTable(appointments) {
  const tableWrap = document.createElement('div');
  tableWrap.className = 'income-table-wrap';
  const table = document.createElement('table');
  table.className = 'income-table';

  const head = document.createElement('thead');
  const headerRow = document.createElement('tr');
  for (const heading of ['Fecha y hora', 'Paciente', 'Profesional', 'Ingreso']) {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = heading;
    headerRow.append(cell);
  }
  head.append(headerRow);

  const body = document.createElement('tbody');
  for (const appointment of appointments) {
    const row = document.createElement('tr');
    const date = document.createElement('td');
    date.textContent = formatDate(appointment.appointment_datetime);
    const patient = document.createElement('td');
    patient.textContent = `${appointment.user_first_names} ${appointment.user_last_names}`;
    const doctor = document.createElement('td');
    doctor.textContent = `Dr. ${appointment.doctor_first_names} ${appointment.doctor_last_names}`;
    const fee = document.createElement('td');
    fee.className = 'income-fee-cell';
    fee.textContent = formatCurrency(appointment.appointment_fee);
    row.append(date, patient, doctor, fee);
    body.append(row);
  }

  table.append(head, body);
  tableWrap.append(table);
  return tableWrap;
}

function renderIncomeReport(results, report) {
  results.replaceChildren();
  const appointments = Array.isArray(report.appointments) ? report.appointments : [];
  const totalAmount = Number(report.total) || 0;
  const average = appointments.length ? totalAmount / appointments.length : 0;
  results.append(createIncomeSummary(totalAmount, appointments.length, average));

  if (!appointments.length) {
    results.append(createIncomeEmpty());
    return;
  }
  results.append(createIncomeDetailHeading(appointments.length), createIncomeTable(appointments));
}

async function loadIncomeReport(from, to) {
  const results = document.querySelector('#income-results');
  const submit = document.querySelector('#income-submit');
  const rangeLabel = document.querySelector('#income-range-label');
  submit.disabled = true;
  submit.textContent = 'Consultando…';
  rangeLabel.textContent = `Período: ${formatDate(from)} – ${formatDate(to)}`;
  results.replaceChildren();

  const loading = document.createElement('div');
  loading.className = 'income-loading';
  loading.textContent = 'Consultando citas completadas…';
  results.append(loading);

  try {
    const report = await apiRequest(`/admin/reports/income?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
      authenticated: true
    });
    renderIncomeReport(results, report);
  } catch (error) {
    results.replaceChildren();
    const message = document.createElement('div');
    message.className = 'income-error';
    message.textContent = error.message;
    results.append(message);
  } finally {
    submit.disabled = false;
    submit.textContent = 'Consultar reporte';
  }
}

function renderAdminRecordsView() {
  if (adminMode === 'patients') renderPatients();
  else if (adminMode === 'doctors') renderAdminDoctors();
}

function resetAdminRecordView() {
  adminVisibleRecordCount = ADMIN_RECORDS_PAGE_SIZE;
  renderAdminRecordsView();
}

function applyIncomePreset(period) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const from = new Date(today);
  if (period === 'month') {
    from.setDate(1);
  } else if (period === 'previous-month') {
    from.setMonth(from.getMonth() - 1, 1);
    today.setDate(0);
  } else {
    from.setDate(from.getDate() - LAST_THIRTY_DAYS_OFFSET);
  }

  const incomeForm = document.querySelector('#income-filter');
  const fromInput = incomeForm.elements.from;
  const toInput = incomeForm.elements.to;
  fromInput.value = formatDateInput(from);
  toInput.value = formatDateInput(today);
  loadIncomeReport(fromInput.value, toInput.value);
}

function showIncomeRangeError(message) {
  const results = document.querySelector('#income-results');
  results.replaceChildren();
  const error = document.createElement('div');
  error.className = 'income-error';
  error.textContent = message;
  results.append(error);
}

export function bindAdminEvents() {
  document.querySelector('#patient-close').addEventListener('click', () => patientDialog.close());
  document.querySelector('#doctor-close').addEventListener('click', () => doctorDialog.close());
  document.querySelector('#admin-panel-link').addEventListener('click', () => {
    document.querySelector('#admin-section').scrollIntoView({ behavior: 'smooth' });
    loadAdminRecords();
  });
  ADMIN_MODES.forEach((mode) => {
    document.querySelector(`#${mode}-tab`).addEventListener('click', () => setAdminMode(mode));
  });
  document.querySelector('#admin-refresh').addEventListener('click', loadAdminRecords);
  document.querySelector('#admin-agenda-refresh').addEventListener('click', loadAppointments);

  adminRecordSearch.addEventListener('input', resetAdminRecordView);
  [adminDoctorSpecialty, adminDoctorFeeMin, adminDoctorFeeMax, adminDoctorDay, adminDoctorTime].forEach((input) => {
    input.addEventListener(input.tagName === 'SELECT' ? 'change' : 'input', () => {
      if (adminMode === 'doctors') resetAdminRecordView();
    });
  });
  document.querySelector('#admin-filter-clear').addEventListener('click', () => {
    resetAdminFilters();
    renderAdminRecordsView();
  });
  adminRecordsShowMore.addEventListener('click', () => {
    adminVisibleRecordCount += ADMIN_RECORDS_PAGE_SIZE;
    renderAdminRecordsView();
  });

  document.querySelector('#income-filter').addEventListener('submit', (event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const from = String(values.get('from'));
    const to = String(values.get('to'));
    if (from > to) {
      showIncomeRangeError('La fecha inicial debe ser anterior o igual a la fecha final.');
      return;
    }
    loadIncomeReport(from, to);
  });
  document.querySelectorAll('[data-income-period]').forEach((button) => {
    button.addEventListener('click', () => applyIncomePreset(button.dataset.incomePeriod));
  });

  document.querySelector('#admin-create-button').addEventListener('click', () => {
    if (adminMode === 'patients') openPatientForm();
    else if (adminMode === 'doctors') openDoctorForm();
  });

  patientForm.addEventListener('submit', (event) => {
    event.preventDefault();
    runFormSubmission(patientForm, patientMessage, async (values) => {
      const patientId = values.get('patientId');
      const body = {
        firstNames: values.get('firstNames'),
        lastNames: values.get('lastNames'),
        email: values.get('email'),
        phone: values.get('phone') || null
      };
      if (!patientId || values.get('password')) body.password = values.get('password');
      await apiRequest(patientId ? `/admin/patients/${patientId}` : '/admin/patients', {
        method: patientId ? 'PUT' : 'POST',
        authenticated: true,
        body
      });
      patientDialog.close();
      patientForm.reset();
      showToast(patientId ? 'Información del paciente actualizada.' : 'Paciente registrado correctamente.');
      await loadAdminRecords();
    });
  });

  doctorForm.addEventListener('submit', (event) => {
    event.preventDefault();
    runFormSubmission(doctorForm, doctorMessage, async (values) => {
      const doctorId = values.get('doctorId');
      const body = {
        firstNames: values.get('firstNames'),
        lastNames: values.get('lastNames'),
        specialty: values.get('specialty'),
        description: values.get('description') || null,
        consultationFee: Number(values.get('consultationFee'))
      };
      if (doctorId) body.active = doctorForm.elements.active.checked;
      await apiRequest(doctorId ? `/doctors/${doctorId}` : '/doctors', {
        method: doctorId ? 'PUT' : 'POST',
        authenticated: true,
        body
      });
      doctorDialog.close();
      doctorForm.reset();
      showToast(doctorId ? 'Información del profesional actualizada.' : 'Profesional agregado correctamente.');
      await loadAdminRecords();
      await loadDoctors();
    });
  });
}
