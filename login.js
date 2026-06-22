/* ============================================================
   MediCore — login.js
   Gestiona login, registro y recuperación de contraseña.
   Depende de: shared.js (DB, sbFetch), auth.js (signIn, etc.)
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // Si ya hay sesión válida, redirigir directo al dashboard
  if (typeof isSessionValid === 'function' && isSessionValid()) {
    window.location.href = 'index.html';
    return;
  }

  bindUI();
  focusFirstField();
});

// ─── Bind eventos ──────────────────────────────────────────────
function bindUI() {
  // Formulario login
  document.getElementById('form-login')?.addEventListener('submit', handleLogin);

  // Formulario registro
  document.getElementById('form-registro')?.addEventListener('submit', handleRegistro);

  // Formulario recuperar contraseña
  document.getElementById('form-recover')?.addEventListener('submit', handleRecover);

  // Toggle visibilidad contraseñas
  document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      if (!input) return;
      const isText = input.type === 'text';
      input.type = isText ? 'password' : 'text';
      btn.textContent = isText ? '👁️' : '🙈';
    });
  });

  // Enter en campos navega al siguiente
  document.getElementById('login-email')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('login-password')?.focus();
  });

  // Limpiar alerta al escribir
  document.getElementById('login-email')?.addEventListener('input', () => clearAuthAlert('alert-login'));
  document.getElementById('login-password')?.addEventListener('input', () => clearAuthAlert('alert-login'));
  document.getElementById('reg-email')?.addEventListener('input', () => clearAuthAlert('alert-registro'));
  document.getElementById('reg-password')?.addEventListener('input', () => clearAuthAlert('alert-registro'));
}

function focusFirstField() {
  setTimeout(() => document.getElementById('login-email')?.focus(), 100);
}

// ─── Cambiar entre tabs login / registro ──────────────────────
function switchTab(tab) {
  const isLogin = tab === 'login';

  document.getElementById('panel-login')?.style   && (document.getElementById('panel-login').style.display    = isLogin ? 'block' : 'none');
  document.getElementById('panel-registro')?.style && (document.getElementById('panel-registro').style.display = isLogin ? 'none'  : 'block');
  document.getElementById('panel-recover')?.style  && (document.getElementById('panel-recover').style.display  = 'none');

  document.getElementById('tab-login')?.classList.toggle('active', isLogin);
  document.getElementById('tab-registro')?.classList.toggle('active', !isLogin);

  clearAuthAlert('alert-login');
  clearAuthAlert('alert-registro');

  // Focus primer campo del panel activo
  setTimeout(() => {
    const firstInput = isLogin
      ? document.getElementById('login-email')
      : document.getElementById('reg-nombre');
    firstInput?.focus();
  }, 50);
}

// ─── Mostrar / limpiar alertas ─────────────────────────────────
function showAuthAlert(id, msg, type = 'error') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = `auth-alert ${type} show`;
}

function clearAuthAlert(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = '';
  el.className = 'auth-alert';
}

// ─── Estado de carga del botón ─────────────────────────────────
function setLoading(btnId, loading, defaultText = 'Ingresar') {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading
    ? '<span class="login-spinner"></span> Cargando…'
    : defaultText;
}

// ─── LOGIN ─────────────────────────────────────────────────────
async function handleLogin(e) {
  e?.preventDefault();
  clearAuthAlert('alert-login');

  const email    = document.getElementById('login-email')?.value?.trim();
  const password = document.getElementById('login-password')?.value;

  if (!email || !password) {
    showAuthAlert('alert-login', 'Completa todos los campos.');
    return;
  }
  if (!isValidEmail(email)) {
    showAuthAlert('alert-login', 'Ingresa un correo electrónico válido.');
    return;
  }

  setLoading('btn-login', true, '🔐 Ingresar');
  try {
    const session = await signIn(email, password);
    saveSession(session);
    await cargarPerfil(session.user.id);

    showAuthAlert('alert-login', '✅ Sesión iniciada. Redirigiendo…', 'success');
    setTimeout(() => { window.location.href = 'index.html'; }, 700);
  } catch (err) {
    const msg = friendlyAuthError(err.message);
    showAuthAlert('alert-login', msg);
    document.getElementById('login-password')?.select();
  } finally {
    setLoading('btn-login', false, '🔐 Ingresar');
  }
}

// ─── REGISTRO ──────────────────────────────────────────────────
async function handleRegistro(e) {
  e?.preventDefault();
  clearAuthAlert('alert-registro');

  const nombre    = document.getElementById('reg-nombre')?.value?.trim();
  const email     = document.getElementById('reg-email')?.value?.trim();
  const password  = document.getElementById('reg-password')?.value;
  const password2 = document.getElementById('reg-password2')?.value;

  if (!nombre || !email || !password || !password2) {
    showAuthAlert('alert-registro', 'Completa todos los campos.');
    return;
  }
  if (!isValidEmail(email)) {
    showAuthAlert('alert-registro', 'Ingresa un correo electrónico válido.');
    return;
  }
  if (password.length < 6) {
    showAuthAlert('alert-registro', 'La contraseña debe tener al menos 6 caracteres.');
    return;
  }
  if (password !== password2) {
    showAuthAlert('alert-registro', 'Las contraseñas no coinciden.');
    document.getElementById('reg-password2')?.select();
    return;
  }

  setLoading('btn-registro', true, '📝 Registrarse');
  try {
    // Registro en Supabase Auth
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.msg || 'Error al registrar');

    // Guardar perfil en usuarios_perfil si la sesión ya viene en la respuesta
    if (data.user?.id) {
      try {
        await sbFetch('usuarios_perfil', {
          method: 'POST',
          body: JSON.stringify({
            user_id: data.user.id,
            nombre:  nombre,
            rol:     'Recepcionista',
          }),
        });
      } catch (_) {
        // No crítico si falla; el perfil puede crearse después
      }
    }

    showAuthAlert('alert-registro',
      '✅ Cuenta creada. Revisa tu correo para confirmar tu cuenta antes de ingresar.',
      'success');
    document.getElementById('form-registro')?.reset();
  } catch (err) {
    showAuthAlert('alert-registro', friendlyAuthError(err.message));
  } finally {
    setLoading('btn-registro', false, '📝 Registrarse');
  }
}

// ─── RECUPERAR CONTRASEÑA ──────────────────────────────────────
function showRecover() {
  document.getElementById('panel-login')?.style    && (document.getElementById('panel-login').style.display    = 'none');
  document.getElementById('panel-registro')?.style && (document.getElementById('panel-registro').style.display = 'none');
  document.getElementById('panel-recover')?.style  && (document.getElementById('panel-recover').style.display  = 'block');
  document.getElementById('tab-login')?.classList.remove('active');
  document.getElementById('tab-registro')?.classList.remove('active');
  clearAuthAlert('alert-recover');
  setTimeout(() => document.getElementById('recover-email')?.focus(), 50);
}

function hideRecover() {
  switchTab('login');
}

async function handleRecover(e) {
  e?.preventDefault();
  clearAuthAlert('alert-recover');

  const email = document.getElementById('recover-email')?.value?.trim();
  if (!email) {
    showAuthAlert('alert-recover', 'Ingresa tu correo electrónico.');
    return;
  }
  if (!isValidEmail(email)) {
    showAuthAlert('alert-recover', 'Ingresa un correo electrónico válido.');
    return;
  }

  setLoading('btn-recover', true, '📧 Enviar enlace');
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    // Supabase retorna 200 tanto si el email existe como si no (seguridad)
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error_description || 'Error al enviar');
    }
    showAuthAlert('alert-recover',
      '✅ Si ese correo existe, recibirás un enlace para restablecer tu contraseña.',
      'success');
    document.getElementById('recover-email').value = '';
  } catch (err) {
    showAuthAlert('alert-recover', friendlyAuthError(err.message));
  } finally {
    setLoading('btn-recover', false, '📧 Enviar enlace');
  }
}

// ─── Helpers ───────────────────────────────────────────────────
function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function friendlyAuthError(msg = '') {
  const m = msg.toLowerCase();
  if (m.includes('invalid login') || m.includes('invalid credentials') || m.includes('email not confirmed'))
    return 'Correo o contraseña incorrectos. Verifica tus datos.';
  if (m.includes('email already registered') || m.includes('already been registered'))
    return 'Este correo ya está registrado. Intenta iniciar sesión.';
  if (m.includes('password should be'))
    return 'La contraseña debe tener al menos 6 caracteres.';
  if (m.includes('rate limit'))
    return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
  if (m.includes('network') || m.includes('fetch'))
    return 'Sin conexión. Verifica tu internet e inténtalo de nuevo.';
  return msg || 'Ocurrió un error. Inténtalo de nuevo.';
}