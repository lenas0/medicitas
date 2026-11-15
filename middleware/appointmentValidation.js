const { isPositiveInteger, isValidDateTime } = require('./requestValidation');

function validateAppointmentCreation(request, response, next) {
  const { doctorId, appointmentDatetime, reason } = request.body;
  if (
    !isPositiveInteger(doctorId) ||
    !isValidDateTime(appointmentDatetime) ||
    (reason != null && (typeof reason !== 'string' || reason.length > 255))
  ) {
    return response.status(400).json({ error: 'Invalid appointment data; use YYYY-MM-DD HH:mm:ss.' });
  }

  return next();
}

function validateAppointmentId(request, response, next) {
  const appointmentId = Number(request.params.appointmentId);
  if (!isPositiveInteger(appointmentId)) {
    return response.status(400).json({ error: 'Invalid appointmentId.' });
  }

  request.validatedAppointmentId = appointmentId;
  return next();
}

function validateAppointmentStatus(request, response, next) {
  const appointmentId = Number(request.params.appointmentId);
  const { status } = request.body;
  if (!isPositiveInteger(appointmentId)) {
    return response.status(400).json({ error: 'Invalid appointmentId.' });
  }

  if (request.auth.role === '2' && status !== 'canceled') {
    return response.status(400).json({ error: 'Patients may only cancel appointments.' });
  }
  if (request.auth.role === '1' && !['completed', 'canceled'].includes(status)) {
    return response.status(400).json({ error: 'Invalid appointmentId or status.' });
  }
  if (!['1', '2'].includes(request.auth.role)) {
    return response.status(403).json({ error: 'Insufficient permissions.' });
  }

  request.validatedAppointmentId = appointmentId;
  return next();
}

module.exports = { validateAppointmentCreation, validateAppointmentId, validateAppointmentStatus };
