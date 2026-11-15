import { DAY_NAMES_SHORT } from './constants.js';

export function formatCurrency(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount)
    : 'Consultar';
}

export function formatDate(value) {
  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return String(value ?? '');
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

export function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');
}

export function initials(doctor) {
  const firstInitial = doctor.doctor_first_names?.trim().charAt(0) || '';
  const lastInitial = doctor.doctor_last_names?.trim().charAt(0) || '';
  return `${firstInitial}${lastInitial}`.toUpperCase();
}

export function scheduleSummary(schedules = []) {
  if (!schedules.length) return 'Agenda por confirmar';
  return schedules.map((schedule) => {
    const day = DAY_NAMES_SHORT[Number(schedule.schedule_day_of_week) - 1] || '';
    const start = String(schedule.schedule_start_time).slice(0, 5);
    const end = String(schedule.schedule_end_time).slice(0, 5);
    return `${day} ${start}–${end}`;
  }).join(' · ');
}

export function scheduleMatchesDayAndTime(schedules = [], day, time) {
  if (!day && !time) return true;
  return schedules.some((schedule) => {
    if (day && Number(schedule.schedule_day_of_week) !== Number(day)) return false;
    if (!time) return true;
    const start = String(schedule.schedule_start_time).slice(0, 5);
    const end = String(schedule.schedule_end_time).slice(0, 5);
    return start <= time && time < end;
  });
}

export function toApiDateTime(localDateTime) {
  return localDateTime.replace('T', ' ') + ':00';
}
