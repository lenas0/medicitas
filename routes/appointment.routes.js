const express = require('express');
const appointmentDao = require('../dao/appointment.dao');
const doctorDao = require('../dao/doctor.dao');
const asyncHandler = require('../middleware/asyncHandler');
const { requireObjectBody } = require('../middleware/requestValidation');
const { validateAppointmentCreation, validateAppointmentStatus } = require('../middleware/appointmentValidation');
const { authenticate, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate);

router.get('/me', requireRole('2'), asyncHandler(async (request, response) => {
  response.json({ appointments: await appointmentDao.listForUser(Number(request.auth.sub)) });
}));

router.get('/me/upcoming', requireRole('2'), asyncHandler(async (request, response) => {
  response.json({ appointments: await appointmentDao.listUpcomingForUser(Number(request.auth.sub)) });
}));

router.get('/me/history', requireRole('2'), asyncHandler(async (request, response) => {
  response.json({ appointments: await appointmentDao.listHistoryForUser(Number(request.auth.sub)) });
}));

router.get('/admin/today', requireRole('1'), asyncHandler(async (request, response) => {
  response.json({ appointments: await appointmentDao.listToday() });
}));

router.post('/', requireRole('2'), requireObjectBody, validateAppointmentCreation, asyncHandler(async (request, response) => {
  const { doctorId, appointmentDatetime, reason } = request.body;

  const doctor = await doctorDao.isAvailableAt(doctorId, appointmentDatetime);
  if (!doctor) return response.status(409).json({ error: 'Doctor is inactive or unavailable at that time.' });

  const appointment = await appointmentDao.create({
    userId: Number(request.auth.sub), doctorId, appointmentDatetime, reason
  });
  if (!appointment) return response.status(409).json({ error: 'Doctor is no longer available.' });
  return response.status(201).json({ appointment });
}));

router.patch('/:appointmentId', requireObjectBody, validateAppointmentStatus, asyncHandler(async (request, response) => {
  const { validatedAppointmentId: appointmentId } = request;
  const { status } = request.body;

  if (request.auth.role === '2') {
    const canceled = await appointmentDao.cancelForUser(appointmentId, Number(request.auth.sub));
    if (!canceled) return response.status(404).json({ error: 'Scheduled appointment not found.' });
    return response.json({ message: 'Appointment canceled.', status });
  }

  const updated = await appointmentDao.updateStatus(appointmentId, status);
  if (!updated) return response.status(404).json({ error: 'Scheduled appointment not found.' });
  return response.json({ message: 'Appointment status updated.', status });
}));

module.exports = router;