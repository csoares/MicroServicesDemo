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
const dropZone  = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const browseBtn = document.getElementById('browseBtn');
const dropLabel = document.getElementById('dropLabel');
const preview   = document.getElementById('preview');
const submitBtn = document.getElementById('submitBtn');
const errorEl   = document.getElementById('error');
const successEl = document.getElementById('success');

let selectedFile = null;

// ── File selection ─────────────────────────────────────────────────────────────
browseBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
  if (fileInput.files.length) handleFileSelected(fileInput.files[0]);
});

// Drag and drop
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', ()  => { dropZone.classList.remove('drag-over'); });
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  if (e.dataTransfer.files.length) handleFileSelected(e.dataTransfer.files[0]);
});

function handleFileSelected(file) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowed.includes(file.type)) {
    showError('Only image files are accepted (JPEG, PNG, WebP, GIF)');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showError('File must be under 10 MB');
    return;
  }

  selectedFile = file;
  hideError();

  // Show preview
  const reader = new FileReader();
  reader.onload = (e) => {
    preview.src = e.target.result;
    preview.classList.remove('hidden');
    dropLabel.classList.add('hidden');
  };
  reader.readAsDataURL(file);

  submitBtn.disabled = false;
}

// ── Upload ─────────────────────────────────────────────────────────────────────
document.getElementById('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedFile) return;

  setLoading(true);

  // Use FormData for multipart upload.
  // IMPORTANT: Do NOT manually set Content-Type — the browser adds the correct
  // multipart boundary automatically. Setting it manually breaks the upload.
  const formData = new FormData();
  formData.append('photo', selectedFile);

  try {
    // POST /api/photos/upload → Nginx → gallery-service (Node.js + Express)
    const res = await fetch('/api/photos/upload', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      // No Content-Type header — browser handles it
      body:    formData,
    });

    const data = await res.json();

    if (!res.ok) {
      showError(data.error || 'Upload failed');
      return;
    }

    showSuccess(`Photo uploaded! Processing in background… Photo ID: ${data.id}`);
    submitBtn.disabled = true;

    // Redirect to gallery after a brief delay so the user sees the success message
    setTimeout(() => (window.location.href = '/gallery.html'), 1800);
  } catch {
    showError('Network error — is the gallery service running?');
  } finally {
    setLoading(false);
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function showError(msg) { errorEl.textContent = msg; errorEl.classList.remove('hidden'); }
function hideError()    { errorEl.classList.add('hidden'); }

function showSuccess(msg) { successEl.textContent = msg; successEl.classList.remove('hidden'); }

function setLoading(loading) {
  submitBtn.disabled = loading;
  submitBtn.textContent = loading ? 'Uploading…' : 'Upload';
}
