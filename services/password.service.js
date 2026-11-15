const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;
const MAX_PASSWORD_BYTES = 72;
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

function isPasswordWithinLimit(password) {
  return Buffer.byteLength(password, 'utf8') <= MAX_PASSWORD_BYTES;
}

function isBcryptHash(value) {
  return BCRYPT_HASH_PATTERN.test(value);
}

function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

module.exports = {
  hashPassword,
  isBcryptHash,
  isPasswordWithinLimit,
  verifyPassword
};
