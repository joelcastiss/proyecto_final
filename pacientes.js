// ══════════════════════════════════════════
//  pacientes.js — Lógica del módulo Pacientes
//  Depende de: shared.js (DB, helpers, modals)
// ══════════════════════════════════════════

// ─── Estado ────────────────────────────────────────────────
let alergiasSeleccionadas = [];
let modoEditar = false;

// ─── Inicialización ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  bindPacienteEvents();
  renderTable();
  renderRecientes();
  updateStats();

  const nacInput = document.getElementById('pac-nacimiento');
  if (nacInput) nacInput.max = new Date().toISOString().split('T')[0];

  const otroInput = document.getElementById('pac-alergia-otro');
  if (otroInput) otroInput.addEventListener('input', actualizarResumenAlergias);
});

function bindPacienteEvents() {
  document.querySelectorAll('[data-paciente-nuevo]').forEach(btn => {
    btn.addEventListener('click', () => {
      resetForm();
      openModal('modal-nuevo');
    });
  });

  const btnGuardar = document.getElementById('btn-guardar-paciente');
  if (btnGuardar) btnGuardar.addEventListener('click', guardarPaciente);

  const form = document.getElementById('form-paciente');
  if (form) {
    form.addEventListener('submit', event => {
      event.preventDefault();
      guardarPaciente(event);
    });
  }
}

// --- Alergias ----------------------------------------------
/**
 * Se dispara al hacer clic en cualquier pill de alergia.
 * Gestiona la exclusividad de "Ninguna" y actualiza el estado.
 * @param {HTMLInputElement} checkbox
 */
function onAlergiaChange(checkbox) {
  const valor = checkbox.value;
  const checks = document.querySelectorAll('#check-alergias input[type="checkbox"]');

  if (valor === 'Ninguna') {
    // Desmarcar todas las demás si se elige Ninguna
    if (checkbox.checked) {
      checks.forEach(cb => { if (cb.value !== 'Ninguna') cb.checked = false; });
    }
  } else {
    // Si se marca cualquier otra opción, desmarcar Ninguna
    if (checkbox.checked) {
      checks.forEach(cb => { if (cb.value === 'Ninguna') cb.checked = false; });
    }
  }

  // Recalcular lista de alergias seleccionadas
  alergiasSeleccionadas = [];
  checks.forEach(cb => { if (cb.checked) alergiasSeleccionadas.push(cb.value); });

  // Mostrar/ocultar campo de texto "Otro"
  const mostrarOtro = alergiasSeleccionadas.includes('Otro');
  document.getElementById('bloque-otro-alergia').style.display = mostrarOtro ? 'block' : 'none';
  if (!mostrarOtro) document.getElementById('pac-alergia-otro').value = '';

  // Limpiar mensaje de error si ya hay selección
  const errEl = document.getElementById('alergias-err');
  if (alergiasSeleccionadas.length) {
    errEl.style.display = 'none';
    errEl.textContent = '';
  }

  actualizarResumenAlergias();
}

/**
 * Muestra debajo de los pills un resumen legible de lo seleccionado.
 */
function actualizarResumenAlergias() {
  const resumen = document.getElementById('alergias-resumen');
  const texto   = document.getElementById('alergias-resumen-texto');

  if (!alergiasSeleccionadas.length) {
    resumen.style.display = 'none';
    return;
  }

  resumen.style.display = 'block';
  const etiquetas = alergiasSeleccionadas.map(a => {
    if (a === 'Otro') {
      const val = document.getElementById('pac-alergia-otro').value.trim();
      return val ? `Otro: ${val}` : 'Otro';
    }
    return a;
  });
  texto.textContent = etiquetas.join(', ');
}

// ─── Documento ─────────────────────────────────────────────

/**
 * Actualiza el hint del campo N° Documento según el tipo seleccionado.
 */
function onTipoDocChange() {
  const tipo = document.getElementById('pac-tipo-doc').value;
  const hint = document.getElementById('doc-hint');

  if (tipo === 'DNI')      hint.textContent = 'Exactamente 8 dígitos numéricos';
  else if (tipo)           hint.textContent = 'Entre 6 y 15 caracteres alfanuméricos';
  else                     hint.textContent = 'Seleccione el tipo de documento primero';

  clearFieldError('pac-doc');
}

// ─── Nacimiento ────────────────────────────────────────────

/**
 * Calcula la edad y muestra/oculta el bloque de apoderado
 * cuando la fecha de nacimiento cambia.
 */
function onNacimientoChange() {
  const val     = document.getElementById('pac-nacimiento').value;
  const edad    = calcAge(val);
  const display = document.getElementById('pac-edad-display');

  if (edad !== null && edad >= 0) {
    display.textContent = `${edad} año${edad !== 1 ? 's' : ''}`;
    document.getElementById('bloque-apoderado').style.display = isMinor(val) ? 'block' : 'none';
  } else {
    display.textContent = '—';
    document.getElementById('bloque-apoderado').style.display = 'none';
  }
}

// ─── Validación ────────────────────────────────────────────

/**
 * Valida todos los campos del formulario de paciente.
 * @returns {boolean} true si el formulario es válido
 */
function validarFormPaciente() {
  clearAllErrors('form-paciente');
  let ok = true;

  const nombres            = document.getElementById('pac-nombres').value.trim();
  const apellidos          = document.getElementById('pac-apellidos').value.trim();
  const tipoDoc            = document.getElementById('pac-tipo-doc').value;
  const doc                = document.getElementById('pac-doc').value.trim();
  const nacimiento         = document.getElementById('pac-nacimiento').value;
  const telefono           = document.getElementById('pac-telefono').value.trim();
  const email              = document.getElementById('pac-email').value.trim();
  const direccion          = document.getElementById('pac-direccion').value.trim();
  const emergNombre        = document.getElementById('pac-emerg-nombre').value.trim();
  const emergParentesco    = document.getElementById('pac-emerg-parentesco').value;
  const emergTel           = document.getElementById('pac-emerg-tel').value.trim();

  // Nombres
  if (!nombres)                          { showFieldError('pac-nombres', 'El nombre es obligatorio'); ok = false; }
  else if (nombres.length < 2)           { showFieldError('pac-nombres', 'Mínimo 2 caracteres'); ok = false; }
  else if (/^\d+$/.test(nombres))        { showFieldError('pac-nombres', 'No puede contener solo números'); ok = false; }
  else                                     markFieldValid('pac-nombres');

  // Apellidos
  if (!apellidos)                        { showFieldError('pac-apellidos', 'Los apellidos son obligatorios'); ok = false; }
  else if (apellidos.length < 2)         { showFieldError('pac-apellidos', 'Mínimo 2 caracteres'); ok = false; }
  else if (/^\d+$/.test(apellidos))      { showFieldError('pac-apellidos', 'No puede contener solo números'); ok = false; }
  else                                     markFieldValid('pac-apellidos');

  // Tipo de documento
  if (!tipoDoc)  { showFieldError('pac-tipo-doc', 'Seleccione el tipo de documento'); ok = false; }
  else             markFieldValid('pac-tipo-doc');

  // Número de documento
  if (!doc) {
    showFieldError('pac-doc', 'El número de documento es obligatorio');
    ok = false;
  } else if (tipoDoc === 'DNI' && !/^\d{8}$/.test(doc)) {
    showFieldError('pac-doc', 'El DNI debe tener exactamente 8 dígitos');
    ok = false;
  } else if (tipoDoc !== 'DNI' && (doc.length < 6 || doc.length > 15)) {
    showFieldError('pac-doc', 'Debe tener entre 6 y 15 caracteres');
    ok = false;
  } else {
    const editCodigo = document.getElementById('pac-codigo-edit').value;
    const dup = DB.get('pacientes').some(p => p.documento === doc && p.codigo !== editCodigo);
    if (dup) { showFieldError('pac-doc', 'Este documento ya está registrado'); ok = false; }
    else       markFieldValid('pac-doc');
  }

  // Fecha de nacimiento
  if (!nacimiento) {
    showFieldError('pac-nacimiento', 'La fecha de nacimiento es obligatoria');
    ok = false;
  } else if (new Date(nacimiento) > new Date()) {
    showFieldError('pac-nacimiento', 'No se permiten fechas futuras');
    ok = false;
  } else {
    markFieldValid('pac-nacimiento');
  }

  // Teléfono
  if (!telefono)                  { showFieldError('pac-telefono', 'El teléfono es obligatorio'); ok = false; }
  else if (!/^\d{9}$/.test(telefono)) { showFieldError('pac-telefono', 'Debe tener exactamente 9 dígitos'); ok = false; }
  else                              markFieldValid('pac-telefono');

  // Email (opcional)
  if (email && !Validate.email(email)) {
    showFieldError('pac-email', 'Formato de correo inválido');
    ok = false;
  }

  // Dirección (opcional, mínimo 5 caracteres si se completa)
  if (direccion && direccion.length < 5) {
    showFieldError('pac-direccion', 'La dirección es demasiado corta');
    ok = false;
  }

  // Alergias — leer directamente desde los checkboxes del DOM
  alergiasSeleccionadas = [];
  document.querySelectorAll('#check-alergias input[type="checkbox"]:checked').forEach(cb => {
    alergiasSeleccionadas.push(cb.value);
  });
  if (!alergiasSeleccionadas.length) {
    const errEl = document.getElementById('alergias-err');
    errEl.textContent = 'Seleccione al menos una opción de alergias';
    errEl.style.display = 'block';
    ok = false;
  }
  if (alergiasSeleccionadas.includes('Otro')) {
    const otro = document.getElementById('pac-alergia-otro').value.trim();
    if (!otro) { showFieldError('pac-alergia-otro', 'Especifique la alergia'); ok = false; }
  }

  // Apoderado (obligatorio si el paciente es menor de edad)
  if (nacimiento && isMinor(nacimiento)) {
    const apoderado      = document.getElementById('pac-apoderado').value.trim();
    const parentApoderado = document.getElementById('pac-parentesco-apoderado').value;
    if (!apoderado || apoderado.length < 3) {
      showFieldError('pac-apoderado', 'Nombre del apoderado requerido (mínimo 3 caracteres)');
      ok = false;
    }
    if (!parentApoderado) {
      showFieldError('pac-parentesco-apoderado', 'Seleccione el parentesco');
      ok = false;
    }
  }

  // Contacto de emergencia
  if (!emergNombre || emergNombre.length < 3) { showFieldError('pac-emerg-nombre',     'Nombre requerido (mínimo 3 caracteres)'); ok = false; }
  if (!emergParentesco)                        { showFieldError('pac-emerg-parentesco', 'Seleccione el parentesco'); ok = false; }
  if (!emergTel || !/^\d{9}$/.test(emergTel)) { showFieldError('pac-emerg-tel',        'El teléfono debe tener 9 dígitos'); ok = false; }

  return ok;
}

// ─── Guardar paciente ──────────────────────────────────────

/**
 * Valida y persiste el paciente (nuevo o edición) en la BD local.
 */
function guardarPaciente(event) {
  if (event) event.preventDefault();
  if (!validarFormPaciente()) {
    showToast('Corrija los errores en el formulario', 'error');
    return;
  }

  const editCodigo = document.getElementById('pac-codigo-edit').value;
  const nacimiento = document.getElementById('pac-nacimiento').value;

  // Normalizar "Otro" con su texto descriptivo
  const alergiasFinal = [...alergiasSeleccionadas];
  if (alergiasFinal.includes('Otro')) {
    const otro = document.getElementById('pac-alergia-otro').value.trim();
    alergiasFinal[alergiasFinal.indexOf('Otro')] = 'Otro: ' + otro;
  }

  const pac = {
    codigo:     editCodigo || nextId('PAC', DB.get('pacientes')),
    nombres:    document.getElementById('pac-nombres').value.trim(),
    apellidos:  document.getElementById('pac-apellidos').value.trim(),
    tipoDoc:    document.getElementById('pac-tipo-doc').value,
    documento:  document.getElementById('pac-doc').value.trim(),
    nacimiento,
    edad:       calcAge(nacimiento),
    telefono:   document.getElementById('pac-telefono').value.trim(),
    email:      document.getElementById('pac-email').value.trim(),
    direccion:  document.getElementById('pac-direccion').value.trim(),
    alergias:   alergiasFinal,
    apoderado:  isMinor(nacimiento) ? {
      nombre:     document.getElementById('pac-apoderado').value.trim(),
      parentesco: document.getElementById('pac-parentesco-apoderado').value,
    } : null,
    emergencia: {
      nombre:     document.getElementById('pac-emerg-nombre').value.trim(),
      parentesco: document.getElementById('pac-emerg-parentesco').value,
      telefono:   document.getElementById('pac-emerg-tel').value.trim(),
    },
    registradoEn: new Date().toISOString(),
  };

  const pacs = DB.get('pacientes');
  if (editCodigo) {
    const idx = pacs.findIndex(p => p.codigo === editCodigo);
    if (idx >= 0) pacs[idx] = pac;
    showToast('Paciente actualizado correctamente', 'success');
  } else {
    pacs.push(pac);
    showToast('Paciente registrado exitosamente', 'success');
  }

  DB.set('pacientes', pacs);
  closeModal('modal-nuevo');
  resetForm();
  renderTable();
  renderRecientes();
  updateStats();
}

// ─── Reset del formulario ──────────────────────────────────

/**
 * Limpia todos los campos y estados del formulario de paciente.
 */
function resetForm() {
  document.getElementById('form-paciente').reset();
  document.getElementById('pac-codigo-edit').value = '';
  document.getElementById('pac-codigo').value      = '';
  document.getElementById('pac-edad-display').textContent = '—';
  document.getElementById('bloque-apoderado').style.display    = 'none';
  document.getElementById('bloque-otro-alergia').style.display = 'none';
  document.getElementById('modal-pac-title').textContent = 'Nuevo Paciente';

  clearAllErrors('form-paciente');

  // Limpiar checkboxes de alergias
  alergiasSeleccionadas = [];
  document.querySelectorAll('#check-alergias input[type="checkbox"]').forEach(cb => cb.checked = false);
  document.getElementById('pac-alergia-otro').value = '';

  const errAl = document.getElementById('alergias-err');
  errAl.style.display = 'none';
  errAl.textContent = '';

  const resumen = document.getElementById('alergias-resumen');
  if (resumen) resumen.style.display = 'none';

  modoEditar = false;

  // Pre-rellenar con el siguiente código disponible
  document.getElementById('pac-codigo').value = nextId('PAC', DB.get('pacientes'));
}

// ─── Render tabla ──────────────────────────────────────────

/**
 * Filtra y pinta la tabla principal de pacientes.
 */
function renderTable() {
  const q   = (document.getElementById('search-pac').value || '').toLowerCase();
  const fAl = document.getElementById('filter-alergia').value;

  const pacs = DB.get('pacientes').filter(p => {
    const match = (p.nombres + ' ' + p.apellidos + ' ' + p.documento).toLowerCase().includes(q);
    if (!match) return false;
    if (fAl === 'si') return p.alergias && p.alergias.length && p.alergias[0] !== 'Ninguna';
    if (fAl === 'no') return !p.alergias || !p.alergias.length || p.alergias[0] === 'Ninguna';
    return true;
  });

  const tbody = document.getElementById('tbody-pac');
  const empty = document.getElementById('empty-pac');

  if (!pacs.length) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = pacs.map(p => {
    const alNoNing = p.alergias && p.alergias.length && p.alergias[0] !== 'Ninguna';
    const alText   = alNoNing
      ? `<span style="color:var(--red);font-size:.7rem;font-weight:600">⚠️ ${p.alergias.join(', ')}</span>`
      : `<span style="color:var(--gray-400);font-size:.72rem">Ninguna</span>`;

    return `<tr>
      <td class="td-code">${p.codigo}</td>
      <td>
        <div style="display:flex;align-items:center;gap:.6rem">
          <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--blue),var(--blue-light));color:white;display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;flex-shrink:0">
            ${p.nombres[0]}${p.apellidos[0]}
          </div>
          <div>
            <div class="td-main">${p.nombres} ${p.apellidos}</div>
            <div style="font-size:.68rem;color:var(--gray-400)">${p.email || '—'}</div>
          </div>
        </div>
      </td>
      <td>${p.tipoDoc}: <strong>${p.documento}</strong></td>
      <td>
        ${p.edad} año${p.edad !== 1 ? 's' : ''}
        ${p.edad < 18 ? '<span style="background:var(--orange-pale);color:#92400E;font-size:.62rem;padding:.1rem .4rem;border-radius:var(--radius-full);font-weight:600">menor</span>' : ''}
      </td>
      <td>${p.telefono}</td>
      <td>${alText}</td>
      <td>
        <div class="actions">
          <button class="btn btn-ghost btn-sm"   onclick="verDetalle('${p.codigo}')">👁 Ver</button>
          <button class="btn btn-outline btn-sm" onclick="editarPaciente('${p.codigo}')">✏️</button>
          <button class="btn btn-danger btn-sm"  onclick="eliminarPaciente('${p.codigo}')">🗑</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ─── Render recientes ──────────────────────────────────────

/**
 * Pinta los últimos 6 pacientes registrados en el sidebar.
 */
function renderRecientes() {
  const pacs = DB.get('pacientes').slice(-6).reverse();
  const el   = document.getElementById('lista-recientes');

  if (!pacs.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-sub">Sin pacientes aún</div></div>';
    return;
  }

  el.innerHTML = pacs.map(p => `
    <div class="patient-list-item" onclick="verDetalle('${p.codigo}')">
      <div class="pli-avatar">${p.nombres[0]}${p.apellidos[0]}</div>
      <div>
        <div class="pli-name">${p.nombres} ${p.apellidos}</div>
        <div class="pli-meta">${p.tipoDoc}: ${p.documento}</div>
      </div>
      <div class="pli-code">${p.codigo}</div>
    </div>`).join('');
}

// ─── Estadísticas ──────────────────────────────────────────

/**
 * Actualiza los contadores del bloque de stats.
 */
function updateStats() {
  const pacs = DB.get('pacientes');
  document.getElementById('st-total').textContent    = pacs.length;
  document.getElementById('st-adultos').textContent  = pacs.filter(p => p.edad >= 18).length;
  document.getElementById('st-menores').textContent  = pacs.filter(p => p.edad < 18).length;
  document.getElementById('st-alergias').textContent = pacs.filter(p =>
    p.alergias && p.alergias.length && p.alergias[0] !== 'Ninguna'
  ).length;
}

// ─── Modal detalle ─────────────────────────────────────────

/**
 * Abre el modal de ficha completa del paciente.
 * @param {string} codigo
 */
function verDetalle(codigo) {
  const p = DB.get('pacientes').find(x => x.codigo === codigo);
  if (!p) return;

  document.getElementById('det-titulo').textContent = `${p.nombres} ${p.apellidos}`;
  document.getElementById('det-codigo').textContent = `${p.codigo} — ${p.tipoDoc}: ${p.documento}`;

  const alNoNing = p.alergias && p.alergias.length && p.alergias[0] !== 'Ninguna';
  const alAlert  = alNoNing
    ? `<div class="allergy-alert" style="margin-bottom:1rem">⚠️ Alergias: ${p.alergias.join(', ')}</div>`
    : '';

  document.getElementById('det-contenido').innerHTML = `
    ${alAlert}
    <div class="patient-info-strip" style="margin-bottom:1.25rem">
      <div class="pi-avatar">${p.nombres[0]}${p.apellidos[0]}</div>
      <div class="pi-data">
        <div class="pi-name">${p.nombres} ${p.apellidos}</div>
        <div class="pi-meta">${p.edad} años • ${p.telefono} • ${p.email || 'Sin correo'}</div>
      </div>
    </div>
    <div class="detail-grid">
      <div class="detail-item"><label>Código</label><span>${p.codigo}</span></div>
      <div class="detail-item"><label>Documento</label><span>${p.tipoDoc}: ${p.documento}</span></div>
      <div class="detail-item"><label>Fecha de Nacimiento</label><span>${formatDate(p.nacimiento)}</span></div>
      <div class="detail-item"><label>Edad</label><span>${p.edad} años</span></div>
      <div class="detail-item"><label>Teléfono</label><span>${p.telefono}</span></div>
      <div class="detail-item"><label>Correo</label><span>${p.email || '—'}</span></div>
      <div class="detail-item" style="grid-column:1/-1"><label>Dirección</label><span>${p.direccion || '—'}</span></div>
      <div class="detail-item" style="grid-column:1/-1"><label>Alergias</label><span>${p.alergias?.join(', ') || 'Ninguna'}</span></div>
    </div>
    ${p.apoderado ? `
    <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--gray-200)">
      <div class="section-label" style="margin-bottom:.5rem">Apoderado</div>
      <div class="detail-grid">
        <div class="detail-item"><label>Nombre</label><span>${p.apoderado.nombre}</span></div>
        <div class="detail-item"><label>Parentesco</label><span>${p.apoderado.parentesco}</span></div>
      </div>
    </div>` : ''}
    <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--gray-200)">
      <div class="section-label" style="margin-bottom:.5rem">Contacto de Emergencia</div>
      <div class="detail-grid">
        <div class="detail-item"><label>Nombre</label><span>${p.emergencia.nombre}</span></div>
        <div class="detail-item"><label>Parentesco</label><span>${p.emergencia.parentesco}</span></div>
        <div class="detail-item"><label>Teléfono</label><span>${p.emergencia.telefono}</span></div>
      </div>
    </div>`;

  document.getElementById('det-btn-editar').onclick = () => {
    closeModal('modal-detalle');
    editarPaciente(codigo);
  };

  openModal('modal-detalle');
}

// ─── Editar paciente ───────────────────────────────────────

/**
 * Carga los datos del paciente en el formulario para edición.
 * @param {string} codigo
 */
function editarPaciente(codigo) {
  const p = DB.get('pacientes').find(x => x.codigo === codigo);
  if (!p) return;

  resetForm();
  modoEditar = true;
  document.getElementById('modal-pac-title').textContent       = 'Editar Paciente';
  document.getElementById('pac-codigo-edit').value             = p.codigo;
  document.getElementById('pac-codigo').value                  = p.codigo;
  document.getElementById('pac-nombres').value                 = p.nombres;
  document.getElementById('pac-apellidos').value               = p.apellidos;
  document.getElementById('pac-tipo-doc').value                = p.tipoDoc;
  document.getElementById('pac-doc').value                     = p.documento;
  document.getElementById('pac-nacimiento').value              = p.nacimiento;
  document.getElementById('pac-telefono').value                = p.telefono;
  document.getElementById('pac-email').value                   = p.email || '';
  document.getElementById('pac-direccion').value               = p.direccion || '';
  document.getElementById('pac-emerg-nombre').value            = p.emergencia?.nombre || '';
  document.getElementById('pac-emerg-parentesco').value        = p.emergencia?.parentesco || '';
  document.getElementById('pac-emerg-tel').value               = p.emergencia?.telefono || '';

  onNacimientoChange();

  if (p.apoderado) {
    document.getElementById('pac-apoderado').value            = p.apoderado.nombre || '';
    document.getElementById('pac-parentesco-apoderado').value = p.apoderado.parentesco || '';
  }

  // Restaurar checkboxes de alergias
  alergiasSeleccionadas = [...(p.alergias || [])];
  document.querySelectorAll('#check-alergias input[type="checkbox"]').forEach(cb => {
    const activo = alergiasSeleccionadas.some(a =>
      a === cb.value || (cb.value === 'Otro' && a.startsWith('Otro:'))
    );
    cb.checked = activo;
  });

  // Restaurar campo "Otro" si aplica
  const otroGuardado = alergiasSeleccionadas.find(a => a.startsWith('Otro:'));
  if (otroGuardado) {
    document.getElementById('bloque-otro-alergia').style.display = 'block';
    document.getElementById('pac-alergia-otro').value = otroGuardado.replace(/^Otro:\s?/, '').trim();
  } else {
    document.getElementById('bloque-otro-alergia').style.display = 'none';
  }

  actualizarResumenAlergias();
  openModal('modal-nuevo');
}

// ─── Eliminar paciente ─────────────────────────────────────

/**
 * Solicita confirmación y elimina el paciente de la BD local.
 * @param {string} codigo
 */
function eliminarPaciente(codigo) {
  if (!confirm('¿Eliminar este paciente del sistema? Esta acción no se puede deshacer.')) return;
  DB.set('pacientes', DB.get('pacientes').filter(p => p.codigo !== codigo));
  showToast('Paciente eliminado', 'warn');
  renderTable();
  renderRecientes();
  updateStats();
}
// Funciones usadas por botones inline y filas generadas dinamicamente.
Object.assign(window, {
  onAlergiaChange,
  onTipoDocChange,
  onNacimientoChange,
  guardarPaciente,
  resetForm,
  renderTable,
  verDetalle,
  editarPaciente,
  eliminarPaciente,
});