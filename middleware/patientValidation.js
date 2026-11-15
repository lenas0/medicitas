const { isPasswordWithinLimit } = require('../services/password.service');

function validatePatientData(request, response, next) {
  const { firstNames, lastNames, email, password, phone } = request.body;
  if (
    typeof firstNames !== 'string' || !firstNames.trim() || firstNames.length > 80 ||
    typeof lastNames !== 'string' || !lastNames.trim() || lastNames.length > 80 ||
    typeof email !== 'string' || email.length > 120 ||
    (password != null && (
      typeof password !== 'string' || password.length < 8 || !isPasswordWithinLimit(password)
    )) ||
    (phone != null && (typeof phone !== 'string' || phone.length > 20))
  ) {
    return response.status(400).json({ error: 'Invalid patient data.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return response.status(400).json({ error: 'Invalid email address.' });
  }

  request.body.firstNames = firstNames.trim();
  request.body.lastNames = lastNames.trim();
  request.body.email = normalizedEmail;
  request.body.phone = phone === undefined ? undefined : phone?.trim() || null;
  return next();
}

function requirePatientPassword(request, response, next) {
  if (
    typeof request.body.password !== 'string' ||
    request.body.password.length < 8 ||
    !isPasswordWithinLimit(request.body.password)
  ) {
    return response.status(400).json({ error: 'Patient password must contain at least 8 characters and no more than 72 UTF-8 bytes.' });
  }
  return next();
}

function requirePatientPhone(request, response, next) {
  if (typeof request.body.phone !== 'string' || !request.body.phone.trim()) {
    return response.status(400).json({ error: 'Phone number is required.' });
  }
  return next();
}

module.exports = { validatePatientData, requirePatientPassword, requirePatientPhone };
