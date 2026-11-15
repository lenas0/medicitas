const pool = require('../services/mysql.service');

async function listPatients() {
  const [patients] = await pool.execute(
    `SELECT user_id, user_first_names, user_last_names, user_email, user_phone
     FROM users
     WHERE user_role = '2'
     ORDER BY user_last_names, user_first_names`
  );
  return patients;
}

async function updatePatient(patientId, { firstNames, lastNames, email, passwordHash, phone }) {
  await pool.execute(
    `UPDATE users
     SET user_first_names = ?, user_last_names = ?, user_email = ?,
         user_password = IF(?, ?, user_password),
         user_phone = IF(?, ?, user_phone)
     WHERE user_id = ? AND user_role = '2'`,
    [
      firstNames, lastNames, email,
      passwordHash != null, passwordHash || null,
      phone !== undefined, phone ?? null,
      patientId
    ]
  );
  return findPatientById(patientId);
}

async function findPatientById(patientId) {
  const [patients] = await pool.execute(
    `SELECT user_id, user_first_names, user_last_names, user_email, user_phone
     FROM users
     WHERE user_id = ? AND user_role = '2'`,
    [patientId]
  );
  return patients[0] || null;
}

async function getIncomeReport({ from, to }) {
  const [[incomeTotalRows], [appointmentRows]] = await Promise.all([
    pool.execute(
      `SELECT COALESCE(SUM(appointment_fee), 0.00)
       FROM appointments
       WHERE appointment_status = 'completed'
         AND appointment_datetime >= ?
         AND appointment_datetime < DATE_ADD(?, INTERVAL 1 DAY)`,
      [from, to]
    ),
    pool.execute(
      `SELECT appointments.appointment_id, appointments.appointment_datetime, appointments.appointment_fee,
              users.user_id, users.user_first_names, users.user_last_names,
              doctors.doctor_id, doctors.doctor_first_names, doctors.doctor_last_names
       FROM appointments
       JOIN users ON users.user_id = appointments.user_id
       JOIN doctors ON doctors.doctor_id = appointments.doctor_id
       WHERE appointments.appointment_status = 'completed'
         AND appointments.appointment_datetime >= ?
         AND appointments.appointment_datetime < DATE_ADD(?, INTERVAL 1 DAY)
       ORDER BY appointments.appointment_datetime`,
      [from, to]
    )
  ]);
  return {
    total: incomeTotalRows[0]['COALESCE(SUM(appointment_fee), 0.00)'],
    appointments: appointmentRows
  };
}

module.exports = { listPatients, updatePatient, getIncomeReport };