/* =====================================================================
   Numéville 3D — jeu en ligne entre amis (Firebase Realtime Database)

   Principe : chaque joueur fait tourner le même moteur de règles (js/jeu/)
   chez lui. Les dés et les pioches viennent d'une graine partagée (NV_alea),
   donc seules les DÉCISIONS des joueurs circulent sur le réseau : chaque clic
   sur un bouton du jeu devient une entrée numérotée « clics/n ». Tous les
   navigateurs rejouent ces clics dans le même ordre et restent synchronisés.

   • Seul le joueur qui doit décider (le joueur actif, ou le détenteur d'une
     carte jouée hors de son tour) peut cliquer ; les autres voient la même
     fenêtre avec les boutons grisés et « C'est à … de jouer ».
   • Un joueur qui recharge la page rejoint la partie : les clics déjà joués
     sont rejoués en accéléré (rattrapage).
   • Un joueur déconnecté met la partie en pause ; au bout de 2 minutes, un
     autre joueur peut reprendre son Éclaireur. À son retour, il reprend la main.

   Données (parties/CODE) : hote, cree, etat (salon | jeu | fini), reglages,
   membres/uid, config (joueurs, niveau, avance, graine), controle/i, clics/n.
   ===================================================================== */

(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sans 0/O ni 1/I/L, faciles à confondre
  const ORDRE_ECL = ['ana', 'tom', 'emily', 'hakim'];
  const PAUSE_MS = window.NV_PAUSE_MS || 120000; // délai avant de pouvoir reprendre l'Éclaireur d'un absent
  const EXPIRATION_MS = 24 * 3600e3; // une partie inactive depuis 24 h est ignorée
  const AFFICHAGE_MIN_MS = 650;     // durée minimale d'affichage d'une fenêtre chez les autres joueurs
  const CLE_SALLE = 'numeville-salle';
  const CLE_NOM = 'numeville-prenom';
  const CLE_REVANCHE = 'numeville-revanche'; // « Rejouer avec le même groupe » : salon à rejoindre après rechargement

  const stock = {
    lire(cle, session) { try { return (session ? sessionStorage : localStorage).getItem(cle); } catch (e) { return null; } },
    ecrire(cle, v, session) { try { const s = session ? sessionStorage : localStorage; if (v === null) s.removeItem(cle); else s.setItem(cle, v); } catch (e) { /* stockage indisponible */ } },
  };
  const echapper = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  /* ===================== connexion à Firebase (à la demande) ===================== */
  let connexion = null;
  function backend() {
    if (!connexion) {
      const url = new URL('js/reseau/backend-firebase.js', document.baseURI).href;
      connexion = import(url)
        .then((m) => m.connecter(window.NV_FIREBASE_CONFIG, window.NV_FIREBASE_SDK))
        .catch((e) => { connexion = null; throw e; });
    }
    return connexion;
  }

  function nouveauCode() {
    const t = new Uint32Array(5);
    crypto.getRandomValues(t);
    return Array.from(t, (x) => ALPHABET[x % ALPHABET.length]).join('');
  }

  /* ===================== état de la salle ===================== */
  const S = {
    fb: null, code: null, uid: null,
    salle: {},              // copie locale : hote, etat, reglages, membres, config, controle, cree
    arrets: [],             // désabonnements Firebase
    synchro: null,          // synchronisation de la partie, une fois lancée
  };
  const chemin = (suite = '') => `parties/${S.code}${suite ? '/' + suite : ''}`;
  const estHote = () => S.salle.hote === S.uid;
  const membresTries = () => Object.entries(S.salle.membres || {})
    .map(([uid, m]) => ({ uid, ...m }))
    .sort((a, b) => (a.rejoint || 0) - (b.rejoint || 0) || (a.uid < b.uid ? -1 : 1));
  const enLigne = (uid) => !!(S.salle.membres && S.salle.membres[uid] && S.salle.membres[uid].en_ligne);

  function message(texte, type = '') {
    const m = $('#el-message');
    m.className = type;
    m.innerHTML = texte || '';
  }

  /* ===================== écran d'accueil : sur cet écran / en ligne ===================== */
  function choisirMode(mode) {
    document.querySelectorAll('#modes button').forEach((b) => {
      const oui = b.dataset.mode === mode;
      b.classList.toggle('choisi', oui);
      b.setAttribute('aria-pressed', String(oui));
    });
    $('#bloc-local').hidden = mode !== 'local';
    $('#bloc-enligne').hidden = mode !== 'enligne';
    $('#btn-jouer').hidden = mode !== 'local';
  }

  function initAccueil() {
    document.querySelectorAll('#modes button').forEach((b) => b.addEventListener('click', () => choisirMode(b.dataset.mode)));
    const nom = $('#el-nom'), code = $('#el-code');
    nom.value = stock.lire(CLE_NOM) || '';
    nom.addEventListener('input', () => stock.ecrire(CLE_NOM, NV_nomPropre(nom.value)));
    code.addEventListener('input', () => {
      const p = code.selectionStart;
      code.value = code.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
      code.setSelectionRange(p, p);
    });
    code.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#el-rejoindre').click(); } });
    $('#el-creer').addEventListener('click', () => entrer('creer'));
    $('#el-rejoindre').addEventListener('click', () => entrer('rejoindre'));

    // lien partagé : ?salle=CODE
    const param = new URLSearchParams(location.search).get('salle');
    if (param) {
      choisirMode('enligne');
      code.value = param.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
      message(`Tu es invité·e dans la partie <b>${echapper(code.value)}</b> : entre ton prénom puis clique sur « Rejoindre ».`);
      (nom.value ? $('#el-rejoindre') : nom).focus();
    }
    // « Rejouer avec le même groupe » : on rejoint le nouveau salon proposé par un joueur
    let revanche = null;
    try { revanche = JSON.parse(stock.lire(CLE_REVANCHE, true) || 'null'); } catch (e) { /* ignoré */ }
    stock.ecrire(CLE_REVANCHE, null, true);
    if (revanche && revanche.code) {
      choisirMode('enligne');
      nom.value = NV_nomPropre(revanche.nom) || nom.value;
      code.value = revanche.code;
      entrer('revanche', revanche.eclaireur);
      return;
    }
    // rechargement de la page pendant une partie en ligne : on la rejoint automatiquement
    const reprise = stock.lire(CLE_SALLE, true);
    if (reprise) {
      choisirMode('enligne');
      code.value = reprise;
      entrer('reprendre');
    }
  }

  function occupe(oui) {
    for (const id of ['#el-creer', '#el-rejoindre']) $(id).disabled = oui;
    document.body.classList.toggle('el-occupe', oui);
  }

  /** Créer, rejoindre ou reprendre une partie. */
  async function entrer(action, eclairePrefere) {
    const prenom = NV_nomPropre($('#el-nom').value);
    if (action !== 'reprendre' && !prenom) { message('Entre d’abord ton prénom.', 'erreur'); $('#el-nom').focus(); return; }
    const code = $('#el-code').value.trim().toUpperCase();
    if (action === 'rejoindre' && code.length !== 5) { message('Le code d’une partie contient 5 caractères.', 'erreur'); $('#el-code').focus(); return; }
    if (location.protocol === 'file:') {
      message('Le jeu en ligne fonctionne depuis le site publié (GitHub Pages) ou un petit serveur local, pas en ouvrant <code>index.html</code> directement.', 'erreur');
      return;
    }
    occupe(true);
    message(action === 'creer' ? 'Création de la partie…' : action === 'revanche' ? 'Connexion au nouveau salon…' : 'Connexion à la partie…');
    try {
      S.fb = await backend();
      S.uid = S.fb.uid;
    } catch (e) {
      console.error(e);
      occupe(false);
      message('Impossible de se connecter au service de jeu en ligne. Vérifie ta connexion internet (ou un bloqueur de contenu) puis réessaie.', 'erreur');
      return;
    }
    try {
      if (action === 'creer') await creer(prenom);
      else if (action === 'revanche') {
        // le salon peut mettre un instant à être créé par celui qui a proposé de rejouer
        for (let essai = 0; ; essai++) {
          try { await rejoindre(code, prenom, false, eclairePrefere); break; } catch (e) {
            if (essai >= 8 || e.message !== 'entrée refusée') throw e;
            await new Promise((r) => setTimeout(r, 1500));
          }
        }
      } else await rejoindre(code, prenom, action === 'reprendre');
    } catch (e) {
      console.warn(e);
      occupe(false);
      S.code = null;
      if (action === 'reprendre') { stock.ecrire(CLE_SALLE, null, true); message(''); return; }
      message(e.messageJoueur || 'Une erreur est survenue. Réessaie dans un instant.', 'erreur');
    }
  }

  /**
   * Crée une salle dont on est l'hôte.
   * @param {{code?:string, eclaireur?:string, reglages?:{niveau:string, avance:boolean}, sansSuivre?:boolean}} [opt]
   *   options d'une revanche : code déjà annoncé aux autres, même Éclaireur, mêmes réglages
   */
  async function creer(prenom, opt = {}) {
    for (let essai = 0; essai < 5; essai++) {
      const code = (essai === 0 && opt.code) || nouveauCode();
      const t = S.fb.heureServeur();
      try {
        await S.fb.ecrire(`parties/${code}`, {
          hote: S.uid, cree: t, etat: 'salon',
          reglages: opt.reglages || { niveau: 'standard', avance: false },
          membres: { [S.uid]: { nom: prenom, eclaireur: opt.eclaireur || 'ana', en_ligne: true, rejoint: t } },
        });
        if (opt.sansSuivre) return code;
        S.code = code;
        await suivre();
        return code;
      } catch (e) {
        console.warn('Code déjà pris ou écriture refusée', e);
      }
    }
    const err = new Error('création impossible');
    err.messageJoueur = 'Impossible de créer la partie. Vérifie que les règles de la base Firebase sont bien publiées, puis réessaie.';
    throw err;
  }

  async function rejoindre(code, prenom, reprise, eclairePrefere) {
    S.code = code;
    const moi = chemin('membres/' + S.uid);
    try {
      if (reprise) await S.fb.ecrire(moi + '/en_ligne', true);
      else {
        // on garde son Éclaireur si on revient dans le même salon
        let ancien = null;
        try { ancien = await S.fb.lire(moi); } catch (e) { /* pas encore membre : lecture interdite */ }
        if (ancien) await S.fb.maj(moi, { nom: prenom, en_ligne: true });
        else await S.fb.ecrire(moi, { nom: prenom, eclaireur: '', en_ligne: true, rejoint: S.fb.heureServeur() });
      }
    } catch (e) {
      const err = new Error('entrée refusée');
      err.messageJoueur = `Impossible de rejoindre la partie <b>${echapper(code)}</b> : vérifie le code. La partie a peut-être déjà commencé (on ne peut plus la rejoindre en cours de route).`;
      throw err;
    }
    const salle = await S.fb.lire(chemin());
    if (!salle || salle.etat === 'fini' || (salle.cree && Date.now() - salle.cree > EXPIRATION_MS)) {
      const err = new Error('partie terminée');
      err.messageJoueur = 'Cette partie est terminée ou a expiré. Crée une nouvelle partie !';
      throw err;
    }
    if (salle.etat === 'salon') {
      const tries = Object.entries(salle.membres || {}).sort((a, b) => (a[1].rejoint || 0) - (b[1].rejoint || 0));
      if (tries.findIndex(([uid]) => uid === S.uid) >= 4) {
        await S.fb.ecrire(moi, null);
        const err = new Error('complète');
        err.messageJoueur = 'Cette partie est complète (4 joueurs maximum).';
        throw err;
      }
      // Éclaireur libre attribué d'office (on peut en changer dans le salon)
      const mien = salle.membres[S.uid];
      const pris = tries.filter(([uid]) => uid !== S.uid).map(([, m]) => m.eclaireur);
      if (!mien.eclaireur || pris.includes(mien.eclaireur)) {
        // revanche : on reprend son Éclaireur de la partie précédente s'il est libre
        const libre = [eclairePrefere, ...ORDRE_ECL].find((e) => e && ORDRE_ECL.includes(e) && !pris.includes(e));
        if (libre) await S.fb.ecrire(moi + '/eclaireur', libre);
      }
    }
    await suivre();
  }

  /** S'abonne à la salle (présence, salon, lancement, contrôle des Éclaireurs). */
  async function suivre() {
    stock.ecrire(CLE_SALLE, S.code, true);
    const lien = new URL(location.href);
    lien.search = '';
    lien.hash = '';
    history.replaceState(null, '', lien.pathname);

    // présence : « en ligne » tant que l'onglet est connecté, « hors ligne » sinon (écrit par le serveur)
    S.arrets.push(S.fb.etatConnexion((ok) => {
      if (!ok || !S.code) return;
      S.fb.surDeconnexion(chemin(`membres/${S.uid}/en_ligne`), false).catch(() => {});
      S.fb.ecrire(chemin(`membres/${S.uid}/en_ligne`), true).catch(() => {});
      if (S.synchro) S.synchro.reprendreMesEclaireurs();
    }));
    const erreur = (e) => console.warn('Écoute refusée', e);
    for (const cle of ['hote', 'etat', 'reglages', 'membres', 'config', 'controle', 'cree', 'suite']) {
      S.arrets.push(S.fb.ecouter(chemin(cle), (v) => { S.salle[cle] = v; majSalle(cle); }, erreur));
    }
    occupe(false);
    message('');
    $('#el-entree').hidden = true;
    $('#el-salon').hidden = false;
  }

  function quitterSalle(texte) {
    for (const f of S.arrets.splice(0)) { try { f(); } catch (e) { /* déjà arrêté */ } }
    stock.ecrire(CLE_SALLE, null, true);
    S.code = null;
    S.salle = {};
    $('#el-salon').hidden = true;
    $('#el-salon').innerHTML = '';
    $('#el-entree').hidden = false;
    message(texte || '');
  }

  /* ===================== salon d'attente ===================== */
  function majSalle(cle) {
    if (S.synchro) { S.synchro.majReseau(cle); return; }
    const s = S.salle;
    if (cle === 'etat' && s.etat === 'fini') { quitterSalle('L’hôte a fermé la partie.'); return; }
    if (s.etat === 'jeu' && s.config) { lancerPartie(); return; }
    if (s.membres && !s.membres[S.uid] && s.etat === 'salon') { quitterSalle('Tu as quitté la partie.'); return; }
    rendreSalon();
  }

  function joueursPrets() {
    const presents = membresTries().filter((m) => m.en_ligne);
    const ecl = presents.map((m) => m.eclaireur).filter(Boolean);
    if (presents.length < 2) return { ok: false, raison: 'Il faut au moins 2 joueurs connectés pour lancer la partie.' };
    if (presents.length > 4) return { ok: false, raison: '4 joueurs au maximum.' };
    if (ecl.length !== presents.length || new Set(ecl).size !== ecl.length) return { ok: false, raison: 'Chaque joueur doit choisir un Éclaireur différent.' };
    return { ok: true, presents };
  }

  function rendreSalon() {
    const zone = $('#el-salon');
    const s = S.salle;
    if (!s.membres || !s.reglages) { zone.innerHTML = '<p class="el-attente">Chargement du salon…</p>'; return; }
    const membres = membresTries();
    const moi = s.membres[S.uid] || {};
    const reg = s.reglages;
    const nb = Math.max(2, Math.min(4, membres.filter((m) => m.en_ligne).length));
    const seuils = NV.SEUILS[nb][reg.niveau];
    const lien = `${location.origin}${location.pathname}?salle=${S.code}`;

    const places = [];
    for (let i = 0; i < 4; i++) {
      const m = membres[i];
      if (!m) { places.push('<li class="vide"><span class="pastille-ecl"></span><span>En attente d’un joueur…</span></li>'); continue; }
      const e = m.eclaireur && NV.ECLAIREURS[m.eclaireur];
      places.push(`<li style="--c:${e ? e.couleur : '#5a6496'}" class="${m.en_ligne ? '' : 'absent'}">
        ${e ? `<img src="assets/img/eclaireur-${e.id}.jpg" alt="">` : '<span class="pastille-ecl"></span>'}
        <span class="qui"><b>${echapper(m.nom)}</b>${m.uid === S.uid ? ' <small>(toi)</small>' : ''}${m.uid === s.hote ? ' <small class="hote">👑 hôte</small>' : ''}</span>
        <span class="role">${e ? e.nom : 'choisit son Éclaireur…'}</span>
        <span class="etat-co" title="${m.en_ligne ? 'Connecté·e' : 'Déconnecté·e'}">${m.en_ligne ? '🟢' : '⚪'}</span></li>`);
    }

    const pris = membres.filter((m) => m.uid !== S.uid).map((m) => m.eclaireur);
    const ecls = ORDRE_ECL.map((id) => {
      const e = NV.ECLAIREURS[id];
      return `<button type="button" class="ecl ${moi.eclaireur === id ? 'choisi' : ''}" data-ecl="${id}" ${pris.includes(id) ? 'disabled' : ''} style="--c:${e.couleur}" title="${e.nom} — ${e.desc}" aria-pressed="${moi.eclaireur === id}"><img src="assets/img/eclaireur-${id}.jpg" alt=""><span>${e.nom}</span></button>`;
    }).join('');

    const niveaux = ['decouverte', 'standard', 'expert'].map((n) => {
      const [b, r] = NV.SEUILS[nb][n];
      return `<button type="button" data-niveau="${n}" class="${reg.niveau === n ? 'choisi' : ''}" ${reg.avance && n === 'decouverte' ? 'disabled title="Le mode avancé se joue en niveau Standard ou Expert"' : ''}>${NV.NIVEAUX[n]}<small>${b} 🔵 · ${r} 🔴</small></button>`;
    }).join('');
    const reglages = estHote() ? `
      <div class="segment niveaux" id="salon-niveaux">${niveaux}</div>
      <p class="salon-seuils">Un Complice est <b>sauvé à ${seuils[0]} 🔵</b> et <b>perdu à ${seuils[1]} 🔴</b>.</p>
      <label class="interrupteur" for="salon-avance">
        <input type="checkbox" id="salon-avance" ${reg.avance ? 'checked' : ''}>
        <span class="glissiere" aria-hidden="true"></span>
        <span class="interrupteur-texte"><b>Mode avancé</b> : cartes Objet et Pouvoir sur deux cases du plateau.<small>Se joue en niveau Standard ou Expert.</small></span>
      </label>` : `
      <p class="salon-resume">Niveau <b>${NV.NIVEAUX[reg.niveau]}</b> (sauvé à ${seuils[0]} 🔵, perdu à ${seuils[1]} 🔴) · Mode avancé : <b>${reg.avance ? 'oui' : 'non'}</b><br><small>Ces réglages sont choisis par l’hôte.</small></p>`;

    const pret = joueursPrets();
    zone.innerHTML = `
      <div class="salon-tete">
        <div>
          <h2>Salon d’attente</h2>
          <p>Partage ce code (ou le lien) avec tes amis :</p>
        </div>
        <div class="salon-code">
          <b aria-label="Code de la partie">${S.code}</b>
          <button type="button" class="btn" id="salon-copier" data-lien="${echapper(lien)}">🔗 Copier le lien</button>
        </div>
      </div>
      <div class="reglage"><h2>Joueurs <small>${membres.length} / 4</small></h2><ul class="salon-joueurs">${places.join('')}</ul></div>
      <div class="reglage"><h2>Ton Éclaireur</h2><div class="eclaireurs" id="salon-ecl">${ecls}</div></div>
      <div class="reglage"><h2>Réglages de la partie</h2>${reglages}</div>
      <div class="accueil-actions salon-actions">
        <button type="button" class="btn" id="salon-quitter">${estHote() ? 'Fermer la partie' : 'Quitter'}</button>
        ${estHote()
          ? `<button type="button" class="btn principal" id="salon-lancer" ${pret.ok ? '' : 'disabled'}>Lancer la partie</button>`
          : '<p class="el-attente">⏳ En attente du lancement par l’hôte…</p>'}
      </div>
      ${estHote() && !pret.ok ? `<p class="salon-info">${pret.raison}</p>` : ''}`;

    // événements
    zone.querySelectorAll('#salon-ecl .ecl').forEach((b) => b.addEventListener('click', () => {
      S.fb.ecrire(chemin(`membres/${S.uid}/eclaireur`), b.dataset.ecl).catch((e) => console.warn(e));
    }));
    $('#salon-copier', zone).addEventListener('click', async (e) => {
      const b = e.currentTarget;
      try { await navigator.clipboard.writeText(b.dataset.lien); b.textContent = '✅ Lien copié'; }
      catch (err) { prompt('Copie ce lien et envoie-le à tes amis :', b.dataset.lien); }
    });
    $('#salon-quitter', zone).addEventListener('click', async () => {
      try {
        if (estHote()) await S.fb.ecrire(chemin('etat'), 'fini');
        else await S.fb.ecrire(chemin('membres/' + S.uid), null);
      } catch (e) { console.warn(e); }
      quitterSalle();
    });
    if (estHote()) {
      zone.querySelectorAll('#salon-niveaux button').forEach((b) => b.addEventListener('click', () => {
        S.fb.ecrire(chemin('reglages/niveau'), b.dataset.niveau).catch((e) => console.warn(e));
      }));
      $('#salon-avance', zone).addEventListener('change', (e) => {
        const avance = e.target.checked;
        S.fb.maj(chemin('reglages'), { avance, niveau: avance && reg.niveau === 'decouverte' ? 'standard' : reg.niveau }).catch((err) => console.warn(err));
      });
      const bl = $('#salon-lancer', zone);
      if (bl) bl.addEventListener('click', lancerDepuisSalon);
    }
  }

  /** L'hôte fige la liste des joueurs (ordre d'arrivée = sens horaire) et lance la partie pour tout le monde. */
  async function lancerDepuisSalon() {
    const pret = joueursPrets();
    if (!pret.ok) return;
    const b = $('#salon-lancer');
    if (b) b.disabled = true;
    const joueurs = pret.presents.map((m) => ({ nom: NV_nomPropre(m.nom) || 'Éclaireur', eclaireur: m.eclaireur, uid: m.uid }));
    const graine = crypto.getRandomValues(new Uint32Array(1))[0] || 1;
    const controle = {};
    joueurs.forEach((j, i) => { controle[i] = j.uid; });
    try {
      await S.fb.maj(chemin(), {
        config: { niveau: S.salle.reglages.niveau, avance: !!S.salle.reglages.avance, graine, joueurs },
        controle,
        etat: 'jeu',
      });
    } catch (e) {
      console.error(e);
      message('Le lancement a échoué. Réessaie.', 'erreur');
      if (b) b.disabled = false;
    }
  }

  /* ===================== partie en ligne ===================== */
  /** Firebase rend une liste numérotée 0, 1, 2… comme un tableau, mais par prudence on accepte aussi un objet. */
  const enTableau = (x) => (Array.isArray(x) ? x : Object.keys(x || {}).sort((a, b) => a - b).map((k) => x[k])).filter(Boolean);

  async function lancerPartie() {
    if (S.synchro) return;
    const cfg = { ...S.salle.config, joueurs: enTableau(S.salle.config.joueurs) };
    S.synchro = new Synchro(cfg); // bloque les nouveaux lancements pendant la préparation
    if (!window.NV_APP) await new Promise((r) => window.addEventListener('nv-pret', r, { once: true }));
    // nombre de clics déjà joués : au-delà de 0, on rejoue la partie en accéléré
    let deja = 0;
    try { const c = await S.fb.lire(chemin('clics')); deja = c ? Object.keys(c).length : 0; } catch (e) { console.warn(e); }
    S.synchro.demarrer(deja);
  }

  class Synchro {
    constructor(cfg) {
      this.cfg = cfg;
      this.clics = [];      // clics reçus, par numéro
      this.prochain = 0;    // numéro du prochain clic à rejouer
      this.ctx = null;      // décision en cours
      this.envoi = false;   // un clic local est parti, on attend son retour
      this.absence = {};    // uid -> heure où on l'a vu se déconnecter
      this.mesPlaces = cfg.joueurs.map((j, i) => (j.uid === S.uid ? i : -1)).filter((i) => i >= 0);
    }

    demarrer(deja) {
      const { ui, plateau } = window.NV_APP;
      this.ui = ui;
      this.plateau = plateau;
      document.body.classList.add('en-ligne');
      $('#accueil').classList.add('cache');
      if (deja > 0) this.debutRattrapage(deja);
      this.envelopperInterface();
      this.installerCapture();
      this.construireHUD();
      this.reprendreMesEclaireurs();
      this.minuteur = setInterval(() => this.majPause(), 1000);
      S.arrets.push(S.fb.ecouterAjouts(chemin('clics'), (cle, v) => this.recevoir(+cle, v), (e) => console.warn(e)));
      S.arrets.push(S.fb.ecouterRetraits(chemin('clics'), () => this.desynchronise('clic annulé par le serveur')));
      const cfg = this.cfg;
      NV_demarrerPartie({
        joueurs: cfg.joueurs.map((j) => ({ nom: NV_nomPropre(j.nom) || 'Éclaireur', eclaireur: j.eclaireur })),
        niveau: cfg.niveau, avance: !!cfg.avance, graine: cfg.graine,
      }, (jeu) => { this.jeu = jeu; });
    }

    /* ---------- rattrapage (rechargement en cours de partie) ---------- */
    debutRattrapage(n) {
      this.rattrapage = n;
      window.NV_RATTRAPAGE = true;
      this.cineAvant = this.plateau.cinematiques;
      this.plateau.cinematiques = false;
      this.plateau.vitesse = 30;
      const v = document.createElement('div');
      v.id = 'el-rattrapage';
      v.innerHTML = '<div class="spinner"></div><p>Reprise de la partie en cours…</p><small></small>';
      document.body.appendChild(v);
    }
    majRattrapage() {
      if (!this.rattrapage) return;
      const v = $('#el-rattrapage small');
      if (v) v.textContent = `${Math.min(this.prochain, this.rattrapage)} / ${this.rattrapage} actions`;
      if (this.prochain >= this.rattrapage) {
        this.rattrapage = 0;
        window.NV_RATTRAPAGE = false;
        this.plateau.cinematiques = this.cineAvant;
        this.plateau.vitesse = 1;
        const el = $('#el-rattrapage');
        if (el) { el.classList.add('cache'); setTimeout(() => el.remove(), 500); }
        if (this.jeu) this.plateau.vueJoueur(this.jeu.decideur(), 700);
      }
    }

    /* ---------- qui décide ? ---------- */
    places() { return this.cfg.joueurs; }
    controleur(place) { return (S.salle.controle && S.salle.controle[place]) || this.cfg.joueurs[place].uid; }
    estAMoi(place) { return this.controleur(place) === S.uid; }
    nomPlace(place) { return NV_nomPropre(this.cfg.joueurs[place].nom); }

    /** Les Éclaireurs de ce navigateur reviennent à leur joueur quand il se reconnecte. */
    reprendreMesEclaireurs() {
      if (!S.salle.controle) return;
      for (const i of this.mesPlaces) {
        if (S.salle.controle[i] !== S.uid) S.fb.ecrire(chemin('controle/' + i), S.uid).catch((e) => console.warn(e));
      }
    }

    majReseau(cle) {
      if (cle === 'suite') this.majRevanche();
      if (cle === 'membres' || cle === 'controle') {
        this.majHUD();
        if (this.ctx) this.appliquerMode();
        this.majPause();
      }
    }

    /* ---------- interception des fenêtres du jeu ---------- */
    envelopperInterface() {
      const ui = this.ui;
      const conteneur = (nom) => (nom === 'action' ? ui.zoneActions : ui.modale);
      for (const nom of ['action', 'choisir', 'choisirCarteAGarder', 'choisirComplice', 'question', 'carteAvance', 'carteDM', 'revelerComplice']) {
        const original = ui[nom].bind(ui);
        ui[nom] = async (...args) => {
          const ctx = { nom, place: this.jeu.decideur().id, empreinte: this.jeu.empreinte(), conteneur: conteneur(nom), debut: performance.now(), fini: false };
          const p = original(...args); // la fenêtre est construite tout de suite
          this.ctx = ctx;
          this.appliquerMode();
          this.consommer();
          try { return await p; } finally {
            ctx.fini = true;
            if (this.ctx === ctx) this.ctx = null;
            this.envoi = false;
            document.body.classList.remove('a-toi');
          }
        };
      }
      // fin de partie : la salle est marquée terminée (un rechargement ne la reprend plus)
      const fin = ui.finPartie.bind(ui);
      ui.finPartie = (jeu) => {
        stock.ecrire(CLE_SALLE, null, true);
        S.fb.ecrire(chemin('etat'), 'fini').catch(() => {});
        clearInterval(this.minuteur);
        $('#el-pause')?.remove();
        ui.boutonsFin = [{ id: 'btn-revanche', label: '🔁 Rejouer avec le même groupe', principal: true, action: (b) => this.revanche(b) }];
        ui.noteFin = '';
        const r = fin(jeu);
        this.majRevanche();
        return r;
      };
    }

    /** Boutons « de jeu » d'une fenêtre (le bouton « En savoir plus » reste libre pour tout le monde). */
    boutons(ctx) {
      return Array.from(ctx.conteneur.querySelectorAll('button')).filter((b) => !b.classList.contains('savoir-plus'));
    }

    /** Débloque les boutons pour celui qui décide, les grise pour les autres, avec un message d'attente. */
    appliquerMode() {
      const ctx = this.ctx;
      if (!ctx) return;
      const moi = this.estAMoi(ctx.place) && !this.rattrapage;
      document.body.classList.toggle('a-toi', moi);
      for (const b of this.boutons(ctx)) {
        if (moi) {
          if (b.dataset.verrou) { if (b.dataset.verrou === 'actif') b.disabled = false; delete b.dataset.verrou; }
        } else if (!b.dataset.verrou) {
          b.dataset.verrou = b.disabled ? 'inactif' : 'actif';
          b.disabled = true;
        }
      }
      // message d'attente (jamais un bouton : l'ordre des boutons doit rester identique chez tous)
      ctx.conteneur.querySelectorAll('.el-tour').forEach((x) => x.remove());
      const hote = ctx.nom === 'action' ? ctx.conteneur : ctx.conteneur.querySelector('.boite');
      if (!hote || this.rattrapage) return;
      const div = document.createElement('div');
      div.className = 'el-tour' + (moi ? ' moi' : '');
      const qui = this.controleur(ctx.place);
      const nom = this.nomPlace(ctx.place);
      if (moi) div.innerHTML = this.cfg.joueurs[ctx.place].uid === S.uid ? '🎯 À toi de jouer !' : `🎯 Tu joues pour <b>${echapper(nom)}</b>`;
      else if (!enLigne(qui)) div.innerHTML = `📴 <b>${echapper(nom)}</b> est déconnecté·e… la partie l’attend.`;
      else {
        const pseudo = qui === this.cfg.joueurs[ctx.place].uid ? nom : `${NV_nomPropre((S.salle.membres[qui] || {}).nom)} (pour ${nom})`;
        div.innerHTML = `⏳ C’est à <b>${echapper(pseudo)}</b> de jouer…`;
      }
      if (ctx.nom === 'action') hote.appendChild(div); else hote.prepend(div);
    }

    /** Clics du joueur qui décide : envoyés au serveur, puis appliqués chez tout le monde (lui compris) à leur retour. */
    installerCapture() {
      const capte = (e) => {
        if (this.rejeu) return;
        const ctx = this.ctx;
        const b = e.target.closest('button');
        if (!ctx || !b || !ctx.conteneur.contains(b) || b.classList.contains('savoir-plus')) return;
        e.stopPropagation();
        e.preventDefault();
        if (!this.estAMoi(ctx.place) || this.rattrapage || this.envoi) return;
        const i = this.boutons(ctx).indexOf(b);
        if (i < 0 || b.disabled) return;
        this.envoi = true;
        const n = this.prochain;
        S.fb.ecrire(chemin('clics/' + n), { v: i, par: S.uid, h: ctx.empreinte, f: ctx.nom })
          .catch((err) => { console.warn('Clic refusé (déjà joué ?)', err); this.envoi = false; });
      };
      for (const z of [this.ui.zoneActions, this.ui.modale]) z.addEventListener('click', capte, true);
    }

    recevoir(n, clic) {
      if (!clic || typeof clic.v !== 'number') return;
      this.clics[n] = clic;
      // Firebase annonce aussitôt nos propres écritures, parfois pendant le clic d'origine :
      // on rejoue au tour suivant (un bouton ne peut pas être recliqué pendant son propre clic)
      setTimeout(() => this.consommer(), 0);
    }

    /** Rejoue les clics reçus, dans l'ordre, sur la fenêtre en cours. */
    consommer() {
      const ctx = this.ctx;
      const clic = this.clics[this.prochain];
      if (!ctx || ctx.fini || !clic || this.attenteAffichage) return;
      // chez les autres joueurs, une fenêtre reste visible un court instant avant de se fermer
      const reste = AFFICHAGE_MIN_MS - (performance.now() - ctx.debut);
      if (!this.rattrapage && !this.presse && clic.par !== S.uid && reste > 0) {
        this.attenteAffichage = setTimeout(() => { this.attenteAffichage = null; this.consommer(); }, reste);
        return;
      }
      if ((clic.h && clic.h !== ctx.empreinte) || (clic.f && clic.f !== ctx.nom)) {
        this.desynchronise(`clic ${this.prochain} : attendu ${clic.f} ${clic.h}, obtenu ${ctx.nom} ${ctx.empreinte}`);
        return;
      }
      const b = this.boutons(ctx)[clic.v];
      if (!b) { this.desynchronise(`clic ${this.prochain} : bouton ${clic.v} introuvable`); return; }
      this.prochain++;
      this.envoi = false;
      this.majRetard();
      if (b.dataset.verrou) { if (b.dataset.verrou === 'actif') b.disabled = false; delete b.dataset.verrou; }
      this.rejeu = true;
      try { b.click(); } finally { this.rejeu = false; }
      this.majRattrapage();
      // la fenêtre peut continuer (ex. « Continuer » après la réponse à une question) : on la reverrouille,
      // puis on traite le clic suivant quand le moteur de jeu a avancé
      setTimeout(() => { if (this.ctx === ctx && !ctx.fini) this.appliquerMode(); this.consommer(); }, 0);
    }

    /**
     * Un joueur en retard de plusieurs actions (onglet laissé en arrière-plan, téléphone lent) :
     * animations accélérées et cinématiques passées jusqu'à ce qu'il ait rattrapé les autres.
     */
    majRetard() {
      if (this.rattrapage) return;
      const retard = this.clics.length - this.prochain;
      if (retard >= 3 && !this.presse) {
        this.presse = true;
        this.cineAvant = this.plateau.cinematiques;
        this.plateau.cinematiques = false;
        this.plateau.vitesse = 6;
        if (this.plateau.enCinematique) this.plateau.passerCinematique();
      } else if (retard === 0 && this.presse) {
        this.presse = false;
        this.plateau.cinematiques = this.cineAvant;
        this.plateau.vitesse = 1;
      }
    }

    /* ---------- fin de partie : rejouer avec le même groupe ---------- */
    /**
     * Le premier qui clique crée un nouveau salon (mêmes réglages, il en devient l'hôte) et l'annonce
     * dans l'ancienne partie (« suite ») ; les autres y sont conduits en cliquant à leur tour.
     * Dans ce salon intermédiaire, chacun garde son Éclaireur s'il est libre et peut en changer.
     */
    async revanche(bouton) {
      bouton.disabled = true;
      const place = this.cfg.joueurs.find((j) => j.uid === S.uid);
      const nom = NV_nomPropre((place && place.nom) || (S.salle.membres?.[S.uid] || {}).nom) || 'Éclaireur';
      const eclaireur = place ? place.eclaireur : '';
      const aller = (code) => {
        stock.ecrire(CLE_REVANCHE, JSON.stringify({ code, nom, eclaireur }), true);
        stock.ecrire(CLE_SALLE, null, true);
        location.reload();
      };
      if (S.salle.suite && S.salle.suite.code) { aller(S.salle.suite.code); return; }
      const note = $('#fin-note');
      if (note) note.textContent = 'Création du nouveau salon…';
      const code = nouveauCode();
      try {
        await S.fb.ecrire(chemin('suite'), { code, par: S.uid }); // échoue si quelqu'un a déjà proposé de rejouer
      } catch (e) {
        const suite = await S.fb.lire(chemin('suite')).catch(() => null);
        if (suite && suite.code) { aller(suite.code); return; }
        bouton.disabled = false;
        if (note) note.textContent = 'Impossible de créer le nouveau salon. Vérifie que les règles Firebase sont à jour, puis réessaie.';
        return;
      }
      try {
        const nouveau = await creer(nom, { code, eclaireur, reglages: { niveau: this.cfg.niveau, avance: !!this.cfg.avance }, sansSuivre: true });
        stock.ecrire(CLE_SALLE, nouveau, true); // au rechargement, on entre directement dans son salon
        location.reload();
      } catch (e) {
        console.warn(e);
        bouton.disabled = false;
        if (note) note.textContent = 'Impossible de créer le nouveau salon. Réessaie dans un instant.';
      }
    }

    /** Quelqu'un a proposé de rejouer : le bouton de fin mène à son salon. */
    majRevanche() {
      const suite = S.salle.suite;
      const b = $('#btn-revanche');
      if (!suite || !suite.code || !b || suite.par === S.uid) return;
      const qui = NV_nomPropre((S.salle.membres?.[suite.par] || {}).nom) || 'Un joueur';
      b.textContent = `🔁 Rejoindre ${qui} dans le nouveau salon`;
      b.disabled = false;
      const note = $('#fin-note');
      if (note) note.textContent = `${qui} propose de rejouer : le salon vous attend (code ${suite.code}).`;
    }

    desynchronise(raison) {
      console.error('Numéville en ligne — désynchronisation :', raison);
      if (this.recharge) return;
      this.recharge = true;
      const n = +(stock.lire('numeville-resync', true) || 0);
      const div = document.createElement('div');
      div.id = 'el-pause';
      div.className = 'alerte';
      if (n >= 2) {
        div.innerHTML = '<p>⚠️ La partie s’est désynchronisée entre les joueurs. Recharge la page pour la reprendre.</p>';
        document.body.appendChild(div);
        return;
      }
      stock.ecrire('numeville-resync', String(n + 1), true);
      div.innerHTML = '<p>🔄 Petite désynchronisation : reprise de la partie…</p>';
      document.body.appendChild(div);
      setTimeout(() => location.reload(), 1500);
    }

    /* ---------- joueur déconnecté : pause, puis reprise de son Éclaireur ---------- */
    majPause() {
      const ctx = this.ctx;
      let div = $('#el-pause:not(.alerte)');
      const qui = ctx ? this.controleur(ctx.place) : null;
      // un joueur revenu repart de zéro s'il se déconnecte à nouveau plus tard
      for (const uid of Object.keys(this.absence)) if (enLigne(uid)) delete this.absence[uid];
      if (!ctx || this.rattrapage || enLigne(qui) || qui === S.uid) { if (div) div.remove(); return; }
      if (!this.absence[qui]) this.absence[qui] = Date.now();
      const reste = Math.max(0, PAUSE_MS - (Date.now() - this.absence[qui]));
      const nom = this.nomPlace(ctx.place);
      if (!div) { div = document.createElement('div'); div.id = 'el-pause'; document.body.appendChild(div); }
      const etat = reste > 0 ? `attente-${Math.ceil(reste / 1000)}` : 'reprise';
      if (div.dataset.etat === etat) return;
      div.dataset.etat = etat;
      if (reste > 0) {
        const s = Math.ceil(reste / 1000);
        div.innerHTML = `<p>📴 <b>${echapper(nom)}</b> s’est déconnecté·e. Partie en pause : on l’attend encore <b>${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}</b>.</p>`;
      } else {
        div.innerHTML = `<p>📴 <b>${echapper(nom)}</b> n’est pas revenu·e.</p><button type="button" class="btn principal">Jouer à sa place</button>`;
        div.querySelector('button').addEventListener('click', () => {
          S.fb.ecrire(chemin('controle/' + ctx.place), S.uid).catch((e) => console.warn(e));
        });
      }
    }

    /* ---------- barre du haut : code de la partie et joueurs connectés ---------- */
    construireHUD() {
      const z = document.createElement('div');
      z.id = 'el-hud';
      document.querySelector('#hud .hud-joueurs').appendChild(z);
      this.majHUD();
    }
    majHUD() {
      const z = $('#el-hud');
      if (!z) return;
      const moi = this.mesPlaces.length ? this.cfg.joueurs[this.mesPlaces[0]] : null;
      const pts = this.cfg.joueurs.map((j, i) => {
        const e = NV.ECLAIREURS[j.eclaireur];
        const ctrl = this.controleur(i);
        const co = enLigne(ctrl);
        const remplace = ctrl !== j.uid ? ` — joué par ${NV_nomPropre((S.salle.membres?.[ctrl] || {}).nom)}` : '';
        return `<i class="${co ? 'co' : 'deco'}" style="--c:${e.couleur}" title="${echapper(NV_nomPropre(j.nom))} : ${co ? 'connecté·e' : 'déconnecté·e'}${echapper(remplace)}"></i>`;
      }).join('');
      z.innerHTML = `<span class="el-code" title="Code de la partie en ligne">🌐 ${S.code}</span>${moi ? `<span class="el-moi">tu es ${NV.ECLAIREURS[moi.eclaireur].nom}</span>` : '<span class="el-moi">spectateur</span>'}<span class="el-points">${pts}</span>`;
    }
  }

  /* ===================== démarrage ===================== */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAccueil);
  else initAccueil();
})();
