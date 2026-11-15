const express = require('express');
const statsDao = require('../dao/stats.dao');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

router.get('/', asyncHandler(async (request, response) => {
  response.json(await statsDao.getPublicCounts());
}));

module.exports = router;
