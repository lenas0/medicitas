import { bindAdminEvents } from './admin.js';
import { bindAppointmentEvents } from './appointments.js';
import { bindAuthEvents, restoreSession } from './auth.js';
import { bindDoctorEvents, loadDoctors } from './doctors.js';
import { bindExamEvents } from './exams.js';
import { bindReviewEvents } from './reviews.js';
import { loadPublicStats } from './stats.js';

bindAuthEvents();
bindDoctorEvents();
bindReviewEvents();
bindAppointmentEvents();
bindExamEvents();
bindAdminEvents();

loadDoctors();
loadPublicStats();
restoreSession();
