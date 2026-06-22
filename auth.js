const SUPABASE_AUTH_URL = SUPABASE_URL + '/auth/v1';

async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_AUTH_URL}/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Error al iniciar sesion');
  return data;
}

async function signOut() {
  DB.setObj('session', null);
  DB.setObj('perfil', null);
  window.location.href = 'login.html';
}

function saveSession(sessionData) {
  DB.setObj('session', {
    access_token: sessionData.access_token,
    refresh_token: sessionData.refresh_token,
    user_id: sessionData.user?.id,
    email: sessionData.user?.email,
    expires_at: Date.now() + (sessionData.expires_in || 3600) * 1000,
  });
}

function getSession() {
  return DB.getObj('session');
}

function isSessionValid() {
  const s = getSession();
  return !!(s && s.access_token && Date.now() < s.expires_at - 60000);
}

async function cargarPerfil(userId) {
  const cached = DB.getObj('perfil');
  if (cached && cached.user_id === userId) return cached;

  try {
    const rows = await sbFetch(`usuarios_perfil?user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`);
    const perfil = rows[0] || { user_id: userId, nombre: 'Usuario', rol: 'Administrador' };
    DB.setObj('perfil', perfil);
    return perfil;
  } catch {
    return { user_id: userId, nombre: 'Usuario', rol: 'Administrador' };
  }
}

async function requireAuth() {
  if (!isSessionValid()) {
    window.location.href = 'login.html';
    return null;
  }
  return cargarPerfil(getSession().user_id);
}

function switchTab(tab) {
  const login = tab === 'login';
  document.getElementById('panel-login').style.display = login ? 'block' : 'none';
  document.getElementById('panel-registro').style.display = login ? 'none' : 'block';
  document.getElementById('tab-login').classList.toggle('active', login);
  document.getElementById('tab-registro').classList.toggle('active', !login);
}

function showAuthAlert(id, msg, type = 'error') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = `auth-alert ${type} show`;
}

async function handleLogin(e) {
  if (e) e.preventDefault();

  const email = document.getElementById('login-email')?.value?.trim();
  const password = document.getElementById('login-password')?.value;

  if (!email || !password) {
    showAuthAlert('alert-login', 'Completa todos los campos.');
    return;
  }

  try {
    const session = await signIn(email, password);
    saveSession(session);
    await cargarPerfil(session.user.id);
    window.location.href = 'index.html';
  } catch (err) {
    showAuthAlert('alert-login', err.message);
  }
}

function renderUserHeader(perfil) {
  if (!perfil) return;
  const navRight = document.querySelector('.nav-right');
  if (!navRight) return;

  const chip = document.createElement('div');
  chip.className = 'user-chip';
  chip.innerHTML = `
    <div style="color:white;font-size:.75rem;font-weight:600">
      ${perfil.nombre || perfil.email || 'Usuario'}
    </div>
    <button onclick="signOut()" style="margin-left:.5rem">Salir</button>
  `;
  navRight.appendChild(chip);
}

function applyRoleAccess(rol) {
  document.querySelectorAll('[data-role]').forEach(el => {
    const required = el.getAttribute('data-role');
    if (required && required !== rol) el.style.display = 'none';
  });
}