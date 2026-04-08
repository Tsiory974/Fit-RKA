/**
 * FitTrack — Séance guidée (seance.js)
 * ======================================
 * Machine à états :
 *   READY → ACTIVE → VALIDATE → REST → (boucle)
 *                                     → RECAP (fin)
 *
 * URL attendue : seance.html?id=<sessionId>
 */

/* ── Constante ring SVG ──────────────────────────────────────
   Cercle r=54, viewBox 120×120 → 2π×54 ≈ 339.292             */
const CIRC = 2 * Math.PI * 54;

/* ── État global ─────────────────────────────────────────────
   Toutes les variables mutables de la séance                  */
let session          = null;
let exercises        = [];     // [{ block, exo }]
let results          = [];     // [{ exoId, nom, groupe, couleur, series[] }]
let currentExoIdx    = 0;
let currentSerie     = 1;
let currentState     = 'ready';

let stopwatchSecs    = 0;
let stopwatchTimer   = null;

let restTotal        = 0;
let restRemaining    = 0;
let restTimer        = null;
let pendingLastSerie = false;

let stepperVal       = 0;
let pendingSerieReps = 0;   // reps validés, en attente du poids
let weightVal        = 0;   // valeur courante de l'input poids

/* ═══════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', init);

function init() {
  DB.init();

  const params = new URLSearchParams(location.search);
  const id = params.get('id');

  if (!id) { showError('Aucun identifiant de séance dans l\'URL.'); return; }

  session = DB.getSession(id);

  // Fallback : scan direct de toutes les clés localStorage
  if (!session) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      try {
        const data = JSON.parse(localStorage.getItem(key));
        if (data && data.id === id) { session = data; break; }
      } catch(e) {}
    }
  }

  // Debug : affiche toutes les clés liées aux séances dans la console
  console.group('FitTrack — debug seance init');
  console.log('ID recherché :', id);
  console.log('Session trouvée :', session);
  console.log('Toutes les clés localStorage :',
    Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)));
  console.groupEnd();

  if (!session) {
    const allKeys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
      .filter(k => k.startsWith('ft_session')).join(', ') || '(aucune)';
    showError(
      `Séance introuvable.<br><small style="font-weight:400;color:#9ca3af">ID : ${id}<br>Clés session en mémoire : ${allKeys}</small>`
    );
    return;
  }

  // Construire le tableau d'exercices — on garde les blocs même si l'exo est introuvable
  // (on créé alors un placeholder pour ne pas bloquer la séance)
  exercises = (session.exercices || []).map(block => {
    const exo = DB.getExercice(block.exoId) || {
      id:      block.exoId,
      nom:     block.exoId,       // fallback : affiche l'ID brut
      groupe:  'Exercice',
      couleur: 'pecto',
      rm:      null,
    };
    return { block, exo };
  });

  if (!exercises.length) {
    showError('Cette séance ne contient aucun exercice.\nAjoute des exercices depuis l\'onglet Séances.');
    return;
  }

  // Initialiser la structure de résultats
  results = exercises.map(({ exo }) => ({
    exoId:   exo.id,
    nom:     exo.nom,
    groupe:  exo.groupe,
    couleur: exo.couleur,
    series:  [],
  }));

  document.getElementById('ws-session-name').textContent = session.nom;

  // Boutons fixes
  document.getElementById('btn-back').addEventListener('click', confirmQuit);
  document.getElementById('btn-start-serie').addEventListener('click', startSerie);
  document.getElementById('btn-serie-done').addEventListener('click', serieDone);
  document.getElementById('btn-full-reps').addEventListener('click', () => validateReps(null));
  document.getElementById('btn-adjust-reps').addEventListener('click', () => validateReps(stepperVal));
  document.getElementById('btn-rep-minus').addEventListener('click', () => changeStepper(-1));
  document.getElementById('btn-rep-plus').addEventListener('click',  () => changeStepper(+1));
  document.getElementById('btn-skip-rest').addEventListener('click', skipRest);
  document.getElementById('btn-weight-confirm').addEventListener('click', confirmWeight);
  document.getElementById('btn-weight-skip').addEventListener('click', () => commitSerie(pendingSerieReps, null));
  document.getElementById('btn-weight-minus').addEventListener('click', () => changeWeight(-2.5));
  document.getElementById('btn-weight-plus').addEventListener('click',  () => changeWeight(+2.5));
  document.getElementById('weight-input').addEventListener('input', e => {
    weightVal = parseFloat(e.target.value) || 0;
  });

  showReady();
}

/** Affiche un message d'erreur dans le premier écran (ne redirige jamais) */
function showError(msg) {
  const screen = document.getElementById('screen-ready');
  if (!screen) return;
  screen.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;
                justify-content:center;flex:1;gap:1rem;text-align:center;padding:2rem">
      <div style="font-size:2.5rem">⚠️</div>
      <p style="color:#e5e7eb;font-weight:700;font-size:1rem;margin:0">${msg}</p>
      <a href="musculation.html"
         style="margin-top:1rem;padding:.75rem 1.5rem;background:var(--accent);
                color:#0a1a0d;border-radius:12px;font-weight:700;text-decoration:none">
        Retour
      </a>
    </div>`;
  screen.classList.add('ws-screen--active');
}

/* ═══════════════════════════════════════════════════════════
   NAVIGATION ENTRE ÉCRANS
═══════════════════════════════════════════════════════════ */
function showScreen(id) {
  document.querySelectorAll('.ws-screen').forEach(s =>
    s.classList.remove('ws-screen--active')
  );
  const el = document.getElementById(id);
  if (el) el.classList.add('ws-screen--active');
}

/* ═══════════════════════════════════════════════════════════
   ÉCRAN 1 : READY
═══════════════════════════════════════════════════════════ */
function showReady() {
  currentState = 'ready';
  const { block, exo } = exercises[currentExoIdx];

  updateHeader();

  setMuscleTag('ready-muscle-tag', exo.groupe, exo.couleur);
  document.getElementById('ready-exo-name').textContent    = exo.nom;
  document.getElementById('ready-serie-num').textContent   = currentSerie;
  document.getElementById('ready-serie-total').textContent = block.series || '?';
  document.getElementById('ready-reps').textContent        = block.reps   || '?';
  document.getElementById('ready-repos').textContent       = block.repos  || '90 s';

  // Séries déjà faites pour cet exercice
  const done   = results[currentExoIdx].series;
  const prevEl = document.getElementById('ready-prev-series');

  if (done.length) {
    prevEl.innerHTML = done.map((s, i) => {
      const miss = s.actual < s.planned;
      return `
        <div class="ws-prev-row">
          <span class="ws-prev-row__label">Série ${i + 1}</span>
          <span class="ws-prev-row__reps${miss ? ' ws-prev-row__reps--miss' : ''}">
            ${s.actual} reps${miss ? ` (obj. ${s.planned})` : ' ✓'}
          </span>
        </div>`;
    }).join('');
  } else {
    prevEl.innerHTML = '';
  }

  showScreen('screen-ready');
}

/* ═══════════════════════════════════════════════════════════
   ÉCRAN 2 : ACTIVE
═══════════════════════════════════════════════════════════ */
function startSerie() {
  currentState = 'active';
  const { block, exo } = exercises[currentExoIdx];

  setMuscleTag('active-muscle-tag', exo.groupe, exo.couleur);
  document.getElementById('active-exo-name').textContent = exo.nom;
  document.getElementById('active-target').textContent   =
    `Série ${currentSerie} / ${block.series}  ·  ${block.reps} reps`;

  stopwatchSecs = 0;
  clearInterval(stopwatchTimer);
  updateStopwatch();
  stopwatchTimer = setInterval(() => {
    stopwatchSecs++;
    updateStopwatch();
  }, 1000);

  showScreen('screen-active');
}

/* ═══════════════════════════════════════════════════════════
   ÉCRAN 3 : VALIDATE
═══════════════════════════════════════════════════════════ */
function serieDone() {
  clearInterval(stopwatchTimer);
  currentState = 'validate';

  const { block } = exercises[currentExoIdx];
  const planned = parseInt(block.reps) || 10;

  stepperVal = planned;
  document.getElementById('stepper-val').textContent         = stepperVal;
  document.getElementById('validate-target').textContent     = `Objectif : ${planned} reps`;
  document.getElementById('validate-full-label').textContent = `(${planned})`;

  showScreen('screen-validate');
}

function changeStepper(delta) {
  stepperVal = Math.max(0, stepperVal + delta);
  document.getElementById('stepper-val').textContent = stepperVal;
}

function validateReps(actual) {
  const { block, exo } = exercises[currentExoIdx];
  const planned    = parseInt(block.reps) || 10;
  const actualReps = (actual === null) ? planned : actual;

  pendingSerieReps = actualReps;

  // Exercice poids du corps → pas de saisie poids
  if (exo.materiel === 'Poids du corps') {
    commitSerie(actualReps, null);
    return;
  }

  showWeightScreen(actualReps, block);
}

function showWeightScreen(actualReps, block) {
  const { exo } = exercises[currentExoIdx];

  // Pré-remplir avec le poids du bloc de séance, ou dernière valeur, ou 0
  const suggested = block.poids || weightVal || 0;
  weightVal = suggested;

  document.getElementById('weight-serie-info').textContent =
    `Série ${currentSerie} · ${actualReps} reps`;

  const input = document.getElementById('weight-input');
  input.value = suggested || '';

  // Hint poids conseillé hypertrophie (si 1RM connu)
  const hintEl = document.getElementById('weight-hint');
  const rm = calculerRMLocal(exo);
  if (rm) {
    const conseille = Math.round(rm * 0.75 / 2.5) * 2.5;
    hintEl.textContent = `Poids conseillé hypertrophie : ${conseille} kg`;
    hintEl.style.display = '';
  } else {
    hintEl.style.display = 'none';
  }

  showScreen('screen-weight');
}

function changeWeight(delta) {
  weightVal = Math.max(0, Math.round((weightVal + delta) * 2) / 2);
  document.getElementById('weight-input').value = weightVal || '';
}

function confirmWeight() {
  const inputVal = parseFloat(document.getElementById('weight-input').value);
  weightVal = inputVal > 0 ? inputVal : 0;
  commitSerie(pendingSerieReps, weightVal || null);
}

function commitSerie(actualReps, poids) {
  const { block } = exercises[currentExoIdx];
  const planned     = parseInt(block.reps)   || 10;
  const totalSeries = parseInt(block.series) || 1;

  results[currentExoIdx].series.push({
    planned:  planned,
    actual:   actualReps,
    duration: stopwatchSecs,
    poids:    poids,
  });

  const isLastSerie = currentSerie >= totalSeries;
  const isLastExo   = currentExoIdx >= exercises.length - 1;

  if (isLastSerie && isLastExo) {
    saveAllResults();
    showRecap();
    return;
  }

  pendingLastSerie = isLastSerie;
  startRest(parseRepos(block.repos), isLastSerie);
}

/** Calcul 1RM local (Epley, meilleure série) — même logique qu'exercice.js */
function calculerRMLocal(exo) {
  if (!exo || exo.materiel === 'Poids du corps') return null;
  const entries = (exo.historique || []).filter(e => e.poids > 0 && e.reps > 0);
  if (!entries.length) return null;
  const best = Math.max(...entries.map(e => e.poids * (1 + e.reps / 30)));
  return Math.round(best * 2) / 2;
}

/* ═══════════════════════════════════════════════════════════
   ÉCRAN 4 : REST
═══════════════════════════════════════════════════════════ */
function startRest(secs, isLastSerie) {
  currentState  = 'rest';
  restTotal     = secs || 90;
  restRemaining = restTotal;

  let nextText;
  if (isLastSerie && currentExoIdx + 1 < exercises.length) {
    nextText = `Prochain : ${exercises[currentExoIdx + 1].exo.nom}`;
  } else {
    nextText = `Prochain : Série ${currentSerie + 1}`;
  }
  document.getElementById('rest-next-text').textContent = nextText;

  // Reset arc sans transition parasite
  const arc = document.getElementById('rest-arc');
  arc.style.transition      = 'none';
  arc.style.strokeDashoffset = 0;
  void arc.getBoundingClientRect(); // force reflow
  arc.style.transition      = '';

  updateRestDisplay();
  showScreen('screen-rest');

  clearInterval(restTimer);
  restTimer = setInterval(() => {
    restRemaining--;
    updateRestDisplay();
    if (restRemaining <= 0) {
      clearInterval(restTimer);
      advanceAfterRest();
    }
  }, 1000);
}

function skipRest() {
  clearInterval(restTimer);
  advanceAfterRest();
}

function advanceAfterRest() {
  if (pendingLastSerie) {
    currentExoIdx++;
    currentSerie = 1;
  } else {
    currentSerie++;
  }
  showReady();
}

/* ═══════════════════════════════════════════════════════════
   ÉCRAN 5 : RÉCAP
═══════════════════════════════════════════════════════════ */
function showRecap() {
  currentState = 'recap';
  updateHeader();

  document.getElementById('recap-session-name').textContent = session.nom;

  const listEl = document.getElementById('recap-list');
  listEl.innerHTML = results.map((r, i) => {
    const block = session.exercices[i] || {};

    const seriesHtml = r.series.map((s, idx) => {
      const miss = s.actual < s.planned;
      return `
        <div class="ws-recap-serie">
          <span class="ws-recap-serie__num">Série ${idx + 1}</span>
          <span class="ws-recap-serie__reps">
            <span class="${miss ? 'miss' : 'ok'}">${s.actual}</span>
            <span class="planned"> / ${s.planned} reps</span>
          </span>
          ${s.poids ? `<span class="ws-recap-serie__poids">${s.poids} kg</span>` : ''}
          <span class="ws-recap-serie__time">${formatTime(s.duration)}</span>
        </div>`;
    }).join('');

    return `
      <div class="ws-recap-exo">
        <div class="ws-recap-exo__header">
          <span class="ws-muscle-tag ws-muscle-tag--${r.couleur || 'pecto'}">${r.groupe}</span>
          <span class="ws-recap-exo__name">${r.nom}</span>
        </div>
        ${seriesHtml || '<div style="padding:.75rem 1rem;font-size:.8rem;color:#4b5563">Aucune série</div>'}
      </div>`;
  }).join('');

  showScreen('screen-recap');
}

/* ═══════════════════════════════════════════════════════════
   SAUVEGARDE
═══════════════════════════════════════════════════════════ */
function saveAllResults() {
  const now = new Date().toISOString();
  results.forEach((r, i) => {
    if (!r.series.length) return;
    const block = (session.exercices || [])[i] || {};
    const exo   = exercises[i]?.exo;

    // Sauvegarder chaque série individuellement pour un 1RM précis
    r.series.forEach((s, idx) => {
      DB.addHistoriqueEntry(r.exoId, {
        titre:  session.nom,
        series: idx + 1,           // numéro de la série
        reps:   s.actual,          // nombre (pas string)
        repos:  block.repos || '',
        poids:  s.poids ?? null,   // nombre ou null (poids du corps)
      });
    });
  });
  DB.clearActiveSession();
}

/* ═══════════════════════════════════════════════════════════
   QUITTER
═══════════════════════════════════════════════════════════ */
function confirmQuit() {
  if (currentState === 'recap') {
    location.href = 'musculation.html';
    return;
  }
  if (confirm('Quitter la séance en cours ?\nTa progression ne sera pas sauvegardée.')) {
    clearInterval(stopwatchTimer);
    clearInterval(restTimer);
    DB.clearActiveSession();
    location.href = 'musculation.html';
  }
}

/* ═══════════════════════════════════════════════════════════
   UTILITAIRES
═══════════════════════════════════════════════════════════ */
function updateHeader() {
  const counterEl = document.getElementById('ws-exo-counter');
  const dotsEl    = document.getElementById('ws-dots');
  if (!counterEl || !dotsEl) return;

  if (currentState === 'recap') {
    counterEl.textContent = '✓';
    dotsEl.innerHTML = '';
    return;
  }

  counterEl.textContent = `${currentExoIdx + 1}/${exercises.length}`;

  const { block } = exercises[currentExoIdx];
  const n = parseInt(block.series) || 1;
  dotsEl.innerHTML = Array.from({ length: n }, (_, i) => {
    if (i + 1 < currentSerie)   return '<span class="ws-dot ws-dot--done"></span>';
    if (i + 1 === currentSerie) return '<span class="ws-dot ws-dot--current"></span>';
    return '<span class="ws-dot"></span>';
  }).join('');
}

function setMuscleTag(elementId, groupe, couleur) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = groupe || '—';
  el.className   = `ws-muscle-tag ws-muscle-tag--${couleur || 'pecto'}`;
}

function updateStopwatch() {
  const el = document.getElementById('ws-stopwatch');
  if (el) el.textContent = formatTime(stopwatchSecs);
}

function updateRestDisplay() {
  const timeEl = document.getElementById('rest-time');
  const arc    = document.getElementById('rest-arc');
  if (timeEl) timeEl.textContent = formatTime(restRemaining);
  if (arc) {
    const fraction = restTotal > 0 ? restRemaining / restTotal : 1;
    arc.style.strokeDashoffset = CIRC * (1 - fraction);
  }
}

function formatTime(secs) {
  const s = Math.max(0, secs);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

/**
 * Parse le champ repos en secondes.
 * Accepte : "90 s", "90", "1 min 30", "2 min", "1min30s", "2:00", etc.
 */
function parseRepos(str) {
  if (!str) return 90;
  const s = String(str).toLowerCase().trim();

  // "1:30" ou "2:00"
  const colonFmt = s.match(/^(\d+):(\d{2})$/);
  if (colonFmt) return parseInt(colonFmt[1]) * 60 + parseInt(colonFmt[2]);

  // "1 min 30" ou "1min30s"
  const minSec = s.match(/(\d+)\s*min\s*(\d+)/);
  if (minSec)  return parseInt(minSec[1]) * 60 + parseInt(minSec[2]);

  // "2 min"
  const minOnly = s.match(/(\d+)\s*min/);
  if (minOnly) return parseInt(minOnly[1]) * 60;

  // "90 s" ou "90"
  const secOnly = s.match(/(\d+)/);
  return secOnly ? parseInt(secOnly[1]) : 90;
}
