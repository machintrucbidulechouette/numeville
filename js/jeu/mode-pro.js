/* =====================================================================
   Numéville 3D — règles du mode Pro
   • Jetpack (Objet) : après le dé blanc, +3 cases en survolant le plateau.
   • Cases malus : « Toboggan à pop-ups » (on redescend de 3 cases) et
     « Batterie à plat » (on perd son Objet, sinon 1 jeton mauvaise pratique).
   Les cartes Dark Master du mode Pro sont dans cartes-dark-master.js.
   Chaque méthode ne fait rien hors du mode Pro. (Méthodes ajoutées à la classe Jeu.)
   ===================================================================== */

class ModePro {
  /** Après le lancer du dé blanc : le détenteur d'un Jetpack peut l'activer. Renvoie true s'il est utilisé. */
  async proposerJetpack(j, n) {
    if (!this.pro || !this.aObjet(j, 'jetpack')) return false;
    if (!await this.proposer(j, j.objet, 'objet', `le dé blanc indique <b>${n}</b>. Allumer le Jetpack pour avancer de <b>${n + 3}</b> cases ?`, `🚀 Décoller (${n + 3} cases)`, `Marcher (${n} cases)`)) return false;
    this.consommerObjet(j);
    this.son('jetpack');
    this.ui.log(`🚀 ${this.tagJ(j)} allume son Jetpack : ${n} + 3 = <b>${n + 3}</b> cases.`);
    return true;
  }

  /** Fin de déplacement sur une case malus. */
  async arriveeMalus(j) {
    if (!this.pro || j.case === null) return;
    const c = NV.BOUCLE[j.case];
    if (!c || !c.malus) return;
    const M = NV.PRO.MALUS[c.malus];
    this.son('malus');
    if (this.plateau.effetMalus) this.plateau.effetMalus(c.malus, j);
    await this.ui.choisir(`${M.icone} Case malus : ${M.titre}`, `<span class="carte-rappel malus">${M.texte}</span>`, [{ label: 'Subir le malus', valeur: 1 }]);

    if (c.malus === 'toboggan') {
      const chemin = this.chemin(j, 3, -1); // vers le bas de l'escalier (sens anti-horaire), case libre suivante si occupée
      this.ui.log(`📉 ${this.tagJ(j)} tombe sur le <b>Toboggan à pop-ups</b> et redescend de 3 cases.`);
      if (this.plateau.glisserPion) await this.plateau.glisserPion(j, chemin);
      else await this.plateau.deplacerPion(j, chemin);
      j.case = chemin[chemin.length - 1];
      j.toboggan = true; // pas de carte Objet / Pouvoir sur la case d'arrivée
      this.ui.log(`${this.tagJ(j)} arrive sur ${this.descCase(j.case)}.`);
      this.sync();
      return;
    }

    // Batterie à plat
    if (this.pouvoirDispo(j, 'bouclier') && await this.proposer(j, j.pouvoir.carte, 'pouvoir', 'ta batterie se vide : utiliser le Bouclier numérique pour annuler ce malus ?', 'Annuler le malus', 'Subir le malus')) {
      this.consommerPouvoir(j);
      this.ui.log('🛡️ Bouclier numérique : la batterie tient bon, le malus est annulé.');
      return;
    }
    if (j.objet) {
      this.ui.log(`🪫 Batterie à plat : ${this.tagJ(j)} perd son objet <b>${j.objet.titre}</b>.`);
      this.defausseObjets.push(j.objet);
      j.objet = null;
      this.sync();
    } else if (this.estActif(c.c)) {
      await this.ajouter(c.c, 'rouge', 1, 'Batterie à plat');
    } else {
      this.ui.log(`🪫 Batterie à plat : ${this.tagJ(j)} n’a pas d’objet et ${this.tagC(c.c)} a déjà un sort scellé : sans effet.`);
    }
  }
}

NV_etendre(Jeu, ModePro);
