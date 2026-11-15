const fs = require('fs');
const { getRequiredValue, getIntegerValue } = require('./config');

function getBooleanValue(name, defaultValue) {
  const rawValue = process.env[name];
  if (rawValue == null || !rawValue.trim()) return defaultValue;
  const normalized = rawValue.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  throw new Error(`${name} must be a boolean value (true/false).`);
}

function getSslConfig() {
  if (!getBooleanValue('DB_SSL', false)) return undefined;

  const rejectUnauthorized = getBooleanValue('DB_SSL_REJECT_UNAUTHORIZED', true);
  const caBase64 = process.env.DB_SSL_CA_BASE64;
  const caPath = process.env.DB_SSL_CA_PATH;

  let ca;
  if (caBase64 && caBase64.trim()) {
    ca = Buffer.from(caBase64.trim(), 'base64').toString('utf8');
  } else if (caPath && caPath.trim()) {
    ca = fs.readFileSync(caPath.trim(), 'utf8');
  }

  if (rejectUnauthorized && !ca) {
    throw new Error('DB_SSL is enabled but no certificate was provided. Set DB_SSL_CA_BASE64 or DB_SSL_CA_PATH, or set DB_SSL_REJECT_UNAUTHORIZED=false.');
  }

  return { ca, rejectUnauthorized };
}

module.exports = {
  host: getRequiredValue('DB_HOST'),
  port: getIntegerValue('DB_PORT', 1),
  user: getRequiredValue('DB_USER'),
  password: getRequiredValue('DB_PASSWORD', true),
  database: getRequiredValue('DB_NAME'),
  waitForConnections: true,
  connectionLimit: getIntegerValue('DB_CONNECTION_LIMIT', 1),
  queueLimit: getIntegerValue('DB_QUEUE_LIMIT', 0),
  connectTimeout: process.env.DB_CONNECT_TIMEOUT_MS
    ? getIntegerValue('DB_CONNECT_TIMEOUT_MS', 1)
    : 10000,
  ssl: getSslConfig()
};
