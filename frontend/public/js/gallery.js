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
  // GET /api/photos → Nginx → gallery-service (Node.js + Express)
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
  // Clear existing cards (except empty-state placeholder)
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

    if (photo.status === 'processed' && photo.thumbnail_path) {
      // Thumbnail path stored as an absolute container path (/uploads/thumbnails/xxx.jpg).
      // Nginx serves /uploads/ via the alias directive — path maps directly to a URL.
      const imgSrc = photo.thumbnail_path; // e.g. /uploads/thumbnails/uuid.jpg

      const img = document.createElement('img');
      img.src   = imgSrc;
      img.alt   = photo.original_filename;
      img.loading = 'lazy';
      img.addEventListener('click', () => openLightbox(photo));
      card.appendChild(img);

      const badge = document.createElement('span');
      badge.className = 'status-badge processed';
      badge.textContent = 'processed';
      card.appendChild(badge);
    } else {
      // Not yet processed — show a spinner placeholder
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

    galleryEl.appendChild(card);
  });
}

// ── Polling ───────────────────────────────────────────────────────────────────
// When any photo is still pending, poll every 3 seconds to pick up the
// 'processed' status update. This demonstrates eventual consistency —
// students can watch the thumbnails appear in real time.

async function loadAndRender() {
  try {
    const photos = await fetchPhotos();
    renderGallery(photos);

    const anyPending = photos.some(p => p.status === 'pending');

    if (anyPending) {
      pollingIndicator.classList.remove('hidden');
      // Schedule next poll
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
  lightboxImg.src     = photo.medium_path || photo.thumbnail_path;
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
