/* ============================================================
   MediCore — shared.js
   Utilidades compartidas: storage, toast, navegación, helpers
   ============================================================ */

// ── Supabase config ──────────────────────────────────────────
const SUPABASE_URL  = 'https://odmwjmafdsqgkpxlxiau.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbXdqbWFmZHNxZ2tweGx4aWF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMjE0MTcsImV4cCI6MjA5NjY5NzQxN30.5uVgGhwwRJEedw3kKurRrHhkpkEJsCq5byY1-D8LvYs';

const SB_HEADERS = {
  'apikey':        SUPABASE_ANON,
  'Authorization': `Bearer ${SUPABASE_ANON}`,
  'Content-Type':  'application/json',
  'Prefer':        'return=representation',
};

// Helper base para fetch a Supabase REST
async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: { ...SB_HEADERS, ...(options.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase [${res.status}]: ${err}`);
  }
  // DELETE / PATCH sin cuerpo retornan 204
  if (res.status === 204) return null;
  return res.json();
}

// ── LocalStorage helpers (fallback / sesión) ─────────────────
const DB = {
  get:    (key) => JSON.parse(localStorage.getItem('medicore_' + key) || '[]'),
  set:    (key, val) => localStorage.setItem('medicore_' + key, JSON.stringify(val)),
  getObj: (key) => JSON.parse(localStorage.getItem('medicore_' + key) || 'null'),
  setObj: (key, val) => localStorage.setItem('medicore_' + key, JSON.stringify(val)),
};

// ── Auto-increment ID ────────────────────────────────────────
function nextId(prefix, list, field = 'codigo') {
  if (!list.length) return prefix + '001';
  const nums = list.map(x => parseInt((x[field] || '').replace(prefix, '')) || 0);
  return prefix + String(Math.max(...nums) + 1).padStart(3, '0');
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
  t.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0'; t.style.transform = 'translateX(20px)'; t.style.transition = 'all .3s';
    setTimeout(() => t.remove(), 300);
  }, duration);
}

// ── Modal helpers ─────────────────────────────────────────────
function openModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.add('active'); document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.remove('active'); document.body.style.overflow = ''; }
}
function closeAllModals() {
  document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
  document.body.style.overflow = '';
}
document.addEventListener('click', e => { if (e.target.classList.contains('modal-overlay')) closeAllModals(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllModals(); });

// ── Clock ─────────────────────────────────────────────────────
function startClock() {
  const el = document.getElementById('nav-clock');
  if (!el) return;
  const tick = () => {
    el.textContent = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  tick(); setInterval(tick, 1000);
}

// ── Active nav ────────────────────────────────────────────────
function setActiveNav() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-item').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (href === page || (page === '' && href === 'index.html')) a.classList.add('active');
  });
}

// ── Form validation helpers ───────────────────────────────────
const Validate = {
  required:     (v) => v !== null && v !== undefined && String(v).trim() !== '',
  minLen:       (v, n) => String(v).trim().length >= n,
  maxLen:       (v, n) => String(v).trim().length <= n,
  noOnlyNumbers:(v) => !/^\d+$/.test(String(v).trim()),
  email:        (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim()),
  dni:          (v) => /^\d{8}$/.test(String(v).trim()),
  phone:        (v) => /^\d{9}$/.test(String(v).trim()),
  noFutureDate: (v) => v && new Date(v) <= new Date(),
  futureDate:   (v) => v && new Date(v) > new Date(),
  noOnlySpaces: (v) => String(v).trim() !== '',
};

function showFieldError(id, msg) {
  const input = document.getElementById(id);
  const error = document.getElementById(id + '-err');
  if (input) input.classList.add('is-error');
  if (error) { error.textContent = msg; error.classList.add('show'); }
}
function clearFieldError(id) {
  const input = document.getElementById(id);
  const error = document.getElementById(id + '-err');
  if (input) { input.classList.remove('is-error', 'is-valid'); }
  if (error) { error.textContent = ''; error.classList.remove('show'); }
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
  const today = new Date(), birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}
function isMinor(dob) { const a = calcAge(dob); return a !== null && a < 18; }
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function todayStr() { return new Date().toISOString().split('T')[0]; }

// ── Render allergy pills ──────────────────────────────────────
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
    el.textContent = Math.round((1 - Math.pow(2, -8 * p)) * target);
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = target.toLocaleString('es-PE');
  }
  requestAnimationFrame(step);
}

// ════════════════════════════════════════════════════════════════
//  SUPABASE DATA LAYER — Caches en memoria por sesión
// ════════════════════════════════════════════════════════════════

let _cachesPacientes  = null;
let _cacheCitas       = null;
let _cacheHistorial   = null;
let _cacheSalaEspera  = null;

// ── Normalizar fila paciente ──────────────────────────────────
function normalizarPaciente(p) {
  return {
    id:              p.id,
    codigo:          String(p.id),
    nombres:         p.nombres   ?? p.Nombres   ?? '',
    apellidos:       p.apellidos ?? p.Apellidos  ?? '',
    documento:       String(p.documento ?? p['N° documento'] ?? ''),
    telefono:        String(p.telefono   ?? p['Teléfono']    ?? '—'),
    correo:          p.correo    ?? p.email ?? '',
    direccion:       p.direccion ?? '',
    sexo:            p.sexo      ?? '',
    fechaNacimiento: p.fecha_nacimiento ?? p['Fecha de nacimiento'] ?? null,
    edad:            calcAge(p.fecha_nacimiento ?? p['Fecha de nacimiento'] ?? null),
    tipoDoc:         p.tipo_documento ?? 'DNI',
    alergias:        Array.isArray(p.alergias) ? p.alergias : [],
    tutor:           p.tutor           ?? null,
    contactoEmerg:   p.contacto_emergencia ?? null,
    creadoEn:        p.created_at ?? null,
  };
}

// ── Normalizar fila cita ──────────────────────────────────────
function normalizarCita(c) {
  return {
    id:                  c.id,
    codigo:              c.codigo              ?? String(c.id),
    paciente:            String(c.paciente_id  ?? c.paciente ?? ''),
    medico:              c.medico              ?? '',
    especialidad:        c.especialidad        ?? '',
    fecha:               c.fecha              ?? '',
    hora:                c.hora               ?? '',
    estado:              c.estado             ?? 'Programada',
    prioridad:           c.prioridad          ?? 'Normal',
    motivo:              c.motivo             ?? '',
    justificacion:       c.justificacion      ?? '',
    horaLlegada:         c.hora_llegada       ?? null,
    horaInicioAtencion:  c.hora_inicio_atencion ?? null,
    horaFin:             c.hora_fin           ?? null,
    motivoCancelacion:   c.motivo_cancelacion ?? null,
    creadoEn:            c.created_at         ?? null,
  };
}

// ── Normalizar fila historial ─────────────────────────────────
function normalizarHistorial(h) {
  return {
    id:            h.id,
    codigo:        h.codigo         ?? String(h.id),
    citaCodigo:    String(h.cita_id ?? h.cita_codigo ?? ''),
    paciente:      String(h.paciente_id ?? h.paciente ?? ''),
    medico:        h.medico         ?? '',
    especialidad:  h.especialidad   ?? '',
    fecha:         h.fecha          ?? '',
    sintomas:      h.sintomas       ?? '',
    diagnostico:   h.diagnostico    ?? '',
    tratamiento:   h.tratamiento    ?? '',
    medicamentos:  Array.isArray(h.medicamentos) ? h.medicamentos : [],
    observaciones: h.observaciones  ?? '',
    proxCita:      h.prox_cita      ?? null,
    creadoEn:      h.created_at     ?? null,
  };
}

// ── Normalizar fila sala_espera ───────────────────────────────
function normalizarSalaEspera(s) {
  return {
    id:           s.id,
    citaCodigo:   String(s.cita_id ?? s.cita_codigo ?? ''),
    paciente:     String(s.paciente_id ?? s.paciente ?? ''),
    estado:       s.estado      ?? 'En espera',
    prioridad:    s.prioridad   ?? 'Normal',
    horaLlegada:  s.hora_llegada ?? null,
    turno:        s.turno       ?? null,
  };
}

// ── PACIENTES ─────────────────────────────────────────────────
async function getPacientesCache(force = false) {
  if (_cachesPacientes && !force) return _cachesPacientes;
  try {
    const rows = await sbFetch('pacientes?select=*&order=id.asc');
    _cachesPacientes = rows.map(normalizarPaciente);
  } catch (e) {
    console.error('Error cargando pacientes:', e);
    _cachesPacientes = [];
  }
  return _cachesPacientes;
}

function getPacienteLocal(codigo) {
  if (!_cachesPacientes) return null;
  return _cachesPacientes.find(p => String(p.id) === String(codigo) || String(p.codigo) === String(codigo)) || null;
}

// Alias síncrono (usa cache ya cargada)
function getPaciente(codigo) { return getPacienteLocal(codigo); }
function getAllPacientes()    { return _cachesPacientes || []; }

// ── CITAS ─────────────────────────────────────────────────────
async function getCitasCache(force = false) {
  if (_cacheCitas && !force) return _cacheCitas;
  try {
    const rows = await sbFetch('citas?select=*&order=fecha.desc,hora.asc');
    _cacheCitas = rows.map(normalizarCita);
  } catch (e) {
    console.error('Error cargando citas:', e);
    _cacheCitas = [];
  }
  return _cacheCitas;
}

function getCitasLocal() { return _cacheCitas || []; }

async function saveCitaDB(cita) {
  // cita.id existe → UPDATE, sino → INSERT
  const payload = {
    codigo:               cita.codigo,
    paciente_id:          cita.paciente,
    medico:               cita.medico,
    especialidad:         cita.especialidad,
    fecha:                cita.fecha,
    hora:                 cita.hora,
    estado:               cita.estado,
    prioridad:            cita.prioridad,
    motivo:               cita.motivo,
    justificacion:        cita.justificacion      ?? null,
    hora_llegada:         cita.horaLlegada        ?? null,
    hora_inicio_atencion: cita.horaInicioAtencion ?? null,
    hora_fin:             cita.horaFin            ?? null,
    motivo_cancelacion:   cita.motivoCancelacion  ?? null,
  };
  let row;
  if (cita.id) {
    const [updated] = await sbFetch(`citas?id=eq.${cita.id}`, {
      method: 'PATCH', body: JSON.stringify(payload),
    });
    row = normalizarCita(updated);
  } else {
    const [inserted] = await sbFetch('citas', {
      method: 'POST', body: JSON.stringify(payload),
    });
    row = normalizarCita(inserted);
  }
  // Actualizar cache local
  if (_cacheCitas) {
    const idx = _cacheCitas.findIndex(c => String(c.id) === String(row.id));
    if (idx >= 0) _cacheCitas[idx] = row; else _cacheCitas.unshift(row);
  }
  return row;
}

async function deleteCitaDB(id) {
  await sbFetch(`citas?id=eq.${id}`, { method: 'DELETE' });
  if (_cacheCitas) _cacheCitas = _cacheCitas.filter(c => String(c.id) !== String(id));
}

// ── HISTORIAL ─────────────────────────────────────────────────
async function getHistorialCache(force = false) {
  if (_cacheHistorial && !force) return _cacheHistorial;
  try {
    const rows = await sbFetch('historial_consultas?select=*&order=fecha.desc');
    _cacheHistorial = rows.map(normalizarHistorial);
  } catch (e) {
    console.error('Error cargando historial:', e);
    _cacheHistorial = [];
  }
  return _cacheHistorial;
}

function getHistorialLocal() { return _cacheHistorial || []; }

async function saveHistorialDB(hist) {
  const payload = {
    codigo:        hist.codigo,
    cita_id:       hist.citaCodigo,
    paciente_id:   hist.paciente,
    medico:        hist.medico,
    especialidad:  hist.especialidad,
    fecha:         hist.fecha,
    sintomas:      hist.sintomas,
    diagnostico:   hist.diagnostico,
    tratamiento:   hist.tratamiento,
    medicamentos:  hist.medicamentos  ?? [],
    observaciones: hist.observaciones ?? null,
    prox_cita:     hist.proxCita      ?? null,
  };
  let row;
  if (hist.id) {
    const [updated] = await sbFetch(`historial_consultas?id=eq.${hist.id}`, {
      method: 'PATCH', body: JSON.stringify(payload),
    });
    row = normalizarHistorial(updated);
  } else {
    const [inserted] = await sbFetch('historial_consultas', {
      method: 'POST', body: JSON.stringify(payload),
    });
    row = normalizarHistorial(inserted);
  }
  if (_cacheHistorial) {
    const idx = _cacheHistorial.findIndex(h => String(h.id) === String(row.id));
    if (idx >= 0) _cacheHistorial[idx] = row; else _cacheHistorial.unshift(row);
  }
  return row;
}

// ── SALA DE ESPERA ────────────────────────────────────────────
async function getSalaEsperaCache(force = false) {
  if (_cacheSalaEspera && !force) return _cacheSalaEspera;
  try {
    const rows = await sbFetch('sala_espera?select=*&order=id.asc');
    _cacheSalaEspera = rows.map(normalizarSalaEspera);
  } catch (e) {
    console.error('Error cargando sala_espera:', e);
    _cacheSalaEspera = [];
  }
  return _cacheSalaEspera;
}

// ── USUARIOS / AUTH ───────────────────────────────────────────
async function getUsuarioPerfil(userId) {
  try {
    const rows = await sbFetch(`usuarios_perfil?user_id=eq.${userId}&select=*&limit=1`);
    return rows[0] ?? null;
  } catch (e) {
    console.error('Error cargando perfil:', e);
    return null;
  }
}

// ── Init on DOM ready ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  startClock();
  setActiveNav();
});

// ── Compatibilidad: alias legacy para código que usa DB.get() ─
// Módulos que aún no migraron usan esto como fallback temporal
const _DB_LEGACY = {
  get: (key) => {
    if (key === 'pacientes') return _cachesPacientes || [];
    if (key === 'citas')     return _cacheCitas      || [];
    if (key === 'historial') return _cacheHistorial  || [];
    return DB.get(key);
  },
  set: DB.set,
};