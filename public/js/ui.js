import {
  CAROUSEL_EDGE_THRESHOLD_PX,
  CAROUSEL_MIN_STEP_PX,
  CAROUSEL_STEP_RATIO,
  TOAST_DURATION_MS
} from './constants.js';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const STAR_PATH = 'M12 3.2l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.4l5.9-.9z';
const MAX_RATING = 5;

const toast = document.querySelector('#toast');
let toastTimer;

export function showToast(message, isError = false) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('visible');
  toastTimer = window.setTimeout(() => toast.classList.remove('visible'), TOAST_DURATION_MS);
}

export function setFormMessage(element, message, success = false) {
  element.textContent = message;
  element.classList.toggle('success', success);
  element.classList.toggle('error', Boolean(message) && !success);
}

export function makeActionButton(label, className, action) {
  const button = document.createElement('button');
  button.className = `button ${className}`;
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', action);
  return button;
}

export async function runFormSubmission(form, messageElement, task) {
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  setFormMessage(messageElement, '');
  try {
    await task(new FormData(form));
  } catch (error) {
    setFormMessage(messageElement, error.message);
  } finally {
    submitButton.disabled = false;
  }
}

export function createCarousel({ track, previousButton, nextButton }) {
  function update() {
    const canScroll = track.scrollWidth > track.clientWidth + CAROUSEL_EDGE_THRESHOLD_PX;
    previousButton.disabled = !canScroll || track.scrollLeft <= CAROUSEL_EDGE_THRESHOLD_PX;
    nextButton.disabled = !canScroll || track.scrollLeft + track.clientWidth >= track.scrollWidth - CAROUSEL_EDGE_THRESHOLD_PX;
  }

  function scroll(direction) {
    track.scrollBy({
      left: direction * Math.max(track.clientWidth * CAROUSEL_STEP_RATIO, CAROUSEL_MIN_STEP_PX),
      behavior: 'smooth'
    });
  }

  return { update, scroll };
}

function createStar(filled) {
  const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('star-icon');
  if (!filled) svg.classList.add('empty');
  const path = document.createElementNS(SVG_NAMESPACE, 'path');
  path.setAttribute('d', STAR_PATH);
  svg.append(path);
  return svg;
}

export function renderStarRating(container, rating) {
  const ratingValue = Number(rating) || 0;
  const stars = Array.from({ length: MAX_RATING }, (_, index) => createStar(index < ratingValue));
  container.replaceChildren(...stars);
}
