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
      // Futur : rediriger vers la vue d'exécution de séance
      alert(`Séance "${session.nom}" démarrée ! (vue d'exécution à venir)`);
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
}

/* ═══════════════════════════════════════════════════════════════
   ONGLET 3 — EXERCICES
═══════════════════════════════════════════════════════════════ */

function renderExerciseList() {
  const container = document.querySelector('.exercises-list');
  if (!container) return;

  const placeholder = container.querySelector('.add-exercise-placeholder');
  container.innerHTML = '';

  const exercises = DB.getAllExercices();

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
      <span class="exercise-card__arrow" aria-hidden="true">›</span>`;
    container.appendChild(card);
  });

  // Placeholder toujours en dernier
  if (placeholder) {
    container.appendChild(placeholder);
  } else {
    const ph = document.createElement('div');
    ph.className = 'add-exercise-placeholder';
    ph.innerHTML = '<label for="show-add-exercise" style="cursor:pointer;display:contents">＋ Ajouter un exercice</label>';
    container.appendChild(ph);
  }
}

/* ═══════════════════════════════════════════════════════════════
   FORMULAIRES
═══════════════════════════════════════════════════════════════ */

function bindForms() {
  bindAddSessionForm();
  bindAddExerciseForm();
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
      block.className      = 'session-exo-block';
      block.dataset.exoId  = exoId;
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
        </div>`;
      block.querySelector('.session-exo-block__remove').addEventListener('click', () => block.remove());
      container.appendChild(block);
    });
  }
}

/* ── Formulaire : ajouter un exercice ── */
function bindAddExerciseForm() {
  const form = document.getElementById('add-exercise-form');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();

    const nomInput     = document.getElementById('new-exo-nom');
    const groupeSelect = document.getElementById('new-exo-groupe');
    const nom          = nomInput.value.trim();
    const groupe       = groupeSelect.value;
    const couleur      = groupeSelect.selectedOptions[0]?.dataset.couleur;

    if (!nom || !groupe) return;

    const result = DB.addExercice({ nom, groupe, couleur });
    if (!result) {
      nomInput.setCustomValidity('Un exercice avec ce nom existe déjà.');
      nomInput.reportValidity();
      return;
    }
    nomInput.setCustomValidity('');

    const toggle = document.getElementById('show-add-exercise');
    if (toggle) toggle.checked = false;
    form.reset();
    renderExerciseList();
  });
}

/* ═══════════════════════════════════════════════════════════════
   UTILITAIRES
═══════════════════════════════════════════════════════════════ */

function updateHeaderDate() {
  const el = document.querySelector('.page-header__subtitle');
  if (!el) return;
  el.textContent = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}
