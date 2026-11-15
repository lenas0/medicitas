import { getToken, clearStoredSession } from './authState.js';
import { API_BASE_PATH } from './constants.js';

const STATUS_LABELS = {
  400: 'Solicitud inválida',
  401: 'No se pudo autenticar',
  403: 'Acceso denegado',
  404: 'No se encontró el recurso',
  409: 'Conflicto con los datos actuales',
  413: 'Solicitud demasiado grande',
  429: 'Demasiadas solicitudes',
  500: 'Error interno del servidor'
};

const ERROR_DETAILS = {
  'Invalid patient data.': 'Revisa los datos del paciente e inténtalo de nuevo.',
  'Phone number is required.': 'El teléfono es obligatorio para crear una cuenta.',
  'Invalid email address.': 'El correo electrónico no tiene un formato válido.',
  'Patient password must contain at least 8 characters and no more than 72 UTF-8 bytes.': 'La contraseña debe tener al menos 8 caracteres y no superar 72 bytes UTF-8.',
  'Invalid doctor data.': 'Revisa los datos del profesional e inténtalo de nuevo.',
  'Invalid doctorId.': 'El identificador del profesional no es válido.',
  'Invalid schedule data.': 'Revisa el día y las horas del horario. La hora final debe ser posterior a la inicial.',
  'Invalid appointment data; use YYYY-MM-DD HH:mm:ss.': 'La fecha o los datos de la cita no son válidos.',
  'Invalid appointmentId.': 'El identificador de la cita no es válido.',
  'Invalid review data.': 'La calificación debe ser de 1 a 5; revisa también los límites del comentario, las etiquetas y la espera.',
  'Only completed appointments can be reviewed.': 'Solo se pueden calificar citas completadas.',
  'Invalid exam data.': 'Revisa los datos del examen e inténtalo de nuevo.',
  'Numeric exams require a value and a valid reference range.': 'El examen numérico requiere un valor y un rango de referencia válido.',
  'Qualitative exams require a positive or negative result.': 'Selecciona un resultado positivo o negativo.',
  'Image exams require a report and image URL.': 'El examen radiológico requiere la URL de la imagen y el informe.',
  'Email is already registered.': 'Ese correo ya tiene una cuenta registrada.',
  'Invalid email or password.': 'El correo o la contraseña no coinciden.',
  'Authentication required.': 'Inicia sesión para continuar.',
  'Invalid or expired token.': 'Tu sesión venció. Inicia sesión de nuevo.',
  'Insufficient permissions.': 'Tu cuenta no tiene permiso para realizar esta acción.',
  'Doctor not found.': 'No se encontró el profesional solicitado.',
  'Doctor is inactive or unavailable at that time.': 'El profesional está inactivo o no atiende en ese horario.',
  'Doctor is no longer available.': 'Ese horario acaba de dejar de estar disponible. Elige otro.',
  'Completed appointment not found.': 'No se encontró una cita completada que puedas calificar.',
  'Appointment not found.': 'No se encontró la cita asociada.',
  'Scheduled appointment not found.': 'No se encontró una cita pendiente que pueda actualizarse.',
  'A record with this value already exists.': 'Ya existe un registro con esos datos.'
};

let unauthorizedHandler = () => {};

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

function formatHttpError(status, detail) {
  const label = STATUS_LABELS[status] || 'La solicitud no pudo completarse';
  const message = ERROR_DETAILS[detail] || detail || 'Ocurrió un error inesperado.';
  return `Error ${status} — ${label}. ${message}`;
}

export async function apiRequest(path, { method = 'GET', body, authenticated = false } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (authenticated && getToken()) headers.Authorization = `Bearer ${getToken()}`;

  let response;
  try {
    response = await fetch(`${API_BASE_PATH}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
  } catch {
    throw new Error('Error de conexión — No se pudo contactar con MediCita. Comprueba que el servidor esté iniciado y vuelve a intentar.');
  }

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    if (!response.ok) throw new Error(formatHttpError(response.status));
  }

  if (!response.ok) {
    if (response.status === 401 && authenticated) {
      clearStoredSession();
      unauthorizedHandler();
    }
    throw new Error(formatHttpError(response.status, payload.error));
  }
  return payload;
}
