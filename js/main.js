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

  /* ---------------- son : réglages et déverrouillage ---------------- */
  function initAudio() {
    const A = window.NV_AUDIO;
    const panneau = document.querySelector('#panneau-audio');
    const bSon = document.querySelector('#btn-son');
    const champs = ['general', 'musique', 'effets'];
    const majIcone = () => {
      const muet = A.reglages.muet || A.reglages.general === 0;
      bSon.textContent = muet ? '🔇' : '🔊';
      bSon.title = muet ? 'Son coupé — réglages du son' : 'Réglages du son';
    };
    for (const k of champs) {
      const input = document.querySelector('#vol-' + k), out = document.querySelector('#val-' + k);
      input.value = Math.round(A.reglages[k] * 100);
      out.textContent = input.value + ' %';
      input.addEventListener('input', () => {
        out.textContent = input.value + ' %';
        A.deverrouiller();
        A.regler(k, input.value / 100);
        if (k === 'effets') A.effet('jetonBleu'); // aperçu du volume des effets
        majIcone();
      });
    }
    // choix du morceau
    document.querySelectorAll('input[name="piste"]').forEach((r) => {
      r.checked = r.value === (A.reglages.piste || 'neons');
      r.addEventListener('change', () => {
        if (!r.checked) return;
        A.deverrouiller();
        A.demarrerMusique();
        A.choisirPiste(r.value);
      });
    });
    const muet = document.querySelector('#son-muet');
    muet.checked = A.reglages.muet;
    muet.addEventListener('change', () => { A.regler('muet', muet.checked); majIcone(); });
    majIcone();

    let ouvreur = null;
    const ouvrir = (e) => {
      ouvreur = e.currentTarget;
      panneau.hidden = !panneau.hidden;
      if (!panneau.hidden) document.querySelector('#vol-general').focus();
    };
    const fermer = () => { panneau.hidden = true; if (ouvreur) ouvreur.focus(); };
    bSon.addEventListener('click', ouvrir);
    document.querySelector('#btn-son-accueil').addEventListener('click', ouvrir);
    document.querySelector('#fermer-audio').addEventListener('click', fermer);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !panneau.hidden) { fermer(); e.stopPropagation(); }
      if ((e.key === 'm' || e.key === 'M') && e.target.tagName !== 'INPUT') {
        muet.checked = !muet.checked; A.regler('muet', muet.checked); majIcone();
      }
    });
    document.addEventListener('pointerdown', (e) => {
      if (!panneau.hidden && !panneau.contains(e.target) && e.target !== bSon && e.target.id !== 'btn-son-accueil') panneau.hidden = true;
    });

    // Les navigateurs n'autorisent le son qu'après une action de l'utilisateur :
    // au premier clic ou à la première touche, on démarre l'audio et la musique d'ambiance.
    const premierGeste = () => {
      A.deverrouiller();
      A.demarrerMusique();
      window.removeEventListener('pointerdown', premierGeste);
      window.removeEventListener('keydown', premierGeste);
    };
    window.addEventListener('pointerdown', premierGeste);
    window.addEventListener('keydown', premierGeste);

    // petit clic sonore sur les boutons
    document.addEventListener('click', (e) => {
      if (e.target.closest('button, .option') && !e.target.closest('#panneau-audio')) A.effet('clic');
    });
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
    document.querySelector('#btn-vue').addEventListener('click', () => {
      // recentre sur le joueur actif pendant la partie, sinon vue d'ensemble
      if (window.__jeu && window.__jeu.joueurActif) plateau.vueJoueur(window.__jeu.joueurActif, 700); else plateau.vueDefaut();
    });
    initAudio();
    document.querySelector('#btn-journal').addEventListener('click', () => document.body.classList.toggle('journal-ouvert'));

    document.querySelector('#btn-jouer').addEventListener('click', () => {
      // les noms sont affichés dans la page : on retire les caractères qui pourraient y injecter du HTML
      const propre = (s) => (s || '').replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
      const joueurs = config.joueurs.map((j, i) => ({ nom: propre(j.nom) || nomsParDefaut[i], eclaireur: j.eclaireur }));
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
