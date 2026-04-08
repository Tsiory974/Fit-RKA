/**
 * FitTrack — Page Musculation
 * ============================
 * Gère les 3 onglets :
 *   1. Séance du jour  — lecture seule, bouton "Commencer"
 *   2. Séances         — liste + création/suppression de séances
 *   3. Exercices       — liste + ajout d'exercice
 */

const JOURS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const JOURS_LONG = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

// État partagé des filtres exercices
let currentSearch    = '';
let currentGroupe    = '';
let currentSousGroupe = '';
let currentType      = '';
let currentMateriel  = '';

// Table des sous-groupes par groupe musculaire
const SOUS_GROUPES = {
  'Pectoraux': ['haut', 'milieu', 'bas'],
  'Dos':       ['largeur', 'épaisseur'],
  'Jambes':    ['quadriceps', 'ischios', 'mollets'],
};

document.addEventListener('DOMContentLoaded', () => {
  DB.init();

  renderTodayPanel();
  renderSessionsList();
  renderExerciseList();
  bindForms();
  updateHeaderDate();
});

/* ═══════════════════════════════════════════════════════════════
   ONGLET 1 — SÉANCE DU JOUR
═══════════════════════════════════════════════════════════════ */

function renderTodayPanel() {
  const emptyEl   = document.getElementById('today-empty');
  const activeEl  = document.getElementById('today-active');
  const session   = DB.getTodaySession();

  if (!session) {
    if (emptyEl)  emptyEl.style.display  = 'flex';
    if (activeEl) activeEl.style.display = 'none';
    return;
  }

  // Il y a une séance programmée aujourd'hui
  if (emptyEl)  emptyEl.style.display  = 'none';
  if (activeEl) activeEl.style.display = 'block';

  // Nom de la séance
  const nameEl = document.getElementById('today-session-name');
  if (nameEl) nameEl.textContent = session.nom;

  // Nombre d'exercices
  const countEl = document.querySelector('.today-exercise-count');
  if (countEl) {
    const n = session.exercices.length;
    countEl.textContent = n + ' exercice' + (n > 1 ? 's' : '');
  }

  // Liste des exercices de la séance
  const listEl = document.getElementById('today-exercise-list');
  if (listEl) {
    listEl.innerHTML = session.exercices.map(block => {
      const exo = DB.getExercice(block.exoId);
      if (!exo) return '';
      return `
        <div class="today-exercise-row">
          <span class="today-exercise-row__tag today-exercise-row__tag--${exo.couleur}">
            ${exo.groupe}
          </span>
          <span class="today-exercise-row__name">${exo.nom}</span>
          <span class="today-exercise-row__info">
            ${block.series}×${block.reps} · ${block.repos}
          </span>
        </div>`;
    }).join('');
  }

  // Bouton "Commencer la séance"
  const startBtn = document.getElementById('btn-start-session');
  if (startBtn) {
    startBtn.onclick = () => {
      DB.setActiveSession(session.id);
      window.location.href = `seance.html?id=${session.id}`;
    };
  }
}

/* ═══════════════════════════════════════════════════════════════
   ONGLET 2 — SÉANCES
═══════════════════════════════════════════════════════════════ */

function renderSessionsList() {
  const container = document.getElementById('sessions-list');
  if (!container) return;

  const sessions = DB.getAllSessions();

  if (sessions.length === 0) {
    container.innerHTML = `
      <div class="sessions-empty">
        <p>Aucune séance programmée.</p>
        <p>Crée ta première séance pour commencer.</p>
      </div>`;
    return;
  }

  container.innerHTML = sessions.map(s => {
    const joursLabel = s.jours.length
      ? s.jours.map(j => JOURS_FR[j]).join(' · ')
      : 'Non planifiée';
    const exoCount = s.exercices.length;
    const canStart = exoCount > 0;

    return `
      <div class="session-card" data-session-id="${s.id}">
        <div class="session-card__header">
          <span class="session-card__name">${s.nom}</span>
          <button class="session-card__delete" data-delete-session="${s.id}"
                  aria-label="Supprimer ${s.nom}" title="Supprimer">✕</button>
        </div>
        <div class="session-card__meta">
          <span class="session-card__days">${joursLabel}</span>
          <span class="session-card__count">${exoCount} exercice${exoCount > 1 ? 's' : ''}</span>
        </div>
        ${s.exercices.length ? `
        <div class="session-card__exercises">
          ${s.exercices.slice(0, 4).map(b => {
            const exo = DB.getExercice(b.exoId);
            return exo
              ? `<span class="session-card__exo-chip session-card__exo-chip--${exo.couleur}">${exo.nom}</span>`
              : '';
          }).join('')}
          ${s.exercices.length > 4 ? `<span class="session-card__exo-more">+${s.exercices.length - 4}</span>` : ''}
        </div>` : ''}
        ${canStart ? `
        <button class="session-card__start" data-start-session="${s.id}" type="button">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
               width="14" height="14" aria-hidden="true">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          Démarrer
        </button>` : ''}
      </div>`;
  }).join('');

  // Boutons de suppression
  container.querySelectorAll('[data-delete-session]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.deleteSession;
      const s  = DB.getSession(id);
      if (s && confirm(`Supprimer la séance "${s.nom}" ?`)) {
        DB.deleteSession(id);
        renderSessionsList();
        renderTodayPanel();
      }
    });
  });

  // Boutons "Démarrer"
  container.querySelectorAll('[data-start-session]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.startSession;
      DB.setActiveSession(id);
      window.location.href = `seance.html?id=${id}`;
    });
  });
}

/* ═══════════════════════════════════════════════════════════════
   ONGLET 3 — EXERCICES
═══════════════════════════════════════════════════════════════ */

function renderExerciseList() {
  const container = document.querySelector('.exercises-list');
  if (!container) return;

  container.innerHTML = '';

  const q = currentSearch.trim().toLowerCase();
  const exercises = DB.getAllExercices().filter(exo => {
    const matchSearch     = !q || exo.nom.toLowerCase().includes(q) || exo.groupe.toLowerCase().includes(q);
    const matchGroupe     = !currentGroupe     || exo.groupe      === currentGroupe;
    const matchSousGroupe = !currentSousGroupe || exo.sousGroupe  === currentSousGroupe;
    const matchType       = !currentType       || exo.type        === currentType;
    const matchMateriel   = !currentMateriel   || exo.materiel    === currentMateriel;
    return matchSearch && matchGroupe && matchSousGroupe && matchType && matchMateriel;
  });

  exercises.forEach(exo => {
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
          ${exo.rm ? exo.rm + ' kg max' : 'Pas encore de 1RM'}
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
   FORMULAIRES
═══════════════════════════════════════════════════════════════ */

function bindForms() {
  bindAddSessionForm();
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
  // ── Rangée 1 : groupes ──
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

  // ── Rangée 3 : type ──
  document.querySelectorAll('[data-filter-type]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-filter-type]').forEach(c => c.classList.remove('chip--active'));
      chip.classList.add('chip--active');
      currentType = chip.dataset.filterType;
      renderExerciseList();
    });
  });

  // ── Rangée 3 : matériel ──
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
  const container = document.getElementById('chips-sous-groupe');
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

/* ── Calcul 1RM estimé (formule Epley, même logique qu'exercice.js) ── */
function calculerRMDepuisHistorique(exo) {
  if (exo.materiel === 'Poids du corps') return null;
  const entries = (exo.historique || []).filter(
    e => e.poids > 0 && typeof e.reps === 'number' && e.reps > 0
  );
  if (entries.length === 0) return null;
  const best = Math.max(...entries.map(e => e.poids * (1 + e.reps / 30)));
  return Math.round(best * 2) / 2;
}

/* ── Formulaire : créer une séance ── */
function bindAddSessionForm() {
  const form = document.getElementById('add-session-form');
  if (!form) return;

  // Peupler le select d'exercices dynamiquement
  const exoSelect = document.getElementById('session-exo-select');
  if (exoSelect) {
    DB.getAllExercices().forEach(exo => {
      const opt = document.createElement('option');
      opt.value       = exo.id;
      opt.textContent = `${exo.nom} (${exo.groupe})`;
      exoSelect.appendChild(opt);
    });
  }

  form.addEventListener('submit', e => {
    e.preventDefault();

    const nom = document.getElementById('session-nom').value.trim();
    if (!nom) return;

    // Jours cochés
    const jours = [...form.querySelectorAll('[name="session-jour"]:checked')]
      .map(cb => parseInt(cb.value));

    // Exercices sélectionnés avec leurs paramètres
    const exercices = [...form.querySelectorAll('.session-exo-block')].map(block => ({
      exoId:  block.dataset.exoId,
      series: parseInt(block.querySelector('[data-field="series"]').value) || 3,
      reps:   parseInt(block.querySelector('[data-field="reps"]').value)   || 10,
      repos:  block.querySelector('[data-field="repos"]').value             || '90 s',
      poids:  parseFloat(block.querySelector('[data-field="poids"]')?.value) || null,
    }));

    DB.addSession({ nom, jours, exercices });

    // Fermer la modale et réinitialiser
    const toggle = document.getElementById('show-add-session');
    if (toggle) toggle.checked = false;
    form.reset();
    document.getElementById('session-exo-blocks').innerHTML = '';

    renderSessionsList();
    renderTodayPanel();
  });

  // Bouton "Ajouter un exercice à la séance"
  const addExoBtn = document.getElementById('btn-add-exo-to-session');
  if (addExoBtn && exoSelect) {
    addExoBtn.addEventListener('click', () => {
      const exoId = exoSelect.value;
      if (!exoId) return;
      const exo = DB.getExercice(exoId);
      if (!exo) return;

      const container = document.getElementById('session-exo-blocks');
      const block = document.createElement('div');
      block.className     = 'session-exo-block';
      block.dataset.exoId = exoId;

      const isPoidsDuCorps = exo.materiel === 'Poids du corps';
      const rmEstime       = calculerRMDepuisHistorique(exo);

      // Poids conseillé hypertrophie : 70–80% du 1RM, arrondi à 2,5 kg
      let poidsConseille = null;
      if (!isPoidsDuCorps && rmEstime) {
        poidsConseille = Math.round(rmEstime * 0.75 / 2.5) * 2.5;
      }

      const champsPoidsHTML = isPoidsDuCorps ? '' : `
        <label class="session-exo-block__poids-label">
          Poids (kg)
          ${poidsConseille
            ? `<span class="session-exo-block__poids-hint">conseillé : ${poidsConseille} kg</span>`
            : ''}
          <input type="number" data-field="poids"
                 value="${poidsConseille || ''}"
                 placeholder="${poidsConseille ? poidsConseille : '—'}"
                 min="0" max="500" step="0.5">
        </label>`;

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
            <input type="number" data-field="reps"   value="10" min="1" max="100">
          </label>
          <label>Repos
            <input type="text"   data-field="repos"  value="90 s" placeholder="90 s">
          </label>
          ${champsPoidsHTML}
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

  // Champ sous-groupe conditionnel selon le groupe choisi
  groupeSelect.addEventListener('change', () => {
    const fieldSG    = document.getElementById('field-sous-groupe');
    const selectSG   = document.getElementById('new-exo-sous-groupe');
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

    const nomInput  = document.getElementById('new-exo-nom');
    const nom       = nomInput.value.trim();
    const groupe    = groupeSelect.value;
    const couleur   = groupeSelect.selectedOptions[0]?.dataset.couleur || 'autre';
    const sousGroupe = (document.getElementById('new-exo-sous-groupe')?.value) || '';
    const type      = form.querySelector('[name="new-exo-type"]:checked')?.value     || '';
    const materiel  = form.querySelector('[name="new-exo-materiel"]:checked')?.value || '';

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
  const btnCanel = document.getElementById('confirm-cancel');
  const overlay  = document.getElementById('confirm-overlay');

  nameEl.textContent = exoNom;
  modal.classList.add('confirm-modal--open');

  const close = () => modal.classList.remove('confirm-modal--open');

  const onDelete = () => {
    DB.deleteExercice(exoId);
    renderExerciseList();
    close();
    cleanup();
  };

  const onCancel = () => { close(); cleanup(); };

  const cleanup = () => {
    btnDel.removeEventListener('click', onDelete);
    btnCanel.removeEventListener('click', onCancel);
    overlay.removeEventListener('click', onCancel);
  };

  btnDel.addEventListener('click', onDelete);
  btnCanel.addEventListener('click', onCancel);
  overlay.addEventListener('click', onCancel);
}

function updateHeaderDate() {
  const el = document.querySelector('.page-header__subtitle');
  if (!el) return;
  el.textContent = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}
