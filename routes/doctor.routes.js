const express = require('express');
const doctorDao = require('../dao/doctor.dao');
const asyncHandler = require('../middleware/asyncHandler');
const { requireObjectBody } = require('../middleware/requestValidation');
const {
  validateDoctorId,
  validateDoctorInput,
  validateDoctorUpdate,
  validateScheduleInput,
  validateScheduleDeletion
} = require('../middleware/doctorValidation');
const { authenticate, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();
const requireAdmin = [authenticate, requireRole('1')];

router.get('/', asyncHandler(async (request, response) => {
  response.json({ doctors: await doctorDao.listActive() });
}));

router.get('/:doctorId/schedules', validateDoctorId, asyncHandler(async (request, response) => {
  const { validatedDoctorId: doctorId } = request;
  if (!await doctorDao.findById(doctorId)) return response.status(404).json({ error: 'Doctor not found.' });
  return response.json({ schedules: await doctorDao.listSchedules(doctorId) });
}));

router.get('/:doctorId', validateDoctorId, asyncHandler(async (request, response) => {
  const { validatedDoctorId: doctorId } = request;
  const doctor = await doctorDao.findById(doctorId);
  if (!doctor || !doctor.doctor_active) return response.status(404).json({ error: 'Doctor not found.' });
  return response.json({ doctor });
}));

router.post('/', ...requireAdmin, requireObjectBody, validateDoctorInput, asyncHandler(async (request, response) => {
  const { firstNames, lastNames, specialty, description, consultationFee } = request.body;
  const doctor = await doctorDao.createDoctor({ firstNames, lastNames, specialty, description, consultationFee });
  return response.status(201).json({ doctor });
}));

router.put(
  '/:doctorId',
  ...requireAdmin,
  requireObjectBody,
  validateDoctorId,
  validateDoctorUpdate,
  asyncHandler(async (request, response) => {
    const { validatedDoctorId: doctorId } = request;
    const { firstNames, lastNames, specialty, description, consultationFee, active } = request.body;
    const doctor = await doctorDao.updateDoctor(doctorId, {
      firstNames, lastNames, specialty, description, consultationFee, active
    });
    if (!doctor) return response.status(404).json({ error: 'Doctor not found.' });
    return response.json({ doctor });
  })
);

router.post(
  '/:doctorId/schedules',
  ...requireAdmin,
  requireObjectBody,
  validateScheduleInput,
  asyncHandler(async (request, response) => {
    const { validatedDoctorId: doctorId } = request;
    const { dayOfWeek, startTime, endTime } = request.body;
    if (!await doctorDao.findById(doctorId)) return response.status(404).json({ error: 'Doctor not found.' });

    const schedule = await doctorDao.addSchedule({ doctorId, dayOfWeek, startTime, endTime });
    return response.status(201).json({ schedule });
  })
);

router.delete(
  '/:doctorId/schedules/:scheduleId',
  ...requireAdmin,
  validateScheduleDeletion,
  asyncHandler(async (request, response) => {
    const { validatedDoctorId: doctorId, validatedScheduleId: scheduleId } = request;
    const deleted = await doctorDao.deleteSchedule(doctorId, scheduleId);
    if (!deleted) return response.status(404).json({ error: 'Schedule not found.' });
    return response.json({ message: 'Schedule deleted.' });
  })
);

module.exports = router;