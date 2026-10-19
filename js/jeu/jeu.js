/* =====================================================================
   Numéville 3D — moteur de règles du jeu de base
   Fidèle au livret de règles Numéville (niveaux, tour de jeu, cases
   spéciales, cartes Dark Master, conditions de victoire et de défaite).
   L'interface (ui) et la scène 3D (plateau) sont injectées.
   Complété par : cartes-dark-master.js et mode-avance.js (même dossier).
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
   * @param {{joueurs:{nom:string, eclaireur:string}[], niveau:string, avance:boolean}} config
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
    this.initAvance(config.avance); // mode avancé : Objets et Pouvoirs (js/jeu/mode-avance.js)
  }

  /* ===================== utilitaires ===================== */
  nomC(id) { return NV.COMPLICES[id].nom; }
  tagC(id) { return `<b class="tag-${id}">${this.nomC(id)}</b>`; }
  tagJ(j) { return `<b style="color:${NV.ECLAIREURS[j.eclaireur].couleur}">${j.nom}</b>`; }
  actifs(filtre = () => true) { return NV.ORDRE_COMPLICES.filter((id) => this.complices[id].statut === 'actif' && filtre(this.complices[id], id)); }
  compte(statut) { return NV.ORDRE_COMPLICES.filter((id) => this.complices[id].statut === statut).length; }
  sync() {
    if (!this.fin && window.NV_AUDIO) NV_AUDIO.definirFond(this.ambianceDeFond());
    // ambiance de nuit tant que « Nuit blanche sur les écrans » est programmée ou active
    if (this.plateau.ambianceNuit) this.plateau.ambianceNuit(!this.fin && !!((this.effets && this.effets.nuitBlanche) || (this.effetsProchains && this.effetsProchains.nuitBlanche)));
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
    this.plateau.enCinematique = true;
    try { await sequence(); } finally { this.plateau.enCinematique = false; this.ui.cinemaFin(); }
    return true;
  }
  /** Après une cinématique, la caméra revient toujours sur le joueur actif (ou la vue d'ensemble). */
  async retourVue() {
    const p = this.plateau;
    p._vue = null;
    p.controles.enabled = true;
    if (this.joueurActif) await p.vueJoueur(this.joueurActif, 900);
    else await p.revenirVue(900);
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
    // mode avancé : « Coffre-fort de données » annule une perte de bonne pratique de Datata imposée par le Dark Master
    if (couleur === 'bleu' && id === 'datata' && this._effetDM && c.bleus > 0 && await this.proposerCoffre()) return 0;
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
    // mode avancé : « Mémoire longue » retarde la perte d'un Complice
    if (nouveau === 'perdu' && await this.proposerMemoire(id)) return;
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
    const bon = await this.ui.question(q, { joueur: j, complice: id, niveau, avance: this.avance, ...contexte });
    this.plateau.sonResultat(bon);
    if (bon) j.bonnes++; else j.mauvaises++;
    return bon;
  }

  async appliquerResultat(id, bon, mult, raison, plafond = Infinity) {
    if (bon) { await this.ajouter(id, 'bleu', mult, raison); return; }
    let n = mult;
    if (this.effets.brouillard && !this.effets.brouillard.has(id)) {
      this.effets.brouillard.add(id);
      n += 1;
      this.ui.log(`🌫️ Brouillard sur Numéville : première mauvaise réponse pour ${this.tagC(id)}, +1 jeton.`);
    }
    if (n > plafond) { n = plafond; this.ui.log(`🛡️ Filtre anti-pub : ${this.tagC(id)} ne reçoit qu’1 jeton mauvaise pratique.`); }
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

    await this.installerAvance();
    await this.choisirPremierJoueur();

    while (!this.fin) {
      this.manche++;
      this.effets = this.effetsProchains;
      this.effetsProchains = {};
      this.ui.log(`<hr><b>— Manche ${this.manche} —</b>`);
      if (this.effets.nuitBlanche) this.ui.log('🌙 Nuit blanche sur les écrans est active pendant cette manche.');
      if (this.effets.brouillard) this.ui.log('🌫️ Brouillard sur Numéville est actif pendant cette manche.');
      this.debutMancheAvance();
      this.sync();
      for (const j of this.ordre) {
        await this.tour(j);
        this.verifierFin();
        if (this.fin) break;
      }
      // mode avancé : tours supplémentaires offerts par le « Chargeur universel »
      while (!this.fin && this.toursBonus && this.toursBonus.length) {
        const j = this.toursBonus.shift();
        this.ui.log(`🔋 Tour supplémentaire pour ${this.tagJ(j)} (Chargeur universel).`);
        await this.tour(j);
        this.verifierFin();
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

  /**
   * Un tour de jeu : 1. déplacement (dé blanc), 2. arrivée (cases Objet / Pouvoir en mode avancé),
   * 3. question (dé noir), 4. fin de tour (cartes jouables en fin de tour en mode avancé).
   */
  async tour(j) {
    this.joueurActif = j;
    this.ui.majHUD(this);
    this.plateau.montrerJoueurActif(j);
    this.plateau.vueJoueur(j);
    const piege = j.piegeClics; j.piegeClics = false;
    const bloque = j.notification; j.notification = false;
    const relais = !!j.relaisRecu; j.relaisRecu = false;
    j.gardienTour = false;
    const bouge = !(bloque && j.case !== null);

    if (!bouge) {
      this.ui.log(`🔔 Notification sans fin : ${this.tagJ(j)} ne lance pas le dé blanc et reste dans son quartier.`);
      await this.ui.action(`${j.nom} est bloqué par une notification sans fin : il reste sur sa case.`, [{ label: 'Continuer', valeur: 1, principal: true }]);
    } else {
      await this.deplacement(j, relais);
    }
    if (bouge) await this.arriveeCase(j); // on pioche seulement en terminant un déplacement sur la case
    if (this.fin) return;
    await this.phaseQuestion(j, piege);
    if (this.fin) return;
    await this.finDeTour(j);
  }

  /* ---- 1. Déplacement ---- */
  async deplacement(j, relais) {
    for (;;) {
      const options = [{ label: '🎲 Lancer le dé blanc', valeur: 'de', principal: true, raccourci: ' ' }, ...this.optionsDeplacement(j, relais)];
      const choix = await this.ui.action(`À ${j.nom} de jouer : lance le dé blanc pour te déplacer.`, options);
      if (choix === 'de') {
        let n = await this.plateau.lancerDe('blanc');
        n = await this.ajusterDe(j, n, 'blanc');
        await this.avancer(j, n, `Dé blanc : <b>${n}</b>.`);
        return;
      }
      if (await this.deplacementAvance(j, choix)) return; // GPS, Plan, Éclaireur rapide, Relais
      // sinon (ex. Kit de réparation) : on repropose le choix du déplacement
      if (this.fin) return;
    }
  }

  /** Avance de n cases dans le sens choisi (règle de la case occupée incluse). */
  async avancer(j, n, intro) {
    const ch = { 1: this.chemin(j, n, 1), [-1]: this.chemin(j, n, -1) };
    const dH = ch[1][ch[1].length - 1], dA = ch[-1][ch[-1].length - 1];
    this.plateau.montrerDestinations([dH, dA], ['#38e1ff', '#ff4fd8']);
    const dir = await this.ui.action(`${intro} Dans quel sens ${j.nom} avance-t-il ?`, [
      { label: `↻ Sens horaire → ${this.descCase(dH)}`, valeur: 1, couleur: '#38e1ff' },
      { label: `↺ Anti-horaire → ${this.descCase(dA)}`, valeur: -1, couleur: '#ff4fd8' },
    ]);
    this.plateau.cacherDestinations();
    const chemin = ch[dir];
    if (chemin.length > n) this.ui.log('La case d’arrivée était occupée : le pion avance jusqu’à la prochaine case libre.');
    // la caméra accompagne le pion vers sa case d'arrivée pendant le déplacement
    this.plateau.vueJoueur(j, Math.max(900, chemin.length * 260), this.plateau.posCase(chemin[chemin.length - 1]));
    await this.plateau.deplacerPion(j, chemin);
    j.case = chemin[chemin.length - 1];
    this.ui.log(`🚶 ${this.tagJ(j)} avance de ${n} (${dir === 1 ? 'horaire' : 'anti-horaire'}) et arrive sur ${this.descCase(j.case)}.`);
  }

  /** Déplacement direct sur une case (Plan de Numéville, Relais solidaire). */
  async teleporter(j, idx) {
    const L = NV.BOUCLE.length;
    let garde = 0;
    while (this.occupee(idx, j) && garde++ < L) idx = (idx + 1) % L;
    this.plateau.vueJoueur(j, 900, this.plateau.posCase(idx));
    await this.plateau.deplacerPion(j, [idx]);
    j.case = idx;
    this.ui.log(`🧭 ${this.tagJ(j)} se rend directement sur ${this.descCase(idx)}.`);
  }

  /* ---- 3. Question (dé noir) ---- */
  async phaseQuestion(j, piege) {
    const caseJ = NV.BOUCLE[j.case];
    let id = caseJ.c, face = caseJ.type === 'face', place = caseJ.type === 'place';

    // mode avancé : « Cyber-patrouille » permet de répondre pour le quartier d'un autre Complice
    const patrouille = await this.cyberPatrouille(j, place ? null : id);
    if (patrouille) { id = patrouille; face = false; place = false; }

    if (place) {
      const choix = this.actifs();
      if (!choix.length) return;
      id = await this.ui.choisirComplice('La Place', `${j.nom} est sur la Place : choisis le Complice pour qui tu réponds à une <b>question difficile</b> (sans lancer le dé noir).`, choix, this);
      this.complicePlace = id;
      const prep = await this.avantQuestion(j, id, 'difficile');
      const bon = await this.poserQuestion(j, id, prep.niveau, { place: true, concertation: prep.concertation });
      await this.resoudreReponse(j, id, bon, { face: false, niveau: prep.niveau });
      return;
    }

    if (this.complices[id].statut !== 'actif') {
      this.ui.log(`Le sort de ${this.tagC(id)} est déjà scellé : pas de question dans ce quartier.`);
      await this.ui.action(`${this.nomC(id)} est déjà ${this.complices[id].statut === 'sauve' ? 'sauvé' : 'perdu'} : on ne répond plus à ses questions. Fin du tour de ${j.nom}.`, [{ label: 'Joueur suivant', valeur: 1, principal: true }]);
      return;
    }
    await this.filtreAntiPub(j, id);
    if (face) {
      this.ui.log(`⚔️ Face-à-face avec ${this.tagC(id)} : le résultat de la question compte double !`);
      this.son('face');
      await this.cine(() => this.plateau.cineFaceAFace(j, id), `Face-à-face avec ${this.nomC(id)}`,
        'Le résultat de cette question comptera double.', NV.COMPLICES[id].couleur);
      await this.retourVue();
    }

    await this.ui.action(`${j.nom} répond pour ${this.nomC(id)}${face ? ' (face-à-face : résultat doublé)' : ''}. Lance le dé noir.`, [{ label: '🎲 Lancer le dé noir', valeur: 1, principal: true, raccourci: ' ' }]);
    let d = await this.plateau.lancerDe('noir');
    d = await this.ajusterDe(j, d, 'noir', id);
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

    const prep = await this.avantQuestion(j, id, niveau); // Loupe à fake news, Carnet d'indices
    const bon = await this.poserQuestion(j, id, prep.niveau, { face, de: d, concertation: prep.concertation });
    await this.resoudreReponse(j, id, bon, { face, niveau: prep.niveau });
    if (this.fin) return;

    if (d === 6) {
      if (await this.bouclier(j)) return; // Bouclier numérique : on ne pioche pas d'attaque
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

}

window.Jeu = Jeu;
