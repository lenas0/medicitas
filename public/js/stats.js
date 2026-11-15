import { apiRequest } from './api.js';

const catalogDoctorCount = document.querySelector('#catalog-doctor-count');
const registeredPatientCount = document.querySelector('#registered-patient-count');
const statsStatus = document.querySelector('#stats-status');

export async function loadPublicStats() {
  try {
    const stats = await apiRequest('/stats');
    catalogDoctorCount.textContent = String(stats.doctorCount);
    registeredPatientCount.textContent = String(stats.patientCount);
    statsStatus.textContent = '';
  } catch (error) {
    catalogDoctorCount.textContent = '—';
    registeredPatientCount.textContent = '—';
    statsStatus.textContent = `No se pudieron cargar las cantidades: ${error.message}`;
  }
}
