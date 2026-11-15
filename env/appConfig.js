const { getRequiredValue, getIntegerValue } = require('./config');

module.exports = {
  port: getIntegerValue('PORT', 1),
  nodeEnvironment: getRequiredValue('NODE_ENV'),
  jsonBodyLimit: getRequiredValue('JSON_BODY_LIMIT'),
  authRateLimitWindowMs: getIntegerValue('AUTH_RATE_LIMIT_WINDOW_MS', 1),
  authRateLimitMax: getIntegerValue('AUTH_RATE_LIMIT_MAX', 1),
  jwtExpiresIn: getRequiredValue('JWT_EXPIRES_IN')
};
