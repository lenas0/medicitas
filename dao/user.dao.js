const pool = require('../services/mysql.service');

async function findByEmail(email) {
  const [matchingUsers] = await pool.execute(
    `SELECT user_id, user_first_names, user_last_names, user_email,
            user_password, user_role, user_phone
     FROM users
     WHERE user_email = ?`,
    [email]
  );
  return matchingUsers[0] || null;
}

async function findById(userId) {
  const [matchingUsers] = await pool.execute(
    `SELECT user_id, user_first_names, user_last_names, user_email,
            user_role, user_phone
     FROM users
     WHERE user_id = ?`,
    [userId]
  );
  return matchingUsers[0] || null;
}

async function createPatient({ firstNames, lastNames, email, password, phone }) {
  const [insertResult] = await pool.execute(
    `INSERT INTO users
       (user_first_names, user_last_names, user_email, user_password, user_role, user_phone)
     VALUES (?, ?, ?, ?, '2', ?)`,
    [firstNames, lastNames, email, password, phone || null]
  );
  return findById(insertResult.insertId);
}

module.exports = { findByEmail, findById, createPatient };