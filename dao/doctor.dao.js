const pool = require('../services/mysql.service');

async function listDoctors(activeOnly) {
  const [doctors] = await pool.execute(
    `SELECT doctor_id, doctor_first_names, doctor_last_names, doctor_specialty,
            doctor_description, doctor_consultation_fee, doctor_active
     FROM doctors
     ${activeOnly ? 'WHERE doctor_active = TRUE' : ''}
     ORDER BY doctor_last_names, doctor_first_names`
  );
  if (!doctors.length) return doctors;

  const doctorIdPlaceholders = doctors.map(() => '?').join(', ');
  const [doctorSchedules] = await pool.execute(
    `SELECT schedule_id, doctor_id, schedule_day_of_week, schedule_start_time, schedule_end_time
     FROM doctor_schedules
     WHERE doctor_id IN (${doctorIdPlaceholders})
     ORDER BY schedule_day_of_week`,
    doctors.map((doctor) => doctor.doctor_id)
  );
  const schedulesByDoctor = new Map(doctors.map((doctor) => [doctor.doctor_id, []]));
  for (const schedule of doctorSchedules) schedulesByDoctor.get(schedule.doctor_id).push(schedule);
  return doctors.map((doctor) => ({ ...doctor, schedules: schedulesByDoctor.get(doctor.doctor_id) }));
}

async function listActive() {
  const doctors = await listDoctors(true);
  return doctors.map(({ doctor_active, ...doctor }) => doctor);
}

async function listAll() {
  return listDoctors(false);
}

async function findById(doctorId) {
  const [matchingDoctors] = await pool.execute(
    `SELECT doctor_id, doctor_first_names, doctor_last_names, doctor_specialty,
            doctor_description, doctor_consultation_fee, doctor_active
     FROM doctors
     WHERE doctor_id = ?`,
    [doctorId]
  );
  return matchingDoctors[0] || null;
}

async function createDoctor({ firstNames, lastNames, specialty, description, consultationFee }) {
  const [insertResult] = await pool.execute(
    `INSERT INTO doctors
       (doctor_first_names, doctor_last_names, doctor_specialty, doctor_description, doctor_consultation_fee)
     VALUES (?, ?, ?, ?, ?)`,
    [firstNames, lastNames, specialty, description || null, consultationFee]
  );
  return findById(insertResult.insertId);
}

async function updateDoctor(doctorId, { firstNames, lastNames, specialty, description, consultationFee, active }) {
  const [updateResult] = await pool.execute(
    `UPDATE doctors
     SET doctor_first_names = ?, doctor_last_names = ?, doctor_specialty = ?,
         doctor_description = ?, doctor_consultation_fee = ?, doctor_active = ?
     WHERE doctor_id = ?`,
    [firstNames, lastNames, specialty, description || null, consultationFee, active, doctorId]
  );
  return updateResult.affectedRows ? findById(doctorId) : null;
}

async function listSchedules(doctorId) {
  const [schedules] = await pool.execute(
    `SELECT schedule_id, doctor_id, schedule_day_of_week, schedule_start_time, schedule_end_time
     FROM doctor_schedules
     WHERE doctor_id = ?
     ORDER BY schedule_day_of_week`,
    [doctorId]
  );
  return schedules;
}

async function addSchedule({ doctorId, dayOfWeek, startTime, endTime }) {
  const [insertResult] = await pool.execute(
    `INSERT INTO doctor_schedules
       (doctor_id, schedule_day_of_week, schedule_start_time, schedule_end_time)
     VALUES (?, ?, ?, ?)`,
    [doctorId, dayOfWeek, startTime, endTime]
  );
  const [createdSchedules] = await pool.execute(
    `SELECT schedule_id, doctor_id, schedule_day_of_week, schedule_start_time, schedule_end_time
     FROM doctor_schedules WHERE schedule_id = ?`,
    [insertResult.insertId]
  );
  return createdSchedules[0];
}

async function deleteSchedule(doctorId, scheduleId) {
  const [deleteResult] = await pool.execute(
    'DELETE FROM doctor_schedules WHERE doctor_id = ? AND schedule_id = ?',
    [doctorId, scheduleId]
  );
  return deleteResult.affectedRows > 0;
}

async function isAvailableAt(doctorId, appointmentDatetime) {
  const [matchingDoctors] = await pool.execute(
    `SELECT doctors.doctor_id, doctors.doctor_consultation_fee
     FROM doctors
     JOIN doctor_schedules ON doctor_schedules.doctor_id = doctors.doctor_id
     WHERE doctors.doctor_id = ?
       AND doctors.doctor_active = TRUE
       AND doctor_schedules.schedule_day_of_week = WEEKDAY(?) + 1
       AND TIME(?) >= doctor_schedules.schedule_start_time
       AND TIME(?) < doctor_schedules.schedule_end_time
       AND ? > NOW()`,
     [doctorId, appointmentDatetime, appointmentDatetime, appointmentDatetime, appointmentDatetime]
  );
  return matchingDoctors[0] || null;
}

module.exports = {
  listActive, listAll, findById, createDoctor, updateDoctor, listSchedules, addSchedule, deleteSchedule, isAvailableAt
};