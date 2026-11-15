const pool = require('../services/mysql.service');

async function create({ appointmentId, rating, comment, tags, waitMinutes }) {
  const serializedTags = tags == null || tags.length === 0 ? null : JSON.stringify(tags.map((tag) => tag.trim()));
  const [insertResult] = await pool.execute(
    `INSERT INTO reviews (appointment_id, review_rating, review_comment, review_tags, review_wait_minutes)
     SELECT appointments.appointment_id, ?, ?, ?, ?
     FROM appointments
     WHERE appointments.appointment_id = ? AND appointments.appointment_status = 'completed'`,
    [rating, comment || null, serializedTags, waitMinutes ?? null, appointmentId]
  );
  if (!insertResult.affectedRows) return null;
  const [createdReviews] = await pool.execute(
    `SELECT review_id, appointment_id, review_rating, review_comment, review_tags,
            review_wait_minutes, review_created_at
     FROM reviews WHERE review_id = ?`,
    [insertResult.insertId]
  );
  return createdReviews[0] || null;
}

async function listForDoctor(doctorId) {
  const [reviews] = await pool.execute(
    `SELECT reviews.review_id, reviews.review_rating, reviews.review_comment, reviews.review_tags,
            reviews.review_wait_minutes, reviews.review_created_at
     FROM reviews
     JOIN appointments ON appointments.appointment_id = reviews.appointment_id
     WHERE appointments.doctor_id = ?
     ORDER BY reviews.review_created_at DESC`,
    [doctorId]
  );
  return reviews;
}

async function isOwnedByUser(appointmentId, userId) {
  const [matchingAppointments] = await pool.execute(
    `SELECT appointment_id FROM appointments WHERE appointment_id = ? AND user_id = ?`,
    [appointmentId, userId]
  );
  return matchingAppointments.length > 0;
}

module.exports = { create, listForDoctor, isOwnedByUser };