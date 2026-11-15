const { isPositiveInteger } = require('./requestValidation');

function validateReviewCreation(request, response, next) {
  const { rating, comment, tags, waitMinutes } = request.body;
  const appointmentId = Number(request.params.appointmentId);
  if (
    !isPositiveInteger(appointmentId) ||
    !Number.isInteger(rating) || rating < 1 || rating > 5 ||
    (comment != null && (typeof comment !== 'string' || comment.length > 500)) ||
    (tags != null && (!Array.isArray(tags) || tags.length > 20 ||
      tags.some((tag) => typeof tag !== 'string' || !tag.trim() || tag.length > 40))) ||
    (waitMinutes != null && (!Number.isInteger(waitMinutes) || waitMinutes < 0 || waitMinutes > 65535))
  ) {
    return response.status(400).json({ error: 'Invalid review data.' });
  }

  request.validatedAppointmentId = appointmentId;
  return next();
}

module.exports = { validateReviewCreation };
