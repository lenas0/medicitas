function requireObjectBody(request, response, next) {
  if (
    request.body === null ||
    typeof request.body !== 'object' ||
    Array.isArray(request.body)
  ) {
    return response.status(400).json({ error: 'Request body must be a JSON object.' });
  }

  return next();
}

function isValidDate(dateValue) {
  if (typeof dateValue !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return false;
  }

  const [year, month, day] = dateValue.split('-').map(Number);
  if (year < 1000) return false;

  const parsedDate = new Date(`${dateValue}T00:00:00.000Z`);
  return Number.isFinite(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === dateValue &&
    month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

function isValidDateTime(dateTimeValue) {
  if (typeof dateTimeValue !== 'string') return false;

  const match = /^(\d{4}-\d{2}-\d{2}) ([0-2]\d:[0-5]\d:[0-5]\d)$/.exec(dateTimeValue);
  if (!match || !isValidDate(match[1])) return false;

  const hour = Number(match[2].slice(0, 2));
  return hour <= 23;
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

module.exports = { requireObjectBody, isValidDate, isValidDateTime, isPositiveInteger };
