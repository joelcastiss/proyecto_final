/* ============================================================
   MediCore — pacientes.js  (Supabase)
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await cargarPacientes();
  renderStats();
  renderLista();
});

async function cargarPacientes() {
  try {
    await getPacientesCache(true);
  } catch (e) {
    showToast('Error al conectar con la base de datos', 'error');
    console.error(e);
  }
}

// ─── Stats ─────────────────────────────────────────────────────
function renderStats() {
  const pacs = getAllPacientes();
  const hoy  = todayStr();
  const nuevosHoy = pacs.filter(p => (p.creadoEn || '').startsWith(hoy)).length;
  const menores   = pacs.filter(p => isMinor(p.fechaNacimiento)).length;
  const conAlerg  = pacs.filter(p => p.alergias?.length && p.alergias[0] !== 'Ninguna').length;

  const elTotal    = document.getElementById('st-total');
  const elNuevos   = document.getElementById('st-nuevos');
  const elMenores  = document.getElementById('st-menores');
  const elAlergias = document.getElementById('st-alergias');

  if (elTotal)    animateCount(elTotal, pacs.length);
  if (elNuevos)   animateCount(elNuevos, nuevosHoy);
  if (elMenores)  animateCount(elMenores, menores);
  if (elAlergias) animateCount(elAlergias, conAlerg);
}

// ─── Lista lateral ─────────────────────────────────────────────
function renderLista(query = '') {
  const q    = query.toLowerCase();
  const pacs = getAllPacientes().filter(p => {
    if (!q) return true;
    const full = `${p.nombres} ${p.apellidos} ${p.documento}`.toLowerCase();
    return full.includes(q);
  });

  const el = document.getElementById('patient-list');
  if (!el) return;

  if (!pacs.length) {
    el.innerHTML = '<div style="font-size:.75rem;color:var(--gray-400);padding:1rem;text-align:center">Sin resultados</div>';
    return;
  }

  el.innerHTML = pacs.slice(0, 50).map(p => {
    const initials = `${(p.nombres || ' ')[0]}${(p.apellidos || ' ')[0]}`.toUpperCase();
    return `<div class="patient-list-item" onclick="seleccionarPaciente('${p.id}')">
      <div class="pli-avatar">${initials}</div>
      <div style="flex:1;min-width:0">
        <div class="pli-name">${p.nombres} ${p.apellidos}</div>
        <div class="pli-meta">${p.tipoDoc} ${p.documento}</div>
      </div>
      <span class="pli-code">P-${String(p.id).padStart(3,'0')}</span>
    </div>`;
  }).join('');
}

// ─── Seleccionar paciente (detalle) ────────────────────────────
function seleccionarPaciente(pacId) {
  // Marcar seleccionado
  document.querySelectorAll('.patient-list-item').forEach(el => el.classList.remove('selected'));
  const items = document.querySelectorAll('.patient-list-item');
  items.forEach(el => {
    if (el.getAttribute('onclick')?.includes(`'${pacId}'`)) el.classList.add('selected');
  });

  const pac = getPacienteLocal(pacId);
  if (!pac) return;

  const det = document.getElementById('detalle-paciente');
  if (!det) return;

  const citas = getCitasLocal().filter(c => String(c.paciente) === String(pac.id));
  const ultCita = citas.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))[0];

  det.innerHTML = `
    <div class="card" style="margin-bottom:1rem">
      <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.25rem;flex-wrap:wrap">
        <div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,var(--blue),var(--blue-light));
          color:white;display:flex;align-items:center;justify-content:center;font-size:1.3rem;font-weight:700;flex-shrink:0">
          ${`${(pac.nombres||' ')[0]}${(pac.apellidos||' ')[0]}`.toUpperCase()}
        </div>
        <div style="flex:1">
          <div style="font-size:1.05rem;font-weight:700;color:var(--gray-900)">${pac.nombres} ${pac.apellidos}</div>
          <div style="font-size:.75rem;color:var(--blue);font-weight:600">P-${String(pac.id).padStart(3,'0')}</div>
        </div>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap">
          <button class="btn btn-outline btn-sm" onclick="abrirEditar('${pac.id}')">✏️ Editar</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="pedirEliminar('${pac.id}')">🗑️</button>
        </div>
      </div>

      <div class="detail-grid">
        <div class="detail-item"><label>Tipo Doc.</label><span>${pac.tipoDoc}</span></div>
        <div class="detail-item"><label>N° Documento</label><span>${pac.documento}</span></div>
        <div class="detail-item"><label>Fecha de Nac.</label><span>${formatDate(pac.fechaNacimiento)}</span></div>
        <div class="detail-item"><label>Edad</label><span>${pac.edad ?? '—'} años${isMinor(pac.fechaNacimiento) ? ' <span style="color:var(--orange);font-size:.65rem;font-weight:600">MENOR</span>' : ''}</span></div>
        <div class="detail-item"><label>Sexo</label><span>${pac.sexo || '—'}</span></div>
        <div class="detail-item"><label>Teléfono</label><span>${pac.telefono}</span></div>
        <div class="detail-item"><label>Correo</label><span>${pac.correo || '—'}</span></div>
        <div class="detail-item"><label>Dirección</label><span>${pac.direccion || '—'}</span></div>
      </div>

      ${pac.alergias?.length && pac.alergias[0] !== 'Ninguna' ? `
        <div style="margin-top:.85rem">
          <div style="font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--gray-400);margin-bottom:.4rem">Alergias</div>
          ${renderAlergias(pac.alergias)}
        </div>` : ''}

      <div style="margin-top:.85rem;padding-top:.85rem;border-top:1px solid var(--gray-100);display:flex;gap:1.5rem;flex-wrap:wrap;font-size:.75rem;color:var(--gray-500)">
        <span>📅 ${citas.length} cita${citas.length !== 1 ? 's' : ''} total${citas.length !== 1 ? 'es' : ''}</span>
        ${ultCita ? `<span>🕐 Última: ${formatDate(ultCita.fecha)}</span>` : ''}
      </div>
    </div>`;
}

// ─── Nuevo / Editar modal ─────────────────────────────────────
function abrirNuevo() {
  clearAllErrors('form-paciente');
  document.getElementById('pac-id-edit').value   = '';
  document.getElementById('modal-pac-title').textContent = 'Nuevo Paciente';
  document.getElementById('form-paciente').reset();
  document.getElementById('bloque-tutor').style.display = 'none';
  openModal('modal-paciente');
}

function abrirEditar(pacId) {
  const pac = getPacienteLocal(pacId);
  if (!pac) return;
  clearAllErrors('form-paciente');
  document.getElementById('pac-id-edit').value   = pac.id;
  document.getElementById('modal-pac-title').textContent = 'Editar Paciente';

  // Llenar campos
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
  set('pac-nombres',   pac.nombres);
  set('pac-apellidos', pac.apellidos);
  set('pac-tipo-doc',  pac.tipoDoc || 'DNI');
  set('pac-doc',       pac.documento);
  set('pac-fnac',      pac.fechaNacimiento || '');
  set('pac-sexo',      pac.sexo || '');
  set('pac-telefono',  pac.telefono);
  set('pac-correo',    pac.correo || '');
  set('pac-direccion', pac.direccion || '');

  // Alergias (checkboxes)
  document.querySelectorAll('.alergia-pill input[type="checkbox"]').forEach(cb => {
    cb.checked = pac.alergias?.includes(cb.value);
  });

  onFechaNacChange();
  openModal('modal-paciente');
}

function onFechaNacChange() {
  const fnac = document.getElementById('pac-fnac')?.value;
  const bloque = document.getElementById('bloque-tutor');
  if (bloque) bloque.style.display = isMinor(fnac) ? 'block' : 'none';
}

async function guardarPaciente() {
  if (!validarFormPaciente()) return;

  const editId = document.getElementById('pac-id-edit').value;

  // Recoger alergias seleccionadas
  const alergias = [...document.querySelectorAll('.alergia-pill input[type="checkbox"]:checked')].map(cb => cb.value);

  const payload = {
    nombres:          document.getElementById('pac-nombres').value.trim(),
    apellidos:        document.getElementById('pac-apellidos').value.trim(),
    tipo_documento:   document.getElementById('pac-tipo-doc')?.value || 'DNI',
    documento:        document.getElementById('pac-doc').value.trim(),
    fecha_nacimiento: document.getElementById('pac-fnac').value || null,
    sexo:             document.getElementById('pac-sexo')?.value || null,
    telefono:         document.getElementById('pac-telefono').value.trim(),
    correo:           document.getElementById('pac-correo')?.value?.trim() || null,
    direccion:        document.getElementById('pac-direccion')?.value?.trim() || null,
    alergias:         alergias,
  };

  try {
    if (editId) {
      const [updated] = await sbFetch(`pacientes?id=eq.${editId}`, {
        method: 'PATCH', body: JSON.stringify(payload),
      });
      // Actualizar cache
      await getPacientesCache(true);
      closeModal('modal-paciente');
      renderLista();
      renderStats();
      seleccionarPaciente(editId);
      showToast('Paciente actualizado', 'success');
    } else {
      const [inserted] = await sbFetch('pacientes', {
        method: 'POST', body: JSON.stringify(payload),
      });
      await getPacientesCache(true);
      closeModal('modal-paciente');
      renderLista();
      renderStats();
      if (inserted?.id) seleccionarPaciente(inserted.id);
      showToast('Paciente registrado', 'success');
    }
  } catch (e) {
    showToast('Error al guardar paciente: ' + e.message, 'error');
    console.error(e);
  }
}

function validarFormPaciente() {
  let ok = true;
  clearAllErrors('form-paciente');
  [
    ['pac-nombres',   'Ingresa los nombres'],
    ['pac-apellidos', 'Ingresa los apellidos'],
    ['pac-doc',       'Ingresa el número de documento'],
    ['pac-fnac',      'Ingresa la fecha de nacimiento'],
    ['pac-telefono',  'Ingresa el teléfono'],
  ].forEach(([id, msg]) => {
    const val = document.getElementById(id)?.value?.trim();
    if (!val) { showFieldError(id, msg); ok = false; }
  });
  const doc = document.getElementById('pac-doc')?.value?.trim();
  if (doc && !/^\d{8}$/.test(doc)) { showFieldError('pac-doc', 'El DNI debe tener 8 dígitos'); ok = false; }
  const tel = document.getElementById('pac-telefono')?.value?.trim();
  if (tel && !/^\d{9}$/.test(tel)) { showFieldError('pac-telefono', 'El teléfono debe tener 9 dígitos'); ok = false; }
  return ok;
}

// ─── Eliminar ─────────────────────────────────────────────────
function pedirEliminar(pacId) {
  document.getElementById('pac-eliminar-id').value = pacId;
  openModal('modal-eliminar');
}

async function confirmarEliminar() {
  const pacId = document.getElementById('pac-eliminar-id').value;
  try {
    await sbFetch(`pacientes?id=eq.${pacId}`, { method: 'DELETE' });
    await getPacientesCache(true);
    closeModal('modal-eliminar');
    const det = document.getElementById('detalle-paciente');
    if (det) det.innerHTML = '<div class="empty-state"><div class="empty-icon">👤</div><div class="empty-sub">Selecciona un paciente</div></div>';
    renderLista();
    renderStats();
    showToast('Paciente eliminado', 'warn');
  } catch (e) {
    showToast('Error al eliminar paciente: ' + e.message, 'error');
  }
}