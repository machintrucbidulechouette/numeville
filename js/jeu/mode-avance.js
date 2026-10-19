/* =====================================================================
   Numéville 3D — mode avancé : cartes Objet et Pouvoir (règles p. 11-12)

   • En début de partie, les joueurs choisissent une case Objet et une case Pouvoir.
   • Terminer son déplacement sur l'une d'elles fait piocher une carte, puis on joue
     son tour normalement. Maximum 1 Objet et 1 Pouvoir en main : en piocher un
     second oblige à choisir lequel garder (l'autre est défaussé sans effet).
   • Une carte qui concerne un Complice déjà sauvé ou perdu est remplacée.
   • Objets : effet ponctuel, à usage unique. Pouvoirs : permanents ou à X utilisations.

   Chaque méthode ne fait rien si le mode avancé est désactivé : le jeu de base
   reste strictement identique. (Méthodes ajoutées à la classe Jeu.)
   ===================================================================== */

class ModeAvance {
  /* ===================== mise en place ===================== */
  initAvance(actif) {
    this.avance = !!actif;
    this.toursBonus = [];
    if (!this.avance) return;
    this.piocheObjets = melanger(NV.OBJETS);
    this.piochePouvoirs = melanger(NV.POUVOIRS);
    this.defausseObjets = [];
    this.defaussePouvoirs = [];
    this.caseObjet = null;
    this.casePouvoir = null;
    for (const j of this.joueurs) Object.assign(j, { objet: null, pouvoir: null, relaisRecu: false, maitreUtilise: false, gardienTour: false });
  }

  /** Les joueurs transforment une case en case Objet, puis une autre en case Pouvoir. */
  async installerAvance() {
    if (!this.avance) return;
    const toutes = NV.BOUCLE.map((_, i) => i);
    this.ui.log('🧰 Mode avancé : choisissez la case Objet et la case Pouvoir.');
    this.caseObjet = await this.choisirCase('Case Objet', 'Mettez-vous d’accord sur une case du plateau : elle devient la <b>case Objet</b> (le pion Objet n’en bougera plus).', toutes);
    this.casePouvoir = await this.choisirCase('Case Pouvoir', 'Choisissez maintenant une autre case : elle devient la <b>case Pouvoir</b>.', toutes.filter((i) => i !== this.caseObjet));
    this.plateau.placerMarqueurAvance('objet', this.caseObjet);
    this.plateau.placerMarqueurAvance('pouvoir', this.casePouvoir);
    this.ui.log(`🧰 Case Objet : ${this.descCase(this.caseObjet)} · ⚡ Case Pouvoir : ${this.descCase(this.casePouvoir)}.`);
    this.sync();
  }

  debutMancheAvance() {
    if (!this.avance) return;
    for (const j of this.joueurs) j.maitreUtilise = false;
  }

  /* ===================== outils ===================== */
  libelleCase(idx) {
    const c = NV.BOUCLE[idx];
    if (c.type === 'place') return 'La Place';
    if (c.type === 'face') return `Portrait de ${this.nomC(c.c)} (face-à-face)`;
    const rang = NV.BOUCLE.filter((b, i) => b.c === c.c && b.type === 'case' && i <= idx).length;
    return `Quartier de ${this.nomC(c.c)} — case ${rang}`;
  }

  /** Choix d'une case en deux temps : le quartier, puis la case (ou « au hasard »). */
  async choisirCase(titre, texte, indices, hasard = true) {
    const groupes = [];
    for (const i of indices) {
      const c = NV.BOUCLE[i];
      const cle = c.type === 'place' ? 'place' : c.c;
      let g = groupes.find((x) => x.cle === cle);
      if (!g) groupes.push(g = { cle, cases: [] });
      g.cases.push(i);
    }
    const options = groupes.map((g) => ({ label: g.cle === 'place' ? '🔀 La Place' : `Quartier de ${this.nomC(g.cle)}`, valeur: g.cle }));
    if (hasard) options.push({ label: '🎲 Au hasard', valeur: '__hasard' });
    const g = await this.ui.choisir(titre, texte, options);
    if (g === '__hasard') return indices[Math.floor(Math.random() * indices.length)];
    const cases = groupes.find((x) => x.cle === g).cases;
    if (cases.length === 1) return cases[0];
    return this.ui.choisir(titre, 'Sur quelle case ?', cases.map((i) => ({ label: this.libelleCase(i), valeur: i })));
  }

  quartiersActifsOuTous() { return NV.ORDRE_COMPLICES; }

  pouvoirDispo(j, id) {
    const p = this.avance && j.pouvoir;
    if (!p || p.carte.id !== id) return false;
    if (p.reste === 'manche') return !j.maitreUtilise;
    return p.reste > 0;
  }
  aObjet(j, id) { return !!(this.avance && j.objet && j.objet.id === id); }

  consommerObjet(j) {
    if (!j.objet) return;
    this.ui.log(`🧰 ${this.tagJ(j)} utilise l’objet <b>${j.objet.titre}</b>.`);
    this.defausseObjets.push(j.objet);
    j.objet = null;
    this.son('objet');
    this.sync();
  }
  consommerPouvoir(j) {
    const p = j.pouvoir;
    if (!p) return;
    this.ui.log(`⚡ ${this.tagJ(j)} utilise le pouvoir <b>${p.carte.titre}</b>.`);
    if (p.reste === 'manche') j.maitreUtilise = true;
    else if (p.reste !== Infinity) {
      p.reste--;
      if (p.reste <= 0) {
        this.ui.log(`Le pouvoir <b>${p.carte.titre}</b> de ${this.tagJ(j)} est épuisé.`);
        this.defaussePouvoirs.push(p.carte);
        j.pouvoir = null;
      }
    }
    this.son('objet');
    this.sync();
  }

  /** Demande au détenteur s'il joue sa carte maintenant. */
  async proposer(j, carte, type, question, oui = 'Utiliser', non = 'Pas maintenant') {
    const icone = type === 'objet' ? '🧰' : '⚡';
    const r = await this.ui.choisir(`${icone} ${carte.titre}`,
      `<span class="carte-rappel">${carte.texte}</span><br><b>${j.nom}</b>, ${question}`,
      [{ label: oui, valeur: true }, { label: non, valeur: false }]);
    return r;
  }

  libelleReste(p) {
    if (!p) return '';
    if (p.reste === Infinity) return 'permanent';
    if (p.reste === 'manche') return '1 fois par manche';
    return `${p.reste} utilisation${p.reste > 1 ? 's' : ''}`;
  }

  /* ===================== cases Objet / Pouvoir ===================== */
  async arriveeCase(j) {
    if (!this.avance || j.case === null) return;
    if (j.case === this.caseObjet) await this.piocherCarteAvance(j, 'objet');
    if (j.case === this.casePouvoir) await this.piocherCarteAvance(j, 'pouvoir');
  }

  async piocherCarteAvance(j, type) {
    const cle = type === 'objet' ? 'Objets' : 'Pouvoirs';
    for (let essais = 0; essais < 30; essais++) {
      if (this['pioche' + cle].length === 0) {
        if (!this['defausse' + cle].length) { this.ui.log(`Plus aucune carte ${type} disponible.`); return; }
        this['pioche' + cle] = melanger(this['defausse' + cle]);
        this['defausse' + cle] = [];
      }
      const carte = this['pioche' + cle].pop();
      this.son('carte');
      const caduque = carte.complice && !this.estActif(carte.complice);
      await this.ui.carteAvance(type, carte, caduque ? `${this.nomC(carte.complice)} est déjà ${this.complices[carte.complice].statut === 'sauve' ? 'sauvé' : 'perdu'} : on reprend une carte.` : null);
      if (caduque) { this['defausse' + cle].push(carte); continue; }

      const actuelle = type === 'objet' ? j.objet : j.pouvoir && j.pouvoir.carte;
      if (actuelle) {
        const garder = await this.ui.choisir(type === 'objet' ? 'Un seul Objet en main' : 'Un seul Pouvoir en main',
          `${j.nom} a déjà <b>${actuelle.titre}</b>. Quelle carte garder ? L’autre est défaussée sans appliquer son effet.`,
          [{ label: `Garder la nouvelle : ${carte.titre}`, valeur: 'nouvelle' }, { label: `Garder l’ancienne : ${actuelle.titre}`, valeur: 'ancienne' }]);
        if (garder === 'ancienne') { this['defausse' + cle].push(carte); this.ui.log(`${this.tagJ(j)} garde ${actuelle.titre}.`); return; }
        this['defausse' + cle].push(actuelle);
      }
      if (type === 'objet') j.objet = carte;
      else j.pouvoir = { carte, reste: carte.utilisations === 'manche' ? 'manche' : carte.utilisations };
      this.ui.log(`${type === 'objet' ? '🧰' : '⚡'} ${this.tagJ(j)} obtient ${type === 'objet' ? 'l’objet' : 'le pouvoir'} <b>${carte.titre}</b>.`);
      this.son('objet');
      this.sync();
      return;
    }
  }

  /* ===================== déplacement ===================== */
  optionsDeplacement(j, relais) {
    if (!this.avance) return [];
    const o = [];
    if (this.pouvoirDispo(j, 'eclaireur')) o.push({ label: '⚡ Avancer de 2 (Éclaireur rapide)', valeur: 'eclaireur', couleur: '#b98cff' });
    if (this.aObjet(j, 'gps')) o.push({ label: '🧰 GPS : avancer de 1 à 3', valeur: 'gps', couleur: '#38e1ff' });
    if (this.aObjet(j, 'plan')) o.push({ label: '🧰 Plan : aller dans un quartier', valeur: 'plan', couleur: '#38e1ff' });
    if (relais) o.push({ label: '🤝 Relais solidaire : case de mon choix', valeur: 'relais', couleur: '#ffd23f' });
    if (this.aObjet(j, 'kit') && this.estActif('hyperco') && this.complices.hyperco.rouges > 0) o.push({ label: '🧰 Kit de réparation (Hyperco)', valeur: 'kit', couleur: '#3daa35' });
    return o;
  }

  /** Renvoie true si le déplacement est fait, false pour reproposer le choix. */
  async deplacementAvance(j, choix) {
    switch (choix) {
      case 'eclaireur':
        this.consommerPouvoir(j);
        await this.avancer(j, 2, 'Éclaireur rapide : 2 cases.');
        return true;
      case 'gps': {
        const n = await this.ui.choisir('🧰 GPS de Numéville', 'De combien de cases avancer (sans lancer le dé blanc) ?', [1, 2, 3].map((v) => ({ label: `${v} case${v > 1 ? 's' : ''}`, valeur: v })));
        this.consommerObjet(j);
        await this.avancer(j, n, `GPS : ${n} case${n > 1 ? 's' : ''}.`);
        return true;
      }
      case 'plan': {
        const cases = NV.BOUCLE.map((_, i) => i).filter((i) => NV.BOUCLE[i].type !== 'place');
        const idx = await this.choisirCase('🧰 Plan de Numéville', 'Dans quel quartier aller ?', cases, false);
        this.consommerObjet(j);
        await this.teleporter(j, idx);
        return true;
      }
      case 'relais': {
        const idx = await this.choisirCase('🤝 Relais solidaire', 'Sur quelle case aller (sans lancer le dé blanc) ?', NV.BOUCLE.map((_, i) => i), false);
        await this.teleporter(j, idx);
        return true;
      }
      case 'kit':
        this.consommerObjet(j);
        await this.retirer('hyperco', 'rouge', 1, 'Kit de réparation');
        return false;
      default: return false;
    }
  }

  /** Dés : Double vérification, Décodeur de fake news (dé noir sur Stalky), Maître des dés. */
  async ajusterDe(j, v, couleur, complice) {
    if (!this.avance) return v;
    if (couleur === 'noir' && this.aObjet(j, 'doubleverif') && await this.proposer(j, j.objet, 'objet', `le dé noir indique <b>${v}</b>. Relancer le dé noir ?`, 'Relancer', 'Garder ' + v)) {
      this.consommerObjet(j);
      const v2 = await this.plateau.lancerDe('noir');
      v = await this.ui.choisir('🧰 Double vérification', 'Quel résultat garder ?', [{ label: `Premier lancer : ${v}`, valeur: v }, { label: `Nouveau lancer : ${v2}`, valeur: v2 }]);
    }
    if (couleur === 'noir' && complice === 'stalky' && this.pouvoirDispo(j, 'decodeur') && await this.proposer(j, j.pouvoir.carte, 'pouvoir', `le dé noir indique <b>${v}</b> sur Stalky. Le relancer ?`, 'Relancer', 'Garder ' + v)) {
      this.consommerPouvoir(j);
      v = await this.plateau.lancerDe('noir');
    }
    if (this.pouvoirDispo(j, 'maitredes')) {
      const opts = [];
      if (v < 6) opts.push({ label: `+1 → ${v + 1}`, valeur: 1 });
      if (v > 1) opts.push({ label: `−1 → ${v - 1}`, valeur: -1 });
      opts.push({ label: `Garder ${v}`, valeur: 0 });
      const delta = await this.ui.choisir('⚡ Maître des dés', `<span class="carte-rappel">${j.pouvoir.carte.texte}</span><br>Dé ${couleur} : <b>${v}</b>. Modifier le résultat ?`, opts);
      if (delta) { this.consommerPouvoir(j); v += delta; this.ui.log(`⚡ Maître des dés : le dé ${couleur} passe à <b>${v}</b>.`); }
    }
    return v;
  }

  /* ===================== avant la question ===================== */
  async cyberPatrouille(j, idCourant) {
    if (!this.pouvoirDispo(j, 'cyberpatrouille')) return null;
    const autres = this.actifs((_, id) => id !== idCourant);
    if (!autres.length) return null;
    if (!await this.proposer(j, j.pouvoir.carte, 'pouvoir', 'veux-tu répondre pour le quartier d’un autre Complice ce tour-ci ?')) return null;
    const id = await this.ui.choisirComplice('⚡ Cyber-patrouille', 'Pour quel Complice répondre ?', autres, this);
    this.consommerPouvoir(j);
    this.ui.log(`⚡ Cyber-patrouille : ${this.tagJ(j)} répond pour le quartier de ${this.tagC(id)}.`);
    return id;
  }

  async filtreAntiPub(j, id) {
    if (id !== 'hyperco' || !this.aObjet(j, 'filtre') || this.effets.filtreHyperco) return;
    if (!await this.proposer(j, j.objet, 'objet', 'tu es dans le quartier d’Hyperco : activer le filtre jusqu’à la fin de la manche ?')) return;
    this.consommerObjet(j);
    this.effets.filtreHyperco = true;
    this.ui.log('🛡️ Filtre anti-pub actif : jusqu’à la fin de la manche, Hyperco ne reçoit qu’1 jeton mauvaise pratique par question.');
  }

  async avantQuestion(j, id, niveau) {
    const r = { niveau, concertation: false };
    if (!this.avance) return r;
    if (id === 'stalky' && niveau === 'difficile' && this.aObjet(j, 'loupe') && await this.proposer(j, j.objet, 'objet', 'jouer la loupe pour piocher une question facile ?')) {
      this.consommerObjet(j);
      r.niveau = 'facile';
    }
    if (this.aObjet(j, 'indices') && await this.proposer(j, j.objet, 'objet', 'le groupe se concerte 1 minute pour t’aider à répondre ?')) {
      this.consommerObjet(j);
      r.concertation = true;
    }
    return r;
  }

  /* ===================== résultat de la question ===================== */
  async resoudreReponse(j, id, bon, { face, niveau }) {
    const plafond = this.effets.filtreHyperco && id === 'hyperco' ? 1 : Infinity;
    if (!this.avance) { await this.appliquerResultat(id, bon, face ? 2 : 1, face ? 'face-à-face' : '', plafond); return; }

    if (!bon) {
      if (id === 'hacker' && this.aObjet(j, 'guidecyber') && await this.proposer(j, j.objet, 'objet', 'ne pas placer le jeton mauvaise pratique sur Hacker ?')) {
        this.consommerObjet(j); this.ui.log('🛡️ Guide de cybersécurité : pas de jeton mauvaise pratique pour Hacker.'); return;
      }
      if (this.aObjet(j, 'capture') && await this.proposer(j, j.objet, 'objet', `ne pas placer le jeton mauvaise pratique sur ${this.nomC(id)} ?`)) {
        this.consommerObjet(j); this.ui.log(`📸 Capture d’écran : pas de jeton mauvaise pratique pour ${this.tagC(id)}.`); return;
      }
      let mult = face ? 2 : 1;
      if (face && this.pouvoirDispo(j, 'ambassadeur')) { mult = 1; this.ui.log('⚡ Ambassadeur du calme : le face-à-face ne donne qu’1 jeton mauvaise pratique.'); }
      await this.appliquerResultat(id, false, mult, face ? 'face-à-face' : '', plafond);
      return;
    }

    await this.appliquerResultat(id, true, face ? 2 : 1, face ? 'face-à-face' : '');
    if (this.fin || !this.estActif(id)) return;
    if (!face && this.aObjet(j, 'carnetbp') && await this.proposer(j, j.objet, 'objet', `placer 1 jeton bonne pratique de plus sur ${this.nomC(id)} ?`)) {
      this.consommerObjet(j);
      await this.ajouter(id, 'bleu', 1, 'Carnet de bonnes pratiques');
    }
    if (id === 'datata' && this.pouvoirDispo(j, 'gardien') && this.estActif('datata') && !j.gardienTour) {
      j.gardienTour = true; // max 1 fois par tour
      this.ui.log('⚡ Gardien des données : 1 jeton bonne pratique de plus pour Datata.');
      await this.ajouter('datata', 'bleu', 1, 'Gardien des données');
    }
    if (id === 'stalky' && this.pouvoirDispo(j, 'mediateur')) {
      const cibles = this.actifs();
      if (cibles.length) {
        const cible = await this.ui.choisirComplice('⚡ Médiateur en ligne', 'Bonne réponse sur Stalky : à quel Complice (pas encore sauvé) donner 1 jeton bonne pratique ?', cibles, this);
        await this.ajouter(cible, 'bleu', 1, 'Médiateur en ligne');
      }
    }
    if (niveau === 'difficile' && this.estActif(id) && this.pouvoirDispo(j, 'coach') && await this.proposer(j, j.pouvoir.carte, 'pouvoir', `bonne réponse difficile : aider ${this.nomC(id)} ?`)) {
      const c = this.complices[id];
      const choix = await this.ui.choisir('⚡ Coach des Complices', `Pour ${this.nomC(id)} :`, [
        { label: '🔵 Placer 1 jeton bonne pratique', valeur: 'bleu' },
        { label: '🔄 Retourner 1 mauvaise pratique en bonne pratique', valeur: 'retourner', desactive: c.rouges === 0 },
      ]);
      this.consommerPouvoir(j);
      if (choix === 'retourner') { c.rouges--; this.sync(); this.ui.log(`🔄 Un jeton mauvaise pratique de ${this.tagC(id)} est retourné.`); }
      await this.ajouter(id, 'bleu', 1, 'Coach des Complices');
    }
  }

  /* ===================== attaques du Dark Master ===================== */
  async bouclier(j) {
    if (!this.pouvoirDispo(j, 'bouclier')) return false;
    if (!await this.proposer(j, j.pouvoir.carte, 'pouvoir', 'ignorer complètement l’attaque du Dark Master ?', 'Ignorer l’attaque', 'Subir l’attaque')) return false;
    this.consommerPouvoir(j);
    this.ui.log('🛡️ Bouclier numérique : l’attaque du Dark Master est ignorée.');
    return true;
  }

  async parapluie(j, carte) {
    if (!this.aObjet(j, 'parapluie')) return false;
    if (!await this.proposer(j, j.objet, 'objet', `annuler l’attaque « ${carte.titre} » ?`, 'Annuler l’attaque', 'Laisser faire')) return false;
    this.consommerObjet(j);
    this.ui.log(`☂️ Parapluie anti-trolls : l’attaque « ${carte.titre} » est annulée.`);
    return true;
  }

  /** Coffre-fort de données : n'importe quel joueur qui l'a peut le jouer. */
  async proposerCoffre() {
    if (!this.avance) return false;
    const j = this.joueurs.find((x) => this.aObjet(x, 'coffre'));
    if (!j || !await this.proposer(j, j.objet, 'objet', 'le Dark Master veut retirer 1 bonne pratique à Datata : protéger ce jeton ?', 'Protéger', 'Laisser faire')) return false;
    this.consommerObjet(j);
    this.ui.log('🔐 Coffre-fort de données : Datata garde son jeton bonne pratique.');
    return true;
  }

  /** Mémoire longue : n'importe quel joueur qui a ce pouvoir peut retarder la perte. */
  async proposerMemoire(id) {
    if (!this.avance) return false;
    const j = this.joueurs.find((x) => this.pouvoirDispo(x, 'memoire'));
    if (!j || !await this.proposer(j, j.pouvoir.carte, 'pouvoir', `${this.nomC(id)} va être perdu : retarder sa perte ?`, 'Retarder la perte', 'Non')) return false;
    this.consommerPouvoir(j);
    this.complices[id].rouges--;
    this.sync();
    this.ui.log(`🧠 Mémoire longue : ${this.tagC(id)} n’est pas perdu, 1 jeton mauvaise pratique est retiré.`);
    return true;
  }

  /** Veilleur de Numéville : regarder la carte du dessus et la laisser ou la mettre dessous. */
  async proposerVeilleur() {
    if (!this.avance || this.piocheFin.length < 2) return;
    const j = this.joueurs.find((x) => this.pouvoirDispo(x, 'veilleur'));
    if (!j || !await this.proposer(j, j.pouvoir.carte, 'pouvoir', 'regarder la prochaine carte « Fin de manche » ?', 'Regarder', 'Non')) return;
    const dessus = this.piocheFin[this.piocheFin.length - 1];
    const choix = await this.ui.choisir('⚡ Veilleur de Numéville', `${j.nom} découvre la prochaine carte : <b>${dessus.titre}</b><br><span class="carte-rappel">${dessus.texte}</span>`, [
      { label: 'La reposer dessus', valeur: 'dessus' }, { label: 'La mettre sous la pioche', valeur: 'dessous' },
    ]);
    if (choix === 'dessous') { this.piocheFin.unshift(this.piocheFin.pop()); this.ui.log(`👁️ Veilleur de Numéville : ${this.tagJ(j)} glisse une carte sous la pioche.`); }
    else this.ui.log(`👁️ Veilleur de Numéville : ${this.tagJ(j)} laisse la carte sur la pioche.`);
  }

  /* ===================== fin de tour ===================== */
  async finDeTour(j) {
    if (!this.avance || this.fin) return;
    if (this.pouvoirDispo(j, 'reparcafe') && this.actifs((e) => e.rouges > 0).length && await this.proposer(j, j.pouvoir.carte, 'pouvoir', 'retirer 1 jeton mauvaise pratique d’un Complice ?')) {
      const id = await this.ui.choisirComplice('⚡ Repar’café', 'À quel Complice retirer 1 jeton mauvaise pratique ?', this.actifs((e) => e.rouges > 0), this);
      this.consommerPouvoir(j);
      await this.retirer(id, 'rouge', 1, 'Repar’café');
    }
    const autres = this.joueurs.filter((x) => x !== j);
    if (autres.length && this.aObjet(j, 'chargeur') && await this.proposer(j, j.objet, 'objet', 'offrir un tour supplémentaire à un autre joueur avant la fin de la manche ?')) {
      const k = await this.ui.choisir('🧰 Chargeur universel', 'Quel joueur rejoue ?', autres.map((x) => ({ label: x.nom, valeur: x.id })));
      this.consommerObjet(j);
      this.toursBonus.push(this.joueurs[k]);
      this.ui.log(`🔋 ${this.tagJ(this.joueurs[k])} jouera un tour supplémentaire avant la fin de la manche.`);
    }
    if (autres.length && this.pouvoirDispo(j, 'relais') && await this.proposer(j, j.pouvoir.carte, 'pouvoir', 'désigner un joueur qui ira sur la case de son choix à son prochain tour ?')) {
      const k = await this.ui.choisir('⚡ Relais solidaire', 'Quel joueur en profite ?', autres.map((x) => ({ label: x.nom, valeur: x.id })));
      this.consommerPouvoir(j);
      this.joueurs[k].relaisRecu = true;
      this.ui.log(`🤝 ${this.tagJ(this.joueurs[k])} pourra aller sur la case de son choix à son prochain tour.`);
    }
  }
}

NV_etendre(Jeu, ModeAvance);
