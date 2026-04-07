/**
 * FitTrack — Couche données (localStorage)
 * ==========================================
 * Point d'entrée unique pour lire/écrire toutes les données.
 * Chaque page importe ce fichier AVANT son propre script.
 *
 * Clés localStorage :
 *   ft_exercises          → string[] — IDs des exercices (ordre)
 *   ft_exo_<id>           → Exercice
 *   ft_sessions           → string[] — IDs des séances (ordre)
 *   ft_session_<id>       → Session
 *   ft_active_session     → string|null — ID de la séance en cours
 *
 * Types :
 *   Exercice  { id, nom, groupe, couleur, rm, rmDate, historique[] }
 *   Session   { id, nom, jours: number[], exercices: ExoBlock[] }
 *   ExoBlock  { exoId, series, reps, repos }
 *   HistEntry { titre, series, reps, repos, poids, date }
 *
 * Jours (0 = lundi … 6 = dimanche, semaine FR)
 */

const KEYS = {
  EXO_LIST:       'ft_exercises',
  EXO_PREFIX:     'ft_exo_',
  SESSION_LIST:   'ft_sessions',
  SESSION_PREFIX: 'ft_session_',
  ACTIVE_SESSION: 'ft_active_session',
};

const DEFAULT_EXERCISES = [
  { id: 'developpe-couche',    nom: 'Développé couché',    groupe: 'Pectoraux', couleur: 'pecto'   },
  { id: 'tractions',           nom: 'Tractions',           groupe: 'Dos',       couleur: 'dos'     },
  { id: 'developpe-militaire', nom: 'Développé militaire', groupe: 'Épaules',   couleur: 'epaules' },
  { id: 'curl-biceps',         nom: 'Curl biceps',         groupe: 'Bras',      couleur: 'bras'    },
  { id: 'squat',               nom: 'Squat',               groupe: 'Jambes',    couleur: 'jambes'  },
  { id: 'crunchs',             nom: 'Crunchs',             groupe: 'Abdos',     couleur: 'abdos'   },
];

const DB = {

  /* ─────────────────────────────────────────────────────────────
     INITIALISATION
  ───────────────────────────────────────────────────────────── */

  init() {
    // Exercices par défaut (premier lancement)
    if (!localStorage.getItem(KEYS.EXO_LIST)) {
      localStorage.setItem(KEYS.EXO_LIST, JSON.stringify(DEFAULT_EXERCISES.map(e => e.id)));
      DEFAULT_EXERCISES.forEach(e => {
        if (!localStorage.getItem(KEYS.EXO_PREFIX + e.id)) {
          localStorage.setItem(KEYS.EXO_PREFIX + e.id, JSON.stringify({
            ...e, rm: null, rmDate: null, historique: [],
          }));
        }
      });
    }
    // Liste des séances (peut être vide)
    if (!localStorage.getItem(KEYS.SESSION_LIST)) {
      localStorage.setItem(KEYS.SESSION_LIST, JSON.stringify([]));
    }
  },

  /* ─────────────────────────────────────────────────────────────
     EXERCICES
  ───────────────────────────────────────────────────────────── */

  getExoIds()       { return JSON.parse(localStorage.getItem(KEYS.EXO_LIST) || '[]'); },
  getExercice(id)   { const r = localStorage.getItem(KEYS.EXO_PREFIX + id); return r ? JSON.parse(r) : null; },
  getAllExercices()  { return this.getExoIds().map(id => this.getExercice(id)).filter(Boolean); },
  saveExercice(exo) { localStorage.setItem(KEYS.EXO_PREFIX + exo.id, JSON.stringify(exo)); },

  addExercice({ nom, groupe, couleur }) {
    const id = nom.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const ids = this.getExoIds();
    if (ids.includes(id)) return null;
    ids.push(id);
    localStorage.setItem(KEYS.EXO_LIST, JSON.stringify(ids));
    const exo = { id, nom, groupe, couleur, rm: null, rmDate: null, historique: [] };
    this.saveExercice(exo);
    return exo;
  },

  deleteExercice(id) {
    const ids = this.getExoIds().filter(i => i !== id);
    localStorage.setItem(KEYS.EXO_LIST, JSON.stringify(ids));
    localStorage.removeItem(KEYS.EXO_PREFIX + id);
  },

  setRM(id, value) {
    const exo = this.getExercice(id);
    if (!exo) return null;
    exo.rm     = parseFloat(value);
    exo.rmDate = new Date().toISOString();
    this.saveExercice(exo);
    return exo;
  },

  addHistoriqueEntry(id, entry) {
    const exo = this.getExercice(id);
    if (!exo) return;
    exo.historique.unshift({ ...entry, date: new Date().toISOString() });
    this.saveExercice(exo);
  },

  /* ─────────────────────────────────────────────────────────────
     SÉANCES PROGRAMMÉES
     Une séance = un programme récurrent (ex: "Push A") assigné
     à un ou plusieurs jours de la semaine.
     jours[] : 0=Lun, 1=Mar, 2=Mer, 3=Jeu, 4=Ven, 5=Sam, 6=Dim
  ───────────────────────────────────────────────────────────── */

  getSessionIds()       { return JSON.parse(localStorage.getItem(KEYS.SESSION_LIST) || '[]'); },
  getSession(id)        { const r = localStorage.getItem(KEYS.SESSION_PREFIX + id); return r ? JSON.parse(r) : null; },
  getAllSessions()       { return this.getSessionIds().map(id => this.getSession(id)).filter(Boolean); },
  saveSession(session)  { localStorage.setItem(KEYS.SESSION_PREFIX + session.id, JSON.stringify(session)); },

  /**
   * Crée une nouvelle séance programmée.
   * @param {Object} p
   * @param {string}   p.nom      — Nom de la séance
   * @param {number[]} p.jours    — Jours de la semaine (0–6)
   * @param {Array}    p.exercices — [{exoId, series, reps, repos}]
   */
  addSession({ nom, jours = [], exercices = [] }) {
    const id  = 'session-' + Date.now();
    const ids = this.getSessionIds();
    ids.push(id);
    localStorage.setItem(KEYS.SESSION_LIST, JSON.stringify(ids));
    const session = { id, nom, jours, exercices, createdAt: new Date().toISOString() };
    this.saveSession(session);
    return session;
  },

  updateSession(session) {
    const ids = this.getSessionIds();
    if (!ids.includes(session.id)) return null;
    this.saveSession(session);
    return session;
  },

  deleteSession(id) {
    const ids = this.getSessionIds().filter(i => i !== id);
    localStorage.setItem(KEYS.SESSION_LIST, JSON.stringify(ids));
    localStorage.removeItem(KEYS.SESSION_PREFIX + id);
    // Si c'était la séance active, on l'efface
    if (this.getActiveSessionId() === id) this.clearActiveSession();
  },

  /* ─────────────────────────────────────────────────────────────
     SÉANCE DU JOUR
  ───────────────────────────────────────────────────────────── */

  /**
   * Retourne la séance programmée pour aujourd'hui, ou null.
   * Si plusieurs séances sont assignées au même jour, retourne la première.
   */
  getTodaySession() {
    // JS getDay() : 0=dim … 6=sam → on convertit en 0=lun … 6=dim
    const jsDay   = new Date().getDay();
    const frDay   = jsDay === 0 ? 6 : jsDay - 1;
    return this.getAllSessions().find(s => s.jours.includes(frDay)) || null;
  },

  /* Séance active (en cours d'exécution) */
  getActiveSessionId()  { return localStorage.getItem(KEYS.ACTIVE_SESSION) || null; },
  setActiveSession(id)  { localStorage.setItem(KEYS.ACTIVE_SESSION, id); },
  clearActiveSession()  { localStorage.removeItem(KEYS.ACTIVE_SESSION); },
};

window.DB = DB;
