const express = require('express');
const examDao = require('../dao/exam.dao');
const asyncHandler = require('../middleware/asyncHandler');
const { requireObjectBody } = require('../middleware/requestValidation');
const { validateAppointmentId } = require('../middleware/appointmentValidation');
const { validateExamCreation } = require('../middleware/examValidation');
const { authenticate, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

router.get(
  '/appointments/:appointmentId',
  authenticate,
  requireRole('2'),
  validateAppointmentId,
  asyncHandler(async (request, response) => {
    const { validatedAppointmentId: appointmentId } = request;
    const exams = await examDao.listForAppointmentAndUser(appointmentId, Number(request.auth.sub));
    return response.json({ exams });
  })
);

router.get('/me', authenticate, requireRole('2'), asyncHandler(async (request, response) => {
  const exams = await examDao.listForUser(Number(request.auth.sub));
  return response.json({ exams });
}));

router.post(
  '/',
  authenticate,
  requireRole('1'),
  requireObjectBody,
  validateExamCreation,
  asyncHandler(async (request, response) => {
    const {
      appointmentId, name, type, date, value, unit, referenceMin, referenceMax,
      quantitativeResult, qualitativeResult, report, imageUrl
    } = request.body;
    if (!await examDao.appointmentExists(appointmentId)) {
      return response.status(404).json({ error: 'Appointment not found.' });
    }

    const exam = await examDao.create({
      appointmentId, name, type, date,
      value: type === 'numeric' ? value : null,
      unit: type === 'numeric' && unit ? unit : null,
      referenceMin: type === 'numeric' ? referenceMin : null,
      referenceMax: type === 'numeric' ? referenceMax : null,
      quantitativeResult: type === 'numeric' ? quantitativeResult || null : null,
      qualitativeResult: type === 'qualitative' ? qualitativeResult : null,
      report: type === 'image' ? report : (report || null),
      imageUrl: type === 'image' ? imageUrl : null
    });
    return response.status(201).json({ exam });
  })
);

module.exports = router;