/* =====================================================================
   Numéville 3D — caméra et cinématiques
   Mouvements de caméra fiables, recentrage, cinématiques des moments clés.
   (méthodes ajoutées à la classe Plateau3D, voir js/3d/plateau3d.js)
   ===================================================================== */

class Cinematiques3D {
  /* ---------- Cinématiques ---------- */
  // Courtes séquences de caméra (2 à 5 s) aux moments clés. Elles peuvent être passées
  // (clic ou Espace) et désactivées dans la barre du haut ; elles sont coupées si
  // l'utilisateur a demandé à réduire les animations.

  passerCinematique() {
    for (const a of this.anims) if (a.cine) a.t0 = -1e9;
  }

  memoriserVue() {
    // on garde la vue d'origine si une cinématique en déclenche une autre (ex. attaque → Complice perdu)
    if (!this._vue) {
      this._vue = { pos: this.camera.position.clone(), cible: this.controles.target.clone() };
      this._decalageMemo = this.camera.position.clone().sub(this.controles.target);
    }
  }

  /**
   * Annule l'élan restant d'un geste de souris (rotation, déplacement, zoom) sans l'appliquer :
   * sinon il s'ajouterait d'un coup au mouvement automatique et la vue « sauterait ».
   * OrbitControls r184 garde cet élan dans _sphericalDelta, _panOffset et _scale.
   */
  _viderInertie() {
    const c = this.controles;
    if (c._sphericalDelta) c._sphericalDelta.set(0, 0, 0);
    if (c._panOffset) c._panOffset.set(0, 0, 0);
    if (typeof c._scale === 'number') c._scale = 1;
  }

  /** Signale une animation de caméra : les contrôles à la souris ne la perturbent pas. */
  _cameraPrise(promesse) {
    if (!this._occupee) {
      this._etaitActive = this.controles.enabled;
      this._viderInertie();
    }
    this._occupee = (this._occupee || 0) + 1;
    this.controles.enabled = false; // aucune saisie souris pendant le mouvement : rien ne s'accumule
    return promesse.finally(() => {
      this._occupee--;
      if (this._occupee === 0 && !this.enCinematique && !this._enPlan) this.controles.enabled = true;
    });
  }

  /** Déplace la caméra vers (pos, cible) en douceur. */
  voler(pos, cible, duree = 1200) {
    this._idVue++; // annule un recentrage en cours
    const a = this.camera.position.clone(), ta = this.controles.target.clone();
    return this._cameraPrise(this.animer(duree, (t) => {
      const k = Plateau3D.ease(t);
      this.camera.position.lerpVectors(a, pos, k);
      this.controles.target.lerpVectors(ta, cible, k);
    }, true));
  }

  async revenirVue(duree = 1000) {
    const v = this._vue || { pos: this.VUE.pos, cible: this.VUE.cible };
    this._vue = null;
    this._enPlan = false;
    await this.voler(v.pos, v.cible, duree);
    this.controles.enabled = true;
  }

  /** Plan rapproché sur un point du plateau, vu depuis le côté des joueurs. */
  async plan(cible, recul = 3.2, hauteur = 3.4, duree = 1200) {
    this._enPlan = true;
    this.controles.enabled = false;
    const pos = cible.clone().add(new THREE.Vector3(cible.x * 0.12, hauteur, recul));
    await this.voler(pos, cible, duree);
  }

  /** Ouverture : survol de Numéville en tournant, puis descente vers la vue de jeu. */
  async cineIntro() {
    this.controles.enabled = false;
    this._idVue++;
    const fin = this.VUE.pos.clone(), cibleFin = this.VUE.cible.clone();
    const rFin = Math.hypot(fin.x, fin.z - cibleFin.z), aFin = Math.atan2(fin.x, fin.z - cibleFin.z);
    const a0 = aFin - 2.2;
    await this._cameraPrise(this.animer(5200, (t) => {
      const k = Plateau3D.ease(t);
      const ang = a0 + (aFin - a0) * k;
      const r = 17 + (rFin - 17) * k;
      const h = 17 + (fin.y - 17) * k;
      const cz = cibleFin.z * k;
      this.camera.position.set(Math.sin(ang) * r, h, cz + Math.cos(ang) * r);
      this.controles.target.set(0, 0, cz);
    }, true));
    this.camera.position.copy(fin);
    this.controles.target.copy(cibleFin);
    this.controles.enabled = true;
  }

  /** Complice sauvé ou perdu : plan sur sa figure 3D qui se transforme. */
  async cineComplice(id, statut) {
    const c = NV.COMPLICES[id];
    const fig = this.posFigure(id, 0.7);
    this.memoriserVue();
    await this.plan(fig, 2.6, 1.5, 1200);
    const lum = c._lumiere;
    if (statut === 'sauve') {
      this.particules(fig.clone().setY(this.HAUT + 0.3), [c.couleur, '#ffffff', c.couleurClaire], 'eclat', 2400);
      const i0 = lum.intensity;
      this.animer(1600, (t) => { lum.intensity = i0 + Math.sin(t * Math.PI) * 30; }, true);
    } else {
      this.particules(fig.clone().setY(this.HAUT + 0.1), ['#1a0a10', '#3a0b18', '#55101f'], 'fumee', 2600);
      const i0 = lum.intensity;
      this.animer(1600, (t) => { lum.intensity = i0 * (Math.random() > 0.3 ? 1 - t * 0.8 : 0.1); lum.color.set(t > 0.5 ? '#ff2a3a' : c.couleur); }, true);
    }
    await this.attendre(1800);
  }

  /** Attaque du Dark Master : plan sur la pioche Attaque, lumière rouge. */
  async cineAttaque() {
    const P = this.pioches.attaque;
    this.memoriserVue();
    const cible = P.base.clone();
    this._teinte('#ff2a3a', 1700);
    this.particules(cible.clone().setY(this.HAUT + 0.3), ['#ff2a3a', '#ff7a2a', '#b0102a'], 'braises', 1800);
    await this.plan(cible, 3.0, 3.2, 1100);
    await this.attendre(500);
  }

  /** Fin de manche : la caméra se pose sur la pioche Fin de manche. */
  async cineFinManche() {
    const P = this.pioches.fin;
    this.memoriserVue();
    this._teinte('#ffd23f', 1300);
    await this.plan(P.base.clone(), 3.4, 3.8, 1100);
    await this.attendre(350);
  }

  /** Face-à-face : le pion du joueur et la figure du Complice dans le même cadre. */
  async cineFaceAFace(joueur, id) {
    const pion = this.pions[joueur.id];
    this.memoriserVue();
    const c = NV.COMPLICES[id];
    const lum = c._lumiere, i0 = lum.intensity;
    this.animer(1600, (t) => { lum.intensity = i0 + Math.sin(t * Math.PI) * 10; }, true);
    const milieu = pion.position.clone().lerp(this.posFigure(id, 0.6), 0.5).setY(this.HAUT + 0.55);
    await this.plan(milieu, 2.5, 1.7, 1100);
    await this.attendre(700);
  }

  /** Fin de partie : tour du plateau (victoire) ou ville qui s'assombrit (défaite). */
  async cineFin(victoire) {
    this.controles.enabled = false;
    if (victoire) {
      this.particules(new THREE.Vector3(0, this.HAUT, 0), ['#e6007e', '#1aa3e8', '#3daa35', '#f05a1a', '#ffffff'], 'confettis', 5200);
    } else {
      const f0 = this.scene.fog.color.clone(), b0 = this.scene.background.clone(), h0 = this.hemi.intensity;
      this.animer(2600, (t) => {
        const r = new THREE.Color('#2a0408');
        this.scene.fog.color.copy(f0).lerp(r, t);
        this.scene.background.copy(b0).lerp(r, t * 0.7);
        this.hemi.intensity = h0 * (1 - t * 0.6);
      }, true);
    }
    const r = 15, h = 11;
    const a0 = Math.atan2(this.camera.position.x, this.camera.position.z);
    const p0 = this.camera.position.clone(), t0 = this.controles.target.clone();
    this._idVue++;
    await this._cameraPrise(this.animer(5200, (t) => {
      const k = Plateau3D.ease(t);
      const ang = a0 + k * (victoire ? Math.PI * 2 : 0.6);
      const cible = new THREE.Vector3(Math.sin(ang) * r, h, Math.cos(ang) * r);
      this.camera.position.lerpVectors(p0, cible, Math.min(1, t * 2.5));
      if (t > 0.4) this.camera.position.copy(cible);
      this.controles.target.lerpVectors(t0, new THREE.Vector3(0, 0, 0), Math.min(1, t * 2));
    }, true));
    this.controles.enabled = true;
  }

  /** Teinte brièvement l'éclairage d'ambiance. */
  _teinte(couleur, duree) {
    const h = this.hemi, c0 = h.color.clone(), cible = new THREE.Color(couleur);
    this.animer(duree, (t) => { h.color.copy(c0).lerp(cible, Math.sin(t * Math.PI) * 0.75); }, true)
      .then(() => h.color.copy(c0));
  }
}

NV_etendre(Plateau3D, Cinematiques3D);
