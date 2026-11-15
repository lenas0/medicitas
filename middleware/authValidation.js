const { isPasswordWithinLimit } = require('../services/password.service');

function validateLogin(request, response, next) {
  const { email, password } = request.body;
  if (typeof email !== 'string' || typeof password !== 'string') {
    return response.status(400).json({ error: 'Email and password are required.' });
  }
  if (!isPasswordWithinLimit(password)) {
    return response.status(400).json({ error: 'Password must not exceed 72 UTF-8 bytes.' });
  }

  request.body.email = email.trim().toLowerCase();
  return next();
}

module.exports = { validateLogin };
