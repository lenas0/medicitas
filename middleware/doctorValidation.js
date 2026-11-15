const { isPositiveInteger } = require('./requestValidation');

function validateDoctorId(request, response, next) {
  const doctorId = Number(request.params.doctorId);
  if (!isPositiveInteger(doctorId)) {
    return response.status(400).json({ error: 'Invalid doctorId.' });
  }

  request.validatedDoctorId = doctorId;
  return next();
}

function validateDoctorInput(request, response, next) {
  const { firstNames, lastNames, specialty, description, consultationFee } = request.body;
  if (
    typeof firstNames !== 'string' || !firstNames.trim() || firstNames.length > 80 ||
    typeof lastNames !== 'string' || !lastNames.trim() || lastNames.length > 80 ||
    typeof specialty !== 'string' || !specialty.trim() || specialty.length > 80 ||
    (description != null && typeof description !== 'string') ||
    !Number.isFinite(consultationFee) || consultationFee < 0
  ) {
    return response.status(400).json({ error: 'Invalid doctor data.' });
  }

  request.body.firstNames = firstNames.trim();
  request.body.lastNames = lastNames.trim();
  request.body.specialty = specialty.trim();
  return next();
}

function validateDoctorUpdate(request, response, next) {
  const { active } = request.body;
  if (typeof active !== 'boolean') {
    return response.status(400).json({ error: 'Invalid doctor data.' });
  }
  return validateDoctorInput(request, response, next);
}

function validateScheduleInput(request, response, next) {
  const doctorId = Number(request.params.doctorId);
  const { dayOfWeek, startTime, endTime } = request.body;
  if (
    !isPositiveInteger(doctorId) ||
    !Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7 ||
    typeof startTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(startTime) ||
    typeof endTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(endTime) ||
    (startTime.length === 5 ? `${startTime}:00` : startTime) >=
      (endTime.length === 5 ? `${endTime}:00` : endTime)
  ) {
    return response.status(400).json({ error: 'Invalid schedule data.' });
  }

  request.validatedDoctorId = doctorId;
  return next();
}

function validateScheduleDeletion(request, response, next) {
  const doctorId = Number(request.params.doctorId);
  const scheduleId = Number(request.params.scheduleId);
  if (!isPositiveInteger(doctorId) || !isPositiveInteger(scheduleId)) {
    return response.status(400).json({ error: 'Invalid doctorId or scheduleId.' });
  }

  request.validatedDoctorId = doctorId;
  request.validatedScheduleId = scheduleId;
  return next();
}

module.exports = {
  validateDoctorId,
  validateDoctorInput,
  validateDoctorUpdate,
  validateScheduleInput,
  validateScheduleDeletion
};
