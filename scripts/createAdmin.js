const pool = require('../services/mysql.service');
const { hashPassword, isPasswordWithinLimit } = require('../services/password.service');

async function createAdmin() {
  const { ADMIN_FIRST_NAMES, ADMIN_LAST_NAMES, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (
    !ADMIN_FIRST_NAMES || !ADMIN_LAST_NAMES || !ADMIN_EMAIL || !ADMIN_PASSWORD ||
    ADMIN_PASSWORD.length < 12 || !isPasswordWithinLimit(ADMIN_PASSWORD)
  ) {
    throw new Error('Set ADMIN_FIRST_NAMES, ADMIN_LAST_NAMES, ADMIN_EMAIL, and an ADMIN_PASSWORD of at least 12 characters and no more than 72 UTF-8 bytes.');
  }
  const passwordHash = await hashPassword(ADMIN_PASSWORD);
  await pool.execute(
    `INSERT INTO users
       (user_first_names, user_last_names, user_email, user_password, user_role)
     VALUES (?, ?, ?, ?, '1')`,
    [ADMIN_FIRST_NAMES.trim(), ADMIN_LAST_NAMES.trim(), ADMIN_EMAIL.trim().toLowerCase(), passwordHash]
  );
  console.log('Admin account created.');
}

createAdmin()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());