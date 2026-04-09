/**
 * FitTrack — Page Musculation
 * ============================
 * Gère 4 onglets :
 *   1. Aujourd'hui  — séances planifiées du jour
 *   2. Planning     — vue 14 jours (passé proche + futur)
 *   3. Séances      — gestion des modèles de séance
 *   4. Exercices    — bibliothèque d'exercices
 */

const JOURS_FR   = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MOIS_SHORT = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'août', 'sep', 'oct', 'nov', 'déc'];

// ── Filtres exercices ──
let currentSearch     = '';
let currentGroupe     = '';
let currentSousGroupe = '';
let currentType       = '';
let currentMateriel   = '';

const SOUS_GROUPES = {
  'Pectoraux': ['haut', 'milieu', 'bas'],
  'Dos':       ['largeur', 'épaisseur'],
  'Jambes':    ['quadriceps', 'ischios', 'mollets'],
};

// ── État modal planification ──
let planModalTemplateId = null;
let planModalDate       = null;

document.addEventListener('DOMContentLoaded', () => {
  DB.init();

  renderTodayPanel();
  renderPlanningPanel();
  renderModelesPanel();
  renderExerciseList();
  bindForms();
  updateHeaderDate();
});

/* ═══════════════════════════════════════════════════════════════
   ONGLET 1 — AUJOURD'HUI
═══════════════════════════════════════════════════════════════ */

function renderTodayPanel() {
  const emptyEl = document.getElementById('today-empty');
  const listEl  = document.getElementById('today-sessions-list');
  if (!listEl) return;

  const today   = localDateStr();
  const planned = DB.getTodayPlanned();

  if (planned.length === 0) {
    if (emptyEl) emptyEl.style.display = 'flex';
    listEl.style.display = 'none';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';
  listEl.style.display = 'block';

  listEl.innerHTML = planned.map(p => {
    const tpl = DB.getTemplate(p.templateId);
    if (!tpl) return '';

    const exoCount = tpl.exercices.length;
    const isDone   = p.completed;

    const exercisesHtml = tpl.exercices.slice(0, 5).map(block => {
      const exo = DB.getExercice(block.exoId);
      if (!exo) return '';
      return `
        <div class="today-exercise-row">
          <span class="today-exercise-row__tag today-exercise-row__tag--${exo.couleur}">${exo.groupe}</span>
          <span class="today-exercise-row__name">${exo.nom}</span>
          <span class="today-exercise-row__info">${block.series}×${block.reps} · ${block.repos}</span>
        </div>`;
    }).join('');

    const moreCount = tpl.exercices.length - 5;
    const moreHtml  = moreCount > 0
      ? `<p class="today-more">+ ${moreCount} exercice${moreCount > 1 ? 's' : ''}</p>`
      : '';

    return `
      <div class="today-session-block${isDone ? ' today-session-block--done' : ''}">
        <div class="today-session-header">
          <div class="today-session-header__info">
            <span class="today-session-header__label">${isDone ? 'Terminée ✓' : 'Séance du jour'}</span>
            <h2 class="today-session-header__name">${tpl.nom}</h2>
          </div>
          <span class="today-exercise-count panel-header__badge">${exoCount} exercice${exoCount !== 1 ? 's' : ''}</span>
        </div>
        <div class="today-exercise-list">${exercisesHtml}${moreHtml}</div>
        ${!isDone && exoCount > 0 ? `
        <button class="btn-start-session" data-planned-id="${p.id}" type="button">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          Commencer la séance
        </button>` : ''}
      </div>`;
  }).join('');

  // Bouton "Ajouter une séance à aujourd'hui"
  listEl.innerHTML += `
    <button class="btn-add-today" id="btn-add-today" type="button">
      ＋ Ajouter une séance aujourd'hui
    </button>`;

  // Boutons "Commencer"
  listEl.querySelectorAll('.btn-start-session').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.href = `seance.html?id=${btn.dataset.plannedId}`;
    });
  });

  // Bouton "Ajouter"
  const addBtn = document.getElementById('btn-add-today');
  if (addBtn) addBtn.addEventListener('click', () => openPlanModal(today));
}

/* ═══════════════════════════════════════════════════════════════
   ONGLET 2 — PLANNING (14 jours)
═══════════════════════════════════════════════════════════════ */

function renderPlanningPanel() {
  const container = document.getElementById('planning-list');
  if (!container) return;

  // Aujourd'hui à minuit (heure locale)
  const todayMs  = new Date();
  todayMs.setHours(0, 0, 0, 0);
  const todayStr = localDateStr();

  // 3 jours passés + aujourd'hui + 10 jours futurs = 14 jours
  const days = [];
  for (let i = -3; i <= 10; i++) {
    const d = new Date(todayMs);
    d.setDate(todayMs.getDate() + i);
    days.push(d);
  }

  const startStr = localDateStr(days[0]);
  const endStr   = localDateStr(days[days.length - 1]);
  const allPlanned = DB.getPlannedForRange(startStr, endStr);

  container.innerHTML = days.map(d => {
    const dateStr  = localDateStr(d);
    const isToday  = dateStr === todayStr;
    const isPast   = dateStr < todayStr;
    const jsDay    = d.getDay();            // 0=Dim, 1=Lun…
    const frDay    = jsDay === 0 ? 6 : jsDay - 1;
    const dayLabel = isToday ? "Aujourd'hui" : JOURS_FR[frDay];
    const dayNum   = d.getDate();
    const monthLbl = MOIS_SHORT[d.getMonth()];

    const dayPlanned = allPlanned.filter(p => p.date === dateStr);

    const sessionsHtml = dayPlanned.map(p => {
      const tpl = DB.getTemplate(p.templateId);
      if (!tpl) return '';
      const exoCount = tpl.exercices.length;
      const chipsHtml = tpl.exercices.slice(0, 3).map(b => {
        const exo = DB.getExercice(b.exoId);
        return exo
          ? `<span class="session-card__exo-chip session-card__exo-chip--${exo.couleur}">${exo.nom}</span>`
          : '';
      }).join('') + (tpl.exercices.length > 3
        ? `<span class="session-card__exo-more">+${tpl.exercices.length - 3}</span>`
        : '');

      return `
        <div class="planning-session${p.completed ? ' planning-session--done' : ''}">
          <div class="planning-session__top">
            <span class="planning-session__name">${tpl.nom}</span>
            <span class="planning-session__count">${exoCount} exo${exoCount > 1 ? 's' : ''}</span>
            ${p.completed ? '<span class="planning-session__badge">✓ Fait</span>' : ''}
          </div>
          ${chipsHtml ? `<div class="planning-session__chips">${chipsHtml}</div>` : ''}
          <div class="planning-session__actions">
            ${!p.completed && exoCount > 0 ? `
            <button class="planning-session__start" data-planned-id="${p.id}" type="button">▶ Démarrer</button>` : ''}
            ${!p.completed ? `
            <button class="planning-session__delete" data-delete-planned="${p.id}" type="button" aria-label="Supprimer">✕</button>` : ''}
          </div>
        </div>`;
    }).join('');

    return `
      <div class="planning-day${isToday ? ' planning-day--today' : ''}${isPast ? ' planning-day--past' : ''}">
        <div class="planning-day__header">
          <div class="planning-day__label">
            <span class="planning-day__weekday">${dayLabel}</span>
            <span class="planning-day__num">${dayNum} ${monthLbl}</span>
          </div>
          ${!isPast ? `
          <button class="planning-day__add" data-date="${dateStr}" aria-label="Planifier une séance">＋</button>` : ''}
        </div>
        ${sessionsHtml ? `<div class="planning-day__sessions">${sessionsHtml}</div>` : ''}
      </div>`;
  }).join('');

  // Boutons "Démarrer"
  container.querySelectorAll('.planning-session__start').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.href = `seance.html?id=${btn.dataset.plannedId}`;
    });
  });

  // Boutons "Supprimer instance"
  container.querySelectorAll('[data-delete-planned]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (confirm('Supprimer cette séance du planning ?')) {
        DB.deletePlanned(btn.dataset.deletePlanned);
        renderPlanningPanel();
        renderTodayPanel();
      }
    });
  });

  // Boutons "+" par jour
  container.querySelectorAll('.planning-day__add').forEach(btn => {
    btn.addEventListener('click', () => openPlanModal(btn.dataset.date));
  });
}

/* ═══════════════════════════════════════════════════════════════
   ONGLET 3 — SÉANCES (MODÈLES)
═══════════════════════════════════════════════════════════════ */

function renderModelesPanel() {
  const listEl   = document.getElementById('modeles-list');
  const recentEl = document.getElementById('modeles-recent');
  if (!listEl) return;

  const templates = DB.getAllTemplates();
  const recent    = DB.getRecentTemplates(3);

  // Section "Récemment utilisées"
  if (recentEl) {
    if (recent.length > 0) {
      recentEl.style.display = 'block';
      recentEl.innerHTML = `
        <p class="modeles-section-title">Récemment utilisées</p>
        ${recent.map(({ template: tpl, completedAt }) => {
          const when  = new Date(completedAt);
          const label = when.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
          return renderTemplateCard(tpl, label);
        }).join('')}`;
      bindTemplateCardActions(recentEl);
    } else {
      recentEl.style.display = 'none';
    }
  }

  // Section "Mes modèles"
  if (templates.length === 0) {
    listEl.innerHTML = `
      <div class="sessions-empty">
        <p>Aucun modèle de séance.</p>
        <p>Crée ton premier modèle pour commencer.</p>
      </div>`;
  } else {
    listEl.innerHTML = `
      <p class="modeles-section-title">Mes modèles</p>
      ${templates.map(tpl => renderTemplateCard(tpl)).join('')}`;
    bindTemplateCardActions(listEl);
  }
}

function renderTemplateCard(tpl, recentLabel = null) {
  const exoCount = tpl.exercices.length;
  const chipsHtml = tpl.exercices.slice(0, 4).map(b => {
    const exo = DB.getExercice(b.exoId);
    return exo
      ? `<span class="session-card__exo-chip session-card__exo-chip--${exo.couleur}">${exo.nom}</span>`
      : '';
  }).join('') + (tpl.exercices.length > 4
    ? `<span class="session-card__exo-more">+${tpl.exercices.length - 4}</span>`
    : '');

  return `
    <div class="template-card" data-template-id="${tpl.id}">
      <div class="template-card__header">
        <span class="template-card__name">${tpl.nom}</span>
        <button class="template-card__delete" data-delete-template="${tpl.id}"
                aria-label="Supprimer ${tpl.nom}" title="Supprimer">✕</button>
      </div>
      ${recentLabel ? `<div class="template-card__recent">${recentLabel}</div>` : ''}
      <div class="template-card__meta">
        <span class="template-card__count">${exoCount} exercice${exoCount !== 1 ? 's' : ''}</span>
      </div>
      ${chipsHtml ? `<div class="template-card__exercises">${chipsHtml}</div>` : ''}
      <div class="template-card__actions">
        <button class="template-card__plan" data-plan-template="${tpl.id}" type="button">
          📅 Planifier
        </button>
        ${exoCount > 0 ? `
        <button class="template-card__start" data-start-template="${tpl.id}" type="button">
          ▶ Démarrer
        </button>` : ''}
      </div>
    </div>`;
}

function bindTemplateCardActions(container) {
  if (!container) return;

  container.querySelectorAll('[data-delete-template]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id  = btn.dataset.deleteTemplate;
      const tpl = DB.getTemplate(id);
      if (tpl && confirm(`Supprimer le modèle "${tpl.nom}" ?\nLes séances futures planifiées avec ce modèle seront également supprimées.`)) {
        DB.deleteTemplate(id);
        renderModelesPanel();
        renderTodayPanel();
        renderPlanningPanel();
      }
    });
  });

  container.querySelectorAll('[data-plan-template]').forEach(btn => {
    btn.addEventListener('click', () => {
      const today = localDateStr();
      openPlanModal(today, btn.dataset.planTemplate);
    });
  });

  container.querySelectorAll('[data-start-template]').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.href = `seance.html?id=${btn.dataset.startTemplate}`;
    });
  });
}

/* ═══════════════════════════════════════════════════════════════
   ONGLET 4 — EXERCICES
═══════════════════════════════════════════════════════════════ */

function renderExerciseList() {
  const container = document.querySelector('.exercises-list');
  if (!container) return;

  container.innerHTML = '';

  const q         = currentSearch.trim().toLowerCase();
  const exercises = DB.getAllExercices().filter(exo => {
    const matchSearch     = !q || exo.nom.toLowerCase().includes(q) || exo.groupe.toLowerCase().includes(q);
    const matchGroupe     = !currentGroupe     || exo.groupe     === currentGroupe;
    const matchSousGroupe = !currentSousGroupe || exo.sousGroupe === currentSousGroupe;
    const matchType       = !currentType       || exo.type       === currentType;
    const matchMateriel   = !currentMateriel   || exo.materiel   === currentMateriel;
    return matchSearch && matchGroupe && matchSousGroupe && matchType && matchMateriel;
  });

  exercises.forEach(exo => {
    const rm   = calculerRMDepuisHistorique(exo);
    const card = document.createElement('a');
    card.href      = `exercice.html?id=${exo.id}`;
    card.className = 'exercise-card';
    card.innerHTML = `
      <div class="exercise-card__muscle-tag exercise-card__muscle-tag--${exo.couleur}">
        ${exo.groupe}
      </div>
      <div class="exercise-card__body">
        <h3 class="exercise-card__name">${exo.nom}</h3>
        <p  class="exercise-card__info">
          ${rm ? rm + ' kg max' : 'Pas encore de 1RM'}
        </p>
      </div>
      <button class="exercise-card__delete" data-delete-exo="${exo.id}"
              aria-label="Supprimer ${exo.nom}" title="Supprimer">✕</button>`;

    card.querySelector('[data-delete-exo]').addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      openDeleteConfirm(exo.id, exo.nom);
    });

    container.appendChild(card);
  });
}

/* ═══════════════════════════════════════════════════════════════
   MODAL — PLANIFIER UNE SÉANCE
═══════════════════════════════════════════════════════════════ */

function openPlanModal(dateStr, preselectedTemplateId = null) {
  const modal = document.getElementById('modal-plan-session');
  if (!modal) return;

  planModalDate       = dateStr;
  planModalTemplateId = preselectedTemplateId;

  // Affichage de la date
  const d           = new Date(dateStr + 'T12:00:00');
  const dateDisplay = document.getElementById('plan-date-display');
  const dateInput   = document.getElementById('plan-date-input');

  const updateDateDisplay = () => {
    if (!dateDisplay || !planModalDate) return;
    const nd = new Date(planModalDate + 'T12:00:00');
    dateDisplay.textContent = nd.toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
  };

  if (dateDisplay) updateDateDisplay();
  if (dateInput) {
    dateInput.value = dateStr;
    // Remplacer le listener précédent
    const newInput = dateInput.cloneNode(true);
    dateInput.parentNode.replaceChild(newInput, dateInput);
    newInput.addEventListener('change', () => {
      planModalDate = newInput.value;
      updateDateDisplay();
    });
  }

  // Liste des modèles
  const tplList   = document.getElementById('plan-template-list');
  const templates = DB.getAllTemplates();

  if (tplList) {
    if (templates.length === 0) {
      tplList.innerHTML = `
        <p class="sessions-empty">
          Aucun modèle disponible.<br>
          Créez d'abord un modèle dans l'onglet <strong>Séances</strong>.
        </p>`;
    } else {
      tplList.innerHTML = templates.map(tpl => {
        const isSelected = tpl.id === preselectedTemplateId;
        return `
          <div class="plan-template-item${isSelected ? ' plan-template-item--selected' : ''}"
               data-tpl-id="${tpl.id}">
            <span class="plan-template-item__name">${tpl.nom}</span>
            <span class="plan-template-item__count">${tpl.exercices.length} exo${tpl.exercices.length > 1 ? 's' : ''}</span>
          </div>`;
      }).join('');

      tplList.querySelectorAll('.plan-template-item').forEach(item => {
        item.addEventListener('click', () => {
          tplList.querySelectorAll('.plan-template-item').forEach(i => i.classList.remove('plan-template-item--selected'));
          item.classList.add('plan-template-item--selected');
          planModalTemplateId = item.dataset.tplId;
        });
      });
    }
  }

  modal.classList.add('plan-modal--open');

  // Bouton Confirmer
  const confirmBtn = document.getElementById('plan-confirm');
  if (confirmBtn) {
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
    newBtn.addEventListener('click', () => {
      if (!planModalTemplateId || !planModalDate) {
        alert('Sélectionne un modèle et une date.');
        return;
      }
      DB.addPlanned({ templateId: planModalTemplateId, date: planModalDate });
      closePlanModal();
      renderPlanningPanel();
      renderTodayPanel();
    });
  }

  // Bouton Annuler
  const cancelBtn = document.getElementById('plan-cancel');
  if (cancelBtn) {
    const newBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newBtn, cancelBtn);
    newBtn.addEventListener('click', closePlanModal);
  }

  // Overlay
  const overlay = modal.querySelector('.plan-modal__overlay');
  if (overlay) {
    const newOverlay = overlay.cloneNode(true);
    overlay.parentNode.replaceChild(newOverlay, overlay);
    newOverlay.addEventListener('click', closePlanModal);
  }
}

function closePlanModal() {
  const modal = document.getElementById('modal-plan-session');
  if (modal) modal.classList.remove('plan-modal--open');
  planModalTemplateId = null;
  planModalDate       = null;
}

/* ═══════════════════════════════════════════════════════════════
   FORMULAIRES
═══════════════════════════════════════════════════════════════ */

function bindForms() {
  bindAddTemplateForm();
  bindAddExerciseForm();
  bindExerciseSearch();
  bindFilterChips();
}

function bindExerciseSearch() {
  const input = document.getElementById('exercise-search');
  if (!input) return;
  input.addEventListener('input', () => {
    currentSearch = input.value;
    renderExerciseList();
  });
}

function bindFilterChips() {
  // Rangée 1 : groupes
  document.querySelectorAll('#chips-groupe .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#chips-groupe .chip').forEach(c => c.classList.remove('chip--active'));
      chip.classList.add('chip--active');
      currentGroupe     = chip.dataset.filterGroupe;
      currentSousGroupe = '';
      updateSousGroupeChips();
      renderExerciseList();
    });
  });

  // Rangée 3 : type
  document.querySelectorAll('[data-filter-type]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-filter-type]').forEach(c => c.classList.remove('chip--active'));
      chip.classList.add('chip--active');
      currentType = chip.dataset.filterType;
      renderExerciseList();
    });
  });

  // Rangée 3 : matériel
  document.querySelectorAll('[data-filter-materiel]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-filter-materiel]').forEach(c => c.classList.remove('chip--active'));
      chip.classList.add('chip--active');
      currentMateriel = chip.dataset.filterMateriel;
      renderExerciseList();
    });
  });
}

function updateSousGroupeChips() {
  const container  = document.getElementById('chips-sous-groupe');
  if (!container) return;

  const sousGroupes = SOUS_GROUPES[currentGroupe] || [];
  if (sousGroupes.length === 0) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  container.style.display = 'flex';
  container.innerHTML = `<span class="chip chip--sub chip--active" data-filter-sg="">Tous</span>` +
    sousGroupes.map(sg =>
      `<span class="chip chip--sub" data-filter-sg="${sg}">${sg.charAt(0).toUpperCase() + sg.slice(1)}</span>`
    ).join('');

  container.querySelectorAll('[data-filter-sg]').forEach(chip => {
    chip.addEventListener('click', () => {
      container.querySelectorAll('[data-filter-sg]').forEach(c => c.classList.remove('chip--active'));
      chip.classList.add('chip--active');
      currentSousGroupe = chip.dataset.filterSg;
      renderExerciseList();
    });
  });
}

/* ── Formule Epley (même logique qu'exercice.js) ── */
function calculerRMDepuisHistorique(exo) {
  if (exo.materiel === 'Poids du corps') return null;
  const entries = (exo.historique || []).filter(
    e => e.poids > 0 && typeof e.reps === 'number' && e.reps > 0
  );
  if (entries.length === 0) return null;
  const best = Math.max(...entries.map(e => e.poids * (1 + e.reps / 30)));
  return Math.round(best * 2) / 2;
}

/* ── Formulaire : créer un modèle de séance ── */
function bindAddTemplateForm() {
  const form = document.getElementById('add-template-form');
  if (!form) return;

  // Peupler le select d'exercices
  const exoSelect = document.getElementById('template-exo-select');
  if (exoSelect) {
    DB.getAllExercices().forEach(exo => {
      const opt       = document.createElement('option');
      opt.value       = exo.id;
      opt.textContent = `${exo.nom} (${exo.groupe})`;
      exoSelect.appendChild(opt);
    });
  }

  form.addEventListener('submit', e => {
    e.preventDefault();

    const nom = document.getElementById('template-nom').value.trim();
    if (!nom) return;

    const exercices = [...form.querySelectorAll('.session-exo-block')].map(block => ({
      exoId:  block.dataset.exoId,
      series: parseInt(block.querySelector('[data-field="series"]').value)  || 3,
      reps:   parseInt(block.querySelector('[data-field="reps"]').value)    || 10,
      repos:  block.querySelector('[data-field="repos"]').value              || '90 s',
      poids:  parseFloat(block.querySelector('[data-field="poids"]')?.value) || null,
    }));

    DB.addTemplate({ nom, exercices });

    const toggle = document.getElementById('show-add-template');
    if (toggle) toggle.checked = false;
    form.reset();
    document.getElementById('template-exo-blocks').innerHTML = '';

    renderModelesPanel();
  });

  // Bouton "Ajouter un exercice au modèle"
  const addExoBtn = document.getElementById('btn-add-exo-to-template');
  if (addExoBtn && exoSelect) {
    addExoBtn.addEventListener('click', () => {
      const exoId = exoSelect.value;
      if (!exoId) return;
      const exo = DB.getExercice(exoId);
      if (!exo) return;

      const container      = document.getElementById('template-exo-blocks');
      const isPoidsDuCorps = exo.materiel === 'Poids du corps';
      const rmEstime       = calculerRMDepuisHistorique(exo);
      const poidsConseille = (!isPoidsDuCorps && rmEstime)
        ? Math.round(rmEstime * 0.75 / 2.5) * 2.5
        : null;

      const poidsHTML = isPoidsDuCorps ? '' : `
        <label class="session-exo-block__poids-label">
          Poids (kg)
          ${poidsConseille ? `<span class="session-exo-block__poids-hint">conseillé : ${poidsConseille} kg</span>` : ''}
          <input type="number" data-field="poids"
                 value="${poidsConseille || ''}"
                 placeholder="${poidsConseille || '—'}" min="0" max="500" step="0.5">
        </label>`;

      const block = document.createElement('div');
      block.className     = 'session-exo-block';
      block.dataset.exoId = exoId;
      block.innerHTML = `
        <div class="session-exo-block__header">
          <span class="session-exo-block__name">${exo.nom}</span>
          <button type="button" class="session-exo-block__remove" aria-label="Retirer">✕</button>
        </div>
        <div class="session-exo-block__fields">
          <label>Séries
            <input type="number" data-field="series" value="3" min="1" max="20">
          </label>
          <label>Reps
            <input type="number" data-field="reps" value="10" min="1" max="100">
          </label>
          <label>Repos
            <input type="text" data-field="repos" value="90 s" placeholder="90 s">
          </label>
          ${poidsHTML}
        </div>`;

      block.querySelector('.session-exo-block__remove').addEventListener('click', () => block.remove());
      container.appendChild(block);
    });
  }
}

/* ── Formulaire : ajouter un exercice ── */
function bindAddExerciseForm() {
  const form         = document.getElementById('add-exercise-form');
  const groupeSelect = document.getElementById('new-exo-groupe');
  if (!form) return;

  groupeSelect.addEventListener('change', () => {
    const fieldSG     = document.getElementById('field-sous-groupe');
    const selectSG    = document.getElementById('new-exo-sous-groupe');
    const sousGroupes = SOUS_GROUPES[groupeSelect.value] || [];

    if (sousGroupes.length > 0) {
      selectSG.innerHTML = '<option value="">Indifférent</option>' +
        sousGroupes.map(sg =>
          `<option value="${sg}">${sg.charAt(0).toUpperCase() + sg.slice(1)}</option>`
        ).join('');
      fieldSG.style.display = 'block';
    } else {
      fieldSG.style.display = 'none';
      selectSG.innerHTML    = '';
    }
  });

  form.addEventListener('submit', e => {
    e.preventDefault();

    const nomInput   = document.getElementById('new-exo-nom');
    const nom        = nomInput.value.trim();
    const groupe     = groupeSelect.value;
    const couleur    = groupeSelect.selectedOptions[0]?.dataset.couleur || 'autre';
    const sousGroupe = document.getElementById('new-exo-sous-groupe')?.value || '';
    const type       = form.querySelector('[name="new-exo-type"]:checked')?.value     || '';
    const materiel   = form.querySelector('[name="new-exo-materiel"]:checked')?.value || '';

    if (!nom || !groupe) return;

    const result = DB.addExercice({ nom, groupe, couleur, sousGroupe, type, materiel });
    if (!result) {
      nomInput.setCustomValidity('Un exercice avec ce nom existe déjà.');
      nomInput.reportValidity();
      return;
    }
    nomInput.setCustomValidity('');

    const toggle = document.getElementById('show-add-exercise');
    if (toggle) toggle.checked = false;
    form.reset();
    document.getElementById('field-sous-groupe').style.display = 'none';
    renderExerciseList();
  });
}

/* ═══════════════════════════════════════════════════════════════
   UTILITAIRES
═══════════════════════════════════════════════════════════════ */

function openDeleteConfirm(exoId, exoNom) {
  const modal    = document.getElementById('modal-delete-exo');
  const nameEl   = document.getElementById('confirm-exo-name');
  const btnDel   = document.getElementById('confirm-delete');
  const btnCancel = document.getElementById('confirm-cancel');
  const overlay  = document.getElementById('confirm-overlay');

  nameEl.textContent = exoNom;
  modal.classList.add('confirm-modal--open');

  const close = () => modal.classList.remove('confirm-modal--open');

  const onDelete = () => { DB.deleteExercice(exoId); renderExerciseList(); close(); cleanup(); };
  const onCancel = () => { close(); cleanup(); };
  const cleanup  = () => {
    btnDel.removeEventListener('click', onDelete);
    btnCancel.removeEventListener('click', onCancel);
    overlay.removeEventListener('click', onCancel);
  };

  btnDel.addEventListener('click', onDelete);
  btnCancel.addEventListener('click', onCancel);
  overlay.addEventListener('click', onCancel);
}

function updateHeaderDate() {
  const el = document.querySelector('.page-header__subtitle');
  if (!el) return;
  el.textContent = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}
