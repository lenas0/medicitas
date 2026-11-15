const pool = require('../services/mysql.service');

async function create({ userId, doctorId, appointmentDatetime, reason }) {
  const [insertResult] = await pool.execute(
    `INSERT INTO appointments
       (user_id, doctor_id, appointment_datetime, appointment_fee, appointment_reason)
     SELECT ?, doctor_id, ?, doctor_consultation_fee, ?
     FROM doctors
     WHERE doctor_id = ? AND doctor_active = TRUE`,
    [userId, appointmentDatetime, reason || null, doctorId]
  );
  if (!insertResult.affectedRows) return null;
  return findByIdForUser(insertResult.insertId, userId);
}

async function findByIdForUser(appointmentId, userId) {
  const [appointments] = await pool.execute(
    `SELECT appointments.appointment_id, appointments.user_id, appointments.doctor_id, appointments.appointment_datetime,
            appointments.appointment_fee, appointments.appointment_reason, appointments.appointment_status,
            doctors.doctor_first_names, doctors.doctor_last_names, doctors.doctor_specialty
     FROM appointments
     JOIN doctors ON doctors.doctor_id = appointments.doctor_id
     WHERE appointments.appointment_id = ? AND appointments.user_id = ?`,
    [appointmentId, userId]
  );
  return appointments[0] || null;
}

async function listPatientAppointments(userId, additionalFilter, sortOrder) {
  const [appointments] = await pool.execute(
    `SELECT appointments.appointment_id, appointments.doctor_id, appointments.appointment_datetime,
            appointments.appointment_fee, appointments.appointment_reason, appointments.appointment_status,
            doctors.doctor_first_names, doctors.doctor_last_names, doctors.doctor_specialty
     FROM appointments
     JOIN doctors ON doctors.doctor_id = appointments.doctor_id
     WHERE appointments.user_id = ? ${additionalFilter}
     ORDER BY ${sortOrder}`,
    [userId]
  );
  return appointments;
}

async function listForUser(userId) {
  return listPatientAppointments(userId, '', 'appointments.appointment_datetime DESC');
}

async function listUpcomingForUser(userId) {
  return listPatientAppointments(
    userId,
    "AND appointments.appointment_status = 'scheduled' AND appointments.appointment_datetime >= NOW()",
    'appointments.appointment_datetime'
  );
}

async function listHistoryForUser(userId) {
  return listPatientAppointments(
    userId,
    "AND (appointments.appointment_status IN ('completed', 'canceled') OR appointments.appointment_datetime < NOW())",
    'appointments.appointment_datetime DESC'
  );
}

async function listToday() {
  const [appointments] = await pool.execute(
    `SELECT appointments.appointment_id, appointments.appointment_datetime, appointments.appointment_fee,
            appointments.appointment_status, appointments.appointment_reason,
            users.user_id, users.user_first_names, users.user_last_names, users.user_email,
            doctors.doctor_id, doctors.doctor_first_names, doctors.doctor_last_names, doctors.doctor_specialty
     FROM appointments
     JOIN users ON users.user_id = appointments.user_id
     JOIN doctors ON doctors.doctor_id = appointments.doctor_id
     WHERE DATE(appointments.appointment_datetime) = CURDATE()
     ORDER BY appointments.appointment_datetime`
  );
  return appointments;
}

async function cancelForUser(appointmentId, userId) {
  const [updateResult] = await pool.execute(
    `UPDATE appointments SET appointment_status = 'canceled'
     WHERE appointment_id = ? AND user_id = ? AND appointment_status = 'scheduled'`,
    [appointmentId, userId]
  );
  return updateResult.affectedRows > 0;
}

async function updateStatus(appointmentId, status) {
  const [updateResult] = await pool.execute(
    `UPDATE appointments SET appointment_status = ?
     WHERE appointment_id = ? AND appointment_status = 'scheduled'`,
    [status, appointmentId]
  );
  return updateResult.affectedRows > 0;
}

module.exports = {
  create, findByIdForUser, listForUser, listUpcomingForUser, listHistoryForUser,
  listToday, cancelForUser, updateStatus
};