const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const appConfig = require('../env/appConfig');
const userDao = require('../dao/user.dao');
const asyncHandler = require('../middleware/asyncHandler');
const { requireObjectBody } = require('../middleware/requestValidation');
const { validatePatientData, requirePatientPassword, requirePatientPhone } = require('../middleware/patientValidation');
const { validateLogin } = require('../middleware/authValidation');
const { authenticate, getJwtSecret } = require('../middleware/auth.middleware');
const { hashPassword, verifyPassword } = require('../services/password.service');

const router = express.Router();
const authLimiter = rateLimit({
  windowMs: appConfig.authRateLimitWindowMs,
  limit: appConfig.authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false
});

function createToken(user) {
  return jwt.sign(
    { sub: String(user.user_id), role: user.user_role },
    getJwtSecret(),
    { expiresIn: appConfig.jwtExpiresIn }
  );
}

function publicUser(user) {
  return {
    userId: user.user_id,
    firstNames: user.user_first_names,
    lastNames: user.user_last_names,
    email: user.user_email,
    role: user.user_role,
    phone: user.user_phone
  };
}

router.post(
  '/users',
  authLimiter,
  requireObjectBody,
  validatePatientData,
  requirePatientPhone,
  requirePatientPassword,
  asyncHandler(async (request, response) => {
    const { firstNames, lastNames, email, password, phone } = request.body;
    if (await userDao.findByEmail(email)) {
      return response.status(409).json({ error: 'Email is already registered.' });
    }

    const user = await userDao.createPatient({
      firstNames,
      lastNames,
      email,
      password: await hashPassword(password),
      phone
    });

    return response.status(201).json({ user: publicUser(user), token: createToken(user) });
  })
);

router.post('/sessions', authLimiter, requireObjectBody, validateLogin, asyncHandler(async (request, response) => {
  const { email, password } = request.body;

  const user = await userDao.findByEmail(email);
  if (!user || !await verifyPassword(password, user.user_password)) {
    return response.status(401).json({ error: 'Invalid email or password.' });
  }

  return response.json({ user: publicUser(user), token: createToken(user) });
}));

router.get('/auth/me', authenticate, asyncHandler(async (request, response) => {
  const user = await userDao.findById(Number(request.auth.sub));
  if (!user) return response.status(404).json({ error: 'User not found.' });
  return response.json({ user: publicUser(user) });
}));

module.exports = router;