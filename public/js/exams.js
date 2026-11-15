import { apiRequest } from './api.js';
import { getActiveUser, getToken } from './authState.js';
import { loadAppointments } from './appointments.js';
import { formatDate } from './formatters.js';
import { runFormSubmission, showToast } from './ui.js';

const examDialog = document.querySelector('#exam-dialog');
const examForm = document.querySelector('#exam-form');
const examMessage = document.querySelector('#exam-message');

function createExamCard(exam) {
  const card = document.createElement('article');
  card.className = 'exam-card';

  const title = document.createElement('h4');
  title.textContent = exam.exam_name;
  const type = document.createElement('p');
  type.textContent = `${exam.exam_type} · ${formatDate(exam.exam_date)} · Dr. ${exam.doctor_first_names} ${exam.doctor_last_names}`;
  card.append(title, type);

  if (exam.exam_type === 'numeric') {
    const value = document.createElement('p');
    value.className = 'exam-value';
    value.textContent = `${exam.exam_value}${exam.exam_unit ? ` ${exam.exam_unit}` : ''}`;
    const reference = document.createElement('p');
    reference.textContent = `Referencia: ${exam.exam_reference_min}–${exam.exam_reference_max}${exam.exam_unit ? ` ${exam.exam_unit}` : ''}`;
    card.append(value, reference);
    if (exam.exam_quantitative_result) {
      const result = document.createElement('p');
      result.textContent = exam.exam_quantitative_result;
      card.append(result);
    }
  } else if (exam.exam_type === 'qualitative') {
    const result = document.createElement('p');
    result.className = 'exam-value';
    result.textContent = exam.exam_qualitative_result === 'positive' ? 'Positivo' : 'Negativo';
    card.append(result);
  }

  if (exam.exam_report) {
    const report = document.createElement('p');
    report.textContent = exam.exam_report;
    card.append(report);
  }

  if (exam.exam_image_url) {
    const image = document.createElement('a');
    image.href = exam.exam_image_url;
    image.target = '_blank';
    image.rel = 'noopener noreferrer';
    image.textContent = 'Ver imagen de radiología';
    card.append(image);
  }

  return card;
}

export async function loadExamResults() {
  if (!getActiveUser() || getActiveUser().role !== '2' || !getToken()) return;
  const list = document.querySelector('#exam-list');
  list.innerHTML = '<div class="loading-card">Cargando resultados…</div>';
  try {
    const { exams = [] } = await apiRequest('/exams/me', { authenticated: true });
    list.replaceChildren();
    if (!exams.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'Aún no hay resultados asociados a tus citas.';
      list.append(empty);
      return;
    }
    list.append(...exams.map(createExamCard));
  } catch (error) {
    list.replaceChildren();
    const message = document.createElement('div');
    message.className = 'empty-state';
    message.textContent = error.message;
    list.append(message);
  }
}

function setExamTypeFields() {
  const type = examForm.elements.type.value;
  const numeric = type === 'numeric';
  const qualitative = type === 'qualitative';
  document.querySelector('#numeric-fields').classList.toggle('hidden', !numeric);
  document.querySelector('#qualitative-fields').classList.toggle('hidden', !qualitative);
  document.querySelector('#image-fields').classList.toggle('hidden', type !== 'image');
  examForm.elements.value.required = numeric;
  examForm.elements.referenceMin.required = numeric;
  examForm.elements.referenceMax.required = numeric;
  examForm.elements.qualitativeResult.required = qualitative;
  examForm.elements.imageUrl.required = type === 'image';
  examForm.elements.imageReport.required = type === 'image';
}

export function openExamForm(appointmentId) {
  examForm.reset();
  examForm.elements.appointmentId.value = appointmentId;
  examForm.elements.date.value = new Date().toISOString().slice(0, 10);
  setExamTypeFields();
  examMessage.textContent = '';
  examDialog.showModal();
}

function buildExamBody(values) {
  const type = values.get('type');
  const body = {
    appointmentId: Number(values.get('appointmentId')),
    name: values.get('name'),
    type,
    date: values.get('date')
  };
  if (type === 'numeric') {
    body.value = Number(values.get('value'));
    body.unit = values.get('unit') || undefined;
    body.referenceMin = Number(values.get('referenceMin'));
    body.referenceMax = Number(values.get('referenceMax'));
    body.quantitativeResult = values.get('quantitativeResult') || undefined;
  } else if (type === 'qualitative') {
    body.qualitativeResult = values.get('qualitativeResult');
    body.report = values.get('qualitativeReport') || undefined;
  } else {
    body.imageUrl = values.get('imageUrl');
    body.report = values.get('imageReport');
  }
  return body;
}

export function bindExamEvents() {
  document.querySelector('#exam-close').addEventListener('click', () => examDialog.close());
  document.querySelector('#refresh-exams').addEventListener('click', loadExamResults);
  examForm.elements.type.addEventListener('change', setExamTypeFields);
  examForm.addEventListener('submit', (event) => {
    event.preventDefault();
    runFormSubmission(examForm, examMessage, async (values) => {
      await apiRequest('/exams', { method: 'POST', authenticated: true, body: buildExamBody(values) });
      examDialog.close();
      examForm.reset();
      showToast('Resultado de examen registrado.');
      await loadAppointments();
    });
  });
}
