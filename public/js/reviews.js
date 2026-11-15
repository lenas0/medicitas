import { apiRequest } from './api.js';
import { MAX_FEATURED_REVIEWS } from './constants.js';
import { createCarousel, renderStarRating, runFormSubmission, showToast } from './ui.js';
import { getDoctors, getDoctorLoadError, isDoctorsLoaded, loadDoctors } from './doctors.js';

const featuredReviews = document.querySelector('#featured-reviews');
const reviewsStatus = document.querySelector('#reviews-status');
const reviewsCarousel = createCarousel({
  track: featuredReviews,
  previousButton: document.querySelector('#reviews-previous'),
  nextButton: document.querySelector('#reviews-next')
});

let featuredReviewsLoaded = false;

function createTestimonialCard({ review, doctor }) {
  const card = document.createElement('article');
  card.className = 'testimonial-card';

  const stars = document.createElement('p');
  stars.className = 'testimonial-stars';
  stars.setAttribute('aria-label', `${review.review_rating} de 5 estrellas`);
  renderStarRating(stars, review.review_rating);

  const comment = document.createElement('blockquote');
  comment.textContent = review.review_comment?.trim() || 'El paciente dejó una calificación sin comentario.';

  const patient = document.createElement('div');
  patient.className = 'testimonial-author';
  const avatar = document.createElement('span');
  avatar.className = 'testimonial-avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = 'P';
  const identity = document.createElement('span');
  identity.className = 'testimonial-identity';
  const authorName = document.createElement('strong');
  authorName.textContent = 'Paciente';
  const doctorName = document.createElement('small');
  doctorName.textContent = `Atendido/a por ${doctor.doctor_first_names} ${doctor.doctor_last_names} · ${doctor.doctor_specialty}`;
  identity.append(authorName, doctorName);
  patient.append(avatar, identity);

  card.append(stars, comment);

  if (Array.isArray(review.review_tags) && review.review_tags.length) {
    const tags = document.createElement('p');
    tags.className = 'testimonial-tags';
    tags.textContent = review.review_tags.join(' · ');
    card.append(tags);
  }

  if (review.review_wait_minutes != null) {
    const wait = document.createElement('p');
    wait.className = 'testimonial-wait';
    wait.textContent = `Espera: ${review.review_wait_minutes} min`;
    card.append(wait);
  }

  card.append(patient);
  return card;
}

function renderFeaturedReviews(reviews) {
  if (!reviews.length) {
    const empty = document.createElement('p');
    empty.className = 'testimonial-empty';
    empty.textContent = 'Aún no hay reseñas de citas publicadas.';
    featuredReviews.replaceChildren(empty);
    reviewsStatus.textContent = '';
    reviewsCarousel.update();
    return;
  }

  featuredReviews.replaceChildren(...reviews.map(createTestimonialCard));
  reviewsStatus.textContent = `Mostrando ${reviews.length} reseña${reviews.length === 1 ? '' : 's'} reciente${reviews.length === 1 ? '' : 's'}.`;
  featuredReviews.scrollLeft = 0;
  reviewsCarousel.update();
}

export async function loadFeaturedReviews() {
  if (featuredReviewsLoaded || !isDoctorsLoaded()) return;
  featuredReviewsLoaded = true;

  const doctorLoadError = getDoctorLoadError();
  if (doctorLoadError) {
    featuredReviews.replaceChildren();
    const error = document.createElement('p');
    error.className = 'testimonial-empty';
    error.textContent = 'No se pudieron cargar las reseñas porque el catálogo de médicos no está disponible.';
    featuredReviews.append(error);
    reviewsStatus.textContent = doctorLoadError;
    return;
  }

  const doctors = getDoctors();
  if (!doctors.length) {
    renderFeaturedReviews([]);
    return;
  }

  const results = await Promise.allSettled(doctors.map(async (doctor) => {
    const { reviews } = await apiRequest(`/reviews/doctor/${doctor.doctor_id}`);
    return reviews.map((review) => ({ review, doctor }));
  }));
  const reviews = [];
  let failedRequests = 0;

  for (const result of results) {
    if (result.status === 'fulfilled') reviews.push(...result.value);
    else failedRequests += 1;
  }

  reviews.sort((left, right) =>
    new Date(right.review.review_created_at).getTime() - new Date(left.review.review_created_at).getTime()
  );
  renderFeaturedReviews(reviews.slice(0, MAX_FEATURED_REVIEWS));

  if (failedRequests === results.length) {
    reviewsStatus.textContent = 'No se pudieron cargar las reseñas. Intenta actualizar la página.';
  } else if (failedRequests > 0) {
    reviewsStatus.textContent = 'Algunas reseñas no pudieron cargarse.';
  }
}

export async function loadDoctorReviews(doctorId, container) {
  container.dataset.loaded = 'true';
  const message = document.createElement('p');
  message.textContent = 'Cargando reseñas…';
  container.append(message);
  try {
    const { reviews = [] } = await apiRequest(`/reviews/doctor/${doctorId}`);
    message.remove();
    if (!reviews.length) {
      const empty = document.createElement('p');
      empty.textContent = 'Todavía no hay reseñas para este profesional.';
      container.append(empty);
      return;
    }
    for (const review of reviews) {
      container.append(createReviewLine(review));
    }
  } catch (error) {
    message.textContent = error.message;
  }
}

function createReviewLine(review) {
  const item = document.createElement('p');
  const stars = document.createElement('span');
  stars.className = 'inline-stars';
  stars.setAttribute('aria-label', `${review.review_rating} de 5 estrellas`);
  renderStarRating(stars, review.review_rating);

  const details = [];
  if (review.review_comment) details.push(` · ${review.review_comment}`);
  if (Array.isArray(review.review_tags)) details.push(` · ${review.review_tags.join(', ')}`);
  if (review.review_wait_minutes != null) details.push(` · Espera: ${review.review_wait_minutes} min`);

  item.append(stars, document.createTextNode(details.join('')));
  return item;
}

export function openReviewForm(appointmentId) {
  const form = document.querySelector('#review-form');
  form.reset();
  form.elements.appointmentId.value = appointmentId;
  document.querySelector('#review-message').textContent = '';
  document.querySelector('#review-dialog').showModal();
}

export function bindReviewEvents() {
  document.querySelector('#review-close').addEventListener('click', () => document.querySelector('#review-dialog').close());
  document.querySelector('#reviews-previous').addEventListener('click', () => reviewsCarousel.scroll(-1));
  document.querySelector('#reviews-next').addEventListener('click', () => reviewsCarousel.scroll(1));
  featuredReviews.addEventListener('scroll', () => reviewsCarousel.update(), { passive: true });
  window.addEventListener('resize', () => reviewsCarousel.update());

  document.querySelector('#review-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = document.querySelector('#review-message');
    runFormSubmission(form, message, async (values) => {
      const tags = values.get('tags').split(',').map((tag) => tag.trim()).filter(Boolean);
      const waitInput = values.get('waitMinutes');
      await apiRequest(`/reviews/appointments/${values.get('appointmentId')}`, {
        method: 'POST',
        authenticated: true,
        body: {
          rating: Number(values.get('rating')),
          comment: values.get('comment') || undefined,
          tags: tags.length ? tags : undefined,
          waitMinutes: waitInput ? Number(waitInput) : undefined
        }
      });
      document.querySelector('#review-dialog').close();
      form.reset();
      showToast('Gracias, tu reseña fue registrada.');
      await loadDoctors();
    });
  });
}
