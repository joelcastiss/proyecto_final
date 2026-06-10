/* ============================================================
   MediCore — auth.js
   Autenticación con Supabase: Login · Registro · Guard · Roles
   ============================================================

   CÓMO USAR ESTE ARCHIVO:
   1. Añade <script src="auth.js"></script> en CADA página protegida
      (después de shared.js pero antes del JS propio del módulo).
   2. En las páginas internas llama a requireAuth() al inicio del
      DOMContentLoaded de ese módulo, o agrega el script con el
      bloque de inicialización que se muestra al final de este archivo.
   3. login.html ya importa este archivo y usa handleLogin()
      y handleRegistro() directamente.
============================================================ */

// ── Configuración Supabase ────────────────────────────────
// Usa las mismas constantes que ya tienes en shared.js
const SUPABASE_URL  = typeof SUPABASE_URL_SH  !== 'undefined' ? SUPABASE_URL_SH  : 'https://bhawfcvnthzdwmkgwgxj.supabase.co';
const SUPABASE_ANON = typeof SUPABASE_ANON_SH !== 'undefined' ? SUPABASE_ANON_SH : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoYXdmY3ZudGh6ZHdta2d3Z3hqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MzY4MjUsImV4cCI6MjA5NjAxMjgyNX0.gpaCKHr2HqAg7k0Zb4VolKWNEZvBrgE7Y2bJuL27PYc';

/* ──────────────────────────────────────────────────────────
   HELPERS INTERNOS — fetch wrapper para Supabase REST API
   ────────────────────────────────────────────────────────── */

/** Cabeceras base con el token de sesión actual (o anon si no hay sesión) */
function _headers(token) {
  return {
    'apikey':        SUPABASE_ANON,
    'Authorization': `Bearer ${token || SUPABASE_ANON}`,
    'Content-Type':  'application/json',
    'Prefer':        'return=minimal',
  };
}

/** Obtiene la sesión almacenada en localStorage por Supabase JS v2 */
function _getStoredSession() {
  try {
    // Supabase v2 guarda la sesión en una clave como sb-<ref>-auth-token
    const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (!key) return null;
    return JSON.parse(localStorage.getItem(key));
  } catch { return null; }
}

function _getAccessToken() {
  const session = _getStoredSession();
  return session?.access_token || null;
}

function _getUserId() {
  const session = _getStoredSession();
  return session?.user?.id || null;
}

/* ──────────────────────────────────────────────────────────
   SESIÓN
   ────────────────────────────────────────────────────────── */

/**
 * Verifica si hay una sesión activa.
 * Hace una petición a Supabase para validar el token.
 * Retorna { user, session } o null.
 */
async function getSession() {
  const token = _getAccessToken();
  if (!token) return null;

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey':        SUPABASE_ANON,
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;
    const user = await res.json();
    return { user, access_token: token };
  } catch { return null; }
}

/**
 * Cierra la sesión del usuario.
 * Invalida el token en Supabase y limpia localStorage.
 */
async function signOut() {
  const token = _getAccessToken();
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: {
        'apikey':        SUPABASE_ANON,
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
      },
    });
  } catch { /* continúa aunque falle la red */ }

  // Limpia la sesión local de Supabase
  const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
  if (key) localStorage.removeItem(key);

  // Limpia caché de perfil
  localStorage.removeItem('medicore_perfil');

  window.location.href = 'login.html';
}

/* ──────────────────────────────────────────────────────────
   AUTH GUARD — protege las páginas internas
   ────────────────────────────────────────────────────────── */

/**
 * Llama esta función en cada página protegida.
 * Si no hay sesión válida → redirige a login.html.
 * Si hay sesión → retorna el perfil del usuario (con su rol).
 *
 * Uso:
 *   document.addEventListener('DOMContentLoaded', async () => {
 *     const perfil = await requireAuth();
 *     applyRoleAccess(perfil.rol);
 *     // ... resto de inicialización del módulo
 *   });
 */
async function requireAuth() {
  const session = await getSession();
  if (!session) {
    window.location.replace('login.html');
    return null;
  }

  // Intenta obtener el perfil desde caché local primero (evita petición extra)
  const cached = localStorage.getItem('medicore_perfil');
  if (cached) {
    try { return JSON.parse(cached); } catch { /* ignora */ }
  }

  // Consulta la tabla usuarios_perfil en Supabase
  const perfil = await fetchPerfil(session.user.id, session.access_token);
  if (perfil) {
    localStorage.setItem('medicore_perfil', JSON.stringify(perfil));
  }
  return perfil;
}

/** Obtiene el perfil del usuario desde la tabla usuarios_perfil */
async function fetchPerfil(userId, token) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/usuarios_perfil?user_id=eq.${userId}&select=*&limit=1`,
      { headers: _headers(token) }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows[0] || null;
  } catch { return null; }
}

/* ──────────────────────────────────────────────────────────
   CONTROL DE ACCESO POR ROL — aplica visibilidad en el DOM
   ────────────────────────────────────────────────────────── */

/**
 * Matriz de permisos: qué puede ver cada rol.
 * Los valores corresponden a los href de los nav-item.
 */
const ROL_ACCESO = {
  'Administrador': ['index.html', 'pacientes.html', 'citas.html', 'sala-espera.html', 'historial.html', 'reportes.html'],
  'Recepción':     ['index.html', 'pacientes.html', 'citas.html', 'sala-espera.html'],
  'Médico':        ['index.html', 'sala-espera.html', 'historial.html'],
  'Enfermería':    ['index.html', 'sala-espera.html'],
};

/**
 * Oculta los elementos del DOM que el rol no puede ver.
 *
 * Estrategia:
 *  - En la navegación: oculta los <a class="nav-item"> cuyo href no esté en el rol.
 *  - En index.html: oculta las .module-card y .quick-card que apunten a páginas restringidas.
 *  - En cualquier página: si el rol no tiene acceso a ESA página → redirige a index.html.
 *
 * @param {string} rol — 'Administrador' | 'Recepción' | 'Médico' | 'Enfermería'
 */
function applyRoleAccess(rol) {
  if (!rol) return;

  const permitidas = ROL_ACCESO[rol] || [];
  const paginaActual = window.location.pathname.split('/').pop() || 'index.html';

  // 1. ¿Tiene acceso a esta página?
  if (paginaActual !== 'login.html' && paginaActual !== 'index.html') {
    if (!permitidas.includes(paginaActual)) {
      showToast(`El rol "${rol}" no tiene acceso a este módulo.`, 'warn');
      setTimeout(() => window.location.replace('index.html'), 1500);
      return;
    }
  }

  // 2. Oculta ítems de navegación
  document.querySelectorAll('.nav-item').forEach(a => {
    const href = (a.getAttribute('href') || '').split('/').pop();
    if (!permitidas.includes(href)) {
      a.style.display = 'none';
    }
  });

  // 3. En index.html oculta cards de módulos y accesos rápidos restringidos
  document.querySelectorAll('.module-card').forEach(card => {
    const link = card.querySelector('a[href]');
    if (!link) return;
    const href = link.getAttribute('href').split('/').pop();
    if (!permitidas.includes(href)) {
      card.style.display = 'none';
    }
  });
  document.querySelectorAll('.quick-card[href]').forEach(card => {
    const href = card.getAttribute('href').split('/').pop();
    if (!permitidas.includes(href)) {
      card.style.display = 'none';
    }
  });

  // 4. Oculta links sueltos en banners / hero
  document.querySelectorAll('a[href]').forEach(a => {
    const href = (a.getAttribute('href') || '').split('/').pop();
    // Solo aplica a páginas del sistema, no a "#" ni externos
    const paginas = ['pacientes.html','citas.html','sala-espera.html','historial.html','reportes.html'];
    if (paginas.includes(href) && !permitidas.includes(href)) {
      a.style.display = 'none';
    }
  });
}

/**
 * Inyecta el saludo del usuario y el botón de cierre de sesión en el header.
 * Llama esto después de requireAuth().
 *
 * @param {object} perfil — objeto de usuarios_perfil
 */
function renderUserHeader(perfil) {
  if (!perfil) return;
  const navRight = document.querySelector('.nav-right');
  if (!navRight) return;

  // Evita duplicar si ya existe
  if (document.getElementById('user-menu')) return;

  const badge = perfil.rol ? `<span style="
    background:var(--blue-pale);color:var(--blue);border-radius:var(--radius-full);
    padding:.18rem .6rem;font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;
  ">${perfil.rol}</span>` : '';

  const html = `
    <div id="user-menu" style="display:flex;align-items:center;gap:.6rem;padding-left:.75rem;border-left:1px solid var(--gray-200)">
      <div style="text-align:right;line-height:1.2">
        <div style="font-size:.75rem;font-weight:700;color:var(--gray-900)">${perfil.nombre || 'Usuario'}</div>
        <div style="margin-top:.15rem">${badge}</div>
      </div>
      <button onclick="signOut()" title="Cerrar sesión" style="
        background:var(--gray-100);border:1.5px solid var(--gray-200);border-radius:var(--radius-full);
        padding:.35rem .75rem;font-size:.7rem;font-weight:600;color:var(--gray-500);cursor:pointer;
        font-family:var(--font);transition:all var(--tr);display:flex;align-items:center;gap:.3rem;
      " onmouseover="this.style.background='var(--red-pale)';this.style.color='var(--red)';this.style.borderColor='var(--red)'"
         onmouseout="this.style.background='var(--gray-100)';this.style.color='var(--gray-500)';this.style.borderColor='var(--gray-200)'">
        🚪 Salir
      </button>
    </div>`;
  navRight.insertAdjacentHTML('beforeend', html);
}

/* ──────────────────────────────────────────────────────────
   LOGIN
   ────────────────────────────────────────────────────────── */

async function handleLogin() {
  const email    = (document.getElementById('login-email')?.value    || '').trim();
  const password = (document.getElementById('login-password')?.value || '').trim();

  // Limpiar errores
  clearFieldError('login-email');
  clearFieldError('login-password');
  _showAuthAlert('alert-login', '', '');

  // Validaciones
  let ok = true;
  if (!email) {
    showFieldError('login-email', 'El correo es obligatorio.');
    ok = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showFieldError('login-email', 'Ingresa un correo válido.');
    ok = false;
  }
  if (!password) {
    showFieldError('login-password', 'La contraseña es obligatoria.');
    ok = false;
  } else if (password.length < 6) {
    showFieldError('login-password', 'La contraseña debe tener al menos 6 caracteres.');
    ok = false;
  }
  if (!ok) return;

  _setLoading('btn-login', true);

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey':       SUPABASE_ANON,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      const msg = data.error_description || data.msg || 'Credenciales incorrectas. Verifica tu correo y contraseña.';
      _showAuthAlert('alert-login', msg, 'error');
      _setLoading('btn-login', false);
      return;
    }

    // Guarda la sesión en el formato que Supabase JS v2 espera
    const sessionKey = `sb-${SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token`;
    localStorage.setItem(sessionKey, JSON.stringify({
      access_token:  data.access_token,
      refresh_token: data.refresh_token,
      expires_at:    Math.floor(Date.now() / 1000) + data.expires_in,
      user:          data.user,
    }));

    // Limpia caché de perfil para que se vuelva a consultar
    localStorage.removeItem('medicore_perfil');

    _showAuthAlert('alert-login', '¡Bienvenido! Redirigiendo…', 'success');
    setTimeout(() => window.location.replace('index.html'), 800);

  } catch (e) {
    _showAuthAlert('alert-login', 'Error de conexión. Verifica tu internet.', 'error');
    _setLoading('btn-login', false);
  }
}

/* ──────────────────────────────────────────────────────────
   REGISTRO
   ────────────────────────────────────────────────────────── */

async function handleRegistro() {
  const nombre   = (document.getElementById('reg-nombre')?.value   || '').trim();
  const email    = (document.getElementById('reg-email')?.value    || '').trim();
  const password = (document.getElementById('reg-password')?.value || '').trim();
  const confirm  = (document.getElementById('reg-confirm')?.value  || '').trim();
  const rolEl    = document.querySelector('.role-chip.selected input[type="radio"]');
  const rol      = rolEl ? rolEl.value : '';

  // Limpiar errores
  ['reg-nombre','reg-email','reg-password','reg-confirm'].forEach(clearFieldError);
  clearFieldError('reg-rol');
  _showAuthAlert('alert-registro', '', '');

  // Validaciones
  let ok = true;
  if (!nombre || nombre.length < 3) {
    showFieldError('reg-nombre', 'El nombre debe tener al menos 3 caracteres.');
    ok = false;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showFieldError('reg-email', 'Ingresa un correo electrónico válido.');
    ok = false;
  }
  if (!password || password.length < 6) {
    showFieldError('reg-password', 'La contraseña debe tener al menos 6 caracteres.');
    ok = false;
  }
  if (!confirm) {
    showFieldError('reg-confirm', 'Confirma tu contraseña.');
    ok = false;
  } else if (password !== confirm) {
    showFieldError('reg-confirm', 'Las contraseñas no coinciden.');
    ok = false;
  }
  if (!rol) {
    showFieldError('reg-rol', 'Selecciona un rol para continuar.');
    ok = false;
  }
  if (!ok) return;

  _setLoading('btn-registro', true);

  try {
    // 1. Registra el usuario en Supabase Auth
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'apikey':       SUPABASE_ANON,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const authData = await authRes.json();

    if (!authRes.ok || authData.error) {
      const msg = authData.msg || authData.error_description || 'No se pudo crear la cuenta. El correo puede estar en uso.';
      _showAuthAlert('alert-registro', msg, 'error');
      _setLoading('btn-registro', false);
      return;
    }

    const userId      = authData.user?.id || authData.id;
    const accessToken = authData.access_token || SUPABASE_ANON;

    if (!userId) {
      _showAuthAlert('alert-registro', 'Cuenta creada. Revisa tu correo para confirmar antes de ingresar.', 'info');
      _setLoading('btn-registro', false);
      return;
    }

    // 2. Inserta el perfil con el rol en la tabla usuarios_perfil
    const perfilRes = await fetch(`${SUPABASE_URL}/rest/v1/usuarios_perfil`, {
      method: 'POST',
      headers: {
        'apikey':        SUPABASE_ANON,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type':  'application/json',
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify({
        user_id:         userId,
        nombre:          nombre,
        correo:          email,
        rol:             rol,
        fecha_creacion:  new Date().toISOString(),
      }),
    });

    // Si hay error insertando el perfil, avisa pero no bloquea
    if (!perfilRes.ok) {
      console.warn('No se pudo insertar el perfil en usuarios_perfil. Verifica la tabla y las políticas RLS.');
    }

    _showAuthAlert('alert-registro', '¡Cuenta creada exitosamente! Ahora puedes iniciar sesión.', 'success');
    _setLoading('btn-registro', false);

    // Limpia el formulario y redirige a login
    setTimeout(() => switchTab('login'), 2000);

  } catch (e) {
    console.error(e);
    _showAuthAlert('alert-registro', 'Error de conexión. Verifica tu internet e inténtalo de nuevo.', 'error');
    _setLoading('btn-registro', false);
  }
}

/* ──────────────────────────────────────────────────────────
   HELPERS DE UI — internos de este archivo
   ────────────────────────────────────────────────────────── */

function _setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  if (loading) btn.classList.add('loading');
  else         btn.classList.remove('loading');
}

function _showAuthAlert(id, msg, type) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!msg) { el.classList.remove('show'); el.textContent = ''; return; }
  el.className = `auth-alert ${type} show`;
  el.innerHTML = `<span>${type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'}</span><span>${msg}</span>`;
}

/** Cambia entre el panel de login y el de registro */
function switchTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('panel-login').style.display    = isLogin ? 'block' : 'none';
  document.getElementById('panel-registro').style.display = isLogin ? 'none'  : 'block';
  document.getElementById('tab-login').classList.toggle('active', isLogin);
  document.getElementById('tab-registro').classList.toggle('active', !isLogin);
}

/* ──────────────────────────────────────────────────────────
   INICIALIZACIÓN AUTOMÁTICA EN PÁGINAS PROTEGIDAS
   ────────────────────────────────────────────────────────── */

/*
   En cada página protegida (index.html, pacientes.html, citas.html, etc.)
   añade este bloque DESPUÉS de <script src="auth.js"></script>:

   ┌─────────────────────────────────────────────────────────┐
   │ <script>                                                │
   │ document.addEventListener('DOMContentLoaded', async () => { │
   │   const perfil = await requireAuth();                   │
   │   if (!perfil) return; // requireAuth ya redirige       │
   │   applyRoleAccess(perfil.rol);                          │
   │   renderUserHeader(perfil);                             │
   │   // Aquí continúa la inicialización normal del módulo  │
   │ });                                                     │
   │ </script>                                               │
   └─────────────────────────────────────────────────────────┘

   Para login.html NO hace falta requireAuth().
   En cambio, si el usuario ya tiene sesión y visita login.html,
   redirige directamente a index.html:
*/

// Auto-redirige desde login.html si ya hay sesión activa
if (window.location.pathname.split('/').pop() === 'login.html') {
  (async () => {
    const session = await getSession();
    if (session) window.location.replace('index.html');
  })();
}
