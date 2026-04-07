/**
 * FitTrack — Page Exercice
 * ========================
 * 1. Lit l'ID de l'exercice depuis l'URL (?id=slug)
 * 2. Charge les données depuis localStorage via DB
 * 3. Affiche l'écran onboarding (saisie 1RM) ou la page principale
 * 4. Met à jour toutes les valeurs dynamiques : zones, graphique, historique
 */

document.addEventListener('DOMContentLoaded', () => {
  DB.init();

  /* ── 1. Identifier l'exercice ────────────────────────────── */
  const params = new URLSearchParams(location.search);
  const id     = params.get('id');

  // Pas d'ID → retour à la liste
  if (!id) { location.href = 'musculation.html'; return; }

  const exo = DB.getExercice(id);
  if (!exo) { location.href = 'musculation.html'; return; }

  /* ── 2. Peupler les champs statiques ────────────────────── */
  // Nom (onboarding + header)
  document.querySelectorAll('[data-exo-name]')
    .forEach(el => el.textContent = exo.nom);

  // Groupe musculaire + couleur
  const muscleEl = document.querySelector('[data-exo-muscle]');
  if (muscleEl) {
    muscleEl.textContent = exo.groupe;
    // Retire toute classe de couleur existante puis applique la bonne
    muscleEl.className = muscleEl.className
      .replace(/exercise-header__muscle--\S+/g, '').trim();
    if (exo.couleur) {
      muscleEl.classList.add('exercise-header__muscle--' + exo.couleur);
    }
  }

  /* ── 3. Décider quel écran afficher ─────────────────────── */
  const onboardingEl = document.getElementById('onboarding-screen');
  const pageEl       = document.getElementById('exercise-page');

  if (exo.rm) {
    // 1RM déjà connu → page principale directement
    showPage(exo);
  } else {
    // Première visite → onboarding
    onboardingEl.style.display = 'flex';
    pageEl.style.display       = 'none';
  }

  /* ── 4. Validation du formulaire 1RM ────────────────────── */
  const rmForm = document.getElementById('rm-form');
  if (rmForm) {
    rmForm.addEventListener('submit', e => {
      e.preventDefault();
      const val = parseFloat(document.getElementById('rm-value').value);
      if (!val || val <= 0) return;

      const updated = DB.setRM(id, val);
      showPage(updated);
    });
  }

  /* ── 5. Fonctions d'affichage ────────────────────────────── */

  function showPage(exo) {
    onboardingEl.style.display = 'none';
    pageEl.style.display       = 'flex';

    // RM dans le header
    document.querySelectorAll('[data-exo-rm] .rm-value')
      .forEach(el => el.textContent = exo.rm);

    // RM + date dans le bloc stats
    const rmStatEl = document.querySelector('.stat-hero .rm-value');
    if (rmStatEl) rmStatEl.textContent = exo.rm;

    const rmDateEl = document.querySelector('[data-rm-date]');
    if (rmDateEl && exo.rmDate) {
      rmDateEl.textContent = 'Mis à jour le ' +
        new Date(exo.rmDate).toLocaleDateString('fr-FR', {
          day: 'numeric', month: 'long', year: 'numeric'
        });
    }

    updateZones(exo.rm);
    renderChart(exo);
    renderHistorique(exo);
  }

  /**
   * Met à jour les poids affichés dans chaque carte de zone.
   * Arrondit au 2,5 kg le plus proche (pratique en salle).
   */
  function updateZones(rm) {
    [50, 60, 70, 75, 80, 85, 90, 100].forEach(pct => {
      const raw    = rm * pct / 100;
      const weight = Math.round(raw / 2.5) * 2.5;
      const el     = document.querySelector(`[data-zone-weight="${pct}"]`);
      if (el) el.innerHTML = `${weight} <small>kg</small>`;
    });
  }

  /**
   * Construit le graphique d'évolution du 1RM.
   * Points = séances avec un poids enregistré + 1RM actuel.
   */
  function renderChart(exo) {
    const barsEl   = document.querySelector('.chart-bars');
    const labelsEl = document.querySelector('.chart-labels');
    const gridEl   = document.querySelector('.chart-grid');
    if (!barsEl || !labelsEl) return;

    // Construire les points du plus ancien au plus récent
    const points = [...exo.historique]
      .filter(e => e.poids)
      .reverse()
      .map(e => ({ date: new Date(e.date), poids: e.poids }));

    // Ajouter le 1RM actuel comme dernier point s'il n'y est pas déjà
    if (exo.rm) {
      const lastPoids = points.length ? points[points.length - 1].poids : null;
      if (lastPoids !== exo.rm) {
        points.push({
          date:   exo.rmDate ? new Date(exo.rmDate) : new Date(),
          poids:  exo.rm,
          isPeak: true,
        });
      } else {
        points[points.length - 1].isPeak = true;
      }
    }

    if (points.length === 0) {
      barsEl.innerHTML   = '<p class="chart-empty">Aucune donnée pour l\'instant.</p>';
      labelsEl.innerHTML = '';
      return;
    }

    const maxPoids = Math.max(...points.map(p => p.poids));

    // Mettre à jour les labels de grille Y
    if (gridEl) {
      const step = Math.ceil(maxPoids / 4 / 5) * 5; // paliers de 5 kg
      gridEl.innerHTML = [4, 3, 2, 1].map(i => {
        const val = i * step;
        const pos = Math.round(val / maxPoids * 100);
        return `<span class="chart-grid__line" style="--pos:${pos}%"><em>${val} kg</em></span>`;
      }).join('');
    }

    // Rendre les barres
    barsEl.innerHTML   = '';
    labelsEl.innerHTML = '';

    points.forEach(p => {
      const h = Math.round(p.poids / maxPoids * 100);

      const bar = document.createElement('div');
      bar.className   = 'chart-bar' + (p.isPeak ? ' chart-bar--peak' : '');
      bar.style.setProperty('--h', h + '%');
      bar.dataset.weight = p.poids;
      bar.innerHTML   = `<span class="chart-bar__tip">${p.poids}</span>`;
      barsEl.appendChild(bar);

      const lbl = document.createElement('span');
      lbl.textContent = p.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      labelsEl.appendChild(lbl);
    });

    // Tendance
    if (points.length >= 2) {
      const diff    = points[points.length - 1].poids - points[0].poids;
      const trendEl = document.querySelector('.rm-chart-block__trend');
      if (trendEl) {
        const up = diff >= 0;
        trendEl.className  = 'rm-chart-block__trend rm-chart-block__trend--' + (up ? 'up' : 'down');
        trendEl.textContent = (up ? '↑ +' : '↓ ') + Math.abs(diff) + ' kg';
      }
    }
  }

  /**
   * Rend la liste des entrées d'historique.
   */
  function renderHistorique(exo) {
    const listEl  = document.querySelector('.history-list');
    const countEl = document.querySelector('.history-header__count');
    if (!listEl) return;

    const entries = exo.historique;
    if (countEl) {
      countEl.textContent = entries.length + ' séance' + (entries.length !== 1 ? 's' : '');
    }

    if (entries.length === 0) {
      listEl.innerHTML = `
        <li class="history-empty">
          Aucune séance enregistrée pour cet exercice.
        </li>`;
      return;
    }

    listEl.innerHTML = entries.map(entry => {
      const d      = new Date(entry.date);
      const day    = d.toLocaleDateString('fr-FR', { day: '2-digit' });
      const month  = d.toLocaleDateString('fr-FR', { month: 'short' });
      const year   = d.getFullYear();

      // Couleur du badge poids
      let badgeClass = '';
      if (exo.rm) {
        if (entry.poids >= exo.rm * 0.9) badgeClass = 'history-entry__weight-badge--max';
        else if (entry.poids >= exo.rm * 0.8) badgeClass = 'history-entry__weight-badge--heavy';
      }

      return `
        <li>
          <article class="history-entry">
            <div class="history-entry__date-col">
              <span class="history-entry__day">${day}</span>
              <span class="history-entry__month">${month}</span>
              <span class="history-entry__year">${year}</span>
            </div>
            <div class="history-entry__body">
              <div class="history-entry__title">${entry.titre || 'Séance'}</div>
              <div class="history-entry__stats">
                <span class="history-entry__stat">
                  <span class="history-entry__stat-icon">⚡</span>${entry.series} séries
                </span>
                <span class="history-entry__stat">
                  <span class="history-entry__stat-icon">↩</span>${entry.reps} reps
                </span>
                <span class="history-entry__stat">
                  <span class="history-entry__stat-icon">⏱</span>${entry.repos}
                </span>
              </div>
              ${entry.poids
                ? `<div class="history-entry__weight-badge ${badgeClass}">${entry.poids} kg</div>`
                : ''}
            </div>
          </article>
        </li>`;
    }).join('');
  }

});
