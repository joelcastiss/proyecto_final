// ─── Supabase config (pacientes) ──────────────────────────
// _pacientesCache, getPacientesCache() y getPacienteLocal()
// ahora viven en shared.js para ser compartidos con historial y sala-espera.
// Este archivo solo necesita las constantes para su propio uso si las requiere.

const MEDICOS = {
  'Medicina general': ['Dr. Carlos Ramos', 'Dra. Ana Torres', 'Dr. José Peña'],
  'Pediatría':        ['Dra. Lucía Herrera', 'Dr. Marco Díaz'],
  'Cardiología':      ['Dr. Eduardo Vela', 'Dra. Patricia Quispe'],
  'Dermatología':     ['Dra. Sofía Lara', 'Dr. Andrés Castro'],
  'Traumatología':    ['Dr. Luis Ramírez', 'Dr. Roberto Huanca'],
  'Ginecología':      ['Dra. María Salinas', 'Dra. Carmen Huanca'],
  'Odontología':      ['Dr. Jorge Soto', 'Dra. Fiorella Núñez'],
};

const HORAS = Array.from({ length: 20 }, (_, i) => {
  const h = Math.floor(i / 2) + 8;
  const m = i % 2 === 0 ? '00' : '30';
  return `${String(h).padStart(2, '0')}:${m}`;
}).filter(h => { const [hh] = h.split(':'); return parseInt(hh) < 18; });

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('cita-fecha').min = todayStr();
  const sel = document.getElementById('cita-hora');
  HORAS.forEach(h => {
    const o = document.createElement('option');
    o.value = o.textContent = h;
    sel.appendChild(o);
  });
  // Precarga pacientes desde Supabase (función en shared.js)
  await getPacientesCache();
  renderCitas();
  updateStats();
});

async function abrirNuevaCita() {
  resetFormCita();
  document.getElementById('modal-cita-title').textContent = 'Nueva Cita';
  await cargarPacientesSelect();
  openModal('modal-cita');
}

async function cargarPacientesSelect(selected = '') {
  const sel = document.getElementById('cita-paciente');
  sel.innerHTML = '<option value="">Cargando pacientes…</option>';
  sel.disabled  = true;

  const pacientes = await getPacientesCache();

  sel.innerHTML = '<option value="">Seleccionar paciente…</option>';
  sel.disabled  = false;

  if (!pacientes.length) {
    sel.innerHTML = '<option value="">No hay pacientes registrados</option>';
    return;
  }

  pacientes.forEach(p => {
    const codigo    = p.codigo ?? p.id;
    const nombres   = p.nombres   ?? p.nombre   ?? '';
    const apellidos = p.apellidos ?? p.apellido  ?? '';
    const documento = p.documento ?? p.dni       ?? p.cedula ?? '';
    const o = document.createElement('option');
    o.value       = codigo;
    o.textContent = `${nombres} ${apellidos} — ${documento}`;
    if (String(codigo) === String(selected)) o.selected = true;
    sel.appendChild(o);
  });
}

function onEspecialidadChange() {
  const esp = document.getElementById('cita-especialidad').value;
  const sel  = document.getElementById('cita-medico');
  sel.innerHTML = '';
  if (!esp) { sel.innerHTML = '<option value="">Seleccione especialidad primero</option>'; return; }
  sel.innerHTML = '<option value="">Seleccionar médico…</option>';
  (MEDICOS[esp] || []).forEach(m => {
    const o = document.createElement('option');
    o.value = o.textContent = m;
    sel.appendChild(o);
  });
  clearFieldError('cita-especialidad');
}

function onPacienteChange() {
  const codigo = document.getElementById('cita-paciente').value;
  const strip  = document.getElementById('pac-info-strip');
  const bloque = document.getElementById('bloque-pac-info');
  if (!codigo) { bloque.style.display = 'none'; return; }

  const p = getPacienteLocal(codigo);
  if (!p) { bloque.style.display = 'none'; return; }

  const nombres   = p.nombres   ?? p.nombre   ?? '';
  const apellidos = p.apellidos ?? p.apellido  ?? '';
  const edad      = p.edad      ?? '—';
  const telefono  = p.telefono  ?? p.celular   ?? '—';
  const tipoDoc   = p.tipoDoc   ?? p.tipo_doc  ?? 'Doc';
  const documento = p.documento ?? p.dni       ?? p.cedula ?? '—';
  const alergias  = Array.isArray(p.alergias) ? p.alergias : [];
  const alNoNing  = alergias.length && alergias[0] !== 'Ninguna';

  strip.innerHTML = `
    <div class="patient-info-strip">
      <div class="pi-avatar">${(nombres[0] ?? '?')}${(apellidos[0] ?? '?')}</div>
      <div class="pi-data">
        <div class="pi-name">${nombres} ${apellidos}</div>
        <div class="pi-meta">${edad} años · ${telefono} · ${tipoDoc}: ${documento}</div>
      </div>
      ${alNoNing ? `<div class="allergy-alert">⚠️ ${alergias.join(', ')}</div>` : ''}
    </div>`;
  bloque.style.display = 'block';
  clearFieldError('cita-paciente');
}

function onPrioridadChange() {
  const val = document.getElementById('cita-prioridad').value;
  document.getElementById('bloque-justificacion').style.display = val === 'Urgente' ? 'block' : 'none';
}

function resetFormCita() {
  document.getElementById('form-cita').reset();
  document.getElementById('cita-codigo-edit').value = '';
  document.getElementById('cita-codigo').value = nextId('CITA', DB.get('citas'));
  document.getElementById('bloque-pac-info').style.display = 'none';
  document.getElementById('bloque-justificacion').style.display = 'none';
  document.getElementById('cita-medico').innerHTML = '<option value="">Seleccione especialidad primero</option>';
  clearAllErrors('form-cita');
}

// ─── Validación ───────────────────────────────────────────
function validarFormCita() {
  clearAllErrors('form-cita');
  let ok = true;
  const editCodigo   = document.getElementById('cita-codigo-edit').value;
  const paciente     = document.getElementById('cita-paciente').value;
  const especialidad = document.getElementById('cita-especialidad').value;
  const medico       = document.getElementById('cita-medico').value;
  const fecha        = document.getElementById('cita-fecha').value;
  const hora         = document.getElementById('cita-hora').value;
  const prioridad    = document.getElementById('cita-prioridad').value;
  const motivo       = document.getElementById('cita-motivo').value.trim();
  const justific     = document.getElementById('cita-justificacion').value.trim();

  if (!paciente)     { showFieldError('cita-paciente',    'Seleccione un paciente');         ok = false; }
  if (!especialidad) { showFieldError('cita-especialidad','Seleccione la especialidad');      ok = false; }
  if (!medico)       { showFieldError('cita-medico',      'Seleccione el médico');            ok = false; }
  if (!fecha)        { showFieldError('cita-fecha',       'La fecha es obligatoria');         ok = false; }
  else if (fecha < todayStr()) { showFieldError('cita-fecha', 'No se permiten fechas pasadas'); ok = false; }
  if (!hora)         { showFieldError('cita-hora',        'Seleccione la hora');              ok = false; }
  if (!prioridad)    { showFieldError('cita-prioridad',   'Seleccione la prioridad');         ok = false; }
  if (prioridad === 'Urgente' && justific.length < 10) { showFieldError('cita-justificacion', 'La justificación debe tener mínimo 10 caracteres'); ok = false; }
  if (!motivo || motivo.length < 10) { showFieldError('cita-motivo', 'El motivo debe tener mínimo 10 caracteres'); ok = false; }
  else if (motivo.length > 200)      { showFieldError('cita-motivo', 'Máximo 200 caracteres'); ok = false; }

  if (ok) {
    const citas = DB.get('citas');
    const dup1 = citas.some(c => c.codigo !== editCodigo && c.medico === medico && c.fecha === fecha && c.hora === hora && !['Cancelada', 'No asistió'].includes(c.estado));
    if (dup1) { showFieldError('cita-hora', 'El médico ya tiene una cita en ese horario'); ok = false; }
    const dup2 = citas.some(c => c.codigo !== editCodigo && c.paciente === paciente && c.fecha === fecha && c.hora === hora && !['Cancelada', 'No asistió'].includes(c.estado));
    if (dup2) { showFieldError('cita-hora', 'El paciente ya tiene una cita en ese horario'); ok = false; }
  }
  return ok;
}

function guardarCita() {
  if (!validarFormCita()) { showToast('Corrija los errores', 'error'); return; }
  const editCodigo = document.getElementById('cita-codigo-edit').value;
  const cita = {
    codigo:        editCodigo || nextId('CITA', DB.get('citas')),
    paciente:      document.getElementById('cita-paciente').value,
    especialidad:  document.getElementById('cita-especialidad').value,
    medico:        document.getElementById('cita-medico').value,
    fecha:         document.getElementById('cita-fecha').value,
    hora:          document.getElementById('cita-hora').value,
    prioridad:     document.getElementById('cita-prioridad').value,
    motivo:        document.getElementById('cita-motivo').value.trim(),
    justificacion: document.getElementById('cita-justificacion').value.trim(),
    estado:        editCodigo ? DB.get('citas').find(c => c.codigo === editCodigo)?.estado || 'Programada' : 'Programada',
    creadaEn:      new Date().toISOString(),
  };
  const citas = DB.get('citas');
  if (editCodigo) {
    const idx = citas.findIndex(c => c.codigo === editCodigo);
    if (idx >= 0) citas[idx] = cita;
    showToast('Cita actualizada', 'success');
  } else {
    citas.push(cita);
    showToast('Cita registrada exitosamente', 'success');
  }
  DB.set('citas', citas);
  closeModal('modal-cita');
  renderCitas();
  updateStats();
}

// ─── Render ───────────────────────────────────────────────
function renderCitas() {
  const q    = (document.getElementById('f-buscar').value || '').toLowerCase();
  const fF   = document.getElementById('f-fecha').value;
  const fE   = document.getElementById('f-estado').value;
  const fEsp = document.getElementById('f-especialidad').value;
  const fP   = document.getElementById('f-prioridad').value;

  let citas = DB.get('citas').filter(c => {
    const pac    = getPacienteLocal(c.paciente);
    const nombre = pac ? `${pac.nombres ?? pac.nombre ?? ''} ${pac.apellidos ?? pac.apellido ?? ''}`.toLowerCase() : '';
    if (q && !nombre.includes(q) && !c.medico.toLowerCase().includes(q) && !c.codigo.toLowerCase().includes(q)) return false;
    if (fF  && c.fecha         !== fF)  return false;
    if (fE  && c.estado        !== fE)  return false;
    if (fEsp && c.especialidad !== fEsp) return false;
    if (fP  && c.prioridad     !== fP)  return false;
    return true;
  });

  const priOrd = { Urgente: 0, Preferencial: 1, Normal: 2 };
  citas.sort((a, b) => priOrd[a.prioridad] - priOrd[b.prioridad] || a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora));

  const grid  = document.getElementById('cita-card-grid');
  const empty = document.getElementById('empty-citas');
  if (!citas.length) { grid.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  grid.innerHTML = citas.map(c => {
    const pac      = getPacienteLocal(c.paciente);
    const nombre   = pac
      ? `${pac.nombres ?? pac.nombre ?? ''} ${pac.apellidos ?? pac.apellido ?? ''}`.trim()
      : '(Paciente no encontrado)';
    const alergias = Array.isArray(pac?.alergias) ? pac.alergias : [];
    const alNoNing = alergias.length && alergias[0] !== 'Ninguna';
    const priClass = c.prioridad === 'Urgente' ? 'urgente' : c.prioridad === 'Preferencial' ? 'preferencial' : '';

    let acciones = '';
    if (c.estado === 'Programada') acciones = `<button class="btn btn-success btn-sm" onclick="cambiarEstado('${c.codigo}','Confirmada')">✔ Confirmar</button><button class="btn btn-danger btn-sm" onclick="pedirCancelacion('${c.codigo}')">✕ Cancelar</button>`;
    if (c.estado === 'Confirmada') acciones = `<button class="btn btn-info btn-sm" onclick="cambiarEstado('${c.codigo}','En espera')">🏥 A sala espera</button><button class="btn btn-danger btn-sm" onclick="pedirCancelacion('${c.codigo}')">✕ Cancelar</button>`;
    if (c.estado === 'En espera')  acciones = `<a href="sala-espera.html" class="btn btn-outline btn-sm">Ver Sala →</a>`;
    if (c.estado === 'Programada' || c.estado === 'Confirmada') acciones += `<button class="btn btn-ghost btn-sm" onclick="editarCita('${c.codigo}')">✏️</button>`;

    return `<div class="cita-card ${priClass}">
      <div class="cita-main">
        <div class="cita-header">
          <span class="cita-code">${c.codigo}</span>
          <span class="badge badge-${c.estado.toLowerCase().replace(/ /g,'')} badge-${c.estado==='En espera'?'espera':c.estado==='En atención'?'atencion':c.estado==='No asistió'?'noasistio':c.estado.toLowerCase()}">${c.estado}</span>
          <span class="badge badge-${c.prioridad.toLowerCase()}">${c.prioridad}</span>
        </div>
        <div class="cita-paciente">${nombre}</div>
        <div class="cita-meta">
          <span>👨‍⚕️ ${c.medico}</span>
          <span>🏥 ${c.especialidad}</span>
          <span>📅 ${formatDate(c.fecha)}</span>
          <span>🕐 ${c.hora}</span>
        </div>
        <div class="cita-motivo">💬 ${c.motivo}</div>
        ${alNoNing ? `<div class="cita-allergy">⚠️ Alergias: ${alergias.join(', ')}</div>` : ''}
        ${c.prioridad === 'Urgente' && c.justificacion ? `<div style="font-size:.7rem;color:var(--red);margin-top:.35rem">🚨 ${c.justificacion}</div>` : ''}
      </div>
      <div class="cita-actions">${acciones}</div>
    </div>`;
  }).join('');
}

function cambiarEstado(codigo, nuevoEstado) {
  const citas = DB.get('citas');
  const c = citas.find(x => x.codigo === codigo);
  if (!c) return;
  if (nuevoEstado === 'En espera' && c.estado === 'Cancelada') { showToast('No se puede enviar a espera una cita cancelada', 'error'); return; }
  c.estado = nuevoEstado;
  if (nuevoEstado === 'En espera') c.horaLlegada = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  DB.set('citas', citas);
  showToast(`Estado actualizado: ${nuevoEstado}`, 'success');
  renderCitas();
  updateStats();
}

function pedirCancelacion(codigo) {
  document.getElementById('cita-cancelar-codigo').value = codigo;
  document.getElementById('motivo-cancelacion').value   = '';
  clearFieldError('motivo-cancelacion');
  openModal('modal-cancelar');
}

function confirmarCancelacion() {
  const motivo = document.getElementById('motivo-cancelacion').value.trim();
  if (!motivo) { showFieldError('motivo-cancelacion', 'Ingrese el motivo de cancelación'); return; }
  const codigo = document.getElementById('cita-cancelar-codigo').value;
  const citas  = DB.get('citas');
  const c = citas.find(x => x.codigo === codigo);
  if (c) { c.estado = 'Cancelada'; c.motivoCancelacion = motivo; }
  DB.set('citas', citas);
  closeModal('modal-cancelar');
  showToast('Cita cancelada', 'warn');
  renderCitas();
  updateStats();
}

async function editarCita(codigo) {
  const c = DB.get('citas').find(x => x.codigo === codigo);
  if (!c) return;
  resetFormCita();
  await cargarPacientesSelect(c.paciente);
  document.getElementById('modal-cita-title').textContent     = 'Editar Cita';
  document.getElementById('cita-codigo-edit').value           = c.codigo;
  document.getElementById('cita-codigo').value                = c.codigo;
  document.getElementById('cita-paciente').value              = c.paciente;
  onPacienteChange();
  document.getElementById('cita-especialidad').value          = c.especialidad;
  onEspecialidadChange();
  setTimeout(() => {
    document.getElementById('cita-medico').value = c.medico;
    document.getElementById('cita-hora').value   = c.hora;
  }, 50);
  document.getElementById('cita-fecha').value         = c.fecha;
  document.getElementById('cita-prioridad').value     = c.prioridad;
  document.getElementById('cita-motivo').value        = c.motivo;
  document.getElementById('cita-justificacion').value = c.justificacion || '';
  if (c.prioridad === 'Urgente') document.getElementById('bloque-justificacion').style.display = 'block';
  openModal('modal-cita');
}

function limpiarFiltros() {
  ['f-buscar', 'f-fecha', 'f-estado', 'f-especialidad', 'f-prioridad'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  renderCitas();
}

function updateStats() {
  const citas = DB.get('citas');
  const today = todayStr();
  document.getElementById('st-total').textContent    = citas.length;
  document.getElementById('st-hoy').textContent      = citas.filter(c => c.fecha === today && !['Cancelada', 'No asistió'].includes(c.estado)).length;
  document.getElementById('st-espera').textContent   = citas.filter(c => c.estado === 'En espera').length;
  document.getElementById('st-urgentes').textContent = citas.filter(c => c.prioridad === 'Urgente' && !['Cancelada', 'No asistió', 'Atendida'].includes(c.estado)).length;
}