'use strict';

// Guard — redirect to login if no token
const token = localStorage.getItem('token');
if (!token) window.location.href = '/login.html';

// ── Logout ────────────────────────────────────────────────────────────────────
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.clear();
  window.location.href = '/login.html';
});

// ── DOM refs ──────────────────────────────────────────────────────────────────
const galleryEl        = document.getElementById('gallery');
const emptyStateEl     = document.getElementById('emptyState');
const pollingIndicator = document.getElementById('pollingIndicator');
const lightbox         = document.getElementById('lightbox');
const lightboxImg      = document.getElementById('lightboxImg');
const lightboxCaption  = document.getElementById('lightboxCaption');

let pollTimer = null;

// ── Fetch and render photos ──────────────────────────────────────────────────
async function fetchPhotos() {
  const res = await fetch('/api/photos/', {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (res.status === 401) {
    localStorage.clear();
    window.location.href = '/login.html';
    return [];
  }

  if (!res.ok) throw new Error('Failed to load photos');
  return res.json();
}

function renderGallery(photos) {
  const cards = galleryEl.querySelectorAll('.photo-card');
  cards.forEach(c => c.remove());

  if (photos.length === 0) {
    emptyStateEl.classList.remove('hidden');
    return;
  }

  emptyStateEl.classList.add('hidden');

  photos.forEach(photo => {
    const card = document.createElement('div');
    card.className = 'photo-card';
    card.dataset.id = photo.id;

    if (photo.status === 'processed' && photo.thumbnail_path) {
      const img = document.createElement('img');
      img.src     = photo.thumbnail_path;
      img.alt     = photo.original_filename;
      img.loading = 'lazy';
      img.addEventListener('click', () => openLightbox(photo));
      card.appendChild(img);

      const badge = document.createElement('span');
      badge.className = 'status-badge processed';
      badge.textContent = 'processed';
      card.appendChild(badge);
    } else {
      card.innerHTML = `
        <div class="processing-placeholder">
          <span class="spinner"></span>
          <p>Processing…</p>
        </div>
        <span class="status-badge pending">pending</span>
      `;
    }

    const caption = document.createElement('p');
    caption.className = 'photo-caption';
    caption.textContent = photo.original_filename;
    card.appendChild(caption);

    // ── Delete button ──────────────────────────────────────────────────────
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.title = 'Delete photo';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // don't open lightbox
      confirmDelete(photo, card);
    });
    card.appendChild(deleteBtn);

    galleryEl.appendChild(card);
  });
}

// ── Delete ────────────────────────────────────────────────────────────────────
async function confirmDelete(photo, card) {
  if (!confirm(`Delete "${photo.original_filename}"?\nThis will also remove all processed variants from MinIO.`)) {
    return;
  }

  // Optimistically remove the card from the DOM
  card.style.opacity = '0.4';
  card.style.pointerEvents = 'none';

  try {
    // DELETE /api/photos/:id → Nginx → gallery-service
    // gallery-service deletes from PostgreSQL + MinIO (original + thumbnail + medium)
    const res = await fetch(`/api/photos/${photo.id}`, {
      method:  'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (res.status === 403) {
      alert('You can only delete your own photos.');
      card.style.opacity = '';
      card.style.pointerEvents = '';
      return;
    }

    if (!res.ok) {
      alert('Delete failed. Please try again.');
      card.style.opacity = '';
      card.style.pointerEvents = '';
      return;
    }

    // Remove card from DOM
    card.remove();

    // Show empty state if no cards remain
    if (!galleryEl.querySelector('.photo-card')) {
      emptyStateEl.classList.remove('hidden');
    }
  } catch {
    alert('Network error — could not delete photo.');
    card.style.opacity = '';
    card.style.pointerEvents = '';
  }
}

// ── Polling ───────────────────────────────────────────────────────────────────
async function loadAndRender() {
  try {
    const photos = await fetchPhotos();
    renderGallery(photos);

    const anyPending = photos.some(p => p.status === 'pending');

    if (anyPending) {
      pollingIndicator.classList.remove('hidden');
      pollTimer = setTimeout(loadAndRender, 3000);
    } else {
      pollingIndicator.classList.add('hidden');
    }
  } catch (err) {
    console.error('Gallery load error:', err);
    galleryEl.innerHTML = `<p class="error">Could not load photos: ${err.message}</p>`;
  }
}

// ── Lightbox ──────────────────────────────────────────────────────────────────
function openLightbox(photo) {
  lightboxImg.src = photo.medium_path || photo.thumbnail_path;
  lightboxCaption.textContent = photo.original_filename;
  lightbox.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

document.getElementById('lightboxClose').addEventListener('click', () => {
  lightbox.classList.add('hidden');
  document.body.style.overflow = '';
});

lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) {
    lightbox.classList.add('hidden');
    document.body.style.overflow = '';
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────
loadAndRender();
