'use strict';

// ── State ────────────────────────────────────────────────────────────────────

const state = {
  emotions: [],       // { id, emotion, effects[], color, parts[] }
  selectedParts: new Set(),
  nextId: 1,
  colorIndex: 0,
  editingId: null,
};

const COLOR_PALETTE = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308',
  '#84CC16', '#10B981', '#06B6D4', '#3B82F6',
  '#8B5CF6', '#EC4899', '#F43F5E', '#14B8A6',
];

// ── Init ─────────────────────────────────────────────────────────────────────

function init() {
  loadFromStorage();

  document.querySelectorAll('.body-part').forEach(el => {
    el.addEventListener('click', onPartClick);
    el.addEventListener('mouseenter', onPartMouseEnter);
    el.addEventListener('mouseleave', onPartMouseLeave);
  });

  byId('add-emotion-btn').addEventListener('click', openAddModal);
  byId('clear-selection-btn').addEventListener('click', clearSelection);

  byId('modal-close').addEventListener('click', closeAddModal);
  byId('cancel-btn').addEventListener('click', closeAddModal);
  byId('save-btn').addEventListener('click', saveEmotion);
  byId('add-bullet-btn').addEventListener('click', () => addBulletRow());

  byId('view-modal-close').addEventListener('click', closeViewModal);
  byId('view-add-btn').addEventListener('click', onViewAddClick);

  byId('modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeAddModal();
  });
  byId('view-modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeViewModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeAddModal(); closeViewModal(); }
  });

  initColorPicker();
  renderBodyColors();
  renderEmotionsList();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function byId(id) { return document.getElementById(id); }

function getEmotionsForPart(partId) {
  return state.emotions.filter(em => em.parts.includes(partId));
}

function getPartLabel(partId) {
  const el = document.querySelector(`[data-part="${partId}"]`);
  return el ? el.dataset.label : partId;
}

function darken(hex, factor = 0.65) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)})`;
}

// ── Body-part interactions ────────────────────────────────────────────────────

function onPartClick(e) {
  const el = e.currentTarget;
  const partId = el.dataset.part;

  // When nothing is selected and part already has emotions → show view modal
  if (state.selectedParts.size === 0) {
    const partEmotions = getEmotionsForPart(partId);
    if (partEmotions.length > 0) {
      openViewModal(partId, el.dataset.label, partEmotions);
      return;
    }
  }

  // Toggle selection
  if (state.selectedParts.has(partId)) {
    state.selectedParts.delete(partId);
    el.classList.remove('selected');
  } else {
    state.selectedParts.add(partId);
    el.classList.add('selected');
  }

  updateControls();
}

function onPartMouseEnter(e) {
  const el = e.currentTarget;
  const partId = el.dataset.part;
  const emotions = getEmotionsForPart(partId);

  let text = el.dataset.label;
  if (emotions.length > 0) {
    text += '\n' + emotions.map(em => em.emotion).join(', ');
  }

  const tip = byId('tooltip');
  tip.textContent = text;
  tip.classList.remove('hidden');
  document.addEventListener('mousemove', moveTooltip);
}

function onPartMouseLeave() {
  byId('tooltip').classList.add('hidden');
  document.removeEventListener('mousemove', moveTooltip);
}

function moveTooltip(e) {
  const tip = byId('tooltip');
  tip.style.left = (e.clientX + 14) + 'px';
  tip.style.top  = (e.clientY - 8)  + 'px';
}

function clearSelection() {
  state.selectedParts.forEach(id => {
    const el = document.querySelector(`[data-part="${id}"]`);
    if (el) el.classList.remove('selected');
  });
  state.selectedParts.clear();
  updateControls();
}

function updateControls() {
  const has = state.selectedParts.size > 0;
  byId('add-emotion-btn').disabled = !has;
  byId('add-emotion-btn').textContent =
    has ? `Gefühl hinzufügen (${state.selectedParts.size})` : 'Gefühl hinzufügen';
  byId('clear-selection-btn').classList.toggle('hidden', !has);
}

// ── Add / Edit Modal ──────────────────────────────────────────────────────────

function openAddModal(prefillPartId = null) {
  state.editingId = null;

  if (prefillPartId && !state.selectedParts.has(prefillPartId)) {
    state.selectedParts.add(prefillPartId);
    const el = document.querySelector(`[data-part="${prefillPartId}"]`);
    if (el) el.classList.add('selected');
    updateControls();
  }

  renderSelectedPartsTags();
  byId('modal-title').textContent = 'Gefühl hinzufügen';
  byId('emotion-input').value = '';
  byId('emotion-input').classList.remove('error');
  byId('bullets-container').innerHTML = '';
  addBulletRow();
  selectColor(COLOR_PALETTE[state.colorIndex % COLOR_PALETTE.length]);

  byId('modal-overlay').classList.remove('hidden');
  byId('emotion-input').focus();
}

function openEditModal(id) {
  const em = state.emotions.find(e => e.id === id);
  if (!em) return;

  state.editingId = id;

  clearSelection();
  em.parts.forEach(pid => {
    state.selectedParts.add(pid);
    const el = document.querySelector(`[data-part="${pid}"]`);
    if (el) el.classList.add('selected');
  });
  updateControls();

  renderSelectedPartsTags();
  byId('modal-title').textContent = 'Gefühl bearbeiten';
  byId('emotion-input').value = em.emotion;
  byId('emotion-input').classList.remove('error');
  byId('bullets-container').innerHTML = '';

  if (em.effects.length === 0) {
    addBulletRow();
  } else {
    em.effects.forEach(v => addBulletRow(v));
  }

  selectColor(em.color);
  byId('modal-overlay').classList.remove('hidden');
  byId('emotion-input').focus();
}

function closeAddModal() {
  byId('modal-overlay').classList.add('hidden');
}

function renderSelectedPartsTags() {
  const container = byId('selected-parts-tags');
  container.innerHTML = '';
  state.selectedParts.forEach(pid => {
    const tag = document.createElement('span');
    tag.className = 'selected-tag';
    tag.textContent = getPartLabel(pid);
    container.appendChild(tag);
  });
}

function saveEmotion() {
  const emotionVal = byId('emotion-input').value.trim();
  if (!emotionVal) {
    byId('emotion-input').classList.add('error');
    byId('emotion-input').focus();
    return;
  }
  byId('emotion-input').classList.remove('error');

  const effects = Array.from(document.querySelectorAll('.bullet-input'))
    .map(i => i.value.trim())
    .filter(Boolean);

  const color = document.querySelector('.color-swatch.active')?.dataset.color
    || COLOR_PALETTE[state.colorIndex % COLOR_PALETTE.length];

  if (state.editingId !== null) {
    const idx = state.emotions.findIndex(e => e.id === state.editingId);
    if (idx !== -1) {
      state.emotions[idx] = {
        ...state.emotions[idx],
        emotion: emotionVal,
        effects,
        color,
        parts: [...state.selectedParts],
      };
    }
  } else {
    state.emotions.push({
      id: state.nextId++,
      emotion: emotionVal,
      effects,
      color,
      parts: [...state.selectedParts],
    });
    state.colorIndex++;
  }

  saveToStorage();
  closeAddModal();
  clearSelection();
  renderBodyColors();
  renderEmotionsList();
}

// ── View Modal ────────────────────────────────────────────────────────────────

let _viewPartId = null;

function openViewModal(partId, partLabel, emotions) {
  _viewPartId = partId;
  byId('view-modal-title').textContent = partLabel;

  const content = byId('view-modal-content');
  content.innerHTML = '';

  emotions.forEach(em => {
    const entry = document.createElement('div');
    entry.className = 'view-emotion-entry';
    entry.style.borderLeftColor = em.color;

    const name = document.createElement('div');
    name.className = 'view-emotion-name';
    name.textContent = em.emotion;
    entry.appendChild(name);

    if (em.effects.length > 0) {
      const ul = document.createElement('ul');
      ul.className = 'view-emotion-effects';
      em.effects.forEach(fx => {
        const li = document.createElement('li');
        li.textContent = fx;
        ul.appendChild(li);
      });
      entry.appendChild(ul);
    }

    const actions = document.createElement('div');
    actions.className = 'view-emotion-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-icon';
    editBtn.textContent = '✏ Bearbeiten';
    editBtn.addEventListener('click', () => {
      closeViewModal();
      openEditModal(em.id);
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-icon danger';
    delBtn.textContent = '✕ Löschen';
    delBtn.addEventListener('click', () => {
      deleteEmotion(em.id);
      // Refresh or close if no more emotions for this part
      const remaining = getEmotionsForPart(partId);
      if (remaining.length === 0) {
        closeViewModal();
      } else {
        openViewModal(partId, partLabel, remaining);
      }
    });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    entry.appendChild(actions);
    content.appendChild(entry);
  });

  byId('view-modal-overlay').classList.remove('hidden');
}

function closeViewModal() {
  byId('view-modal-overlay').classList.add('hidden');
  _viewPartId = null;
}

function onViewAddClick() {
  const pid = _viewPartId;
  closeViewModal();
  clearSelection();
  openAddModal(pid);
}

// ── Delete ────────────────────────────────────────────────────────────────────

function deleteEmotion(id) {
  state.emotions = state.emotions.filter(e => e.id !== id);
  saveToStorage();
  renderBodyColors();
  renderEmotionsList();
}

// ── Bullet rows ───────────────────────────────────────────────────────────────

function addBulletRow(value = '') {
  const row = document.createElement('div');
  row.className = 'bullet-row';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'bullet-input';
  input.placeholder = 'z.B. Herzklopfen, Zittern, Enge …';
  input.value = value;
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addBulletRow(); }
  });

  const rm = document.createElement('button');
  rm.type = 'button';
  rm.className = 'bullet-remove';
  rm.textContent = '✕';
  rm.addEventListener('click', () => row.remove());

  row.appendChild(input);
  row.appendChild(rm);
  byId('bullets-container').appendChild(row);
  input.focus();
}

// ── Color picker ──────────────────────────────────────────────────────────────

function initColorPicker() {
  const picker = byId('color-picker');
  COLOR_PALETTE.forEach(color => {
    const sw = document.createElement('div');
    sw.className = 'color-swatch';
    sw.style.backgroundColor = color;
    sw.dataset.color = color;
    sw.tabIndex = 0;
    sw.title = color;
    sw.addEventListener('click', () => selectColor(color));
    sw.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') selectColor(color);
    });
    picker.appendChild(sw);
  });
  selectColor(COLOR_PALETTE[0]);
}

function selectColor(color) {
  document.querySelectorAll('.color-swatch').forEach(sw =>
    sw.classList.toggle('active', sw.dataset.color === color)
  );
}

// ── Render body colors & badges ───────────────────────────────────────────────

function renderBodyColors() {
  // Remove old badges
  document.querySelectorAll('.badge-group').forEach(g => g.remove());

  const svg = byId('body-svg');

  document.querySelectorAll('.body-part').forEach(el => {
    const partId = el.dataset.part;
    const emotions = getEmotionsForPart(partId);

    if (emotions.length === 0) {
      el.style.fill   = '';
      el.style.stroke = '';
    } else {
      // Stripe pattern for multiple emotions — show colors as thin stripes
      if (emotions.length === 1) {
        el.style.fill   = emotions[0].color;
        el.style.stroke = darken(emotions[0].color);
      } else {
        // Use the first color as fill; add a count badge
        el.style.fill   = emotions[0].color;
        el.style.stroke = darken(emotions[0].color);

        // Badge
        const bbox = el.getBBox();
        const cx = bbox.x + bbox.width  / 2;
        const cy = bbox.y + bbox.height / 2;

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.classList.add('badge-group');
        g.style.pointerEvents = 'none';

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', cx);
        circle.setAttribute('cy', cy);
        circle.setAttribute('r', '9');
        circle.setAttribute('fill', '#1e293b');

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', cx);
        text.setAttribute('y', cy + 3.5);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '9');
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('fill', '#fff');
        text.setAttribute('font-family', 'sans-serif');
        text.textContent = emotions.length;

        g.appendChild(circle);
        g.appendChild(text);
        svg.appendChild(g);
      }
    }
  });
}

// ── Emotions list (sidebar) ───────────────────────────────────────────────────

function renderEmotionsList() {
  const list  = byId('emotions-list');
  const count = byId('emotions-count');
  count.textContent = state.emotions.length;

  if (state.emotions.length === 0) {
    list.innerHTML = '<p class="empty-state">Noch keine Gefühle eingetragen.<br>Wähle Körperteile aus und füge Gefühle hinzu.</p>';
    return;
  }

  list.innerHTML = '';

  state.emotions.forEach(em => {
    const card = document.createElement('div');
    card.className = 'emotion-card';
    card.style.borderLeftColor = em.color;

    // Header
    const header = document.createElement('div');
    header.className = 'emotion-card-header';

    const nameEl = document.createElement('div');
    nameEl.className = 'emotion-name';
    nameEl.textContent = em.emotion;

    const actions = document.createElement('div');
    actions.className = 'emotion-card-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-icon';
    editBtn.textContent = '✏';
    editBtn.title = 'Bearbeiten';
    editBtn.addEventListener('click', () => openEditModal(em.id));

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-icon danger';
    delBtn.textContent = '✕';
    delBtn.title = 'Löschen';
    delBtn.addEventListener('click', () => {
      if (confirm(`"${em.emotion}" wirklich löschen?`)) deleteEmotion(em.id);
    });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    header.appendChild(nameEl);
    header.appendChild(actions);
    card.appendChild(header);

    // Part tags
    const parts = document.createElement('div');
    parts.className = 'emotion-parts';
    em.parts.forEach(pid => {
      const tag = document.createElement('span');
      tag.className = 'part-tag';
      tag.textContent = getPartLabel(pid);
      parts.appendChild(tag);
    });
    card.appendChild(parts);

    // Effects
    if (em.effects.length > 0) {
      const ul = document.createElement('ul');
      ul.className = 'emotion-effects';
      em.effects.forEach(fx => {
        const li = document.createElement('li');
        li.textContent = fx;
        ul.appendChild(li);
      });
      card.appendChild(ul);
    }

    list.appendChild(card);
  });
}

// ── Persistence ───────────────────────────────────────────────────────────────

function saveToStorage() {
  try {
    localStorage.setItem('feeling-body-chart', JSON.stringify({
      emotions: state.emotions,
      nextId: state.nextId,
      colorIndex: state.colorIndex,
    }));
  } catch (_) {}
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem('feeling-body-chart');
    if (!raw) return;
    const data = JSON.parse(raw);
    state.emotions    = data.emotions    || [];
    state.nextId      = data.nextId      || 1;
    state.colorIndex  = data.colorIndex  || 0;
  } catch (_) {}
}

// ── Start ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);
