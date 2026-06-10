const PRIO_ORD = { Urgente: 0, Preferencial: 1, Normal: 2 };

document.addEventListener('DOMContentLoaded', () => {
  cargarMedicosSelect();
  renderSala();
  setInterval(renderSala, 30000); // auto-refresh cada 30s
});

function cargarMedicosSelect() {
  const citas   = DB.get('citas');
  const medicos = [...new Set(citas.map(c => c.medico).filter(Boolean))];
  const sel     = document.getElementById('f-medico');
  medicos.forEach(m => {
    const o = document.createElement('option');
    o.value = o.textContent = m;
    sel.appendChild(o);
  });
}

function renderSala() {
  const fMed = document.getElementById('f-medico').value;
  const fEsp = document.getElementById('f-especialidad').value;
  const fEst = document.getElementById('f-estado-sala').value;

  let citas = DB.get('citas').filter(c => {
    if (!['En espera', 'En atención', 'Atendida', 'No asistió'].includes(c.estado)) return false;
    if (c.estado === 'Cancelada') return false;
    if (fMed && c.medico !== fMed) return false;
    if (fEsp && c.especialidad !== fEsp) return false;
    if (fEst && c.estado !== fEst) return false;
    return true;
  });

  // Sort: urgente > preferencial > normal, luego hora llegada, luego hora cita
  citas.sort((a, b) => {
    const pA = PRIO_ORD[a.prioridad] ?? 2, pB = PRIO_ORD[b.prioridad] ?? 2;
    if (pA !== pB) return pA - pB;
    const lA = a.horaLlegada || '99:99', lB = b.horaLlegada || '99:99';
    if (lA !== lB) return lA.localeCompare(lB);
    return (a.hora || '').localeCompare(b.hora || '');
  });

  const lista = document.getElementById('sala-lista');
  const empty = document.getElementById('empty-sala');

  updateStats(citas);
  updateSidebar(citas);

  if (!citas.length) { lista.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  let turnoNum = 0;
  lista.innerHTML = citas.map((c, i) => {
    const pac     = getPaciente(c.paciente);
    const nombre  = pac ? `${pac.nombres} ${pac.apellidos}` : '(Paciente no encontrado)';
    const priClass = (c.prioridad || '').toLowerCase();
    const alNoNing = pac?.alergias?.length && pac.alergias[0] !== 'Ninguna';

    if (c.estado === 'En espera') turnoNum++;
    const numDisplay = c.estado === 'En atención' ? '🩺'
      : c.estado === 'Atendida'   ? '✓'
      : c.estado === 'No asistió' ? '✗'
      : turnoNum;

    let acciones = '';
    if (c.estado === 'En espera') {
      acciones = `
        <button class="btn btn-success btn-sm" onclick="pasarAtencion('${c.codigo}')">🩺 Atender</button>
        <button class="btn btn-danger btn-sm"  onclick="pedirNoAsistio('${c.codigo}')">✗ No asistió</button>`;
    }
    if (c.estado === 'En atención') {
      acciones = `<button class="btn btn-primary btn-sm" onclick="pedirAtendido('${c.codigo}')">✅ Finalizar</button>`;
    }
    if (c.estado === 'Atendida') {
      const hist = DB.get('historial').find(h => h.citaCodigo === c.codigo);
      acciones = hist
        ? `<span style="font-size:.7rem;color:var(--green);font-weight:600">📋 Historial registrado</span>`
        : `<a href="historial.html?cita=${c.codigo}" class="btn btn-outline btn-sm">📋 Registrar historial</a>`;
    }

    const estadoClass = c.estado === 'En atención' ? 'en-atencion' : c.estado === 'Atendida' ? 'atendido' : '';
    return `<div class="turno-card ${priClass} ${estadoClass}">
      <div class="turno-num ${priClass}">${numDisplay}</div>
      <div class="turno-body">
        <div class="turno-header">
          <span class="turno-nombre">${nombre}</span>
          <span class="badge badge-${c.estado === 'En espera' ? 'espera' : c.estado === 'En atención' ? 'atencion' : c.estado === 'Atendida' ? 'atendida' : c.estado === 'No asistió' ? 'noasistio' : c.estado.toLowerCase()}">${c.estado}</span>
          <span class="badge badge-${priClass}">${c.prioridad}</span>
        </div>
        <div class="turno-meta">
          <span>👨‍⚕️ ${c.medico}</span>
          <span>🏥 ${c.especialidad}</span>
          <span>🕐 Cita: ${c.hora}</span>
          ${pac ? `<span>🎂 ${pac.edad} años</span>` : ''}
        </div>
        <div class="turno-motivo">${c.motivo}</div>
        ${alNoNing ? `<div class="turno-allergy">⚠️ Alergias: ${pac.alergias.join(', ')}</div>` : ''}
        ${c.prioridad === 'Urgente' && c.justificacion ? `<div class="turno-justif">🚨 Urgencia: ${c.justificacion}</div>` : ''}
        <div class="turno-tiempos">
          <span class="turno-tiempo-chip">📅 ${formatDate(c.fecha)}</span>
          ${c.horaLlegada       ? `<span class="turno-tiempo-chip llegada">🚶 Llegó: ${c.horaLlegada}</span>` : ''}
          ${c.horaInicioAtencion? `<span class="turno-tiempo-chip atencion">🩺 Atención: ${c.horaInicioAtencion}</span>` : ''}
        </div>
      </div>
      <div class="turno-acciones">${acciones}</div>
    </div>`;
  }).join('');
}

function updateStats(citas) {
  document.getElementById('st-urgentes').textContent     = citas.filter(c => c.prioridad === 'Urgente'      && c.estado === 'En espera').length;
  document.getElementById('st-preferencial').textContent = citas.filter(c => c.prioridad === 'Preferencial' && c.estado === 'En espera').length;
  document.getElementById('st-espera').textContent       = citas.filter(c => c.estado === 'En espera').length;
  document.getElementById('st-atencion').textContent     = citas.filter(c => c.estado === 'En atención').length;
  document.getElementById('st-atendidos').textContent    = citas.filter(c => c.estado === 'Atendida').length;
}

function updateSidebar(citas) {
  // Ticker
  const enAtencion = citas.find(c => c.estado === 'En atención');
  if (enAtencion) {
    const pac = getPaciente(enAtencion.paciente);
    document.getElementById('ticker-num').textContent = enAtencion.codigo;
    document.getElementById('ticker-pac').textContent = pac ? `${pac.nombres} ${pac.apellidos}` : '—';
    document.getElementById('ticker-esp').textContent = `${enAtencion.especialidad} · ${enAtencion.medico}`;
  } else {
    document.getElementById('ticker-num').textContent = '—';
    document.getElementById('ticker-pac').textContent = 'Ninguno';
    document.getElementById('ticker-esp').textContent = '—';
  }

  // Resumen
  const total    = citas.length;
  const espera   = citas.filter(c => c.estado === 'En espera').length;
  const atencion = citas.filter(c => c.estado === 'En atención').length;
  const atend    = citas.filter(c => c.estado === 'Atendida').length;
  const noAsist  = citas.filter(c => c.estado === 'No asistió').length;
  document.getElementById('resumen-dia').innerHTML = `
    <div class="resumen-item"><span class="resumen-label">Total en sala</span><span class="resumen-val">${total}</span></div>
    <div class="resumen-item"><span class="resumen-label">En espera</span><span class="resumen-val" style="color:var(--teal)">${espera}</span></div>
    <div class="resumen-item"><span class="resumen-label">En atención</span><span class="resumen-val" style="color:var(--orange)">${atencion}</span></div>
    <div class="resumen-item"><span class="resumen-label">Atendidos</span><span class="resumen-val" style="color:var(--green)">${atend}</span></div>
    <div class="resumen-item"><span class="resumen-label">No asistió</span><span class="resumen-val" style="color:var(--gray-400)">${noAsist}</span></div>`;

  // Próximos
  const proximos = citas.filter(c => c.estado === 'En espera').slice(0, 3);
  const pEl      = document.getElementById('proximos-lista');
  if (!proximos.length) {
    pEl.innerHTML = '<div style="font-size:.75rem;color:var(--gray-400);padding:.5rem 0">Sin pacientes en espera</div>';
    return;
  }
  pEl.innerHTML = proximos.map((c, i) => {
    const pac    = getPaciente(c.paciente);
    const nombre = pac ? `${pac.nombres} ${pac.apellidos}` : '—';
    const priColor = c.prioridad === 'Urgente' ? 'var(--red)' : c.prioridad === 'Preferencial' ? 'var(--orange)' : 'var(--blue)';
    return `<div style="display:flex;align-items:center;gap:.65rem;padding:.65rem 0;border-bottom:1px solid var(--gray-100)">
      <div style="width:28px;height:28px;border-radius:50%;background:${priColor};color:white;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;flex-shrink:0">${i + 1}</div>
      <div>
        <div style="font-size:.8rem;font-weight:600;color:var(--gray-900)">${nombre}</div>
        <div style="font-size:.68rem;color:var(--gray-400)">${c.especialidad} · ${c.hora}</div>
      </div>
    </div>`;
  }).join('');
}

function pasarAtencion(codigo) {
  const citas = DB.get('citas');
  const c     = citas.find(x => x.codigo === codigo);
  if (!c) { showToast('Cita no encontrada', 'error'); return; }
  if (c.estado !== 'En espera') { showToast('Solo se puede atender pacientes en espera', 'error'); return; }
  const yaEnAtencion = citas.find(x => x.codigo !== codigo && x.medico === c.medico && x.estado === 'En atención');
  if (yaEnAtencion) { showToast(`El médico ${c.medico} ya tiene un paciente en atención`, 'warn'); return; }
  c.estado = 'En atención';
  c.horaInicioAtencion = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  DB.set('citas', citas);
  showToast('Paciente en atención', 'success');
  renderSala();
}

function pedirNoAsistio(codigo) {
  document.getElementById('noasistio-codigo').value = codigo;
  openModal('modal-noasistio');
}

function confirmarNoAsistio() {
  const codigo = document.getElementById('noasistio-codigo').value;
  const citas  = DB.get('citas');
  const c      = citas.find(x => x.codigo === codigo);
  if (c) c.estado = 'No asistió';
  DB.set('citas', citas);
  closeModal('modal-noasistio');
  showToast('Marcado como No asistió', 'warn');
  renderSala();
}

function pedirAtendido(codigo) {
  document.getElementById('atendido-codigo').value = codigo;
  document.getElementById('btn-ir-historial').style.display = 'none';
  openModal('modal-a-historial');
}

function confirmarAtendido() {
  const codigo = document.getElementById('atendido-codigo').value;
  const citas  = DB.get('citas');
  const c      = citas.find(x => x.codigo === codigo);
  if (!c) { showToast('Cita no encontrada', 'error'); return; }
  if (c.estado !== 'En atención') { showToast('Solo se puede finalizar pacientes en atención', 'error'); return; }
  c.estado  = 'Atendida';
  c.horaFin = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  DB.set('citas', citas);
  const btnH     = document.getElementById('btn-ir-historial');
  btnH.href      = `historial.html?cita=${codigo}`;
  btnH.style.display = 'inline-flex';
  showToast('Consulta finalizada. Registra el historial clínico.', 'success');
  renderSala();
}