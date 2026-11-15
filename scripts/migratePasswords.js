const pool = require('../services/mysql.service');
const mysqlConfig = require('../env/mysqlConfig');
const {
  hashPassword,
  isBcryptHash,
  isPasswordWithinLimit
} = require('../services/password.service');

function getConfirmedDatabase() {
  const confirmationIndex = process.argv.indexOf('--confirm-database');
  if (confirmationIndex < 0 || !process.argv[confirmationIndex + 1]) {
    throw new Error('Pass --confirm-database followed by the exact database name from DB_NAME.');
  }

  const confirmedDatabase = process.argv[confirmationIndex + 1];
  if (confirmedDatabase !== mysqlConfig.database) {
    throw new Error('The confirmed database does not match DB_NAME; migration cancelled.');
  }
  return confirmedDatabase;
}

async function migratePasswords() {
  const confirmedDatabase = getConfirmedDatabase();
  const connection = await pool.getConnection();
  let transactionStarted = false;

  try {
    const [[databaseRow]] = await connection.query('SELECT DATABASE() AS databaseName');
    if (databaseRow.databaseName !== confirmedDatabase) {
      throw new Error('The connected database does not match the confirmed database; migration cancelled.');
    }

    await connection.beginTransaction();
    transactionStarted = true;
    const [users] = await connection.execute(
      'SELECT user_id, user_password FROM users FOR UPDATE'
    );

    let migratedCount = 0;
    let skippedCount = 0;

    for (const user of users) {
      if (isBcryptHash(user.user_password)) {
        skippedCount += 1;
        continue;
      }
      if (!isPasswordWithinLimit(user.user_password)) {
        throw new Error(`User ${user.user_id} has a password over bcrypt's 72-byte limit; migration rolled back.`);
      }

      const passwordHash = await hashPassword(user.user_password);
      const [updateResult] = await connection.execute(
        'UPDATE users SET user_password = ? WHERE user_id = ? AND user_password = ?',
        [passwordHash, user.user_id, user.user_password]
      );
      if (updateResult.affectedRows !== 1) {
        throw new Error(`Could not safely update user ${user.user_id}; migration rolled back.`);
      }
      migratedCount += 1;
    }

    await connection.commit();
    transactionStarted = false;
    console.log(`Password migration completed for ${confirmedDatabase}: ${migratedCount} migrated, ${skippedCount} already hashed.`);
  } catch (error) {
    if (transactionStarted) await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

migratePasswords()
  .catch((error) => {
    console.error(`Password migration failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
