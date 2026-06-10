/* ============================================================
   MediCore — auth.js
   Autenticación con Supabase Auth + tabla usuarios_perfil
   ============================================================ */

// ── Supabase Auth (usa misma config de shared.js) ─────────────
const SUPABASE_AUTH_URL = SUPABASE_URL + '/auth/v1';

async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_AUTH_URL}/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Error al iniciar sesión');
  return data; // { access_token, user, ... }
}

async function signOut() {
  const token = DB.getObj('session')?.access_token;
  if (token) {
    await fetch(`${SUPABASE_AUTH_URL}/logout`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${token}` },
    }).catch(() => {});
  }
  DB.setObj('session', null);
  DB.setObj('perfil', null);
  window.location.href = 'login.html';
}

function getSession() {
  return DB.getObj('session');
}

function saveSession(sessionData) {
  DB.setObj('session', {
    access_token:  sessionData.access_token,
    refresh_token: sessionData.refresh_token,
    user_id:       sessionData.user?.id,
    email:         sessionData.user?.email,
    expires_at:    Date.now() + (sessionData.expires_in || 3600) * 1000,
  });
}

function isSessionValid() {
  const s = getSession();
  if (!s || !s.access_token) return false;
  return Date.now() < (s.expires_at - 60000); // 1 min de margen
}

// ── Cargar perfil desde usuarios_perfil ──────────────────────
async function cargarPerfil(userId) {
  // Intenta desde cache local primero
  const cached = DB.getObj('perfil');
  if (cached && cached.user_id === userId) return cached;

  try {
    const rows = await sbFetch(`usuarios_perfil?user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`);
    const perfil = rows[0] ?? null;
    if (perfil) DB.setObj('perfil', perfil);
    return perfil;
  } catch (e) {
    console.error('Error cargando perfil:', e);
    // Perfil mínimo de fallback para que la app no rompa
    return { user_id: userId, nombre: 'Usuario', rol: 'medico' };
  }
}

// ── requireAuth: llama al inicio de cada página protegida ─────
// Redirige a login.html si no hay sesión válida
// Retorna el perfil del usuario logueado
async function requireAuth() {
  if (!isSessionValid()) {
    window.location.href = 'login.html';
    return null;
  }
  const s = getSession();
  const perfil = await cargarPerfil(s.user_id);
  return perfil;
}

// ── renderUserHeader: muestra nombre/rol en el header ─────────
function renderUserHeader(perfil) {
  if (!perfil) return;
  // Busca el contenedor del nav-right y añade el chip de usuario
  const navRight = document.querySelector('.nav-right');
  if (!navRight) return;
  const existing = navRight.querySelector('.user-chip');
  if (existing) existing.remove();

  const chip = document.createElement('div');
  chip.className = 'user-chip';
  chip.style.cssText = 'display:flex;align-items:center;gap:.5rem;cursor:pointer;';
  chip.innerHTML = `
    <div style="width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.2);
      color:white;display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:700;">
      ${(perfil.nombre || perfil.email || 'U').charAt(0).toUpperCase()}
    </div>
    <div style="line-height:1.2">
      <div style="font-size:.75rem;font-weight:600;color:white">${perfil.nombre || perfil.email || 'Usuario'}</div>
      <div style="font-size:.6rem;opacity:.7;color:white;text-transform:capitalize">${perfil.rol || 'usuario'}</div>
    </div>
    <button onclick="signOut()" title="Cerrar sesión"
      style="background:rgba(255,255,255,.15);border:none;color:white;cursor:pointer;
      border-radius:6px;padding:.25rem .5rem;font-size:.65rem;margin-left:.25rem;">Salir</button>`;
  navRight.appendChild(chip);
}

// ── applyRoleAccess: muestra/oculta elementos según rol ───────
function applyRoleAccess(rol) {
  // Elementos con data-role="admin" solo visibles para admin
  document.querySelectorAll('[data-role]').forEach(el => {
    const required = el.getAttribute('data-role');
    if (required && required !== rol) el.style.display = 'none';
  });
}

// ── Login form handler (usado en login.html) ──────────────────
async function handleLogin(e) {
  if (e) e.preventDefault();
  const email    = document.getElementById('login-email')?.value?.trim();
  const password = document.getElementById('login-password')?.value;
  const errEl    = document.getElementById('login-error');
  const btnEl    = document.getElementById('login-btn');

  if (!email || !password) {
    if (errEl) errEl.textContent = 'Completa todos los campos.';
    return;
  }
  if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Ingresando…'; }
  if (errEl) errEl.textContent = '';

  try {
    const session = await signIn(email, password);
    saveSession(session);
    // Precargar perfil
    await cargarPerfil(session.user.id);
    window.location.href = 'index.html';
  } catch (err) {
    if (errEl) errEl.textContent = err.message;
  } finally {
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Ingresar'; }
  }
}