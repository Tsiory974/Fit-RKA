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
  DB_VERSION:     'ft_db_version',
};

// Incrémenter DB_VERSION_CURRENT force la réinitialisation des exercices par défaut
const DB_VERSION_CURRENT = 5;

// sousGroupe : zone ciblée (optionnel selon le groupe)
// type       : 'polyarticulaire' | 'isolation'
// materiel   : 'Poids du corps' | 'Haltères' | 'Barre' | 'Machine' | 'Élastique' | 'Kettlebell'
const DEFAULT_EXERCISES = [
  // ── Pectoraux ──
  { id: 'developpe-couche',         nom: 'Développé couché',                       groupe: 'Pectoraux', couleur: 'pecto',   sousGroupe: 'milieu',     type: 'polyarticulaire', materiel: 'Barre'         },
  { id: 'developpe-incline',        nom: 'Développé incliné',                      groupe: 'Pectoraux', couleur: 'pecto',   sousGroupe: 'haut',       type: 'polyarticulaire', materiel: 'Barre'         },
  { id: 'developpe-decline',        nom: 'Développé décliné',                      groupe: 'Pectoraux', couleur: 'pecto',   sousGroupe: 'bas',        type: 'polyarticulaire', materiel: 'Barre'         },
  { id: 'ecarte-halteres',          nom: 'Écarté haltères',                        groupe: 'Pectoraux', couleur: 'pecto',   sousGroupe: 'milieu',     type: 'isolation',       materiel: 'Haltères'      },
  { id: 'ecarte-machine',           nom: 'Écarté à la machine',                    groupe: 'Pectoraux', couleur: 'pecto',   sousGroupe: 'milieu',     type: 'isolation',       materiel: 'Machine'       },
  { id: 'pompes',                   nom: 'Pompes',                                 groupe: 'Pectoraux', couleur: 'pecto',   sousGroupe: 'milieu',     type: 'polyarticulaire', materiel: 'Poids du corps' },
  // ── Dos ──
  { id: 'tractions',                nom: 'Tractions',                              groupe: 'Dos',       couleur: 'dos',     sousGroupe: 'largeur',    type: 'polyarticulaire', materiel: 'Poids du corps' },
  { id: 'tirage-vertical',          nom: 'Tirage vertical',                        groupe: 'Dos',       couleur: 'dos',     sousGroupe: 'largeur',    type: 'polyarticulaire', materiel: 'Machine'       },
  { id: 'tirage-horizontal',        nom: 'Tirage horizontal',                      groupe: 'Dos',       couleur: 'dos',     sousGroupe: 'épaisseur',  type: 'polyarticulaire', materiel: 'Machine'       },
  { id: 'rowing-barre',             nom: 'Rowing barre',                           groupe: 'Dos',       couleur: 'dos',     sousGroupe: 'épaisseur',  type: 'polyarticulaire', materiel: 'Barre'         },
  { id: 'rowing-haltere',           nom: 'Rowing haltère',                         groupe: 'Dos',       couleur: 'dos',     sousGroupe: 'épaisseur',  type: 'polyarticulaire', materiel: 'Haltères'      },
  { id: 'souleve-de-terre',         nom: 'Soulevé de terre',                       groupe: 'Dos',       couleur: 'dos',     sousGroupe: 'épaisseur',  type: 'polyarticulaire', materiel: 'Barre'         },
  // ── Jambes ──
  { id: 'squat',                    nom: 'Squat',                                  groupe: 'Jambes',    couleur: 'jambes',  sousGroupe: 'quadriceps', type: 'polyarticulaire', materiel: 'Barre'         },
  { id: 'presse-cuisses',           nom: 'Presse à cuisses',                       groupe: 'Jambes',    couleur: 'jambes',  sousGroupe: 'quadriceps', type: 'polyarticulaire', materiel: 'Machine'       },
  { id: 'fentes',                   nom: 'Fentes',                                 groupe: 'Jambes',    couleur: 'jambes',  sousGroupe: 'quadriceps', type: 'polyarticulaire', materiel: 'Poids du corps' },
  { id: 'leg-extension',            nom: 'Leg extension',                          groupe: 'Jambes',    couleur: 'jambes',  sousGroupe: 'quadriceps', type: 'isolation',       materiel: 'Machine'       },
  { id: 'leg-curl',                 nom: 'Leg curl',                               groupe: 'Jambes',    couleur: 'jambes',  sousGroupe: 'ischios',    type: 'isolation',       materiel: 'Machine'       },
  { id: 'mollets-debout',           nom: 'Mollets debout',                         groupe: 'Jambes',    couleur: 'jambes',  sousGroupe: 'mollets',    type: 'isolation',       materiel: 'Machine'       },
  // ── Épaules ──
  { id: 'developpe-militaire',      nom: 'Développé militaire',                    groupe: 'Épaules',   couleur: 'epaules', sousGroupe: '',           type: 'polyarticulaire', materiel: 'Barre'         },
  { id: 'elevations-laterales',     nom: 'Élévations latérales',                   groupe: 'Épaules',   couleur: 'epaules', sousGroupe: '',           type: 'isolation',       materiel: 'Haltères'      },
  { id: 'elevations-frontales',     nom: 'Élévations frontales',                   groupe: 'Épaules',   couleur: 'epaules', sousGroupe: '',           type: 'isolation',       materiel: 'Haltères'      },
  { id: 'oiseau-reverse-fly',       nom: 'Oiseau (reverse fly)',                   groupe: 'Épaules',   couleur: 'epaules', sousGroupe: '',           type: 'isolation',       materiel: 'Haltères'      },
  { id: 'shrugs',                   nom: 'Shrugs',                                 groupe: 'Épaules',   couleur: 'epaules', sousGroupe: '',           type: 'isolation',       materiel: 'Barre'         },
  // ── Biceps ──
  { id: 'curl-barre',               nom: 'Curl barre',                             groupe: 'Biceps',    couleur: 'biceps',  sousGroupe: '',           type: 'isolation',       materiel: 'Barre'         },
  { id: 'curl-halteres',            nom: 'Curl haltères',                          groupe: 'Biceps',    couleur: 'biceps',  sousGroupe: '',           type: 'isolation',       materiel: 'Haltères'      },
  { id: 'curl-incline',             nom: 'Curl incliné',                           groupe: 'Biceps',    couleur: 'biceps',  sousGroupe: '',           type: 'isolation',       materiel: 'Haltères'      },
  { id: 'curl-marteau',             nom: 'Curl marteau',                           groupe: 'Biceps',    couleur: 'biceps',  sousGroupe: '',           type: 'isolation',       materiel: 'Haltères'      },
  // ── Triceps ──
  { id: 'dips',                     nom: 'Dips',                                   groupe: 'Triceps',   couleur: 'triceps', sousGroupe: '',           type: 'polyarticulaire', materiel: 'Poids du corps' },
  { id: 'extension-triceps-poulie', nom: 'Extension triceps poulie',               groupe: 'Triceps',   couleur: 'triceps', sousGroupe: '',           type: 'isolation',       materiel: 'Machine'       },
  { id: 'extension-haltere-tete',   nom: 'Extension haltère au-dessus de la tête', groupe: 'Triceps',   couleur: 'triceps', sousGroupe: '',           type: 'isolation',       materiel: 'Haltères'      },
  { id: 'barre-au-front',           nom: 'Barre au front',                         groupe: 'Triceps',   couleur: 'triceps', sousGroupe: '',           type: 'isolation',       materiel: 'Barre'         },
  // ── Abdos ──
  { id: 'crunch',                   nom: 'Crunch',                                 groupe: 'Abdos',     couleur: 'abdos',   sousGroupe: '',           type: 'isolation',       materiel: 'Poids du corps' },
  { id: 'releves-jambes',           nom: 'Relevés de jambes',                      groupe: 'Abdos',     couleur: 'abdos',   sousGroupe: '',           type: 'isolation',       materiel: 'Poids du corps' },
  { id: 'gainage',                  nom: 'Gainage',                                groupe: 'Abdos',     couleur: 'abdos',   sousGroupe: '',           type: 'isolation',       materiel: 'Poids du corps' },
  { id: 'russian-twist',            nom: 'Russian twist',                          groupe: 'Abdos',     couleur: 'abdos',   sousGroupe: '',           type: 'isolation',       materiel: 'Poids du corps' },
  { id: 'mountain-climbers',        nom: 'Mountain climbers',                      groupe: 'Abdos',     couleur: 'abdos',   sousGroupe: '',           type: 'isolation',       materiel: 'Poids du corps' },
];

const DB = {

  /* ─────────────────────────────────────────────────────────────
     INITIALISATION
  ───────────────────────────────────────────────────────────── */

  init() {
    const storedVersion = parseInt(localStorage.getItem(KEYS.DB_VERSION) || '0', 10);

    if (storedVersion < DB_VERSION_CURRENT) {
      // Supprimer tous les anciens exercices par défaut
      const oldIds = JSON.parse(localStorage.getItem(KEYS.EXO_LIST) || '[]');
      const defaultIds = DEFAULT_EXERCISES.map(e => e.id);
      oldIds.forEach(id => {
        if (!defaultIds.includes(id)) localStorage.removeItem(KEYS.EXO_PREFIX + id);
      });

      // Écrire la nouvelle liste complète
      localStorage.setItem(KEYS.EXO_LIST, JSON.stringify(defaultIds));
      DEFAULT_EXERCISES.forEach(e => {
        // Conserver rm/historique mais forcer nom, groupe, couleur à jour
        const raw      = localStorage.getItem(KEYS.EXO_PREFIX + e.id);
        const existing = raw ? JSON.parse(raw) : null;
        localStorage.setItem(KEYS.EXO_PREFIX + e.id, JSON.stringify({
          rm: null, rmDate: null, historique: [],
          ...(existing || {}),
          id: e.id, nom: e.nom, groupe: e.groupe, couleur: e.couleur,
        }));
      });

      localStorage.setItem(KEYS.DB_VERSION, String(DB_VERSION_CURRENT));
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

  addExercice({ nom, groupe, couleur, sousGroupe = '', type = '', materiel = '' }) {
    const id = nom.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const ids = this.getExoIds();
    if (ids.includes(id)) return null;
    ids.push(id);
    localStorage.setItem(KEYS.EXO_LIST, JSON.stringify(ids));
    const exo = { id, nom, groupe, couleur, sousGroupe, type, materiel, rm: null, rmDate: null, historique: [] };
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
