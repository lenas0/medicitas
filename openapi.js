const responseRef = (name) => ({ $ref: `#/components/responses/${name}` });
const schemaRef = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema) => ({ 'application/json': { schema } });
const success = (description, schema) => ({ description, content: json(schemaRef(schema)) });
const errors = (...names) => Object.fromEntries(names.map((name) => [
  ({ BadRequest: 400, Unauthorized: 401, Forbidden: 403, NotFound: 404, Conflict: 409, RateLimited: 429, InternalError: 500 })[name],
  responseRef(name)
]));
const responses = (code, description, schema, ...errorNames) => ({
  [code]: success(description, schema),
  ...errors(...errorNames)
});
const body = (schema, example) => ({
  required: true,
  content: { 'application/json': { schema: schemaRef(schema), ...(example ? { example } : {}) } }
});
const idParameter = (name) => ({ name, in: 'path', required: true, schema: { type: 'integer', minimum: 1 } });

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'MediCita API',
    version: '1.0.0',
    description: 'Documentación interactiva de la API de MediCita.'
  },
  servers: [{ url: '/api', description: 'API actual' }],
  tags: ['Salud', 'Autenticación', 'Médicos', 'Citas', 'Reseñas', 'Exámenes', 'Administración'].map((name) => ({ name })),
  security: [{ bearerAuth: [] }],
  paths: {
    '/health': { get: {
      tags: ['Salud'], summary: 'Comprobar el estado de la API y la base de datos', security: [],
      responses: {
        200: { description: 'La base de datos está disponible.', content: { ...json(schemaRef('Health')), example: { status: 'ok', database: 'connected' } } },
        ...errors('InternalError')
      }
    } },
    '/stats': { get: {
      tags: ['Salud'], summary: 'Consultar cantidades públicas de médicos y pacientes', security: [],
      responses: responses(200, 'Cantidades actuales de médicos activos y pacientes registrados.', 'PublicStats', 'InternalError')
    } },
    '/users': { post: {
      tags: ['Autenticación'], summary: 'Crear una cuenta de paciente',
      description: 'El rol se asigna como paciente. El límite se configura con AUTH_RATE_LIMIT_MAX y AUTH_RATE_LIMIT_WINDOW_MS.',
      security: [], requestBody: body('RegisterRequest', {
        firstNames: 'Alex', lastNames: 'Morgan', email: 'alex@example.com', password: 'a-long-password', phone: '555-0100'
      }),
      responses: responses(201, 'Paciente registrado.', 'AuthResult', 'BadRequest', 'Conflict', 'RateLimited', 'InternalError')
    } },
    '/sessions': { post: {
      tags: ['Autenticación'], summary: 'Crear una sesión autenticada',
      description: 'El límite se configura con AUTH_RATE_LIMIT_MAX y AUTH_RATE_LIMIT_WINDOW_MS.', security: [],
      requestBody: body('LoginRequest', { email: 'alex@example.com', password: 'a-long-password' }),
      responses: responses(200, 'Credenciales válidas.', 'AuthResult', 'BadRequest', 'Unauthorized', 'RateLimited', 'InternalError')
    } },
    '/auth/me': { get: {
      tags: ['Autenticación'], summary: 'Obtener la cuenta autenticada',
      responses: responses(200, 'Cuenta encontrada.', 'CurrentUserResult', 'Unauthorized', 'NotFound', 'InternalError')
    } },
    '/doctors': {
      get: {
        tags: ['Médicos'], summary: 'Listar médicos activos', security: [],
        responses: responses(200, 'Lista de médicos activos.', 'DoctorListResult', 'InternalError')
      },
      post: {
        tags: ['Médicos'], summary: 'Crear un médico', description: 'Requiere rol administrador.',
        requestBody: body('CreateDoctorRequest'),
        responses: responses(201, 'Médico creado.', 'DoctorResult', 'BadRequest', 'Unauthorized', 'Forbidden', 'Conflict', 'InternalError')
      }
    },
    '/doctors/{doctorId}': {
      parameters: [idParameter('doctorId')],
      get: {
        tags: ['Médicos'], summary: 'Obtener un médico', security: [],
        responses: responses(200, 'Médico encontrado.', 'DoctorResult', 'BadRequest', 'NotFound', 'InternalError')
      },
      put: {
        tags: ['Médicos'], summary: 'Actualizar un médico',
        description: 'Requiere rol administrador. Reemplaza todos los campos editables.',
        requestBody: body('UpdateDoctorRequest'),
        responses: responses(200, 'Médico actualizado.', 'DoctorResult', 'BadRequest', 'Unauthorized', 'Forbidden', 'NotFound', 'Conflict', 'InternalError')
      }
    },
    '/doctors/{doctorId}/schedules': {
      parameters: [idParameter('doctorId')],
      get: {
        tags: ['Médicos'], summary: 'Listar horarios de un médico', security: [],
        responses: responses(200, 'Horarios del médico.', 'ScheduleListResult', 'BadRequest', 'NotFound', 'InternalError')
      },
      post: {
        tags: ['Médicos'], summary: 'Agregar un horario a un médico',
        description: 'Requiere rol administrador. dayOfWeek usa ISO: 1 = lunes y 7 = domingo.',
        requestBody: body('CreateScheduleRequest'),
        responses: responses(201, 'Horario creado.', 'ScheduleResult', 'BadRequest', 'Unauthorized', 'Forbidden', 'NotFound', 'Conflict', 'InternalError')
      }
    },
    '/doctors/{doctorId}/schedules/{scheduleId}': {
      parameters: [idParameter('doctorId'), idParameter('scheduleId')],
      delete: {
        tags: ['Médicos'], summary: 'Eliminar un horario de un médico',
        description: 'Requiere rol administrador.',
        responses: {
          200: { description: 'Horario eliminado.', content: { ...json(schemaRef('MessageResult')), example: { message: 'Schedule deleted.' } } },
          ...errors('BadRequest', 'Unauthorized', 'Forbidden', 'NotFound', 'InternalError')
        }
      }
    },
    '/appointments/me': { get: {
      tags: ['Citas'], summary: 'Listar las citas del paciente autenticado', description: 'Requiere rol paciente.',
      responses: responses(200, 'Citas del paciente.', 'AppointmentListResult', 'Unauthorized', 'Forbidden', 'InternalError')
    } },
    '/appointments/me/upcoming': { get: {
      tags: ['Citas'], summary: 'Listar próximas citas programadas del paciente',
      responses: responses(200, 'Próximas citas.', 'AppointmentListResult', 'Unauthorized', 'Forbidden', 'InternalError')
    } },
    '/appointments/me/history': { get: {
      tags: ['Citas'], summary: 'Listar historial de citas del paciente',
      description: 'Incluye citas completadas, canceladas y citas programadas cuya fecha ya pasó.',
      responses: responses(200, 'Historial de citas.', 'AppointmentListResult', 'Unauthorized', 'Forbidden', 'InternalError')
    } },
    '/appointments/admin/today': { get: {
      tags: ['Citas'], summary: 'Listar las citas de hoy',
      description: 'Requiere rol administrador. La fecha se calcula en la zona horaria de MySQL.',
      responses: responses(200, 'Citas del día actual.', 'TodayAppointmentListResult', 'Unauthorized', 'Forbidden', 'InternalError')
    } },
    '/appointments': { post: {
      tags: ['Citas'], summary: 'Agendar una cita',
      description: 'Requiere rol paciente. La fecha y hora se interpretan en la zona horaria de la base de datos.',
      requestBody: body('CreateAppointmentRequest', {
        doctorId: 1, appointmentDatetime: '2026-11-02 09:30:00', reason: 'Annual checkup'
      }),
      responses: responses(201, 'Cita creada.', 'CreatedAppointmentResult', 'BadRequest', 'Unauthorized', 'Forbidden', 'Conflict', 'InternalError')
    } },
    '/appointments/{appointmentId}': {
      parameters: [idParameter('appointmentId')],
      patch: {
        tags: ['Citas'], summary: 'Actualizar el estado de una cita',
        description: 'Requiere autenticación. Los pacientes solo pueden cancelar sus propias citas programadas. Los administradores pueden completar o cancelar cualquier cita programada.',
        requestBody: body('UpdateAppointmentStatusRequest'),
        responses: {
          200: { description: 'Estado actualizado.', content: { ...json(schemaRef('AppointmentStatusResult')), example: { message: 'Appointment canceled.', status: 'canceled' } } },
          ...errors('BadRequest', 'Unauthorized', 'Forbidden', 'NotFound', 'InternalError')
        }
      }
    },
    '/reviews/doctor/{doctorId}': {
      parameters: [idParameter('doctorId')],
      get: {
        tags: ['Reseñas'], summary: 'Listar reseñas de un médico', security: [],
        responses: responses(200, 'Reseñas del médico.', 'ReviewListResult', 'BadRequest', 'InternalError')
      }
    },
    '/reviews/appointments/{appointmentId}': {
      parameters: [idParameter('appointmentId')],
      post: {
        tags: ['Reseñas'], summary: 'Crear una reseña para una cita completada',
        description: 'Requiere rol paciente y que la cita pertenezca al usuario autenticado.',
        requestBody: body('CreateReviewRequest'),
        responses: responses(201, 'Reseña creada.', 'ReviewResult', 'BadRequest', 'Unauthorized', 'Forbidden', 'NotFound', 'Conflict', 'InternalError')
      }
    },
    '/exams/appointments/{appointmentId}': {
      parameters: [idParameter('appointmentId')],
      get: {
        tags: ['Exámenes'], summary: 'Consultar exámenes de una cita propia',
        description: 'Requiere rol paciente. Si la cita no existe o no pertenece al paciente, devuelve una lista vacía.',
        responses: responses(200, 'Exámenes asociados a la cita.', 'ExamListResult', 'BadRequest', 'Unauthorized', 'Forbidden', 'InternalError')
      }
    },
    '/exams/me': { get: {
      tags: ['Exámenes'], summary: 'Consultar todos los resultados propios del paciente',
      responses: responses(200, 'Resultados del paciente autenticado.', 'ExamListResult', 'Unauthorized', 'Forbidden', 'InternalError')
    } },
    '/exams': { post: {
      tags: ['Exámenes'], summary: 'Registrar un examen',
      description: 'Requiere rol administrador. Los campos requeridos dependen del tipo de examen.',
      requestBody: body('CreateExamRequest'),
      responses: responses(201, 'Examen creado.', 'ExamResult', 'BadRequest', 'Unauthorized', 'Forbidden', 'NotFound', 'Conflict', 'InternalError')
    } },
    '/admin/patients': {
      get: {
        tags: ['Administración'], summary: 'Listar pacientes registrados', description: 'Requiere rol administrador.',
        responses: responses(200, 'Pacientes registrados.', 'PatientListResult', 'Unauthorized', 'Forbidden', 'InternalError')
      },
      post: {
        tags: ['Administración'], summary: 'Registrar un paciente desde administración',
        description: 'Requiere rol administrador. La contraseña se almacena como hash bcrypt.',
        requestBody: body('RegisterRequest'),
        responses: responses(201, 'Paciente registrado.', 'PatientResult', 'BadRequest', 'Unauthorized', 'Forbidden', 'Conflict', 'InternalError')
      }
    },
    '/admin/patients/{patientId}': {
      parameters: [idParameter('patientId')],
      put: {
        tags: ['Administración'], summary: 'Actualizar la información de un paciente',
        description: 'Requiere rol administrador. La contraseña es opcional; si se envía, se almacena como hash bcrypt.',
        requestBody: body('UpdatePatientRequest'),
        responses: responses(200, 'Paciente actualizado.', 'PatientResult', 'BadRequest', 'Unauthorized', 'Forbidden', 'NotFound', 'Conflict', 'InternalError')
      }
    },
    '/admin/doctors': { get: {
      tags: ['Administración'], summary: 'Listar todos los profesionales, incluidos los inactivos',
      description: 'Requiere rol administrador.',
      responses: responses(200, 'Directorio completo de profesionales y horarios.', 'AdminDoctorListResult', 'Unauthorized', 'Forbidden', 'InternalError')
    } },
    '/admin/reports/income': { get: {
      tags: ['Administración'], summary: 'Consultar informe de ingresos',
      description: 'Requiere rol administrador. El rango incluye ambos días; solo suma citas completadas.',
      parameters: [
        { name: 'from', in: 'query', required: true, description: 'Fecha inicial inclusiva (YYYY-MM-DD).', schema: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } },
        { name: 'to', in: 'query', required: true, description: 'Fecha final inclusiva; debe ser igual o posterior a `from` (YYYY-MM-DD).', schema: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } }
      ],
      responses: responses(200, 'Total e ingresos por cita completada.', 'IncomeReport', 'BadRequest', 'Unauthorized', 'Forbidden', 'InternalError')
    } }
  },
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    requestBodies: {
      Register: body('RegisterRequest'),
      Login: body('LoginRequest'),
      CreateDoctor: body('CreateDoctorRequest'),
      UpdateDoctor: body('UpdateDoctorRequest'),
      CreateSchedule: body('CreateScheduleRequest'),
      CreateAppointment: body('CreateAppointmentRequest'),
      UpdateAppointmentStatus: body('UpdateAppointmentStatusRequest'),
      CreateReview: body('CreateReviewRequest'),
      CreateExam: body('CreateExamRequest')
    },
    responses: {
      BadRequest: {
        description: 'Parámetros o datos de entrada no válidos.',
        content: { 'application/json': { schema: schemaRef('ErrorResponse'), example: { error: 'Invalid request data.' } } }
      },
      Unauthorized: {
        description: 'Falta un token válido o las credenciales no son correctas.',
        content: { 'application/json': { schema: schemaRef('ErrorResponse'), example: { error: 'Authentication required.' } } }
      },
      Forbidden: {
        description: 'El rol del usuario no permite realizar esta operación.',
        content: { 'application/json': { schema: schemaRef('ErrorResponse'), example: { error: 'Insufficient permissions.' } } }
      },
      NotFound: {
        description: 'No se encontró el recurso solicitado.',
        content: { 'application/json': { schema: schemaRef('ErrorResponse'), example: { error: 'Resource not found.' } } }
      },
      Conflict: {
        description: 'La operación entra en conflicto con el estado actual o una restricción de unicidad.',
        content: { 'application/json': { schema: schemaRef('ErrorResponse'), example: { error: 'A record with this value already exists.' } } }
      },
      InternalError: {
        description: 'Error interno o de base de datos. Los errores de análisis del JSON también producen esta respuesta.',
        content: { 'application/json': { schema: schemaRef('ErrorResponse'), example: { error: 'Internal server error.' } } }
      },
      RateLimited: {
        description: 'Se superó el límite de solicitudes de autenticación.',
        content: { 'application/json': { schema: schemaRef('RateLimitResponse'), example: { message: 'Too many requests, please try again later.' } } }
      }
    },
    schemas: {
      ErrorResponse: { type: 'object', required: ['error'], properties: { error: { type: 'string', example: 'Invalid request data.' } } },
      RateLimitResponse: { type: 'object', required: ['message'], properties: { message: { type: 'string', example: 'Too many requests, please try again later.' } } },
      Health: {
        type: 'object', required: ['status', 'database'],
        properties: { status: { type: 'string', example: 'ok' }, database: { type: 'string', example: 'connected' } }
      },
      PublicStats: {
        type: 'object', required: ['doctorCount', 'patientCount'],
        properties: {
          doctorCount: { type: 'integer', minimum: 0, description: 'Cantidad de médicos activos.' },
          patientCount: { type: 'integer', minimum: 0, description: 'Cantidad de cuentas con rol paciente.' }
        }
      },
      RegisterRequest: {
        type: 'object', required: ['firstNames', 'lastNames', 'email', 'password', 'phone'],
        properties: {
          firstNames: { type: 'string', minLength: 1, maxLength: 80 },
          lastNames: { type: 'string', minLength: 1, maxLength: 80 },
          email: { type: 'string', format: 'email', maxLength: 120 },
          password: { type: 'string', minLength: 8, maxLength: 72, description: 'Máximo 72 bytes UTF-8.' },
          phone: { type: 'string', minLength: 1, maxLength: 20 }
        }
      },
      LoginRequest: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string' }, password: { type: 'string' } } },
      PublicUser: {
        type: 'object', required: ['userId', 'firstNames', 'lastNames', 'email', 'role', 'phone'],
        properties: {
          userId: { type: 'integer' }, firstNames: { type: 'string' }, lastNames: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['1', '2'], description: '1 = administrador; 2 = paciente.' },
          phone: { type: 'string', nullable: true }
        }
      },
      AuthResult: {
        type: 'object', required: ['user', 'token'],
        properties: { user: schemaRef('PublicUser'), token: { type: 'string', description: 'JWT para Authorization: Bearer.' } }
      },
      CurrentUserResult: { type: 'object', required: ['user'], properties: { user: schemaRef('PublicUser') } },
      DoctorSummary: {
        type: 'object', required: ['doctor_id', 'doctor_first_names', 'doctor_last_names', 'doctor_specialty', 'doctor_description', 'doctor_consultation_fee', 'schedules'],
        properties: {
          doctor_id: { type: 'integer' }, doctor_first_names: { type: 'string' }, doctor_last_names: { type: 'string' },
          doctor_specialty: { type: 'string' }, doctor_description: { type: 'string', nullable: true },
          doctor_consultation_fee: { type: 'string', description: 'Importe decimal devuelto por MySQL.' },
          schedules: { type: 'array', items: schemaRef('Schedule') }
        }
      },
      Doctor: {
        allOf: [schemaRef('DoctorSummary'), {
          type: 'object', required: ['doctor_active'], properties: { doctor_active: { type: 'integer', enum: [0, 1], description: 'Columna MySQL BOOLEAN devuelta como TINYINT.' } }
        }]
      },
      DoctorListResult: { type: 'object', required: ['doctors'], properties: { doctors: { type: 'array', items: schemaRef('DoctorSummary') } } },
      AdminDoctorListResult: { type: 'object', required: ['doctors'], properties: { doctors: { type: 'array', items: schemaRef('Doctor') } } },
      DoctorResult: { type: 'object', required: ['doctor'], properties: { doctor: schemaRef('Doctor') } },
      CreateDoctorRequest: {
        type: 'object', required: ['firstNames', 'lastNames', 'specialty', 'consultationFee'],
        properties: {
          firstNames: { type: 'string', minLength: 1, maxLength: 80 }, lastNames: { type: 'string', minLength: 1, maxLength: 80 },
          specialty: { type: 'string', minLength: 1, maxLength: 80 }, description: { type: 'string', nullable: true },
          consultationFee: { type: 'number', minimum: 0 }
        }
      },
      UpdateDoctorRequest: {
        type: 'object', required: ['firstNames', 'lastNames', 'specialty', 'consultationFee', 'active'],
        properties: {
          firstNames: { type: 'string', minLength: 1, maxLength: 80 }, lastNames: { type: 'string', minLength: 1, maxLength: 80 },
          specialty: { type: 'string', minLength: 1, maxLength: 80 }, description: { type: 'string', nullable: true },
          consultationFee: { type: 'number', minimum: 0 }, active: { type: 'boolean' }
        }
      },
      Schedule: {
        type: 'object', required: ['schedule_id', 'doctor_id', 'schedule_day_of_week', 'schedule_start_time', 'schedule_end_time'],
        properties: {
          schedule_id: { type: 'integer' }, doctor_id: { type: 'integer' },
          schedule_day_of_week: { type: 'integer', minimum: 1, maximum: 7, description: '1 = lunes; 7 = domingo.' },
          schedule_start_time: { type: 'string', example: '09:00:00' }, schedule_end_time: { type: 'string', example: '17:00:00' }
        }
      },
      ScheduleListResult: { type: 'object', required: ['schedules'], properties: { schedules: { type: 'array', items: schemaRef('Schedule') } } },
      ScheduleResult: { type: 'object', required: ['schedule'], properties: { schedule: schemaRef('Schedule') } },
      CreateScheduleRequest: {
        type: 'object', required: ['dayOfWeek', 'startTime', 'endTime'],
        properties: {
          dayOfWeek: { type: 'integer', minimum: 1, maximum: 7 },
          startTime: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d(:[0-5]\\d)?$', example: '09:00' },
          endTime: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d(:[0-5]\\d)?$', example: '17:00' }
        }
      },
      Appointment: {
        type: 'object', required: ['appointment_id', 'doctor_id', 'appointment_datetime', 'appointment_fee', 'appointment_reason', 'appointment_status', 'doctor_first_names', 'doctor_last_names', 'doctor_specialty'],
        properties: {
          appointment_id: { type: 'integer' }, user_id: { type: 'integer', description: 'Incluido al crear la cita.' }, doctor_id: { type: 'integer' },
          appointment_datetime: { type: 'string', format: 'date-time' }, appointment_fee: { type: 'string', description: 'Importe decimal devuelto por MySQL.' },
          appointment_reason: { type: 'string', nullable: true }, appointment_status: { type: 'string', enum: ['scheduled', 'completed', 'canceled'] },
          doctor_first_names: { type: 'string' }, doctor_last_names: { type: 'string' }, doctor_specialty: { type: 'string' }
        }
      },
      AppointmentListResult: { type: 'object', required: ['appointments'], properties: { appointments: { type: 'array', items: schemaRef('Appointment') } } },
      CreatedAppointmentResult: { type: 'object', required: ['appointment'], properties: { appointment: schemaRef('Appointment') } },
      TodayAppointment: {
        type: 'object', required: ['appointment_id', 'appointment_datetime', 'appointment_fee', 'appointment_status', 'appointment_reason', 'user_id', 'user_first_names', 'user_last_names', 'user_email', 'doctor_id', 'doctor_first_names', 'doctor_last_names', 'doctor_specialty'],
        properties: {
          appointment_id: { type: 'integer' }, appointment_datetime: { type: 'string', format: 'date-time' }, appointment_fee: { type: 'string' },
          appointment_status: { type: 'string', enum: ['scheduled', 'completed', 'canceled'] }, appointment_reason: { type: 'string', nullable: true },
          user_id: { type: 'integer' }, user_first_names: { type: 'string' }, user_last_names: { type: 'string' }, user_email: { type: 'string', format: 'email' },
          doctor_id: { type: 'integer' }, doctor_first_names: { type: 'string' }, doctor_last_names: { type: 'string' }, doctor_specialty: { type: 'string' }
        }
      },
      TodayAppointmentListResult: { type: 'object', required: ['appointments'], properties: { appointments: { type: 'array', items: schemaRef('TodayAppointment') } } },
      CreateAppointmentRequest: {
        type: 'object', required: ['doctorId', 'appointmentDatetime'],
        properties: {
          doctorId: { type: 'integer', minimum: 1 },
          appointmentDatetime: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$', example: '2026-11-02 09:30:00' },
          reason: { type: 'string', maxLength: 255, nullable: true }
        }
      },
      UpdateAppointmentStatusRequest: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['completed', 'canceled'] } } },
      MessageResult: { type: 'object', required: ['message'], properties: { message: { type: 'string' } } },
      AppointmentStatusResult: {
        type: 'object', required: ['message', 'status'],
        properties: { message: { type: 'string' }, status: { type: 'string', enum: ['completed', 'canceled'] } }
      },
      Review: {
        type: 'object', required: ['review_id', 'review_rating', 'review_comment', 'review_tags', 'review_wait_minutes', 'review_created_at'],
        properties: {
          review_id: { type: 'integer' }, appointment_id: { type: 'integer', description: 'Incluido al crear la reseña.' },
          review_rating: { type: 'integer', minimum: 1, maximum: 5 }, review_comment: { type: 'string', nullable: true },
          review_tags: { type: 'array', items: { type: 'string' }, nullable: true },
          review_wait_minutes: { type: 'integer', minimum: 0, maximum: 65535, nullable: true },
          review_created_at: { type: 'string', format: 'date-time' }
        }
      },
      ReviewListResult: { type: 'object', required: ['reviews'], properties: { reviews: { type: 'array', items: schemaRef('Review') } } },
      ReviewResult: { type: 'object', required: ['review'], properties: { review: schemaRef('Review') } },
      CreateReviewRequest: {
        type: 'object', required: ['rating'],
        properties: {
          rating: { type: 'integer', minimum: 1, maximum: 5 },
          comment: { type: 'string', maxLength: 500, nullable: true },
          tags: { type: 'array', maxItems: 20, items: { type: 'string', minLength: 1, maxLength: 40 }, nullable: true },
          waitMinutes: { type: 'integer', minimum: 0, maximum: 65535, nullable: true }
        }
      },
      Exam: {
        type: 'object', required: ['exam_id', 'appointment_id', 'exam_name', 'exam_type', 'exam_date', 'exam_value', 'exam_unit', 'exam_reference_min', 'exam_reference_max', 'exam_quantitative_result', 'exam_qualitative_result', 'exam_report', 'exam_image_url'],
        properties: {
          exam_id: { type: 'integer' }, appointment_id: { type: 'integer' }, exam_name: { type: 'string' },
          exam_type: { type: 'string', enum: ['numeric', 'qualitative', 'image'] }, exam_date: { type: 'string', format: 'date' },
          exam_value: { type: 'string', nullable: true, description: 'Importe decimal devuelto por MySQL.' }, exam_unit: { type: 'string', nullable: true },
          exam_reference_min: { type: 'string', nullable: true }, exam_reference_max: { type: 'string', nullable: true },
          exam_quantitative_result: { type: 'string', nullable: true }, exam_qualitative_result: { type: 'string', enum: ['positive', 'negative'], nullable: true },
          exam_report: { type: 'string', nullable: true }, exam_image_url: { type: 'string', format: 'uri', nullable: true }
        }
      },
      ExamListResult: { type: 'object', required: ['exams'], properties: { exams: { type: 'array', items: schemaRef('Exam') } } },
      ExamResult: { type: 'object', required: ['exam'], properties: { exam: schemaRef('Exam') } },
      NumericExamRequest: {
        type: 'object', required: ['appointmentId', 'name', 'type', 'date', 'value', 'referenceMin', 'referenceMax'],
        properties: {
          appointmentId: { type: 'integer', minimum: 1 }, name: { type: 'string', minLength: 1, maxLength: 100 },
          type: { type: 'string', enum: ['numeric'] }, date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          value: { type: 'number' }, unit: { type: 'string', maxLength: 20, nullable: true },
          referenceMin: { type: 'number' }, referenceMax: { type: 'number' },
          quantitativeResult: { type: 'string', nullable: true }
        }
      },
      QualitativeExamRequest: {
        type: 'object', required: ['appointmentId', 'name', 'type', 'date', 'qualitativeResult'],
        properties: {
          appointmentId: { type: 'integer', minimum: 1 }, name: { type: 'string', minLength: 1, maxLength: 100 },
          type: { type: 'string', enum: ['qualitative'] }, date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          qualitativeResult: { type: 'string', enum: ['positive', 'negative'] }, report: { type: 'string', nullable: true }
        }
      },
      ImageExamRequest: {
        type: 'object', required: ['appointmentId', 'name', 'type', 'date', 'report', 'imageUrl'],
        properties: {
          appointmentId: { type: 'integer', minimum: 1 }, name: { type: 'string', minLength: 1, maxLength: 100 },
          type: { type: 'string', enum: ['image'] }, date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          report: { type: 'string', minLength: 1 }, imageUrl: { type: 'string', minLength: 1 }
        }
      },
      CreateExamRequest: {
        oneOf: [schemaRef('NumericExamRequest'), schemaRef('QualitativeExamRequest'), schemaRef('ImageExamRequest')],
        discriminator: { propertyName: 'type' }
      },
      Patient: {
        type: 'object', required: ['user_id', 'user_first_names', 'user_last_names', 'user_email', 'user_phone'],
        properties: {
          user_id: { type: 'integer' }, user_first_names: { type: 'string' }, user_last_names: { type: 'string' },
          user_email: { type: 'string', format: 'email' }, user_phone: { type: 'string', nullable: true }
        }
      },
      PatientListResult: { type: 'object', required: ['patients'], properties: { patients: { type: 'array', items: schemaRef('Patient') } } },
      PatientResult: { type: 'object', required: ['patient'], properties: { patient: schemaRef('Patient') } },
      UpdatePatientRequest: {
        type: 'object', required: ['firstNames', 'lastNames', 'email'],
        properties: {
          firstNames: { type: 'string', minLength: 1, maxLength: 80 },
          lastNames: { type: 'string', minLength: 1, maxLength: 80 },
          email: { type: 'string', format: 'email', maxLength: 120 },
          password: { type: 'string', minLength: 8, maxLength: 72, nullable: true, description: 'Máximo 72 bytes UTF-8.' },
          phone: { type: 'string', maxLength: 20, nullable: true }
        }
      },
      IncomeAppointment: {
        type: 'object', required: ['appointment_id', 'appointment_datetime', 'appointment_fee', 'user_id', 'user_first_names', 'user_last_names', 'doctor_id', 'doctor_first_names', 'doctor_last_names'],
        properties: {
          appointment_id: { type: 'integer' }, appointment_datetime: { type: 'string', format: 'date-time' }, appointment_fee: { type: 'string' },
          user_id: { type: 'integer' }, user_first_names: { type: 'string' }, user_last_names: { type: 'string' },
          doctor_id: { type: 'integer' }, doctor_first_names: { type: 'string' }, doctor_last_names: { type: 'string' }
        }
      },
      IncomeReport: {
        type: 'object', required: ['total', 'appointments'],
        properties: {
          total: { type: 'string', description: 'Importe decimal devuelto por MySQL.' },
          appointments: { type: 'array', items: schemaRef('IncomeAppointment') }
        }
      }
    }
  }
};