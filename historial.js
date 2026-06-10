// ─── Supabase config ───────────────────────────────────────
// SUPABASE_URL_SH y SUPABASE_ANON_SH vienen de shared.js
// _pacientesCache, getPacientesCache() y getPacienteLocal()
// también están definidos en shared.js y disponibles aquí.

const SB_HEADERS = {
  'apikey':        SUPABASE_ANON_SH,
  'Authorization': `Bearer ${SUPABASE_ANON_SH}`,
  'Content-Type':  'application/json',
  'Prefer':        'return=representation',
};

// ─── Cache historial ───────────────────────────────────────
let _historialCache = null;

async function fetchHistorialSupabase() {
  const res = await fetch(`${SUPABASE_URL_SH}/rest/v1/historial?select=*`, { headers: SB_HEADERS });
  if (!res.ok) throw new Error(`Supabase error ${res.status}: ${await res.text()}`);
  const rows = await res.json();
  return rows.map(normalizeHistorial);
}

function normalizeHistorial(h) {
  return {
    id:             h.id,
    codigo:         h.codigo          ?? '',
    citaCodigo:     h.cita_codigo     ?? '',
    pacienteCodigo: h.paciente_codigo ?? '',
    medico:         h.medico          ?? '',
    especialidad:   h.especialidad    ?? '',
    fecha:          h.fecha           ?? '',
    sintomas:       h.sintomas        ?? '',
    diagnostico:    h.diagnostico     ?? '',
    tratamiento:    h.tratamiento     ?? '',
    medicamentos:   Array.isArray(h.medicamentos) ? h.medicamentos : [],
    observaciones:  h.observaciones   ?? '',
    proximaCita:    h.proxima_cita    ?? '',
    registradoEn:   h.registrado_en   ?? h.created_at ?? '',
  };
}

async function getHistorialCache(forceRefresh = false) {
  if (_historialCache !== null && !forceRefresh) return _historialCache;
  try {
    _historialCache = await fetchHistorialSupabase();
  } catch (e) {
    console.error('Error al cargar historial desde Supabase:', e);
    showToast('Error al cargar historial desde el servidor', 'error');
    _historialCache = [];
  }
  return _historialCache;
}

async function insertHistorialSupabase(hist) {
  const payload = {
    codigo:          hist.codigo,
    cita_codigo:     hist.citaCodigo,
    paciente_codigo: hist.pacienteCodigo,
    medico:          hist.medico,
    especialidad:    hist.especialidad,
    fecha:           hist.fecha,
    sintomas:        hist.sintomas,
    diagnostico:     hist.diagnostico,
    tratamiento:     hist.tratamiento,
    medicamentos:    hist.medicamentos,
    observaciones:   hist.observaciones,
    proxima_cita:    hist.proximaCita || null,
    registrado_en:   hist.registradoEn,
  };
  const res = await fetch(`${SUPABASE_URL_SH}/rest/v1/historial`, {
    method:  'POST',
    headers: SB_HEADERS,
    body:    JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Supabase insert error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return normalizeHistorial(Array.isArray(data) ? data[0] : data);
}

// ─── Código correlativo ────────────────────────────────────
function nextHistCodigo(lista) {
  const nums = lista
    .map(h => parseInt((h.codigo ?? '').replace('HIST-', ''), 10))
    .filter(n => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return `HIST-${String(max + 1).padStart(3, '0')}`;
}

// ─── Estado local ──────────────────────────────────────────
let medicamentos     = [];
let citaSeleccionada = null;

// ─── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const params    = new URLSearchParams(window.location.search);
  const citaParam = params.get('cita');

  // Precarga pacientes (shared.js) e historial en paralelo
  await Promise.all([getPacientesCache(), getHistorialCache()]);

  await renderCitasAtendidas();
  await updateStats();

  if (citaParam) {
    setTimeout(() => seleccionarCita(citaParam), 150);
  }

  ['hist-sintomas', 'hist-diagnostico', 'hist-tratamiento'].forEach(id => {
    const el  = document.getElementById(id);
    const cnt = document.getElementById(id + '-cnt');
    if (el && cnt) {
      el.addEventListener('input', () => { cnt.textContent = `${el.value.length} / ${el.maxLength}`; });
    }
  });

  const pc = document.getElementById('hist-prox-cita');
  if (pc) {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    pc.min = t.toISOString().split('T')[0];
  }
});

// ─── Render lista izquierda ────────────────────────────────
async function renderCitasAtendidas() {
  const q     = (document.getElementById('search-citas-at').value || '').toLowerCase();
  const citas = DB.get('citas').filter(c => c.estado === 'Atendida');
  const hist  = await getHistorialCache();

  const filtradas = citas.filter(c => {
    const pac    = getPacienteLocal(c.paciente);
    const nombre = pac ? `${pac.nombres ?? ''} ${pac.apellidos ?? ''}`.toLowerCase() : '';
    return !q || nombre.includes(q) || c.codigo.toLowerCase().includes(q);
  }).sort((a, b) => b.creadaEn?.localeCompare(a.creadaEn || '') || 0);

  const el = document.getElementById('lista-citas-atendidas');
  if (!filtradas.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-sub">No hay citas atendidas${q ? ' con ese criterio' : ''}</div></div>`;
    return;
  }
  el.innerHTML = filtradas.map(c => {
    const pac       = getPacienteLocal(c.paciente);
    const nombre    = pac ? `${pac.nombres ?? ''} ${pac.apellidos ?? ''}`.trim() : '(Paciente no encontrado)';
    const tieneHist = hist.some(h => h.citaCodigo === c.codigo);
    const selClass  = citaSeleccionada?.codigo === c.codigo ? 'selected' : '';
    const hasClass  = tieneHist ? 'has-hist' : '';
    return `<div class="cita-atendida-item ${selClass} ${hasClass}" onclick="seleccionarCita('${c.codigo}')">
      <div class="cai-icon">${tieneHist ? '✅' : '📋'}</div>
      <div class="cai-main">
        <div class="cai-nombre">${nombre}</div>
        <div class="cai-meta">${c.codigo} · ${formatDate(c.fecha)} · ${c.especialidad}</div>
      </div>
    </div>`;
  }).join('');
}

// ─── Seleccionar cita ──────────────────────────────────────
async function seleccionarCita(codigo) {
  const c = DB.get('citas').find(x => x.codigo === codigo);
  if (!c) { showToast('Cita no encontrada', 'error'); return; }
  if (c.estado !== 'Atendida') { showToast('Solo se puede registrar historial de citas atendidas', 'error'); return; }
  citaSeleccionada = c;
  await renderCitasAtendidas();

  const pac      = getPacienteLocal(c.paciente);
  const histAll  = await getHistorialCache();
  const hist     = histAll
    .filter(h => h.pacienteCodigo === String(c.paciente))
    .sort((a, b) => b.fecha?.localeCompare(a.fecha || '') || 0);
  const tieneEsta = hist.find(h => h.citaCodigo === c.codigo);
  const alNoNing  = pac?.alergias?.length && pac.alergias[0] !== 'Ninguna';

  let html = '';

  // Strip paciente
  html += `<div class="patient-info-strip" style="margin-bottom:1.25rem">
    <div class="pi-avatar">${pac ? (pac.nombres[0] ?? '?') + (pac.apellidos[0] ?? '?') : '?'}</div>
    <div class="pi-data">
      <div class="pi-name">${pac ? `${pac.nombres} ${pac.apellidos}` : 'Paciente no encontrado'}</div>
      <div class="pi-meta">${pac ? `${pac.edad} años · ${pac.tipoDoc}: ${pac.documento}` : ''} · Cita: ${c.codigo} · ${formatDate(c.fecha)}</div>
    </div>
    ${alNoNing ? `<div class="allergy-alert">⚠️ ${pac.alergias.join(', ')}</div>` : ''}
  </div>`;

  // Botón registrar o aviso ya registrado
  if (!tieneEsta) {
    html += `<div class="card" style="margin-bottom:1.25rem">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem">
        <div>
          <div class="card-title" style="margin:0">Registrar Historial Clínico</div>
          <div style="font-size:.78rem;color:var(--gray-400);margin-top:.25rem">Cita del ${formatDate(c.fecha)} · ${c.especialidad} · ${c.medico}</div>
        </div>
        <button class="btn btn-primary" onclick="abrirFormHistorial('${c.codigo}')">📋 Registrar Consulta</button>
      </div>
    </div>`;
  } else {
    html += `<div class="alert alert-success" style="margin-bottom:1.25rem"><span class="alert-icon">✅</span>Historial registrado para esta cita.</div>`;
  }

  // Lista de historiales del paciente
  if (hist.length) {
    html += `<div style="margin-bottom:.75rem;font-size:.78rem;font-weight:600;color:var(--gray-700)">Historial completo del paciente (${hist.length} consulta${hist.length !== 1 ? 's' : ''})</div>`;
    html += hist.map(h => {
      const esEsta = h.citaCodigo === c.codigo;
      return `<div class="hist-card" ${esEsta ? 'style="border-color:var(--blue);border-width:2px"' : ''}>
        <div class="hist-card-header">
          <div>
            <span class="hist-code">${h.codigo}</span>
            ${esEsta ? '<span style="background:var(--blue-pale);color:var(--blue);font-size:.6rem;font-weight:700;padding:.15rem .5rem;border-radius:var(--radius-full);margin-left:.4rem">Esta consulta</span>' : ''}
          </div>
          <span class="hist-fecha">📅 ${formatDate(h.fecha)} · ${h.especialidad}</span>
        </div>
        <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.75rem;font-size:.78rem;">
          <span>👨‍⚕️ ${h.medico}</span>
        </div>
        <div class="hist-section">
          <div class="hist-section-title">Síntomas</div>
          <div class="hist-section-body">${h.sintomas}</div>
        </div>
        <hr class="hist-divider"/>
        <div class="hist-section">
          <div class="hist-section-title">Diagnóstico</div>
          <div class="hist-section-body">${h.diagnostico}</div>
        </div>
        <hr class="hist-divider"/>
        <div class="hist-section">
          <div class="hist-section-title">Tratamiento / Indicaciones</div>
          <div class="hist-section-body">${h.tratamiento}</div>
        </div>
        ${h.medicamentos && h.medicamentos.length ? `
        <hr class="hist-divider"/>
        <div class="hist-section">
          <div class="hist-section-title">Medicamentos Recetados</div>
          ${h.medicamentos.map(m => `<div class="med-item">
            <div class="med-nombre">💊 ${m.nombre}</div>
            <div class="med-detalle">${[m.dosis, m.frecuencia, m.duracion].filter(Boolean).join(' · ')}</div>
          </div>`).join('')}
        </div>` : ''}
        ${h.observaciones ? `
        <hr class="hist-divider"/>
        <div class="hist-section">
          <div class="hist-section-title">Observaciones</div>
          <div class="hist-section-body">${h.observaciones}</div>
        </div>` : ''}
        ${h.proximaCita ? `
        <hr class="hist-divider"/>
        <div style="display:flex;align-items:center;gap:.5rem">
          <div class="hist-section-title" style="margin:0">Próxima Cita:</div>
          <div class="prox-cita-chip">📅 ${formatDate(h.proximaCita)}</div>
        </div>` : ''}
        ${alNoNing ? `<hr class="hist-divider"/><div class="allergy-alert" style="margin-top:.25rem">⚠️ Alergias del paciente: ${pac.alergias.join(', ')}</div>` : ''}
      </div>`;
    }).join('');
  } else {
    html += `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">Sin historial previo</div><div class="empty-sub">Este paciente aún no tiene consultas registradas.</div></div>`;
  }

  document.getElementById('main-historial').innerHTML = html;
  await updateStats();
}

// ─── Abrir formulario ──────────────────────────────────────
async function abrirFormHistorial(citaCodigo) {
  const c = DB.get('citas').find(x => x.codigo === citaCodigo);
  if (!c) { showToast('Cita no encontrada', 'error'); return; }

  const hist = await getHistorialCache();
  const dup  = hist.find(h => h.citaCodigo === citaCodigo);
  if (dup) { showToast('Ya existe un historial para esta cita', 'warn'); return; }

  const pac      = getPacienteLocal(c.paciente);
  const alNoNing = pac?.alergias?.length && pac.alergias[0] !== 'Ninguna';

  document.getElementById('hist-cita-codigo').value       = c.codigo;
  document.getElementById('hist-codigo').value            = nextHistCodigo(hist);
  document.getElementById('hist-medico').value            = c.medico;
  document.getElementById('hist-especialidad').value      = c.especialidad;
  document.getElementById('hist-fecha').value             = formatDate(c.fecha);
  document.getElementById('modal-hist-title').textContent = 'Registrar Consulta Médica';
  document.getElementById('modal-hist-sub').textContent   = `Cita ${c.codigo} · ${pac ? `${pac.nombres} ${pac.apellidos}` : 'Paciente'}`;

  document.getElementById('hist-pac-strip').innerHTML = `
    <div class="patient-info-strip">
      <div class="pi-avatar">${pac ? (pac.nombres[0] ?? '?') + (pac.apellidos[0] ?? '?') : '?'}</div>
      <div class="pi-data">
        <div class="pi-name">${pac ? `${pac.nombres} ${pac.apellidos}` : '—'}</div>
        <div class="pi-meta">${pac ? `${pac.edad} años · ${pac.tipoDoc}: ${pac.documento}` : ''}</div>
      </div>
      ${alNoNing ? `<div class="allergy-alert">⚠️ ${pac.alergias.join(', ')}</div>` : ''}
    </div>`;

  ['hist-sintomas', 'hist-diagnostico', 'hist-tratamiento', 'hist-observaciones'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  ['hist-sintomas-cnt', 'hist-diagnostico-cnt', 'hist-tratamiento-cnt'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '0 / ' + (id.includes('tratamiento') ? 400 : 300);
  });
  document.getElementById('hist-prox-cita').value = '';
  medicamentos = [];
  renderMeds();
  clearAllErrors('form-historial');
  openModal('modal-historial');
}

// ─── Medicamentos dinámicos ────────────────────────────────
function agregarMed() {
  medicamentos.push({ nombre: '', dosis: '', frecuencia: '', duracion: '' });
  renderMeds();
}

function eliminarMed(i) {
  medicamentos.splice(i, 1);
  renderMeds();
}

function renderMeds() {
  const el = document.getElementById('med-lista');
  if (!medicamentos.length) {
    el.innerHTML = '<div style="font-size:.75rem;color:var(--gray-400);margin-bottom:.5rem">Sin medicamentos agregados.</div>';
    return;
  }
  el.innerHTML = medicamentos.map((m, i) => `
    <div class="med-row" style="margin-bottom:.65rem;background:var(--gray-50);border:1px solid var(--gray-200);border-radius:var(--radius);padding:.65rem">
      <div class="form-group">
        <label class="form-label">Medicamento <span class="req">*</span></label>
        <input type="text" class="form-control" placeholder="Ej: Amoxicilina" value="${m.nombre}"
          oninput="medicamentos[${i}].nombre=this.value"/>
      </div>
      <div class="form-group">
        <label class="form-label">Dosis</label>
        <input type="text" class="form-control" placeholder="500mg" value="${m.dosis}"
          oninput="medicamentos[${i}].dosis=this.value"/>
      </div>
      <div class="form-group">
        <label class="form-label">Frecuencia</label>
        <input type="text" class="form-control" placeholder="Cada 8 horas" value="${m.frecuencia}"
          oninput="medicamentos[${i}].frecuencia=this.value"/>
      </div>
      <div class="form-group">
        <label class="form-label">Duración</label>
        <input type="text" class="form-control" placeholder="5 días" value="${m.duracion}"
          oninput="medicamentos[${i}].duracion=this.value"/>
      </div>
      <div class="form-group">
        <label class="form-label">&nbsp;</label>
        <button type="button" class="btn btn-danger btn-sm" onclick="eliminarMed(${i})">🗑</button>
      </div>
    </div>`).join('');
}

// ─── Validar ───────────────────────────────────────────────
function validarHistorial() {
  clearAllErrors('form-historial');
  let ok = true;
  const sintomas    = document.getElementById('hist-sintomas').value.trim();
  const diagnostico = document.getElementById('hist-diagnostico').value.trim();
  const tratamiento = document.getElementById('hist-tratamiento').value.trim();
  const proxCita    = document.getElementById('hist-prox-cita').value;

  if (!sintomas || sintomas.length < 10)       { showFieldError('hist-sintomas',    'Mínimo 10 caracteres'); ok = false; }
  else if (sintomas.length > 300)               { showFieldError('hist-sintomas',    'Máximo 300 caracteres'); ok = false; }
  if (!diagnostico || diagnostico.length < 10)  { showFieldError('hist-diagnostico', 'Mínimo 10 caracteres'); ok = false; }
  else if (diagnostico.length > 300)            { showFieldError('hist-diagnostico', 'Máximo 300 caracteres'); ok = false; }
  else if (['bien','mal','ok','nada'].includes(diagnostico.toLowerCase())) { showFieldError('hist-diagnostico', 'El diagnóstico es demasiado corto o vago'); ok = false; }
  if (!tratamiento || tratamiento.length < 10)  { showFieldError('hist-tratamiento', 'Mínimo 10 caracteres'); ok = false; }
  else if (tratamiento.length > 400)            { showFieldError('hist-tratamiento', 'Máximo 400 caracteres'); ok = false; }

  for (let i = 0; i < medicamentos.length; i++) {
    if (!medicamentos[i].nombre.trim()) {
      showToast(`Medicamento ${i + 1}: el nombre es obligatorio`, 'error');
      ok = false; break;
    }
  }
  if (proxCita && new Date(proxCita) <= new Date()) {
    showFieldError('hist-prox-cita', 'La próxima cita debe ser una fecha futura'); ok = false;
  }
  return ok;
}

// ─── Guardar → Supabase ────────────────────────────────────
async function guardarHistorial() {
  if (!validarHistorial()) { showToast('Corrija los errores del formulario', 'error'); return; }

  const citaCodigo = document.getElementById('hist-cita-codigo').value;
  const cita = DB.get('citas').find(c => c.codigo === citaCodigo);
  if (!cita) { showToast('Cita no encontrada', 'error'); return; }

  const histCache = await getHistorialCache();
  if (histCache.find(h => h.citaCodigo === citaCodigo)) {
    showToast('Ya existe un historial para esta cita', 'warn'); return;
  }

  const hist = {
    codigo:         nextHistCodigo(histCache),
    citaCodigo,
    pacienteCodigo: String(cita.paciente),
    medico:         cita.medico,
    especialidad:   cita.especialidad,
    fecha:          cita.fecha,
    sintomas:       document.getElementById('hist-sintomas').value.trim(),
    diagnostico:    document.getElementById('hist-diagnostico').value.trim(),
    tratamiento:    document.getElementById('hist-tratamiento').value.trim(),
    medicamentos:   medicamentos.filter(m => m.nombre.trim()),
    observaciones:  document.getElementById('hist-observaciones').value.trim(),
    proximaCita:    document.getElementById('hist-prox-cita').value,
    registradoEn:   new Date().toISOString(),
  };

  try {
    const saved = await insertHistorialSupabase(hist);
    _historialCache = [...histCache, saved];
    closeModal('modal-historial');
    showToast('Historial clínico registrado exitosamente', 'success');
    await renderCitasAtendidas();
    if (citaSeleccionada) await seleccionarCita(citaSeleccionada.codigo);
    await updateStats();
  } catch (e) {
    console.error('Error al guardar historial:', e);
    showToast('Error al guardar en el servidor: ' + e.message, 'error');
  }
}

// ─── Stats ─────────────────────────────────────────────────
async function updateStats() {
  const hist  = await getHistorialCache();
  const citas = DB.get('citas').filter(c => c.estado === 'Atendida');
  const pacs  = [...new Set(hist.map(h => h.pacienteCodigo))];
  document.getElementById('st-hist').textContent       = hist.length;
  document.getElementById('st-pendientes').textContent = citas.filter(c => !hist.find(h => h.citaCodigo === c.codigo)).length;
  document.getElementById('st-con-meds').textContent   = hist.filter(h => h.medicamentos && h.medicamentos.length).length;
  document.getElementById('st-pacs-hist').textContent  = pacs.length;
}