import { apiRequest } from './api.js';
import { getActiveUser } from './authState.js';
import { openBooking } from './appointments.js';
import { loadDoctorReviews, loadFeaturedReviews } from './reviews.js';
import {
  DOCTORS_INITIAL_PAGE_SIZE,
  DOCTOR_HIGHLIGHT_DURATION_MS,
  MAX_DOCTOR_SUGGESTIONS,
  MIN_SEARCH_LENGTH
} from './constants.js';
import { formatCurrency, initials, normalizeSearchText, scheduleMatchesDayAndTime, scheduleSummary } from './formatters.js';
import { createCarousel } from './ui.js';

const doctorList = document.querySelector('#doctor-list');
const publicDoctorSpecialty = document.querySelector('#public-doctor-specialty');
const publicDoctorDay = document.querySelector('#public-doctor-day');
const publicDoctorTime = document.querySelector('#public-doctor-time');
const doctorCatalogStatus = document.querySelector('#doctor-catalog-status');
const doctorsShowMore = document.querySelector('#doctors-show-more');
const doctorSearchForm = document.querySelector('#doctor-search-form');
const doctorSearchInput = document.querySelector('#doctor-search-input');
const doctorSuggestions = document.querySelector('#doctor-suggestions');
const doctorSearchStatus = document.querySelector('#doctor-search-status');

const doctorCarousel = createCarousel({
  track: doctorList,
  previousButton: document.querySelector('#doctors-previous'),
  nextButton: document.querySelector('#doctors-next')
});

let doctors = [];
let doctorVisibleCount = DOCTORS_INITIAL_PAGE_SIZE;
let doctorsLoaded = false;
let doctorLoadError = '';
let activeSuggestionIndex = -1;

export function getDoctors() {
  return doctors;
}

export function isDoctorsLoaded() {
  return doctorsLoaded;
}

export function getDoctorLoadError() {
  return doctorLoadError;
}

function getPublicFilteredDoctors() {
  const specialty = publicDoctorSpecialty.value;
  const selectedDay = publicDoctorDay.value;
  const selectedTime = publicDoctorTime.value;
  return doctors.filter((doctor) => {
    if (specialty && doctor.doctor_specialty !== specialty) return false;
    return scheduleMatchesDayAndTime(doctor.schedules, selectedDay, selectedTime);
  });
}

function updatePublicDoctorSpecialties() {
  const selectedSpecialty = publicDoctorSpecialty.value;
  const specialties = [...new Set(doctors.map((doctor) => doctor.doctor_specialty).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, 'es'));
  publicDoctorSpecialty.replaceChildren(new Option('Todas las especialidades', ''));
  for (const specialty of specialties) {
    publicDoctorSpecialty.add(new Option(specialty, specialty));
  }
  if (specialties.includes(selectedSpecialty)) publicDoctorSpecialty.value = selectedSpecialty;
}

function matchingDoctors(query) {
  const normalizedQuery = normalizeSearchText(query.trim());
  if (!normalizedQuery) return [];
  return getPublicFilteredDoctors().filter((doctor) => {
    const name = `${doctor.doctor_first_names} ${doctor.doctor_last_names}`;
    return normalizeSearchText(`${name} ${doctor.doctor_specialty}`).includes(normalizedQuery);
  });
}

function closeDoctorSuggestions() {
  doctorSuggestions.replaceChildren();
  doctorSuggestions.classList.add('hidden');
  doctorSearchInput.setAttribute('aria-expanded', 'false');
  doctorSearchInput.removeAttribute('aria-activedescendant');
  activeSuggestionIndex = -1;
}

function selectDoctorSuggestion(doctor) {
  closeDoctorSuggestions();
  doctorSearchStatus.textContent = `Profesional seleccionado: Dr. ${doctor.doctor_first_names} ${doctor.doctor_last_names}.`;
  renderDoctors(doctor.doctor_id);
  window.requestAnimationFrame(() => {
    const card = Array.from(doctorList.children)
      .find((item) => item.dataset.doctorId === String(doctor.doctor_id));
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('doctor-card-highlight');
    window.setTimeout(() => card.classList.remove('doctor-card-highlight'), DOCTOR_HIGHLIGHT_DURATION_MS);
  });
}

function createSuggestionOption(doctor, index) {
  const option = document.createElement('button');
  option.type = 'button';
  option.id = `doctor-suggestion-${doctor.doctor_id}`;
  option.className = 'doctor-suggestion';
  option.setAttribute('role', 'option');
  option.setAttribute('aria-selected', 'false');
  const name = document.createElement('strong');
  name.textContent = `Dr. ${doctor.doctor_first_names} ${doctor.doctor_last_names}`;
  const specialty = document.createElement('span');
  specialty.textContent = doctor.doctor_specialty;
  option.append(name, specialty);
  option.addEventListener('click', () => selectDoctorSuggestion(doctor));
  option.dataset.suggestionIndex = String(index);
  return option;
}

function updateDoctorSearch() {
  const query = doctorSearchInput.value.trim();
  const normalizedQuery = normalizeSearchText(query);
  activeSuggestionIndex = -1;
  doctorVisibleCount = DOCTORS_INITIAL_PAGE_SIZE;
  renderDoctors();

  if (doctorLoadError) {
    closeDoctorSuggestions();
    doctorSearchStatus.textContent = doctorLoadError;
    return;
  }

  if (normalizedQuery.length < MIN_SEARCH_LENGTH) {
    closeDoctorSuggestions();
    doctorSearchStatus.textContent = query
      ? 'Escribe al menos dos letras para ver sugerencias.'
      : 'Busca entre los profesionales disponibles.';
    return;
  }

  if (!doctorsLoaded) {
    closeDoctorSuggestions();
    doctorSearchStatus.textContent = 'Cargando profesionales para buscar…';
    return;
  }

  const matches = matchingDoctors(query);
  if (!matches.length) {
    closeDoctorSuggestions();
    doctorSearchStatus.textContent = query.length >= MIN_SEARCH_LENGTH && getPublicFilteredDoctors().length
      ? 'No encontramos médicos con ese nombre o especialidad dentro de los filtros seleccionados.'
      : 'No hay médicos que coincidan con los filtros de especialidad y horario.';
    return;
  }

  const suggestions = matches.slice(0, MAX_DOCTOR_SUGGESTIONS);
  doctorSuggestions.replaceChildren(...suggestions.map(createSuggestionOption));
  doctorSuggestions.classList.remove('hidden');
  doctorSearchInput.setAttribute('aria-expanded', 'true');
  doctorSearchStatus.textContent = `${matches.length} profesional${matches.length === 1 ? '' : 'es'} encontrado${matches.length === 1 ? '' : 's'}.`;
}

function setActiveSuggestion(index) {
  const options = Array.from(doctorSuggestions.querySelectorAll('[role="option"]'));
  if (!options.length) return;
  activeSuggestionIndex = (index + options.length) % options.length;
  options.forEach((option, optionIndex) => {
    const isActive = optionIndex === activeSuggestionIndex;
    option.setAttribute('aria-selected', String(isActive));
    if (isActive) {
      doctorSearchInput.setAttribute('aria-activedescendant', option.id);
      option.scrollIntoView({ block: 'nearest' });
    }
  });
}

function createDoctorCard(doctor) {
  const card = document.createElement('article');
  card.className = 'doctor-card';
  card.dataset.doctorId = String(doctor.doctor_id);

  const top = document.createElement('div');
  top.className = 'doctor-top';
  const avatar = document.createElement('span');
  avatar.className = 'doctor-avatar';
  avatar.textContent = initials(doctor);
  const specialty = document.createElement('span');
  specialty.className = 'specialty-pill';
  specialty.textContent = doctor.doctor_specialty;
  top.append(avatar, specialty);

  const name = document.createElement('h3');
  name.textContent = `Dr. ${doctor.doctor_first_names} ${doctor.doctor_last_names}`;
  const description = document.createElement('p');
  description.className = 'doctor-description';
  description.textContent = doctor.doctor_description || 'Atención profesional y cercana para acompañar tu bienestar.';

  const meta = document.createElement('div');
  meta.className = 'doctor-meta';
  const fee = document.createElement('span');
  fee.className = 'fee';
  fee.textContent = formatCurrency(doctor.doctor_consultation_fee);
  const feeHint = document.createElement('small');
  feeHint.textContent = ' / consulta';
  fee.append(feeHint);
  const schedule = document.createElement('span');
  schedule.className = 'schedule-note';
  schedule.textContent = scheduleSummary(doctor.schedules);
  meta.append(fee, schedule);

  const button = document.createElement('button');
  button.className = 'button button-primary';
  button.type = 'button';
  button.textContent = getActiveUser()?.role === '2' ? 'Agendar consulta' : 'Elegir médico';
  button.addEventListener('click', () => openBooking(doctor));

  const reviews = document.createElement('details');
  reviews.className = 'doctor-reviews';
  const reviewsSummary = document.createElement('summary');
  reviewsSummary.textContent = 'Ver reseñas';
  reviews.append(reviewsSummary);
  reviews.addEventListener('toggle', () => {
    if (reviews.open && !reviews.dataset.loaded) loadDoctorReviews(doctor.doctor_id, reviews);
  });

  card.append(top, name, description, meta, button, reviews);
  return card;
}

function createDoctorEmptyState(query) {
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  if (!doctorsLoaded) {
    empty.textContent = 'Cargando médicos…';
  } else if (doctorLoadError) {
    empty.textContent = doctorLoadError;
  } else if (query.length >= MIN_SEARCH_LENGTH) {
    empty.textContent = 'No se encontraron profesionales que coincidan con la búsqueda y los filtros.';
  } else {
    empty.textContent = 'No hay médicos disponibles con la especialidad y horario seleccionados.';
  }
  return empty;
}

export function renderDoctors(includeDoctorId = null, preserveScroll = false) {
  const previousScrollLeft = preserveScroll ? doctorList.scrollLeft : 0;
  const query = doctorSearchInput.value.trim();
  const matching = query.length >= MIN_SEARCH_LENGTH ? matchingDoctors(query) : getPublicFilteredDoctors();
  const visibleDoctors = matching.slice(0, doctorVisibleCount);

  if (includeDoctorId !== null && !visibleDoctors.some((doctor) => String(doctor.doctor_id) === String(includeDoctorId))) {
    const selectedDoctor = matching.find((doctor) => String(doctor.doctor_id) === String(includeDoctorId));
    if (selectedDoctor) visibleDoctors.push(selectedDoctor);
  }

  if (!matching.length) {
    doctorList.replaceChildren(createDoctorEmptyState(query));
    doctorCatalogStatus.textContent = '';
    doctorsShowMore.classList.add('hidden');
    doctorCarousel.update();
    return;
  }

  doctorList.replaceChildren(...visibleDoctors.map(createDoctorCard));
  doctorList.scrollLeft = previousScrollLeft;
  doctorCatalogStatus.textContent = query.length >= MIN_SEARCH_LENGTH
    ? `Mostrando ${visibleDoctors.length} de ${matching.length} profesional${matching.length === 1 ? '' : 'es'} encontrado${matching.length === 1 ? '' : 's'}.`
    : `Mostrando ${visibleDoctors.length} de ${matching.length} médicos disponibles.`;
  doctorsShowMore.textContent = query.length >= MIN_SEARCH_LENGTH ? 'Ver más resultados' : 'Ver más médicos';
  doctorsShowMore.classList.toggle('hidden', visibleDoctors.length >= matching.length);
  window.requestAnimationFrame(() => doctorCarousel.update());
}

export async function loadDoctors() {
  try {
    const result = await apiRequest('/doctors');
    doctors = result.doctors || [];
    updatePublicDoctorSpecialties();
    doctorsLoaded = true;
    doctorLoadError = '';
    renderDoctors();
    loadFeaturedReviews();
    if (doctorSearchInput.value.trim().length >= MIN_SEARCH_LENGTH) updateDoctorSearch();
  } catch (error) {
    doctorsLoaded = true;
    doctorLoadError = error.message;
    doctors = [];
    renderDoctors();
    doctorSearchStatus.textContent = 'No se pudo cargar el catálogo de profesionales.';
    loadFeaturedReviews();
  }
}

function applyPublicDoctorFilters() {
  doctorVisibleCount = DOCTORS_INITIAL_PAGE_SIZE;
  if (doctorSearchInput.value.trim().length >= MIN_SEARCH_LENGTH) updateDoctorSearch();
  else renderDoctors();
}

export function bindDoctorEvents() {
  doctorSearchInput.addEventListener('input', updateDoctorSearch);
  [publicDoctorSpecialty, publicDoctorDay, publicDoctorTime].forEach((input) => {
    input.addEventListener(input.tagName === 'SELECT' ? 'change' : 'input', applyPublicDoctorFilters);
  });
  document.querySelector('#public-doctor-filter-clear').addEventListener('click', () => {
    publicDoctorSpecialty.value = '';
    publicDoctorDay.value = '';
    publicDoctorTime.value = '';
    applyPublicDoctorFilters();
  });
  doctorSearchInput.addEventListener('keydown', (event) => {
    const options = doctorSuggestions.querySelectorAll('[role="option"]');
    if (event.key === 'ArrowDown' && options.length) {
      event.preventDefault();
      setActiveSuggestion(activeSuggestionIndex + 1);
    } else if (event.key === 'ArrowUp' && options.length) {
      event.preventDefault();
      setActiveSuggestion(activeSuggestionIndex < 0 ? options.length - 1 : activeSuggestionIndex - 1);
    } else if (event.key === 'Enter' && options.length) {
      event.preventDefault();
      const option = options[activeSuggestionIndex < 0 ? 0 : activeSuggestionIndex];
      const doctor = doctors.find((item) => String(item.doctor_id) === option.id.replace('doctor-suggestion-', ''));
      if (doctor) selectDoctorSuggestion(doctor);
    } else if (event.key === 'Escape') {
      closeDoctorSuggestions();
    }
  });
  doctorSearchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const match = matchingDoctors(doctorSearchInput.value)[0];
    if (match) {
      selectDoctorSuggestion(match);
    } else if (doctorSearchInput.value.trim().length < MIN_SEARCH_LENGTH) {
      doctorSearchStatus.textContent = 'Escribe al menos dos letras para buscar un médico.';
      doctorSearchInput.focus();
    } else {
      updateDoctorSearch();
    }
  });
  document.addEventListener('pointerdown', (event) => {
    if (!doctorSearchForm.contains(event.target)) closeDoctorSuggestions();
  });
  document.querySelector('#doctors-previous').addEventListener('click', () => doctorCarousel.scroll(-1));
  document.querySelector('#doctors-next').addEventListener('click', () => doctorCarousel.scroll(1));
  doctorsShowMore.addEventListener('click', () => {
    doctorVisibleCount += DOCTORS_INITIAL_PAGE_SIZE;
    renderDoctors(null, true);
  });
  doctorList.addEventListener('scroll', () => doctorCarousel.update(), { passive: true });
  window.addEventListener('resize', () => doctorCarousel.update());
}
