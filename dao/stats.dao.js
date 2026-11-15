const pool = require('../services/mysql.service');

async function getPublicCounts() {
  const [rows] = await pool.execute(
    `SELECT
       (SELECT COUNT(*) FROM doctors WHERE doctor_active = TRUE) AS doctorCount,
       (SELECT COUNT(*) FROM users WHERE user_role = '2') AS patientCount`
  );
  return rows[0];
}

module.exports = { getPublicCounts };
