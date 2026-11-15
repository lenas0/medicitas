const { isPositiveInteger, isValidDate } = require('./requestValidation');

function validatePatientId(request, response, next) {
  const patientId = Number(request.params.patientId);
  if (!isPositiveInteger(patientId)) {
    return response.status(400).json({ error: 'Invalid patientId.' });
  }

  request.validatedPatientId = patientId;
  return next();
}

function validateIncomeReportRange(request, response, next) {
  const { from, to } = request.query;
  if (!isValidDate(from) || !isValidDate(to) || from > to) {
    return response.status(400).json({ error: 'Provide valid from and to dates (YYYY-MM-DD).' });
  }
  return next();
}

module.exports = { validatePatientId, validateIncomeReportRange };
