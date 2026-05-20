# FitTrack — CLAUDE.md
> Fichier lu automatiquement par Claude Code à chaque démarrage de conversation.

---

## Présentation du projet

**FitTrack** est une application web PWA de suivi fitness.
- **Stack** : HTML5 + CSS3 + JavaScript **Vanilla uniquement** (zéro framework, zéro build tool)
- **Stockage** : `localStorage` exclusivement (pas de backend, pas de base de données)
- **Cible** : Mobile-first, compatible iPhone Safari / Android Chrome / PWA
- **Langue** : Interface en français

---

## Structure des fichiers

```
fitness/
├── index.html                  ← Accueil (navbar uniquement pour l'instant)
├── navbar.css                  ← Styles de la navbar + variables CSS globales
├── musculation.html / .css     ← Module musculation (onglets CSS radio)
├── seance.html / .css          ← Page séance en cours
├── exercice.html / .css        ← Fiche détail d'un exercice
├── exercice-overlay.css        ← Overlay ajout exercice
├── profil.html / .css          ← Page profil + sauvegarde données
│
├── alimentation/
│   ├── alimentation.html / .css  ← Liste + ajout aliments (bottom-sheet modal)
│   └── aliment.html / .css       ← Fiche détail d'un aliment
│
└── js/
    ├── data.js          ← Couche données : tous les globals window.*, ALIMENTS_DATA, DB, ALIM_DB, RECETTES_DB
    ├── musculation.js   ← Logique module musculation
    ├── seance.js        ← Logique séance
    ├── exercice.js      ← Logique fiche exercice
    ├── alimentation.js  ← Logique module alimentation (liste, modal ajout, picker)
    ├── aliment.js       ← Logique fiche détail aliment
    ├── scanner.js       ← Scanner code-barres ZXing + OpenFoodFacts API
    └── profil.js        ← Export / Import / Sauvegarde rapide localStorage
```

---

## Variables CSS globales (définies dans `navbar.css`)

```css
--bg-nav:      #111417      /* fond navbar */
--accent:      #39e07a      /* vert fitness (couleur principale) */
--accent-glow: rgba(57,224,122,0.25)
--text-idle:   #6b7280      /* texte inactif */
--text-active: #ffffff
--nav-height:  68px         /* hauteur navbar fixe en bas */
```

**Palette générale :**
- Fond body : `#0e1114`
- Fond cartes : `#13171b` ou `#1a1e23`
- Bordures : `#1f2a22` ou `#1f242a`
- Texte principal : `#f0f0f0` / `#e5e7eb`
- Texte secondaire : `#6b7280`
- Erreur : `#f87171`

---

## Navbar

La navbar est **dupliquée dans chaque HTML** (pas de composant partagé).
- Item actif : classe `active` ajoutée manuellement sur le `<a>` correspondant à la page
- Liens depuis la racine : `index.html`, `musculation.html`, `alimentation/alimentation.html`, `profil.html`
- Liens depuis `alimentation/` : `../index.html`, `../musculation.html`, `alimentation.html`, `../profil.html`

---

## Clés localStorage

| Clé | Type | Description |
|-----|------|-------------|
| `ft_exercises` | `string[]` | IDs des exercices |
| `ft_exo_<id>` | `Exercice` | Données d'un exercice |
| `ft_templates` | `string[]` | IDs des modèles de séance |
| `ft_template_<id>` | `SessionTemplate` | Données d'un modèle |
| `ft_planned` | `string[]` | IDs des séances planifiées |
| `ft_planned_<id>` | `PlannedSession` | Données d'une séance planifiée |
| `ft_active_session` | `string\|null` | ID séance active (legacy) |
| `ft_custom_aliments` | `Aliment[]` | Aliments créés par l'utilisateur |
| `ft_alim_notes_<id>` | `string` | Notes libres d'un aliment |
| `ft_alim_<YYYY-MM-DD>` | `DayData` | Journal alimentaire par jour |
| `ft_quick_save` | `{ savedAt, data }` | Snapshot sauvegarde rapide (profil) |
| `ft_profile` | `ProfilObjectif` | Objectif nutritionnel utilisateur |

---

## Globals JavaScript (définis dans `data.js`)

Chargés **avant** les autres scripts sur chaque page.

| Global | Description |
|--------|-------------|
| `window.DB` | CRUD exercices, templates, séances planifiées |
| `window.ALIM_DB` | CRUD journal alimentaire (getDay, addItem, removeItem, setWater…) |
| `window.RECETTES_DB` | CRUD recettes |
| `window.ALIMENTS_DATA` | Tableau des aliments (base statique + custom fusionnés) |
| `window.CAT_SLUG` | Map catégorie → slug CSS (ex: `'Viandes' → 'viandes'`) |
| `window.DAILY_GOALS` | Objectifs journaliers calculés depuis `PROFIL_DB.calcGoals()` `{ kcal, p, g, l, water, tdee }` |
| `window.PROFIL_DB` | CRUD objectif utilisateur — `get()`, `save(data)`, `calcGoals()` (Mifflin-St Jeor) |
| `window.MEAL_KEYS` | Tableau des repas `['petit-dejeuner', 'dejeuner', …]` |
| `window.localDateStr(date?)` | Retourne `'YYYY-MM-DD'` en heure locale (évite le bug UTC iOS) |

---

## Types de données principaux

```js
Exercice        { id, nom, groupe, couleur, sousGroupe, type, materiel, rm, rmDate, historique[] }
SessionTemplate { id, nom, exercices: ExoBlock[], createdAt }
PlannedSession  { id, templateId, date: 'YYYY-MM-DD', completed, completedAt, createdAt }

// ExoBlock — deux variantes selon le type d'exercice
ExoBlock (muscu)  { exoId, series, reps, repos, poids }
ExoBlock (cardio) { exoId, duree, distance, intensite }

// HistEntry — deux variantes
HistEntry (muscu)  { titre, series, reps, repos, poids, date }
HistEntry (cardio) { titre, duree, distance?, intensite?, date }

Aliment {
  id, nom, categorie, detail, type: 'gramme'|'ml'|'unite',
  m: { p, g, l, k },   // macros pour 100g/100ml/unité
  marque?               // optionnel, produits emballés
}
```

---

## Module Musculation — Cardio

Le cardio est un **groupe d'exercice first-class** (`groupe: 'Cardio'`), pas un système séparé.

### Groupes musculaires valides
Pectoraux, Dos, Épaules, Biceps, Triceps, Jambes, Abdos, **Cardio**, Autre

### Exercices cardio
- `couleur: 'cardio'` → badge bleu `--color-cardio: #38bdf8`
- `type: 'cardio'` (auto-défini à la création, sans choix de matériel)
- 8 exercices par défaut dans `data.js` : Course à pied, Vélo, Natation, Elliptique, Rameur, Corde à sauter, Marche rapide, HIIT
- Créer un nouvel exercice cardio : dropdown Groupe → "Cardio" → les champs Type et Matériel se masquent automatiquement

### Détection cardio dans le code
```js
const isCardio = exo.groupe === 'Cardio';
```
Utilisé partout : `renderExerciseList()`, `_renderSdExoList()`, `seance.js` (lignes ~244, 879, 1110, 1155, 1304)

### Flux cardio
| Contexte | Fonction |
|----------|----------|
| Créer un exercice | Formulaire `#add-exercise-form` → dropdown "Cardio" |
| Ajouter à un modèle | `openExoConfigModal()` → champ `#exo-config-duree` (min) |
| Pendant une séance | `seance.js` → inputs durée/distance/intensité |
| Déclarer après coup | `openCardioDeclarationSheet()` → `#cardio-declare-sheet` |

### Bottom-sheet déclaration cardio (`#cardio-declare-sheet`)
- Sélecteur activité, date, durée (required), distance (optionnel km), intensité chips (Faible/Modérée/Élevée)
- Sauve dans `exo.historique` via `DB.saveExercice()`
- Positionné en `position: fixed; inset: 0; z-index: 1100; display: flex; align-items: flex-end`

---

## Module Alimentation — points clés

- **`alimentation.html`** : liste les aliments + bottom-sheet modal pour en créer un nouveau
- **`aliment.html`** : fiche détail d'un aliment (URL param `?id=...`)
- Les aliments **custom** (créés par l'user) sont dans `localStorage['ft_custom_aliments']`
- `aliment.js` appelle `_loadCustomAliments()` au démarrage pour fusionner custom + statiques dans `window.ALIMENTS_DATA`
- `alimentation.js` expose `openAlimNewModal()`, `_applyAlimKind(kind)`, `_applyAlimType(type)`
- La zone scanner (`#alim-scan-zone`) est visible **seulement** quand `typeAliment === 'produit'`, contrôlé par `_applyAlimKind()`
- Cliquer sur un aliment custom navigue vers `aliment.html?id=<id>`

## Scanner (`js/scanner.js`)

- Bibliothèque : **ZXing** `@zxing/library@0.21.3` (UMD CDN)
  ```html
  <script src="https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js"></script>
  ```
- API externe : **OpenFoodFacts** `https://world.openfoodfacts.org/api/v0/product/{barcode}.json`
- Formats détectés : EAN-13, EAN-8, UPC-A, UPC-E, CODE-128
- API publique : `window.FitScanner.open()` / `window.FitScanner.close()`
- Overlay `#scan-overlay` : `position: fixed; z-index: 400`
- iOS Safari : `<video playsinline autoplay muted>` + arrêt manuel du stream `video.srcObject.getTracks().forEach(t => t.stop())`

---

## Module Profil (`profil.html` + `js/profil.js`)

Trois fonctionnalités :
1. **Sauvegarde rapide** — snapshot dans `localStorage['ft_quick_save']` avec horodatage, bouton "Restaurer" si snapshot existant
2. **Export fichier** — télécharge `fitness-backup.json` (tout le localStorage sauf `ft_quick_save`)
3. **Import fichier** — lit un `.json`, confirm dialog, `localStorage.clear()` + réécriture, `location.reload()`

---

## Conventions et règles importantes

- **Vanilla JS uniquement** — pas de React, Vue, jQuery, npm, webpack, etc.
- **Mobile-first** — tout doit fonctionner sur iPhone Safari et Android Chrome
- **`max-width: 480px`** sur body pour les pages complexes (musculation, alimentation)
- **Navbar padding** : `body` a `padding-bottom: var(--nav-height)` via `navbar.css` — ne pas recréer
- **Bottom-sheet modals** : pattern `visibility: hidden + transform: translateY(100%)` → classe `--open` pour afficher
- **Bottom-sheet overlay fixe** : tout conteneur de bottom-sheet doit avoir `position: fixed; inset: 0; z-index: 1100; display: flex; align-items: flex-end` — sans cela la sheet s'affiche dans le flux du document et sort de l'écran
- **Scroll dans une bottom-sheet** : la zone scrollable doit avoir `flex: 1; min-height: 0; overflow-y: auto`. Le conteneur parent doit avoir une hauteur **définie** (`height`, pas seulement `max-height`) pour que `flex: 1` soit résolu sur iOS Safari. Utiliser `height: var(--h, 90dvh); max-height: var(--h, 90dvh); box-sizing: border-box`
- **Dates** : toujours utiliser `window.localDateStr()` (jamais `toISOString().slice(0,10)` — bug timezone iOS)
- **IDs** : format `<préfixe>-<timestamp>` généré avec `Date.now()` ou similaire
- **Pas de framework CSS** — tout est écrit à la main, cohérent avec la palette dark fitness
- Ne pas modifier `navbar.css` ni `data.js` sans raison forte — ce sont les fondations partagées

---

## Pages et leurs scripts

| Page | Scripts chargés (dans l'ordre) |
|------|-------------------------------|
| `musculation.html` | `navbar.css`, `musculation.css`, `data.js`, `musculation.js` |
| `seance.html` | `navbar.css`, `seance.css`, `data.js`, `seance.js` |
| `exercice.html` | `navbar.css`, `exercice.css`, `data.js`, `exercice.js` |
| `alimentation/alimentation.html` | `../navbar.css`, `alimentation.css`, `../js/data.js`, `../js/alimentation.js`, `../js/scanner.js` |
| `alimentation/aliment.html` | `../navbar.css`, `aliment.css`, `../js/data.js`, `../js/aliment.js` |
| `profil.html` | `navbar.css`, `profil.css`, `js/profil.js` |
