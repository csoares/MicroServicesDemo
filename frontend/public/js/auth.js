'use strict';

// ── Helpers ──────────────────────────────────────────────────────────────────

function showError(msg) {
  const el = document.getElementById('error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function showSuccess(msg) {
  const el = document.getElementById('success');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}

function setLoading(loading) {
  const btn = document.getElementById('submitBtn');
  btn.disabled = loading;
  btn.textContent = loading ? 'Please wait…' : btn.dataset.label;
}

// ── Login ─────────────────────────────────────────────────────────────────────

const loginForm = document.getElementById('loginForm');
if (loginForm) {
  const btn = document.getElementById('submitBtn');
  btn.dataset.label = btn.textContent;

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    setLoading(true);

    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
      // POST /api/auth/login → Nginx → auth-service (Go + Gin)
      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        showError(data.error || 'Login failed');
        return;
      }

      // Store the JWT — subsequent requests send it as Authorization: Bearer <token>
      localStorage.setItem('token',    data.token);
      localStorage.setItem('username', data.username || email.split('@')[0]);

      window.location.href = '/gallery.html';
    } catch {
      showError('Network error — is the auth service running?');
    } finally {
      setLoading(false);
    }
  });
}

// ── Register ──────────────────────────────────────────────────────────────────

const registerForm = document.getElementById('registerForm');
if (registerForm) {
  const btn = document.getElementById('submitBtn');
  btn.dataset.label = btn.textContent;

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    setLoading(true);

    const username = document.getElementById('username').value.trim();
    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
      // POST /api/auth/register → Nginx → auth-service (Go + Gin)
      const res = await fetch('/api/auth/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        showError(data.error || 'Registration failed');
        return;
      }

      showSuccess('Account created! Redirecting to login…');
      setTimeout(() => (window.location.href = '/login.html'), 1500);
    } catch {
      showError('Network error — is the auth service running?');
    } finally {
      setLoading(false);
    }
  });
}
