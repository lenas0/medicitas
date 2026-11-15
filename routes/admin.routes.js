const express = require('express');
const adminDao = require('../dao/admin.dao');
const userDao = require('../dao/user.dao');
const doctorDao = require('../dao/doctor.dao');
const asyncHandler = require('../middleware/asyncHandler');
const { requireObjectBody } = require('../middleware/requestValidation');
const { validatePatientId, validateIncomeReportRange } = require('../middleware/adminValidation');
const { validatePatientData, requirePatientPassword } = require('../middleware/patientValidation');
const { authenticate, requireRole } = require('../middleware/auth.middleware');
const { hashPassword } = require('../services/password.service');

const router = express.Router();
router.use(authenticate, requireRole('1'));

router.get('/patients', asyncHandler(async (request, response) => {
  response.json({ patients: await adminDao.listPatients() });
}));

router.get('/doctors', asyncHandler(async (request, response) => {
  response.json({ doctors: await doctorDao.listAll() });
}));

router.post(
  '/patients',
  requireObjectBody,
  validatePatientData,
  requirePatientPassword,
  asyncHandler(async (request, response) => {
    const patient = await userDao.createPatient({
      ...request.body,
      password: await hashPassword(request.body.password)
    });
    return response.status(201).json({ patient });
  })
);

router.put(
  '/patients/:patientId',
  requireObjectBody,
  validatePatientId,
  validatePatientData,
  asyncHandler(async (request, response) => {
    const { password, ...patientData } = request.body;
    const passwordHash = password == null ? undefined : await hashPassword(password);
    const patient = await adminDao.updatePatient(request.validatedPatientId, {
      ...patientData,
      passwordHash
    });
    if (!patient) return response.status(404).json({ error: 'Patient not found.' });
    return response.json({ patient });
  })
);

router.get('/reports/income', validateIncomeReportRange, asyncHandler(async (request, response) => {
  const { from, to } = request.query;
  return response.json(await adminDao.getIncomeReport({ from, to }));
}));

module.exports = router;