/* =====================================================================
   Numéville 3D — cartes Dark Master (Fin de manche et Attaque)
   Pioche, règle « Complice déjà sauvé ou perdu → on reprend une carte » et effets.
   (méthodes ajoutées à la classe Jeu, voir js/jeu/jeu.js)
   ===================================================================== */

class CartesDarkMaster {
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
      // mode avancé : le « Parapluie anti-trolls » annule entièrement l'attaque
      if (await this.parapluie(j, carte)) return;
      this.ui.log(`☠️ Attaque du Dark Master : <b>${carte.titre}</b>.`);
      this._effetDM = true;
      try { await this.effetAttaque(carte, ctx); } finally { this._effetDM = false; }
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
    await this.proposerVeilleur();
    while (!this.fin) {
      if (this.piocheFin.length === 0) {
        await this.retourVue();
        const s = this.compte('sauve');
        this.fin = { type: s >= NV.FIN.victoire ? (s === NV.FIN.totale ? 'totale' : 'victoire') : 'defaite', raison: 'La pioche « Fin de manche » est épuisée.' };
        return;
      }
      const carte = this.piocheFin.pop();
      await this.plateau.piocherCarte('fin');
      this.sync();
      const ok = this.applicableFin(carte);
      await this.ui.carteDM('fin', carte, ok ? null : 'Cet effet concerne un Complice déjà sauvé ou perdu : on reprend une carte.');
      if (!ok) continue;
      this.ui.log(`🃏 Fin de manche : <b>${carte.titre}</b>.`);
      this._effetDM = true;
      try { await this.effetFin(carte); } finally { this._effetDM = false; }
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
      // mode Pro
      case 'scrollinfini': return this.estActif('scrollo') || this.estActif('stalky');
      case 'zoneblanche': return this.estActif('fracturo');
      case 'sansecran': return this.estActif('scrollo') || this.estActif('hyperco');
      case 'mediatheque': return this.actifs().length > 0;
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
      // mode Pro
      case 'autoplay': case 'notifnuit': return this.estActif('scrollo');
      case 'formulaire': return this.estActif('fracturo');
      case 'abandon': return this.estActif('fracturo') || this.estActif(this.quartierCible(ctx));
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
        if (this.plateau.cineNuitBlanche) {
          this.son('nuit');
          await this.cine(() => this.plateau.cineNuitBlanche(), '🌙 Nuit blanche sur les écrans',
            'Numéville ne dort plus : à la prochaine manche, le premier dé noir de 1 à 3 donnera une question difficile.', '#9db8ff');
        }
        this.sync();
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
      /* ---- cartes du mode Pro ---- */
      case 'scrollinfini':
        for (const id of ['scrollo', 'stalky']) await this.ajouter(id, 'rouge', 1, c.titre);
        break;
      case 'zoneblanche': {
        await this.ajouter('fracturo', 'rouge', 1, c.titre);
        const choix = this.actifs((e, id) => id !== 'fracturo' && e.bleus > 0);
        if (!choix.length || this.fin) { ui.log('Aucun autre Complice n’a de bonne pratique à perdre.'); break; }
        const id = await ui.choisirComplice(c.titre, 'Choisissez un autre Complice : il perd 1 jeton bonne pratique.', choix, this);
        await this.retirer(id, 'bleu', 1, c.titre);
        break;
      }
      case 'sansecran': {
        const cibles = ['scrollo', 'hyperco'].filter((id) => this.estActif(id) && this.complices[id].rouges > 0);
        if (!cibles.length) ui.log('Ni Scrollo ni Hyperco n’ont de mauvaise pratique : sans effet.');
        for (const id of cibles) await this.retirer(id, 'rouge', 1, c.titre);
        break;
      }
      case 'mediatheque': {
        const id = await ui.choisirComplice(c.titre, 'Quel Complice profite de l’atelier ? (Fracturo en reçoit 2.)', this.actifs(), this);
        await this.ajouter(id, 'bleu', id === 'fracturo' ? 2 : 1, c.titre);
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
    const simple = { rumeur: 'stalky', motdepasse: 'hacker', cleusb: 'hacker', revendues: 'datata', promo: 'hyperco', autoplay: 'scrollo', formulaire: 'fracturo' };
    if (simple[c.id]) { await this.ajouter(simple[c.id], 'rouge', 1, c.titre); return; }
    switch (c.id) {
      case 'messagepiege':
        await this.ajouter(this.quartierCible(ctx), 'rouge', 1, c.titre);
        break;
      case 'stress': {
        const bon = await this.poserQuestion(j, ctx.quartier, 'difficile', { stress: true });
        await this.resoudreReponse(j, ctx.quartier, bon, { face: false, niveau: 'difficile' });
        break;
      }
      case 'influence': {
        const choix = this.actifs((e) => e.bleus > 0);
        if (!choix.length) { ui.log('Aucun Complice n’a de bonne pratique : sans effet.'); break; }
        const id = await ui.choisirComplice(c.titre, 'Choisissez un Complice : 1 de ses jetons bonne pratique est retourné sur sa face mauvaise pratique.', choix, this);
        if (id === 'datata' && await this.proposerCoffre()) break; // Coffre-fort de données
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
      /* ---- attaques du mode Pro ---- */
      case 'notifnuit':
        await this.ajouter('scrollo', 'rouge', 1, c.titre);
        j.piegeClics = true;
        ui.log(`🌙 Au prochain tour de ${this.tagJ(j)}, un 1-2-3 au dé noir donnera une question difficile.`);
        break;
      case 'abandon': {
        const q = this.quartierCible(ctx);
        const options = [];
        if (this.estActif('fracturo')) options.push({ label: '🔵 Retirer 1 bonne pratique à Fracturo', valeur: 'fracturo', desactive: this.complices.fracturo.bleus === 0 });
        if (this.estActif(q)) options.push({ label: `🔴 Ajouter 1 mauvaise pratique à ${this.nomC(q)} (ton quartier)`, valeur: 'quartier' });
        if (options.every((o) => o.desactive)) options.forEach((o) => (o.desactive = false));
        const v = await ui.choisir(c.titre, `${j.nom} doit choisir :`, options);
        if (v === 'fracturo') await this.retirer('fracturo', 'bleu', 1, c.titre); else await this.ajouter(q, 'rouge', 1, c.titre);
        break;
      }
      case 'consoexpress': {
        await ui.action(`Consommation express : ${j.nom} relance le dé noir (4-5-6 = question difficile sur Hyperco).`, [{ label: '🎲 Relancer le dé noir', valeur: 1, principal: true, raccourci: ' ' }]);
        const d = await this.plateau.lancerDe('noir');
        if (d <= 3) { ui.log(`🎲 ${d} : rien de plus ne se passe.`); break; }
        ui.log(`🎲 ${d} : question difficile sur ${this.tagC('hyperco')} !`);
        const bon = await this.poserQuestion(j, 'hyperco', 'difficile', {});
        await this.resoudreReponse(j, 'hyperco', bon, { face: false, niveau: 'difficile' });
        break;
      }
    }
  }
}

NV_etendre(Jeu, CartesDarkMaster);
