# MediCita Backend

REST API built with Node.js, Express, and MySQL. The code follows the project layers: `routes/` handles HTTP requests, `dao/` contains SQL access, `services/mysql.service.js` provides the shared connection pool, and `env/mysqlConfig.js` reads database configuration.

## Requirements

- Node.js 18 or newer
- MySQL 8.0.16 or newer (the schema uses enforced `CHECK` constraints)

## Setup

1. Create the MySQL database by running `medicitas.sql`. This is the only database setup script; it already includes the current review, schedule, and exam fields. Set `DB_NAME` in `.env` to the database name you want to use, such as `medicita`.
2. Copy `.env.example` to `.env`, configure the MySQL server connection, and set a random `JWT_SECRET` of at least 32 characters. The example file documents the configurable API port, request body limit, authentication rate limit, JWT expiration, and database pool size. The `.env` file is excluded from version control by `.gitignore`.
3. Install dependencies with `npm install`.
4. Start the API with `npm start`. The default port is `5000`.

The static frontend is served from `public/` at `/`. Interactive API documentation is available at `/api-docs`. `GET /api/health` checks the database connection. The home page includes a recent-review carousel populated from the public doctor-review endpoints; if there are no reviews yet, it shows an empty state instead of sample testimonials.

## Frontend

The HTML, CSS, and browser JavaScript live in `public/index.html`, `public/styles.css`, and the ES modules under `public/js/`. The browser code is split by responsibility: `api.js` handles HTTP requests, `authState.js` and `auth.js` manage the session, `doctors.js` renders the public catalog, `appointments.js` and `exams.js` cover patient bookings and results, `admin.js` contains the administration panel, and `ui.js` groups shared interface helpers. Express serves these files from the same origin as the API, so no separate frontend server or CORS configuration is needed for local use. Open `http://localhost:5000` after starting the backend. Patient registration requires a phone number. Patients can browse doctors and their consultation schedules, book/cancel appointments, view upcoming appointments and history, submit ratings and optional comments/tags/wait times for completed appointments, and consult numeric, qualitative, and radiology exam results. The public doctor catalog initially shows up to six professionals in a horizontal carousel; use its arrows to navigate and “Ver más médicos” to reveal additional results. Patients can filter the public catalog by specialty, day, and time, and combine those filters with the name/specialty search. Administrators can search patient and doctor records; the doctor list can also be filtered by specialty, consultation-fee range, and availability by weekday and time. The administration patient and doctor lists show up to six matching records at first; “Ver más” adds the next six while preserving the current search or filters. Administrators can list/create/update patients; list/create/update and activate/deactivate doctors; manage doctor schedules; view the daily agenda and change scheduled appointments to completed/canceled; record exam results; and report completed-appointment income by date range. The JWT is kept in browser `sessionStorage` and sent to protected API routes as a bearer token.

When an administrator is signed in, the frontend keeps the home hero, doctor image, statistics strip, and footer visible while hiding the public about, reviews, doctor catalog, and patient appointment sections. The administration tabs provide patient management, doctor management, today's agenda, and the income report.

## Deploy gratis (Render + MySQL administrado)

Esta app se publica tal cual: un solo servicio Node sirve el frontend y la API, y
la base de datos MySQL vive en un proveedor gratuito (por ejemplo Aiven). No hace
falta cambiar el frontend porque `API_BASE_PATH = '/api'` es relativo.

### 1. Crear la base de datos

1. Crea una cuenta gratuita en [Aiven](https://aiven.io) y un servicio **MySQL**
   (plan Free). Alternativa: [db4free.net](https://www.db4free.net) (más simple,
   pero borra bases inactivas y limita las conexiones).
2. En el panel del servicio copia: host, puerto, usuario, contraseña y nombre de
   la base. Descarga el certificado **CA** (`ca.pem`) si el proveedor lo exige.

### 2. Cargar el esquema

El archivo `db/schema.sql` contiene el esquema sin `CREATE DATABASE`/`USE`, que
los MySQL administrados no permiten. La forma corta es copiar
`.env.deploy.example` a `.env.deploy`, completar las credenciales y ejecutar:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-cloud-db.ps1
```

El script carga `.env.deploy`, crea las tablas y crea la cuenta administradora.
También puedes hacerlo paso a paso: crea un archivo `.env.deploy` o exporta las
variables en tu terminal (no lo subas al repositorio):

```powershell
$env:NODE_ENV="production"
$env:DB_HOST="tu-host.aivencloud.com"
$env:DB_PORT="3306"
$env:DB_USER="avnadmin"
$env:DB_PASSWORD="tu-password"
$env:DB_NAME="defaultdb"
$env:DB_CONNECTION_LIMIT="5"
$env:DB_SSL="true"
$env:DB_SSL_CA_BASE64=[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\ruta\ca.pem"))
$env:JWT_SECRET="pega-aqui-un-secreto-nuevo-de-48-bytes"
npm run db:init -- --confirm-database defaultdb
```

Para generar un `JWT_SECRET` nuevo:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 3. Crear el administrador en la base remota

Con las mismas variables de conexión cargadas:

```powershell
$env:ADMIN_FIRST_NAMES="Claudia"
$env:ADMIN_LAST_NAMES="Cerquera"
$env:ADMIN_EMAIL="tu-correo@ejemplo.com"
$env:ADMIN_PASSWORD="UnaClaveSeguraDe12+"
npm run create-admin
Remove-Item Env:ADMIN_PASSWORD
```

### 4. Publicar en Render

1. Sube el proyecto a un repositorio de GitHub.
2. En [Render](https://render.com) elige **New > Blueprint** y conecta el
   repositorio; `render.yaml` crea el servicio gratis.
3. Render pedirá las variables marcadas con `sync: false`:
   `JWT_SECRET`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` y
   `DB_SSL_CA_BASE64`. Pega los mismos valores del paso 2.
4. Deploy. La URL queda como `https://medicitas.onrender.com`.

Comprueba `https://TU-URL.onrender.com/api/health`; debe responder
`{"status":"ok","database":"connected"}`.

### Notas del plan gratuito

- Render suspende el servicio tras ~15 minutos sin visitas: la primera visita
  tarda alrededor de un minuto en despertar. Después responde normal.
- Si el proveedor de MySQL tiene lista de IPs permitidas, déjala sin restricción
  o permite `0.0.0.0/0`, porque Render usa IPs de salida dinámicas.
- `NODE_ENV=production` activa `trust proxy` (necesario para el rate limit
  detrás del proxy de Render) y deja de imprimir errores internos en consola.
- Nunca subas `.env` ni `*.pem`; ambos están en `.gitignore`.

## Initial admin account

Public registration always creates a patient (`user_role = '2'`). To create the first administrator, temporarily add `ADMIN_FIRST_NAMES`, `ADMIN_LAST_NAMES`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` to `.env`. Use a password with at least 12 characters, then run `npm run create-admin`. Remove `ADMIN_PASSWORD` from `.env` after the account is created. Admin accounts are never created through the public API.

Roles are `1 = admin` and `2 = patient`.

## Password storage evolution

The original design stored user passwords as plain text and compared them directly during login. The current design uses bcrypt with a unique salt per password: registration, admin-created patients, admin password changes, and new administrator accounts hash passwords on the server, and login verifies the submitted password against the stored hash.

### Registration endpoint password hashing

The public registration endpoint is `POST /api/users`. Its password handling was updated so the submitted password is hashed on the server before the user is persisted:

1. The endpoint validates the registration fields and checks whether the email is already registered.
2. Before calling `userDao.createPatient`, it passes the submitted password to `hashPassword`:

   ```js
   password: await hashPassword(password)
   ```

3. `hashPassword` in `services/password.service.js` calls `bcrypt.hash` with 12 salt rounds. Bcrypt generates a random salt for the password and includes the salt and cost information in the resulting hash.
4. The endpoint passes that hash—not the submitted password—to `createPatient`. `dao/user.dao.js` stores the received value in `users.user_password` using a parameterized query.
5. The response includes the public user fields and an authentication token; it does not return the password or its hash.

Thus, the value written to the database during registration is the bcrypt hash. This is a one-way password hash, not encrypted text that the application later decrypts.

Existing plain-text passwords must be migrated once. Back up the database, test the migration on a restored copy first, and stop the API while migrating. Set `DB_NAME` to the intended database, then pass that exact name to the command. For example, with `DB_NAME=medicita_prueba_20261102`, run `npm run migrate-passwords -- --confirm-database medicita_prueba_20261102`. The command checks the actual connected database, skips bcrypt hashes so it can be safely rerun, and rolls back if any existing password exceeds bcrypt's 72-byte input limit. Such accounts need a password reset before migration can complete. Never run this command without a verified backup and explicit confirmation of the target database.

## API documentation

Open `/api-docs` while the API is running to browse the OpenAPI documentation and try requests interactively. Protected operations use a Bearer token returned by registration or login.

## API endpoints

| Method | Path | Access |
| --- | --- | --- |
| `GET` | `/api/stats` | Public; counts active doctors and registered patients |
| `POST` | `/api/users` | Public; creates a patient |
| `POST` | `/api/sessions` | Public; authenticates a user |
| `GET` | `/api/auth/me` | Authenticated |
| `GET` | `/api/doctors` | Public; active doctors |
| `GET` | `/api/doctors/:doctorId` | Public |
| `GET` | `/api/doctors/:doctorId/schedules` | Public |
| `POST` | `/api/doctors` | Admin |
| `PUT` | `/api/doctors/:doctorId` | Admin |
| `POST` | `/api/doctors/:doctorId/schedules` | Admin |
| `DELETE` | `/api/doctors/:doctorId/schedules/:scheduleId` | Admin |
| `POST` | `/api/appointments` | Patient |
| `GET` | `/api/appointments/me` | Patient; own appointments |
| `GET` | `/api/appointments/me/upcoming` | Patient; future scheduled appointments |
| `GET` | `/api/appointments/me/history` | Patient; past, completed, or canceled appointments |
| `PATCH` | `/api/appointments/:appointmentId` | Patient; own scheduled appointment (send `{"status":"canceled"}`) |
| `GET` | `/api/appointments/admin/today` | Admin |
| `PATCH` | `/api/appointments/:appointmentId` | Admin; scheduled appointment (send `{"status":"completed"}` or `{"status":"canceled"}`) |
| `GET` | `/api/reviews/doctor/:doctorId` | Public |
| `POST` | `/api/reviews/appointments/:appointmentId` | Patient; own completed appointment |
| `GET` | `/api/exams/appointments/:appointmentId` | Patient; own appointment |
| `GET` | `/api/exams/me` | Patient; all own exam results |
| `POST` | `/api/exams` | Admin |
| `GET` | `/api/admin/patients` | Admin |
| `POST` | `/api/admin/patients` | Admin; creates a patient |
| `PUT` | `/api/admin/patients/:patientId` | Admin; updates patient details (optional password) |
| `GET` | `/api/admin/doctors` | Admin; lists active and inactive doctors |
| `GET` | `/api/admin/reports/income?from=YYYY-MM-DD&to=YYYY-MM-DD` | Admin |

Send the JWT returned by registration or login as `Authorization: Bearer <token>` for protected endpoints. Request fields and public authentication users use English camelCase. DAO-backed response records expose the selected database columns in English snake_case.

## Request examples

Register a patient:

```json
{
  "firstNames": "Alex",
  "lastNames": "Morgan",
  "email": "alex@example.com",
  "password": "a-long-password",
  "phone": "555-0100"
}
```

Book an appointment (database-local time):

```json
{
  "doctorId": 1,
  "appointmentDatetime": "2026-11-02 09:30:00",
  "reason": "Annual checkup"
}
```

## Known schema constraints

- A doctor can have one schedule interval per day, Monday through Sunday (`dayOfWeek`: 1 = Monday, 7 = Sunday).
- Appointment uniqueness prevents duplicate start times, but appointment duration and overlapping intervals are not modeled.
- Numeric exam results include lower and upper reference limits; reviews support optional tags and waiting time.
- The API stores a reference to a radiology image (`imageUrl`); image files must be hosted or stored by a separate file service.
- Income reports total completed appointments by their recorded `appointment_fee`; separate payment transactions are not modeled.
