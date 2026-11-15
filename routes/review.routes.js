const express = require('express');
const reviewDao = require('../dao/review.dao');
const asyncHandler = require('../middleware/asyncHandler');
const { requireObjectBody } = require('../middleware/requestValidation');
const { validateReviewCreation } = require('../middleware/reviewValidation');
const { validateDoctorId } = require('../middleware/doctorValidation');
const { authenticate, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/doctor/:doctorId', validateDoctorId, asyncHandler(async (request, response) => {
  const { validatedDoctorId: doctorId } = request;
  return response.json({ reviews: await reviewDao.listForDoctor(doctorId) });
}));

router.post(
  '/appointments/:appointmentId',
  authenticate,
  requireRole('2'),
  requireObjectBody,
  validateReviewCreation,
  asyncHandler(async (request, response) => {
    const { validatedAppointmentId: appointmentId } = request;
    const { rating, comment, tags, waitMinutes } = request.body;
    if (!await reviewDao.isOwnedByUser(appointmentId, Number(request.auth.sub))) {
      return response.status(404).json({ error: 'Completed appointment not found.' });
    }

    const review = await reviewDao.create({ appointmentId, rating, comment, tags, waitMinutes });
    if (!review) return response.status(409).json({ error: 'Only completed appointments can be reviewed.' });
    return response.status(201).json({ review });
  })
);

module.exports = router;