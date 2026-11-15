const pool = require('../services/mysql.service');

async function listForAppointmentAndUser(appointmentId, userId) {
  const [exams] = await pool.execute(
    `SELECT exams.exam_id, exams.appointment_id, exams.exam_name, exams.exam_type, exams.exam_date,
            exams.exam_value, exams.exam_unit, exams.exam_reference_min, exams.exam_reference_max,
            exams.exam_quantitative_result,
            exams.exam_qualitative_result, exams.exam_report, exams.exam_image_url
     FROM exams
     JOIN appointments ON appointments.appointment_id = exams.appointment_id
     WHERE exams.appointment_id = ? AND appointments.user_id = ?
     ORDER BY exams.exam_date DESC, exams.exam_id DESC`,
    [appointmentId, userId]
  );
  return exams;
}

async function listForUser(userId) {
  const [exams] = await pool.execute(
    `SELECT exams.exam_id, exams.appointment_id, exams.exam_name, exams.exam_type, exams.exam_date,
            exams.exam_value, exams.exam_unit, exams.exam_reference_min, exams.exam_reference_max,
            exams.exam_quantitative_result, exams.exam_qualitative_result, exams.exam_report,
            exams.exam_image_url, appointments.appointment_datetime,
            doctors.doctor_first_names, doctors.doctor_last_names, doctors.doctor_specialty
     FROM exams
     JOIN appointments ON appointments.appointment_id = exams.appointment_id
     JOIN doctors ON doctors.doctor_id = appointments.doctor_id
     WHERE appointments.user_id = ?
     ORDER BY exams.exam_date DESC, exams.exam_id DESC`,
    [userId]
  );
  return exams;
}

async function create({
  appointmentId, name, type, date, value, unit, referenceMin, referenceMax,
  quantitativeResult, qualitativeResult, report, imageUrl
}) {
  const [insertResult] = await pool.execute(
    `INSERT INTO exams
       (appointment_id, exam_name, exam_type, exam_date, exam_value, exam_unit,
        exam_reference_min, exam_reference_max, exam_quantitative_result,
        exam_qualitative_result, exam_report, exam_image_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      appointmentId, name, type, date, value, unit, referenceMin, referenceMax,
      quantitativeResult, qualitativeResult, report, imageUrl
    ]
  );
  const [createdExams] = await pool.execute(
    `SELECT exam_id, appointment_id, exam_name, exam_type, exam_date, exam_value,
            exam_unit, exam_reference_min, exam_reference_max, exam_quantitative_result,
            exam_qualitative_result,
            exam_report, exam_image_url
     FROM exams WHERE exam_id = ?`,
    [insertResult.insertId]
  );
  return createdExams[0];
}

async function appointmentExists(appointmentId) {
  const [matchingAppointments] = await pool.execute(
    `SELECT appointment_id FROM appointments WHERE appointment_id = ?`,
    [appointmentId]
  );
  return matchingAppointments.length > 0;
}

module.exports = { listForAppointmentAndUser, listForUser, create, appointmentExists };