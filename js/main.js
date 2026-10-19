/* =====================================================================
   Numéville 3D — écran d'accueil et démarrage de la partie
   ===================================================================== */

(function () {
  const config = { nb: 2, niveau: 'standard', joueurs: [] };
  const ordreEcl = ['ana', 'tom', 'emily', 'hakim'];
  const nomsParDefaut = ['Joueur 1', 'Joueur 2', 'Joueur 3', 'Joueur 4'];

  function majSeuils() {
    const [b, r] = NV.SEUILS[config.nb][config.niveau];
    document.querySelector('#seuils').innerHTML = `Un Complice est <b>sauvé à ${b} 🔵</b> et <b>perdu à ${r} 🔴</b>.`;
    document.querySelectorAll('#niveaux button').forEach((btn) => {
      const [bb, rr] = NV.SEUILS[config.nb][btn.dataset.niveau];
      btn.querySelector('small').textContent = `${bb} 🔵 · ${rr} 🔴`;
    });
  }

  function rendreJoueurs() {
    // conserve les saisies existantes
    while (config.joueurs.length < config.nb) {
      const pris = config.joueurs.map((j) => j.eclaireur);
      config.joueurs.push({ nom: nomsParDefaut[config.joueurs.length], eclaireur: ordreEcl.find((e) => !pris.includes(e)) });
    }
    config.joueurs.length = config.nb;
    const zone = document.querySelector('#liste-joueurs');
    zone.innerHTML = '';
    config.joueurs.forEach((j, i) => {
      const ligne = document.createElement('div');
      ligne.className = 'ligne-joueur';
      ligne.style.setProperty('--c', NV.ECLAIREURS[j.eclaireur].couleur);
      ligne.innerHTML = `<label class="num">${i + 1}</label>
        <input type="text" maxlength="16" value="${j.nom.replace(/"/g, '&quot;')}" aria-label="Nom du joueur ${i + 1}">
        <div class="eclaireurs">${ordreEcl.map((id) => {
          const e = NV.ECLAIREURS[id];
          const pris = config.joueurs.some((x, k) => k !== i && x.eclaireur === id);
          return `<button type="button" class="ecl ${j.eclaireur === id ? 'choisi' : ''}" data-id="${id}" ${pris ? 'disabled' : ''} style="--c:${e.couleur}" title="${e.nom} — ${e.desc}"><img src="assets/img/eclaireur-${id}.jpg" alt=""><span>${e.nom}</span></button>`;
        }).join('')}</div>`;
      ligne.querySelector('input').addEventListener('input', (ev) => { j.nom = ev.target.value; });
      ligne.querySelectorAll('.ecl').forEach((b) => b.addEventListener('click', () => { j.eclaireur = b.dataset.id; rendreJoueurs(); }));
      zone.appendChild(ligne);
    });
    majSeuils();
  }

  function initAccueil() {
    document.querySelectorAll('#nb-joueurs button').forEach((b) => b.addEventListener('click', () => {
      config.nb = +b.dataset.nb;
      document.querySelectorAll('#nb-joueurs button').forEach((x) => x.classList.toggle('choisi', x === b));
      rendreJoueurs();
    }));
    document.querySelectorAll('#niveaux button').forEach((b) => b.addEventListener('click', () => {
      config.niveau = b.dataset.niveau;
      document.querySelectorAll('#niveaux button').forEach((x) => x.classList.toggle('choisi', x === b));
      majSeuils();
    }));
    rendreJoueurs();
  }

  function demarrer() {
    if (!window.THREE || !window.NV_ADDONS) return;
    const ui = new Interface();
    const plateau = new Plateau3D(document.querySelector('#scene'));
    window.__plateau = plateau;
    ui.plateau = plateau;

    // Cinématiques : activées par défaut (sauf si le système demande moins d'animations)
    const bCine = document.querySelector('#btn-cine');
    try { const v = localStorage.getItem('numeville-cinematiques'); if (v !== null) plateau.cinematiques = v === '1'; } catch (e) { /* stockage indisponible */ }
    const majCine = () => {
      bCine.setAttribute('aria-pressed', String(plateau.cinematiques));
      bCine.title = plateau.cinematiques ? 'Cinématiques activées (cliquer pour les couper)' : 'Cinématiques coupées (cliquer pour les activer)';
    };
    majCine();
    bCine.addEventListener('click', () => {
      plateau.cinematiques = !plateau.cinematiques;
      try { localStorage.setItem('numeville-cinematiques', plateau.cinematiques ? '1' : '0'); } catch (e) { /* stockage indisponible */ }
      majCine();
    });

    document.querySelector('#btn-regles').addEventListener('click', () => ui.regles());
    document.querySelector('#btn-regles-accueil').addEventListener('click', () => ui.regles());
    document.querySelector('#btn-vue').addEventListener('click', () => plateau.vueDefaut());
    const bSon = document.querySelector('#btn-son');
    bSon.addEventListener('click', () => { plateau.muet = !plateau.muet; bSon.textContent = plateau.muet ? '🔇' : '🔊'; });
    document.querySelector('#btn-journal').addEventListener('click', () => document.body.classList.toggle('journal-ouvert'));

    document.querySelector('#btn-jouer').addEventListener('click', () => {
      const joueurs = config.joueurs.map((j, i) => ({ nom: (j.nom || '').trim() || nomsParDefaut[i], eclaireur: j.eclaireur }));
      document.querySelector('#accueil').classList.add('cache');
      document.body.classList.add('en-jeu');
      const jeu = new Jeu({ joueurs, niveau: config.niveau }, plateau, ui);
      window.__jeu = jeu;
      jeu.lancer().catch((e) => { console.error(e); ui.log(`<b>Erreur :</b> ${e.message}`); });
    });
    document.querySelector('#chargement').classList.add('cache');
  }

  initAccueil();
  if (window.THREE && window.NV_ADDONS) demarrer();
  else window.addEventListener('three-pret', demarrer, { once: true });
  setTimeout(() => {
    if (!window.THREE) {
      document.querySelector('#chargement').innerHTML = `<div class="erreur"><h2>Three.js n’a pas pu être chargé</h2>
        <p>Le jeu télécharge la bibliothèque 3D Three.js depuis internet (cdn.jsdelivr.net) au démarrage.<br>
        Vérifie ta connexion internet puis recharge la page.</p></div>`;
    }
  }, 12000);
})();
