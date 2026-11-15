const { isPositiveInteger, isValidDate } = require('./requestValidation');

function validateExamCreation(request, response, next) {
  const {
    appointmentId, name, type, date, value, unit, referenceMin, referenceMax,
    quantitativeResult, qualitativeResult, report, imageUrl
  } = request.body;
  const validType = ['numeric', 'qualitative', 'image'].includes(type);
  if (
    !isPositiveInteger(appointmentId) ||
    typeof name !== 'string' || !name.trim() || name.length > 100 ||
    !isValidDate(date) || !validType
  ) {
    return response.status(400).json({ error: 'Invalid exam data.' });
  }

  if (type === 'numeric' && (
    !Number.isFinite(value) ||
    (unit != null && (typeof unit !== 'string' || unit.length > 20)) ||
    !Number.isFinite(referenceMin) || !Number.isFinite(referenceMax) || referenceMin > referenceMax
  )) {
    return response.status(400).json({ error: 'Numeric exams require a value and a valid reference range.' });
  }
  if (type === 'qualitative' && !['positive', 'negative'].includes(qualitativeResult)) {
    return response.status(400).json({ error: 'Qualitative exams require a positive or negative result.' });
  }
  if (
    (quantitativeResult != null && typeof quantitativeResult !== 'string') ||
    (report != null && typeof report !== 'string')
  ) {
    return response.status(400).json({ error: 'Exam report fields must be strings.' });
  }
  if (type === 'image' && (
    typeof report !== 'string' || !report.trim() ||
    typeof imageUrl !== 'string' || !imageUrl.trim()
  )) {
    return response.status(400).json({ error: 'Image exams require a report and image URL.' });
  }

  request.body.name = name.trim();
  request.body.unit = unit?.trim();
  return next();
}

module.exports = { validateExamCreation };
