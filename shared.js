/* ============================================================
   MediCore — shared.js
   Utilidades compartidas: storage, toast, navegación, helpers
   ============================================================ */

// ── CONFIGURACIÓN GLOBAL DE SUPABASE ─────────────────────────
const SUPABASE_URL_SH  = 'https://bhawfcvnthzdwmkgwgxj.supabase.co';
const SUPABASE_ANON_SH = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoYXdmY3ZudGh6ZHdta2d3Z3hqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MzY4MjUsImV4cCI6MjA5NjAxMjgyNX0.gpaCKHr2HqAg7k0Zb4VolKWNEZvBrgE7Y2bJuL27PYc';

// Cabeceras HTTP estándar listas para reutilizar en cualquier consulta fetch de tus módulos
const SB_HEADERS = {
  'apikey':        SUPABASE_ANON_SH,
  'Authorization': `Bearer ${SUPABASE_ANON_SH}`,
  'Content-Type':  'application/json',
  'Prefer':        'return=representation'
};

// ── LocalStorage helpers (Compatibilidad secundaria) ─────────
const DB = {
  get: (key) => JSON.parse(localStorage.getItem('medicore_' + key) || '[]'),
  set: (key, val) => localStorage.setItem('medicore_' + key, JSON.stringify(val)),
  getObj: (key) => JSON.parse(localStorage.getItem('medicore_' + key) || 'null'),
  setObj: (key, val) => localStorage.setItem('medicore_' + key, JSON.stringify(val)),
};

// ── Auto-increment ID ────────────────────────────────────────
function nextId(prefix, list, field = 'codigo') {
  if (!list.length) return prefix + '001';
  const nums = list.map(x => parseInt((x[field] || '').replace(prefix,'')) || 0);
  const next = Math.max(...nums) + 1;
  return prefix + String(next).padStart(3, '0');
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warn: '⚠️' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="toast-icon">${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; t.style.transform='translateX(20px)'; t.style.transition='all .3s'; setTimeout(()=>t.remove(),300); }, duration);
}

// ── Modal helpers ─────────────────────────────────────────────
function openModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.add('active'); document.body.style.overflow='hidden'; }
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.remove('active'); document.body.style.overflow=''; }
}
function closeAllModals() {
  document.querySelectorAll('.modal-overlay.active').forEach(m=>{m.classList.remove('active');});
  document.body.style.overflow='';
}

// Close modal on overlay click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) closeAllModals();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeAllModals();
});

// ── Clock ─────────────────────────────────────────────────────
function startClock() {
  const el = document.getElementById('nav-clock');
  if (!el) return;
  const tick = () => {
    const n = new Date();
    el.textContent = n.toLocaleTimeString('es-PE', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
  };
  tick(); setInterval(tick, 1000);
}

// ── Active nav ────────────────────────────────────────────────
function setActiveNav() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-item').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (href === page || (page === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
}

// ── Form validation helpers ───────────────────────────────────
const Validate = {
  required: (v) => v !== null && v !== undefined && String(v).trim() !== '',
  minLen: (v, n) => String(v).trim().length >= n,
  maxLen: (v, n) => String(v).trim().length <= n,
  noOnlyNumbers: (v) => !/^\d+$/.test(String(v).trim()),
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim()),
  dni: (v) => /^\d{8}$/.test(String(v).trim()),
  phone: (v) => /^\d{9}$/.test(String(v).trim()),
  noFutureDate: (v) => v && new Date(v) <= new Date(),
  futureDate: (v) => v && new Date(v) > new Date(),
  noOnlySpaces: (v) => String(v).trim() !== '',
};

function showFieldError(id, msg) {
  const input = document.getElementById(id);
  const error = document.getElementById(id + '-err');
  if (input)  input.classList.add('is-error');
  if (error)  { error.textContent = msg; error.classList.add('show'); }
}

function clearFieldError(id) {
  const input = document.getElementById(id);
  const error = document.getElementById(id + '-err');
  if (input)  { input.classList.remove('is-error'); input.classList.remove('is-valid'); }
  if (error)  { error.textContent = ''; error.classList.remove('show'); }
}

function markFieldValid(id) {
  const input = document.getElementById(id);
  if (input) { input.classList.remove('is-error'); input.classList.add('is-valid'); }
  const error = document.getElementById(id + '-err');
  if (error) error.classList.remove('show');
}

function clearAllErrors(formId) {
  const form = formId ? document.getElementById(formId) : document;
  if (!form) return;
  form.querySelectorAll('.is-error').forEach(el => el.classList.remove('is-error'));
  form.querySelectorAll('.form-error').forEach(el => el.classList.remove('show'));
}

// ── Date helpers ──────────────────────────────────────────────
function calcAge(dob) {
  if (!dob) return null;
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

// ── Render allergy pills (shared display) ─────────────────────
function renderAlergias(alergias) {
  if (!alergias || !alergias.length || alergias[0] === 'Ninguna') {
    return '<span style="color:var(--gray-400);font-size:.72rem">Ninguna</span>';
  }
  return alergias.map(a =>
    `<span style="background:var(--red-pale);color:#991B1B;border-radius:var(--radius-full);padding:.15rem .5rem;font-size:.65rem;font-weight:600;">${a}</span>`
  ).join(' ');
}

// ── Stats counter animation ───────────────────────────────────
function animateCount(el, target, duration = 1000) {
  if (!el) return;
  const start = performance.now();
  function step(now) {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(2, -8 * p);
    el.textContent = Math.round(eased * target);
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = target.toLocaleString('es-PE');
  }
  requestAnimationFrame(step);
}

// ── Supabase pacientes cache ──────────────────────────────────
let _pacientesCache = null;

async function fetchPacientesSupabase() {
  const res = await fetch(`${SUPABASE_URL_SH}/rest/v1/pacientes?select=*`, {
    headers: {
      'apikey':        SUPABASE_ANON_SH,
      'Authorization': `Bearer ${SUPABASE_ANON_SH}`,
      'Content-Type':  'application/json',
    },
  });
  if (!res.ok) throw new Error(`Supabase error ${res.status}`);
  const rows = await res.json();
  return rows.map(p => ({
    id:         p.id,
    codigo:     p.codigo ?? String(p.id),
    nombres:    p.nombres    ?? '',
    apellidos:  p.apellidos  ?? '',
    documento:  String(p.documento ?? ''),
    telefono:   String(p.telefono  ?? '—'),
    edad:       calcAge(p.fecha_nacimiento ?? null),
    tipoDoc:    p.tipo_documento ?? 'DNI',
    alergias:   p.alergias ?? [],
  }));
}

async function getPacientesCache() {
  if (_pacientesCache !== null) return _pacientesCache;
  try {
    _pacientesCache = await fetchPacientesSupabase();
  } catch (e) {
    console.error('Error al cargar pacientes:', e);
    _pacientesCache = [];
  }
  return _pacientesCache;
}

function getPacienteLocal(codigo) {
  if (!_pacientesCache) return null;
  return _pacientesCache.find(
    p => String(p.codigo) === String(codigo)
  ) || null;
}

// ── Renderizado de la Identidad en la Cabecera (User Profile Widget) ──
function renderUserHeader(perfil) {
  const headerInner = document.querySelector('.app-header-inner');
  if (!headerInner || document.getElementById('user-profile-badge')) return;

  const badge = document.createElement('div');
  badge.id = 'user-profile-badge';
  badge.style.display = 'flex';
  badge.style.alignItems = 'center';
  badge.style.gap = '.75rem';
  badge.style.marginLeft = 'auto';

  let colorRol = '#1976D2';
  if (perfil.rol === 'Médico') colorRol = '#2e7d32';
  if (perfil.rol === 'Enfermería') colorRol = '#ed6c02';

  badge.innerHTML = `
    <div style="text-align: right; line-height: 1.2;">
      <div style="font-size: .83rem; font-weight: 600; color: var(--gray-900);">${perfil.nombre}</div>
      <span style="font-size: .68rem; background:${colorRol}; color:white; padding: 2px 6px; border-radius:4px; font-weight:700;">${perfil.rol}</span>
    </div>
    <button onclick="handleLogout()" style="background: none; border: 1px solid var(--gray-200); padding: .4rem; border-radius: var(--radius); cursor: pointer; font-size: 1rem;" title="Cerrar sesión">
      🚪
    </button>
  `;

  headerInner.appendChild(badge);
}

// ── Init on DOM ready ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  startClock();
  setActiveNav();
});