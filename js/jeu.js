/* =====================================================================
   Numéville 3D — moteur de règles du jeu de base
   Fidèle au livret de règles Numéville (niveaux, tour de jeu, cases
   spéciales, cartes Dark Master, conditions de victoire et de défaite).
   L'interface (ui) et la scène 3D (plateau) sont injectées.
   ===================================================================== */

const melanger = (t) => {
  const a = t.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

class Jeu {
  /**
   * @param {{joueurs:{nom:string, eclaireur:string}[], niveau:string}} config
   */
  constructor(config, plateau, ui) {
    this.plateau = plateau;
    this.ui = ui;
    this.niveau = config.niveau;
    const nb = config.joueurs.length;
    [this.seuilBleu, this.seuilRouge] = NV.SEUILS[nb][config.niveau];

    this.joueurs = config.joueurs.map((j, i) => ({
      id: i, nom: j.nom, eclaireur: j.eclaireur,
      depart: i, case: null,           // null = encore sur sa case départ
      notification: false,             // carte « Notification sans fin »
      piegeClics: false,               // carte « Piège à clics »
      bonnes: 0, mauvaises: 0,         // statistiques de fin de partie
    }));

    this.complices = {};
    for (const id of NV.ORDRE_COMPLICES) this.complices[id] = { bleus: 0, rouges: 0, statut: 'actif' };

    // Pioches de questions : 25 faciles + 25 difficiles par Complice
    this.pioches = {};
    this.defausses = {};
    for (const id of NV.ORDRE_COMPLICES) {
      this.pioches[id] = {}; this.defausses[id] = { facile: [], difficile: [] };
      for (const niv of ['facile', 'difficile']) {
        this.pioches[id][niv] = melanger(window.NV_QUESTIONS.filter((q) => q.c === id && q.lvl === niv));
      }
    }
    this.piocheFin = melanger(NV.CARTES_FIN);
    this.piocheAttaque = melanger(NV.CARTES_ATTAQUE);
    this.defausseAttaque = [];

    this.manche = 0;
    this.effets = {};            // effets actifs pendant la manche en cours
    this.effetsProchains = {};   // effets programmés pour la manche suivante
    this.fin = null;             // résultat quand la partie est terminée
    this.ordre = this.joueurs.slice();
  }

  /* ===================== utilitaires ===================== */
  nomC(id) { return NV.COMPLICES[id].nom; }
  tagC(id) { return `<b class="tag-${id}">${this.nomC(id)}</b>`; }
  tagJ(j) { return `<b style="color:${NV.ECLAIREURS[j.eclaireur].couleur}">${j.nom}</b>`; }
  actifs(filtre = () => true) { return NV.ORDRE_COMPLICES.filter((id) => this.complices[id].statut === 'actif' && filtre(this.complices[id], id)); }
  compte(statut) { return NV.ORDRE_COMPLICES.filter((id) => this.complices[id].statut === statut).length; }
  sync() {
    if (!this.fin && window.NV_AUDIO) NV_AUDIO.definirFond(this.ambianceDeFond());
    this.plateau.majJetons(this.complices);
    this.plateau.majPioches(this.piocheFin.length, Math.min(this.piocheAttaque.length, 15));
    this.ui.majHUD(this);
  }

  /* ===================== audio ===================== */
  son(nom, opt) { if (window.NV_AUDIO) NV_AUDIO.effet(nom, opt); }
  ambiance(nom, mesures) { if (window.NV_AUDIO) NV_AUDIO.changerAmbiance(nom, mesures); }
  /** La musique se tend quand Numéville est en danger : un Complice perdu, ou à un jeton de l'être. */
  ambianceDeFond() {
    const danger = this.compte('perdu') > 0 || this.actifs((e) => e.rouges >= this.seuilRouge - 1).length > 0;
    return danger ? 'tension' : 'calme';
  }

  /* ===================== cinématiques ===================== */
  /** Joue une cinématique de la scène 3D avec bandes noires et légende (si activées). */
  async cine(sequence, titre, texte, couleur) {
    if (!this.plateau.cinematiques) return false;
    this.ui.cinemaDebut(titre, texte, couleur);
    try { await sequence(); } finally { this.ui.cinemaFin(); }
    return true;
  }
  /** Ramène la caméra à la vue de jeu après une cinématique. */
  async retourVue() {
    if (this.plateau._vue) await this.plateau.revenirVue(900);
  }

  /* ===================== jetons ===================== */
  async ajouter(id, couleur, n = 1, raison = '') {
    const c = this.complices[id];
    if (c.statut !== 'actif' || n <= 0) return;
    this.ui.log(`${couleur === 'bleu' ? '🔵' : '🔴'} ${n > 1 ? n + ' jetons' : '1 jeton'} ${couleur === 'bleu' ? 'bonne' : 'mauvaise'} pratique pour ${this.tagC(id)}${raison ? ' — ' + raison : ''}.`);
    for (let i = 0; i < n; i++) {
      if (c.statut !== 'actif') break;
      if (couleur === 'bleu') c.bleus++; else c.rouges++;
      this.sync();
      await this.verifierSeuils(id);
    }
  }

  async retirer(id, couleur, n = 1, raison = '') {
    const c = this.complices[id];
    if (c.statut !== 'actif') return 0;
    const cle = couleur === 'bleu' ? 'bleus' : 'rouges';
    const r = Math.min(n, c[cle]);
    c[cle] -= r;
    this.sync();
    if (r > 0) this.ui.log(`↩️ ${r} jeton${r > 1 ? 's' : ''} ${couleur === 'bleu' ? 'bonne' : 'mauvaise'} pratique retiré${r > 1 ? 's' : ''} à ${this.tagC(id)}${raison ? ' — ' + raison : ''}.`);
    else this.ui.log(`${this.tagC(id)} n’a aucun jeton ${couleur === 'bleu' ? 'bonne' : 'mauvaise'} pratique : sans effet.`);
    return r;
  }

  async verifierSeuils(id) {
    const c = this.complices[id];
    if (c.statut !== 'actif') return;
    let nouveau = null;
    if (c.bleus >= this.seuilBleu) nouveau = 'sauve';
    else if (c.rouges >= this.seuilRouge) nouveau = 'perdu';
    if (!nouveau) return;
    c.statut = nouveau;
    c.bleus = 0; c.rouges = 0;   // on retourne la fiche et on retire tous ses jetons
    this.sync();
    this.ui.log(nouveau === 'sauve'
      ? `✨ ${this.tagC(id)} est <b>SAUVÉ</b> : il redevient ${NV.COMPLICES[id].sauveNom} !`
      : `💀 ${this.tagC(id)} est <b>PERDU</b> : il bascule définitivement du côté obscur.`);
    const cp = NV.COMPLICES[id];
    this.son(nouveau === 'sauve' ? 'sauve' : 'perdu');
    if (nouveau === 'sauve') this.ambiance('lumineux', 2);
    await this.cine(() => this.plateau.cineComplice(id, nouveau),
      nouveau === 'sauve' ? `${cp.nom} est libéré·e !` : `${cp.nom} est perdu…`,
      nouveau === 'sauve' ? `Les bonnes pratiques ont eu raison du Dark Master : ${cp.nom} redevient ${cp.sauveNom}.` : 'Trop de mauvaises pratiques : il bascule définitivement du côté obscur.',
      nouveau === 'sauve' ? cp.couleur : '#ff3a44');
    await this.ui.revelerComplice(id, nouveau);
    await this.retourVue();
    this.verifierFin();
  }

  verifierFin() {
    if (this.fin) return;
    const s = this.compte('sauve'), p = this.compte('perdu');
    if (s === 4) this.fin = { type: 'totale' };
    else if (p >= 2) this.fin = { type: 'defaite', raison: '2 Complices sont perdus.' };
    else if (this.actifs().length === 0) this.fin = { type: s >= 3 ? 'victoire' : 'defaite', raison: 'Tous les Complices ont un sort scellé.' };
  }

  /* ===================== déplacement ===================== */
  occupee(idx, sauf) { return this.joueurs.some((j) => j !== sauf && j.case === idx); }

  /** Liste des cases parcourues pour n pas dans le sens dir (+1 horaire, -1 anti-horaire). */
  chemin(j, n, dir) {
    const L = NV.BOUCLE.length;
    const pas = [];
    let pos = j.case;
    for (let i = 0; i < n; i++) {
      pos = pos === null ? NV.DEPARTS[j.depart].entree : (pos + dir + L) % L;
      pas.push(pos);
    }
    // « si votre déplacement se termine sur une case occupée, rendez-vous à la prochaine case libre »
    let garde = 0;
    while (this.occupee(pos, j) && garde++ < L) { pos = (pos + dir + L) % L; pas.push(pos); }
    return pas;
  }

  /* ===================== questions ===================== */
  piocherQuestion(id, niveau) {
    let p = this.pioches[id][niveau];
    if (p.length === 0) {
      this.pioches[id][niveau] = p = melanger(this.defausses[id][niveau]);
      this.defausses[id][niveau] = [];
      this.ui.log(`La pioche ${niveau} de ${this.tagC(id)} est épuisée : on remélange la défausse.`);
    }
    const q = p.pop();
    this.defausses[id][niveau].push(q);
    return q;
  }

  async poserQuestion(j, id, niveau, contexte = {}) {
    const q = this.piocherQuestion(id, niveau);
    this.ui.log(`❓ ${this.tagJ(j)} pioche une question <b>${niveau}</b> de ${this.tagC(id)}.`);
    const bon = await this.ui.question(q, { joueur: j, complice: id, niveau, ...contexte });
    this.plateau.sonResultat(bon);
    if (bon) j.bonnes++; else j.mauvaises++;
    return bon;
  }

  async appliquerResultat(id, bon, mult, raison) {
    if (bon) { await this.ajouter(id, 'bleu', mult, raison); return; }
    let n = mult;
    if (this.effets.brouillard && !this.effets.brouillard.has(id)) {
      this.effets.brouillard.add(id);
      n += 1;
      this.ui.log(`🌫️ Brouillard sur Numéville : première mauvaise réponse pour ${this.tagC(id)}, +1 jeton.`);
    }
    await this.ajouter(id, 'rouge', n, raison);
  }

  /* ===================== déroulement ===================== */
  async lancer() {
    this.sync();
    for (const j of this.joueurs) { this.plateau.creerPion(j); this.plateau.placerPion(j); }
    this.ui.log(`🏙️ Bienvenue à Numéville ! Niveau <b>${NV.NIVEAUX[this.niveau]}</b> : un Complice est sauvé à <b>${this.seuilBleu}</b> 🔵 et perdu à <b>${this.seuilRouge}</b> 🔴.`);

    this.son('intro');
    if (window.NV_AUDIO) NV_AUDIO.demarrerMusique();
    await this.cine(() => this.plateau.cineIntro(), 'Numéville',
      'Le Dark Master et ses 4 Complices ont pris le contrôle de la ville. Éclaireurs, à vous de jouer !', '#38e1ff');

    await this.choisirPremierJoueur();

    while (!this.fin) {
      this.manche++;
      this.effets = this.effetsProchains;
      this.effetsProchains = {};
      this.ui.log(`<hr><b>— Manche ${this.manche} —</b>`);
      if (this.effets.nuitBlanche) this.ui.log('🌙 Nuit blanche sur les écrans est active pendant cette manche.');
      if (this.effets.brouillard) this.ui.log('🌫️ Brouillard sur Numéville est actif pendant cette manche.');
      this.sync();
      for (const j of this.ordre) {
        await this.tour(j);
        this.verifierFin();
        if (this.fin) break;
      }
      if (this.fin) break;
      await this.finDeManche();
    }
    this.plateau.cacherDestinations();
    const gagne = this.fin.type !== 'defaite';
    this.son(gagne ? 'victoire' : 'defaite');
    this.ambiance(gagne ? 'lumineux' : 'sombre');
    await this.cine(() => this.plateau.cineFin(gagne),
      gagne ? (this.fin.type === 'totale' ? 'Numéville est libérée !' : 'Numéville résiste !') : 'Le Dark Master l’emporte…',
      gagne ? 'Les Éclaireurs ont propagé les bonnes pratiques dans toute la ville.' : 'La ville reste sous son emprise. La prochaine fois sera la bonne !',
      gagne ? '#38e1ff' : '#ff3a44');
    await this.ui.finPartie(this);
  }

  async choisirPremierJoueur() {
    let candidats = this.joueurs.slice();
    await this.ui.action('Chaque joueur lance le dé blanc : le plus haut score commence.', [{ label: '🎲 Lancer pour désigner le premier joueur', valeur: 1, principal: true }]);
    while (candidats.length > 1) {
      const scores = [];
      for (const j of candidats) {
        this.plateau.montrerJoueurActif(j);
        const v = await this.plateau.lancerDe('blanc');
        scores.push(v);
        this.ui.log(`🎲 ${this.tagJ(j)} fait <b>${v}</b>.`);
      }
      const max = Math.max(...scores);
      const gagnants = candidats.filter((_, i) => scores[i] === max);
      if (gagnants.length > 1) this.ui.log('Égalité : les joueurs concernés relancent.');
      candidats = gagnants;
    }
    const premier = candidats[0];
    const i = this.joueurs.indexOf(premier);
    this.ordre = this.joueurs.slice(i).concat(this.joueurs.slice(0, i));
    this.ui.log(`${this.tagJ(premier)} commence. On joue ensuite dans le sens horaire.`);
  }

  async tour(j) {
    this.joueurActif = j;
    this.ui.majHUD(this);
    this.plateau.montrerJoueurActif(j);
    const piege = j.piegeClics; j.piegeClics = false;
    const bloque = j.notification; j.notification = false;

    /* ---- 1. Déplacement (dé blanc) ---- */
    if (bloque && j.case !== null) {
      this.ui.log(`🔔 Notification sans fin : ${this.tagJ(j)} ne lance pas le dé blanc et reste dans son quartier.`);
      await this.ui.action(`${j.nom} est bloqué par une notification sans fin : il reste sur sa case.`, [{ label: 'Continuer', valeur: 1, principal: true }]);
    } else {
      await this.ui.action(`À ${j.nom} de jouer : lance le dé blanc pour te déplacer.`, [{ label: '🎲 Lancer le dé blanc', valeur: 1, principal: true, raccourci: ' ' }]);
      const n = await this.plateau.lancerDe('blanc');
      const ch = { 1: this.chemin(j, n, 1), [-1]: this.chemin(j, n, -1) };
      const dH = ch[1][ch[1].length - 1], dA = ch[-1][ch[-1].length - 1];
      this.plateau.montrerDestinations([dH, dA], ['#38e1ff', '#ff4fd8']);
      const dir = await this.ui.action(`Dé blanc : <b>${n}</b>. Dans quel sens ${j.nom} avance-t-il ?`, [
        { label: `↻ Sens horaire → ${this.descCase(dH)}`, valeur: 1, couleur: '#38e1ff' },
        { label: `↺ Anti-horaire → ${this.descCase(dA)}`, valeur: -1, couleur: '#ff4fd8' },
      ]);
      this.plateau.cacherDestinations();
      const chemin = ch[dir];
      if (chemin.length > n) this.ui.log('La case d’arrivée était occupée : le pion avance jusqu’à la prochaine case libre.');
      await this.plateau.deplacerPion(j, chemin);
      j.case = chemin[chemin.length - 1];
      this.ui.log(`🚶 ${this.tagJ(j)} avance de ${n} (${dir === 1 ? 'horaire' : 'anti-horaire'}) et arrive sur ${this.descCase(j.case)}.`);
    }

    /* ---- 2. Question / action (dé noir) ---- */
    const caseJ = NV.BOUCLE[j.case];
    if (caseJ.type === 'place') {
      const choix = this.actifs();
      if (!choix.length) return;
      const id = await this.ui.choisirComplice('La Place', `${j.nom} est sur la Place : choisis le Complice pour qui tu réponds à une <b>question difficile</b> (sans lancer le dé noir).`, choix, this);
      this.complicePlace = id;
      const bon = await this.poserQuestion(j, id, 'difficile', { place: true });
      await this.appliquerResultat(id, bon, 1);
      return;
    }

    const id = caseJ.c;
    if (this.complices[id].statut !== 'actif') {
      this.ui.log(`Le sort de ${this.tagC(id)} est déjà scellé : pas de question dans ce quartier.`);
      await this.ui.action(`${this.nomC(id)} est déjà ${this.complices[id].statut === 'sauve' ? 'sauvé' : 'perdu'} : on ne répond plus à ses questions. Fin du tour de ${j.nom}.`, [{ label: 'Joueur suivant', valeur: 1, principal: true }]);
      return;
    }
    const face = caseJ.type === 'face';
    if (face) {
      this.ui.log(`⚔️ Face-à-face avec ${this.tagC(id)} : le résultat de la question compte double !`);
      this.son('face');
      await this.cine(() => this.plateau.cineFaceAFace(j, id), `Face-à-face avec ${this.nomC(id)}`,
        'Le résultat de cette question comptera double.', NV.COMPLICES[id].couleur);
      await this.retourVue();
    }

    await this.ui.action(`${j.nom} est dans le quartier de ${this.nomC(id)}${face ? ' (face-à-face : résultat doublé)' : ''}. Lance le dé noir.`, [{ label: '🎲 Lancer le dé noir', valeur: 1, principal: true, raccourci: ' ' }]);
    const d = await this.plateau.lancerDe('noir');
    let niveau = d <= 3 ? 'facile' : 'difficile';
    if (d <= 3 && this.effets.nuitBlanche) {
      niveau = 'difficile'; this.effets.nuitBlanche = false;
      this.ui.log('🌙 Nuit blanche sur les écrans : ce premier 1-2-3 de la manche donne une question difficile.');
    }
    if (d <= 3 && piege && niveau === 'facile') {
      niveau = 'difficile';
      this.ui.log(`🪤 Piège à clics : ${this.tagJ(j)} doit répondre à une question difficile.`);
    }
    this.ui.log(`🎲 Dé noir : <b>${d}</b>${d === 6 ? ' — attaque du Dark Master après la question !' : ''}`);

    const bon = await this.poserQuestion(j, id, niveau, { face, de: d });
    await this.appliquerResultat(id, bon, face ? 2 : 1, face ? 'face-à-face' : '');
    if (this.fin) return;

    if (d === 6) {
      this.son('attaque');
      this.ambiance('tension', 2);
      await this.cine(() => this.plateau.cineAttaque(), 'Le Dark Master attaque !',
        `${j.nom} a fait 6 au dé noir : une carte Attaque est révélée.`, '#ff3a44');
      await this.attaque(j, id);
      await this.retourVue();
    }
  }

  descCase(idx) {
    const c = NV.BOUCLE[idx];
    if (c.type === 'place') return 'la Place';
    return `${c.type === 'face' ? 'le portrait de ' : 'le quartier de '}${this.nomC(c.c)}`;
  }

  /* ===================== cartes Dark Master ===================== */
  async attaque(j, idQuartier) {
    while (!this.fin) {
      if (this.piocheAttaque.length === 0) {
        this.piocheAttaque = melanger(this.defausseAttaque);
        this.defausseAttaque = [];
      }
      const carte = this.piocheAttaque.pop();
      this.defausseAttaque.push(carte);
      await this.plateau.piocherCarte('attaque');
      this.sync();
      const ctx = { joueur: j, quartier: idQuartier };
      const ok = this.applicableAttaque(carte, ctx);
      await this.ui.carteDM('attaque', carte, ok ? null : 'Cet effet concerne un Complice déjà sauvé ou perdu : on reprend une carte.');
      if (!ok) continue;
      this.ui.log(`☠️ Attaque du Dark Master : <b>${carte.titre}</b>.`);
      await this.effetAttaque(carte, ctx);
      return;
    }
  }

  async finDeManche() {
    this.ui.log(`<b>Fin de la manche ${this.manche}</b> : le Dark Master révèle une carte.`);
    await this.ui.action(`Fin de la manche ${this.manche} : on révèle une carte « Dark Master – Fin de manche ».`, [{ label: '🃏 Révéler la carte', valeur: 1, principal: true, raccourci: ' ' }]);
    if (this.piocheFin.length) {
      this.son('finManche');
      await this.cine(() => this.plateau.cineFinManche(), `Fin de la manche ${this.manche}`,
        `Le Dark Master révèle une carte. Il en reste ${this.piocheFin.length} dans la pioche.`, '#ffd23f');
    }
    while (!this.fin) {
      if (this.piocheFin.length === 0) {
        await this.retourVue();
        const s = this.compte('sauve');
        this.fin = { type: s >= 3 ? (s === 4 ? 'totale' : 'victoire') : 'defaite', raison: 'La pioche « Fin de manche » est épuisée.' };
        return;
      }
      const carte = this.piocheFin.pop();
      await this.plateau.piocherCarte('fin');
      this.sync();
      const ok = this.applicableFin(carte);
      await this.ui.carteDM('fin', carte, ok ? null : 'Cet effet concerne un Complice déjà sauvé ou perdu : on reprend une carte.');
      if (!ok) continue;
      this.ui.log(`🃏 Fin de manche : <b>${carte.titre}</b>.`);
      await this.effetFin(carte);
      await this.retourVue();
      return;
    }
  }

  estActif(id) { return this.complices[id].statut === 'actif'; }

  applicableFin(c) {
    switch (c.id) {
      case 'vague': return this.estActif('stalky') || this.estActif('datata');
      case 'cyberattaque': return this.estActif('hacker');
      case 'fuite': return this.estActif('datata');
      case 'obsolescence': return this.estActif('hyperco');
      case 'surconso': case 'campagne': return this.actifs().length > 0;
      default: return true; // nuit blanche, brouillard, mobilisation
    }
  }

  applicableAttaque(c, ctx) {
    switch (c.id) {
      case 'messagepiege': return this.estActif(this.quartierCible(ctx));
      case 'rumeur': return this.estActif('stalky');
      case 'motdepasse': case 'cleusb': return this.estActif('hacker');
      case 'revendues': return this.estActif('datata');
      case 'promo': case 'consoexpress': return this.estActif('hyperco');
      case 'stress': return this.estActif(ctx.quartier);
      case 'partage': return this.estActif('datata') || this.estActif('stalky');
      case 'crash': return this.estActif('hacker') || this.estActif(this.quartierCible(ctx));
      default: return this.actifs().length > 0; // influence, bug, trolls, notification, piège à clics
    }
  }

  quartierCible(ctx) {
    const c = NV.BOUCLE[ctx.joueur.case];
    return c && c.type === 'place' ? (this.complicePlace || ctx.quartier) : (c ? c.c : ctx.quartier);
  }

  async effetFin(c) {
    const ui = this.ui;
    switch (c.id) {
      case 'vague':
        for (const id of ['stalky', 'datata']) await this.ajouter(id, 'rouge', 1, c.titre);
        break;
      case 'cyberattaque': {
        await this.ajouter('hacker', 'rouge', 1, c.titre);
        const choix = this.actifs((_, id) => id !== 'hacker');
        if (choix.length) {
          const id = await ui.choisirComplice(c.titre, 'Choisissez un autre Complice : il reçoit aussi 1 jeton mauvaise pratique.', choix, this);
          await this.ajouter(id, 'rouge', 1, c.titre);
        }
        break;
      }
      case 'surconso': {
        const action = await ui.choisir(c.titre, 'Que choisissez-vous ?', [
          { label: '🔴 Ajouter 1 mauvaise pratique à un Complice', valeur: 'rouge' },
          { label: '🔵 Retirer 1 bonne pratique à un Complice', valeur: 'bleu' },
        ]);
        const choix = action === 'bleu' ? this.actifs((e) => e.bleus > 0) : this.actifs();
        if (!choix.length) { ui.log('Aucun Complice ne possède de bonne pratique : sans effet.'); break; }
        const id = await ui.choisirComplice(c.titre, action === 'rouge' ? 'Quel Complice reçoit 1 jeton mauvaise pratique ?' : 'À quel Complice retirer 1 jeton bonne pratique ?', choix, this);
        if (action === 'rouge') await this.ajouter(id, 'rouge', 1, c.titre); else await this.retirer(id, 'bleu', 1, c.titre);
        break;
      }
      case 'fuite': {
        const deja = this.complices.datata.rouges >= 2;
        await this.ajouter('datata', 'rouge', 1, c.titre);
        if (deja) {
          const choix = this.actifs((_, id) => id !== 'datata');
          if (choix.length) {
            const id = await ui.choisirComplice(c.titre, 'Datata avait déjà au moins 2 mauvaises pratiques : choisissez un autre Complice qui reçoit 1 jeton mauvaise pratique.', choix, this);
            await this.ajouter(id, 'rouge', 1, c.titre);
          }
        }
        break;
      }
      case 'nuitblanche':
        this.effetsProchains.nuitBlanche = true;
        ui.log('🌙 La prochaine manche, le premier dé noir entre 1 et 3 donnera une question difficile.');
        break;
      case 'obsolescence':
        await this.retirer('hyperco', 'bleu', 1, c.titre);
        await this.ajouter('hyperco', 'rouge', 1, c.titre);
        break;
      case 'brouillard':
        this.effetsProchains.brouillard = new Set();
        ui.log('🌫️ La prochaine manche, la première mauvaise réponse de chaque Complice donnera 2 jetons.');
        break;
      case 'mobilisation': {
        const cibles = this.actifs((e) => e.rouges > 0);
        if (!cibles.length) ui.log('Aucun Complice n’a de mauvaise pratique : sans effet.');
        for (const id of cibles) await this.retirer(id, 'rouge', 1, c.titre);
        break;
      }
      case 'campagne': {
        const id = await ui.choisirComplice(c.titre, 'Choisissez le Complice qui profite de la campagne éducative.', this.actifs(), this);
        const peutRetirer = this.complices[id].rouges > 0;
        const action = await ui.choisir(c.titre, `Pour ${this.nomC(id)} :`, [
          { label: '🔵 Ajouter 1 bonne pratique', valeur: 'bleu' },
          { label: '🔴 Retirer 1 mauvaise pratique', valeur: 'rouge', desactive: !peutRetirer },
        ]);
        if (action === 'bleu') await this.ajouter(id, 'bleu', 1, c.titre); else await this.retirer(id, 'rouge', 1, c.titre);
        break;
      }
    }
  }

  async effetAttaque(c, ctx) {
    const ui = this.ui, j = ctx.joueur;
    const simple = { rumeur: 'stalky', motdepasse: 'hacker', cleusb: 'hacker', revendues: 'datata', promo: 'hyperco' };
    if (simple[c.id]) { await this.ajouter(simple[c.id], 'rouge', 1, c.titre); return; }
    switch (c.id) {
      case 'messagepiege':
        await this.ajouter(this.quartierCible(ctx), 'rouge', 1, c.titre);
        break;
      case 'stress': {
        const bon = await this.poserQuestion(j, ctx.quartier, 'difficile', { stress: true });
        await this.appliquerResultat(ctx.quartier, bon, 1, c.titre);
        break;
      }
      case 'influence': {
        const choix = this.actifs((e) => e.bleus > 0);
        if (!choix.length) { ui.log('Aucun Complice n’a de bonne pratique : sans effet.'); break; }
        const id = await ui.choisirComplice(c.titre, 'Choisissez un Complice : 1 de ses jetons bonne pratique est retourné sur sa face mauvaise pratique.', choix, this);
        this.complices[id].bleus--;
        this.sync();
        await this.ajouter(id, 'rouge', 1, `${c.titre} (jeton retourné)`);
        break;
      }
      case 'bug': {
        const choix = this.actifs((e) => e.bleus > 0);
        if (!choix.length) { ui.log('Aucun Complice n’a de bonne pratique : sans effet.'); break; }
        const id = await ui.choisirComplice(c.titre, 'À quel Complice retirer 1 jeton bonne pratique ?', choix, this);
        await this.retirer(id, 'bleu', 1, c.titre);
        break;
      }
      case 'trolls': {
        let choix = this.actifs((e) => e.rouges > 0);
        if (!choix.length) { ui.log('Aucun Complice n’a encore de mauvaise pratique : sans effet.'); break; }
        if (choix.length <= 2) { for (const id of choix) await this.ajouter(id, 'rouge', 1, c.titre); break; }
        const a = await ui.choisirComplice(c.titre, 'Premier Complice ciblé par les trolls :', choix, this);
        choix = choix.filter((x) => x !== a);
        const b = await ui.choisirComplice(c.titre, 'Second Complice ciblé par les trolls :', choix, this);
        await this.ajouter(a, 'rouge', 1, c.titre);
        await this.ajouter(b, 'rouge', 1, c.titre);
        break;
      }
      case 'notification':
        j.notification = true;
        ui.log(`🔔 ${this.tagJ(j)} ne lancera pas le dé blanc à son prochain tour.`);
        break;
      case 'piegeclics':
        j.piegeClics = true;
        ui.log(`🪤 Au prochain tour de ${this.tagJ(j)}, un 1-2-3 au dé noir donnera une question difficile.`);
        break;
      case 'partage': {
        const choix = ['datata', 'stalky'].filter((id) => this.estActif(id));
        const id = choix.length === 1 ? choix[0] : await ui.choisirComplice(c.titre, 'Datata ou Stalky : qui reçoit 1 jeton mauvaise pratique ?', choix, this);
        await this.ajouter(id, 'rouge', 1, c.titre);
        const suite = this.actifs((e) => e.rouges > 0);
        if (suite.length && !this.fin) {
          const id2 = await ui.choisirComplice(c.titre, 'Puis ajoutez 1 jeton mauvaise pratique à un Complice ayant déjà au moins 1 mauvaise pratique :', suite, this);
          await this.ajouter(id2, 'rouge', 1, c.titre);
        }
        break;
      }
      case 'crash': {
        const q = this.quartierCible(ctx);
        const options = [];
        if (this.estActif('hacker')) options.push({ label: '🔵 Retirer 1 bonne pratique à Hacker', valeur: 'hacker', desactive: this.complices.hacker.bleus === 0 });
        if (this.estActif(q)) options.push({ label: `🔴 Ajouter 1 mauvaise pratique à ${this.nomC(q)} (ton quartier)`, valeur: 'quartier' });
        if (options.every((o) => o.desactive)) options.forEach((o) => (o.desactive = false));
        const v = await ui.choisir(c.titre, `${j.nom} doit choisir :`, options);
        if (v === 'hacker') await this.retirer('hacker', 'bleu', 1, c.titre); else await this.ajouter(q, 'rouge', 1, c.titre);
        break;
      }
      case 'consoexpress': {
        await ui.action(`Consommation express : ${j.nom} relance le dé noir (4-5-6 = question difficile sur Hyperco).`, [{ label: '🎲 Relancer le dé noir', valeur: 1, principal: true, raccourci: ' ' }]);
        const d = await this.plateau.lancerDe('noir');
        if (d <= 3) { ui.log(`🎲 ${d} : rien de plus ne se passe.`); break; }
        ui.log(`🎲 ${d} : question difficile sur ${this.tagC('hyperco')} !`);
        const bon = await this.poserQuestion(j, 'hyperco', 'difficile', {});
        await this.appliquerResultat('hyperco', bon, 1, c.titre);
        break;
      }
    }
  }
}

window.Jeu = Jeu;
