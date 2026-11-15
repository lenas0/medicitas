const express = require('express');
const helmet = require('helmet');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const appConfig = require('./env/appConfig');
const openapiSpec = require('./openapi');
const pool = require('./services/mysql.service');
const authRoutes = require('./routes/auth.routes');
const doctorRoutes = require('./routes/doctor.routes');
const appointmentRoutes = require('./routes/appointment.routes');
const reviewRoutes = require('./routes/review.routes');
const examRoutes = require('./routes/exam.routes');
const adminRoutes = require('./routes/admin.routes');
const statsRoutes = require('./routes/stats.routes');

const app = express();
app.disable('x-powered-by');
if (appConfig.nodeEnvironment === 'production') {
  app.set('trust proxy', 1);
}
app.use(helmet());
app.use(express.json({ limit: appConfig.jsonBodyLimit }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

app.get('/api/health', async (request, response, next) => {
  try {
    await pool.query('SELECT 1');
    return response.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    return next(error);
  }
});

app.use('/api', authRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/stats', statsRoutes);

app.use((request, response) => {
  response.status(404).json({ error: 'Route not found.' });
});

app.use((error, request, response, next) => {
  if (response.headersSent) return next(error);
  if (error.type === 'entity.parse.failed') {
    return response.status(400).json({ error: 'Invalid JSON request body.' });
  }
  if (error.type === 'entity.too.large') {
    return response.status(413).json({ error: 'Request body is too large.' });
  }
  if (error.code === 'ER_DUP_ENTRY') {
    return response.status(409).json({ error: 'A record with this value already exists.' });
  }

  if (appConfig.nodeEnvironment !== 'production') {
    console.error(error);
  }
  return response.status(500).json({ error: 'Internal server error.' });
});

app.listen(appConfig.port, () => {
  console.log(`MediCita API listening on port ${appConfig.port}`);
}).on('error', (error) => {
  console.error(`MediCita API could not start: ${error.message}`);
  process.exitCode = 1;
});