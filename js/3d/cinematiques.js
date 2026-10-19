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
      // sobre : une onde douce au sol, quelques paillettes qui montent lentement, la lumière du quartier qui s'éclaire
      const sol = fig.clone().setY(this.HAUT);
      setTimeout(() => {
        this._onde(sol, c.couleurClaire, 1600, 0);
        this.particules(sol.clone().setY(this.HAUT + 0.2), [c.couleurClaire, '#ffffff'], 'paillettes', 2600);
      }, 250);
      const i0 = lum.intensity;
      this.animer(2200, (t) => { lum.intensity = i0 + Math.sin(t * Math.PI) * 14; }, true).then(() => { lum.intensity = i0; });
      // léger travelling avant pendant la transformation
      const p0 = this.camera.position.clone(), cible = this.controles.target.clone();
      await this._cameraPrise(this.animer(1800, (t) => {
        this.camera.position.lerpVectors(p0, cible, Plateau3D.ease(t) * 0.12);
      }, true));
    } else {
      this.particules(fig.clone().setY(this.HAUT + 0.1), ['#1a0a10', '#3a0b18', '#55101f'], 'fumee', 2600);
      const i0 = lum.intensity;
      this.animer(1600, (t) => { lum.intensity = i0 * (Math.random() > 0.3 ? 1 - t * 0.8 : 0.1); lum.color.set(t > 0.5 ? '#ff2a3a' : c.couleur); }, true);
    }
    await this.attendre(statut === 'sauve' ? 700 : 1800);
  }

  /**
   * Attaque du Dark Master : la ville s'assombrit, des éclairs rouges frappent la pioche Attaque,
   * les lumières des Complices vacillent, la carte du dessus se soulève en tremblant
   * et une onde de choc secoue la caméra.
   */
  async cineAttaque() {
    const P = this.pioches.attaque;
    this.memoriserVue();
    const base = P.base.clone().setY(this.HAUT);
    const duree = 2300;

    // la ville s'assombrit (même mécanisme que le crépuscule), teinte rouge
    this.animer(duree + 300, (t) => { this._fCrep = (t < 0.2 ? Plateau3D.ease(t / 0.2) : t > 0.8 ? 1 - Plateau3D.ease((t - 0.8) / 0.2) : 1) * 0.85; }, true)
      .then(() => { this._fCrep = 0; });
    this._teinte('#ff2a3a', duree);

    // éclairs : flashs rouges brefs et irréguliers au-dessus de la pioche
    const eclair = new THREE.PointLight('#ff3a4a', 0, 12, 1.1);
    eclair.position.copy(base).setY(this.HAUT + 2.6);
    this.scene.add(eclair);
    const flashs = [0.1, 0.15, 0.38, 0.43, 0.46, 0.7];
    this.animer(duree, (t) => {
      let v = 0;
      for (const f of flashs) { const d = t - f; if (d >= 0 && d < 0.045) v = Math.max(v, 1 - d / 0.045); }
      eclair.intensity = v * 55;
    }, true).then(() => this.scene.remove(eclair));

    // les lumières des quartiers vacillent comme une panne
    for (const id of NV.ORDRE_COMPLICES) {
      const l = NV.COMPLICES[id]._lumiere, i0 = l.intensity;
      this.animer(duree, (t) => { l.intensity = t > 0.92 ? i0 : i0 * (Math.random() < 0.25 ? 0.15 : 0.7); }, true).then(() => { l.intensity = i0; });
    }

    // onde de choc rouge et braises au moment du gros éclair
    setTimeout(() => {
      this._onde(base, '#ff2a3a', 1100, 0);
      this._onde(base, '#ff7a2a', 1100, 220);
      this.particules(base.clone().setY(this.HAUT + 0.3), ['#ff2a3a', '#ff7a2a', '#b0102a'], 'braises', 1800);
    }, duree * 0.38);

    // la carte du dessus se soulève et tremble
    const carte = P.cartes[P.cartes.length - 1];
    if (carte) {
      const y0 = carte.position.y, x0 = carte.position.x, z0 = carte.position.z;
      this.animer(duree, (t) => {
        const k = Plateau3D.ease(Math.max(0, (t - 0.3) / 0.7));
        const tremble = 0.025 * k * (1 - Math.max(0, t - 0.85) / 0.15);
        carte.position.set(x0 + (Math.random() - 0.5) * tremble, y0 + k * 0.6, z0 + (Math.random() - 0.5) * tremble);
        carte.rotation.x = Math.sin(t * 40) * 0.05 * k;
      }, true);
    }

    // caméra : plongée sur la pioche puis secousse à l'impact
    await this.plan(base, 3.0, 3.2, 850);
    const p = this.camera.position.clone();
    await this._cameraPrise(this.animer(900, (t) => {
      const a = 0.09 * Math.pow(1 - t, 2);
      this.camera.position.set(p.x + (Math.random() - 0.5) * a, p.y + (Math.random() - 0.5) * a, p.z + (Math.random() - 0.5) * a);
    }, true));
    this.camera.position.copy(p);
    await this.attendre(450);
  }

  /** Fin de manche : la caméra se pose sur la pioche Fin de manche. */
  /**
   * Fin de manche : le crépuscule tombe sur Numéville, la caméra tourne autour de la pioche
   * « Fin de manche » pendant qu'une onde dorée parcourt le plateau, puis la carte du dessus
   * se soulève et tourne sur elle-même, prête à être révélée.
   */
  async cineFinManche() {
    const P = this.pioches.fin;
    this.memoriserVue();
    const base = P.base.clone().setY(this.HAUT);
    const duree = 2600;

    // crépuscule : la lumière baisse puis remonte (géré par _appliquerAmbiance)
    this.animer(duree + 500, (t) => { this._fCrep = t < 0.3 ? Plateau3D.ease(t / 0.3) : t > 0.8 ? 1 - Plateau3D.ease((t - 0.8) / 0.2) : 1; }, true)
      .then(() => { this._fCrep = 0; });

    // halo doré au-dessus de la pioche + ondes sur le plateau
    const halo = new THREE.PointLight('#ffcf4a', 0, 7, 1.4);
    halo.position.copy(base).setY(this.HAUT + 1.3);
    this.scene.add(halo);
    this.animer(duree + 300, (t) => { halo.intensity = Math.pow(Math.sin(t * Math.PI), 0.7) * 16; }, true)
      .then(() => this.scene.remove(halo));
    this._onde(base, '#ffd23f', 1500, 0);
    this._onde(base, '#ffb43f', 1500, 450);
    this._onde(base, '#fff1b0', 1500, 900);

    // la carte du dessus se soulève en tournant
    const carte = P.cartes[P.cartes.length - 1];
    if (carte) {
      const y0 = carte.position.y, r0 = carte.rotation.y;
      this.animer(duree, (t) => {
        const k = Plateau3D.ease(Math.max(0, (t - 0.35) / 0.65));
        carte.position.y = y0 + k * 0.75 + Math.sin(t * Math.PI * 4) * 0.02 * k;
        carte.rotation.y = r0 + k * Math.PI * 2;
        carte.rotation.x = Math.sin(t * Math.PI * 2) * 0.08 * k;
      }, true);
      setTimeout(() => this.particules(base.clone().setY(this.HAUT + 0.5), ['#ffd23f', '#fff1b0', '#ff9f1a'], 'eclat', 1800), 900);
    }

    // caméra : arc de cercle descendant autour de la pioche
    this._idVue++;
    const p0 = this.camera.position.clone(), t0 = this.controles.target.clone();
    const rel = p0.clone().sub(base);
    const a0 = Math.atan2(rel.x, rel.z), r0 = Math.max(3.5, Math.hypot(rel.x, rel.z)), h0 = rel.y;
    const a1 = a0 + (a0 > 0 ? -0.75 : 0.75), r1 = 3.3, h1 = 2.6;
    const cibleFin = base.clone().setY(this.HAUT + 0.55);
    await this._cameraPrise(this.animer(duree, (t) => {
      const k = Plateau3D.ease(t);
      const a = a0 + (a1 - a0) * k, r = r0 + (r1 - r0) * k, h = h0 + (h1 - h0) * k;
      this.camera.position.set(base.x + Math.sin(a) * r, base.y + h, base.z + Math.cos(a) * r);
      this.controles.target.lerpVectors(t0, cibleFin, k);
    }, true));
    await this.attendre(250);
  }

  /** Onde lumineuse qui s'étend sur le plateau depuis un point. */
  _onde(centre, couleur, duree, delai = 0) {
    if (this.mouvementReduit) return;
    setTimeout(() => {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 64),
        new THREE.MeshBasicMaterial({ color: couleur, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(centre.x, this.HAUT + 0.012, centre.z);
      this.scene.add(m);
      this.animer(duree, (t) => { m.scale.setScalar(1 + Plateau3D.easeOut(t) * 9); m.material.opacity = 0.9 * (1 - t); })
        .then(() => { this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); });
    }, delai);
  }

  /* ---------- « Nuit blanche sur les écrans » ---------- */

  /** Cinématique de la carte : la nuit tombe, la lune se lève, des écrans s'allument au-dessus des quartiers. */
  async cineNuitBlanche() {
    this.memoriserVue();
    this.ambianceNuit(true);
    this._idVue++;
    const p0 = this.camera.position.clone(), t0 = this.controles.target.clone();
    // vue basse au ras du plateau, tournée vers la lune
    const p1 = new THREE.Vector3(1.2, 2.4, 8.2), t1 = new THREE.Vector3(-0.8, 2.2, -4);
    await this._cameraPrise(this.animer(2200, (t) => {
      const k = Plateau3D.ease(t);
      this.camera.position.lerpVectors(p0, p1, k);
      this.controles.target.lerpVectors(t0, t1, k);
    }, true));
    await this.attendre(1300);
  }

  /** Ambiance de nuit pendant la manche où l'effet « Nuit blanche » est actif (s'estompe ensuite). */
  ambianceNuit(actif) {
    this._cibleNuit = actif ? 1 : 0;
    if (actif && !this._decorNuit) this._creerDecorNuit();
  }

  _creerDecorNuit() {
    const groupe = new THREE.Group();
    // ciel étoilé en dôme
    const N = 420, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2, e = 0.08 + Math.random() * 0.9, r = 26;
      pos.set([Math.cos(a) * Math.cos(e) * r, 1 + Math.sin(e) * r * 0.6, Math.sin(a) * Math.cos(e) * r], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const etoiles = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#dfe8ff', size: 0.16, map: this._texParticule(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    groupe.add(etoiles);
    // lune
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const g = cv.getContext('2d');
    const d = g.createRadialGradient(128, 128, 30, 128, 128, 128);
    d.addColorStop(0, 'rgba(255,255,255,1)'); d.addColorStop(0.36, 'rgba(225,235,255,1)'); d.addColorStop(0.4, 'rgba(170,195,255,.45)'); d.addColorStop(1, 'rgba(120,150,255,0)');
    g.fillStyle = d; g.fillRect(0, 0, 256, 256);
    g.fillStyle = 'rgba(160,175,215,.35)';
    for (const [x, y, r] of [[108, 110, 12], [146, 140, 9], [122, 152, 6], [150, 104, 5]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
    const texLune = new THREE.CanvasTexture(cv); texLune.colorSpace = THREE.SRGBColorSpace;
    const lune = new THREE.Sprite(new THREE.SpriteMaterial({ map: texLune, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    lune.scale.setScalar(4.2);
    lune.position.set(-5, 7.5, -16);
    groupe.add(lune);
    // écrans allumés qui flottent au-dessus de la ville
    const ecrans = [];
    const texEcran = this._texEcran();
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.56),
        new THREE.MeshBasicMaterial({ map: texEcran, color: i % 3 ? '#9cc4ff' : '#c9a6ff', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      const a = (i / 14) * Math.PI * 2 + Math.random() * 0.3, r = 3.4 + Math.random() * 1.4;
      m.position.set(Math.cos(a) * r, this.HAUT + 1.1 + Math.random() * 0.9, Math.sin(a) * r);
      m.userData = { y0: m.position.y, ph: Math.random() * 6, rot: (Math.random() - 0.5) * 0.6 };
      groupe.add(m); ecrans.push(m);
    }
    const lumiere = new THREE.PointLight('#7fa8ff', 0, 14, 1.2);
    lumiere.position.set(-3, 6, -6);
    groupe.add(lumiere);
    this.scene.add(groupe);
    this._decorNuit = { groupe, etoiles, lune, ecrans, lumiere };
  }

  _texEcran() {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 104;
    const g = cv.getContext('2d');
    g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.roundRect(2, 2, 60, 100, 10); g.fill();
    g.fillStyle = 'rgba(30,45,90,.9)'; g.beginPath(); g.roundRect(7, 10, 50, 84, 5); g.fill();
    g.fillStyle = 'rgba(255,255,255,.75)';
    for (let y = 18; y < 88; y += 12) g.fillRect(12, y, 18 + ((y * 7) % 22), 5);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /** Mise à jour à chaque image : nuit (fondu), crépuscule de fin de manche, teinte des cinématiques. */
  _appliquerAmbiance(temps, dt) {
    if (!this._amb0) {
      this._amb0 = { hemiI: this.hemi.intensity, hemiC: this.hemi.color.clone(), solI: this.soleil.intensity, solC: this.soleil.color.clone(), bg: this.scene.background.clone() };
      this._fNuit = 0; this._cibleNuit = this._cibleNuit || 0; this._fCrep = this._fCrep || 0; this._teinteF = 0;
    }
    const cible = this._cibleNuit || 0;
    this._fNuit += (cible - this._fNuit) * (1 - Math.exp(-dt * 1.6));
    if (Math.abs(cible - this._fNuit) < 0.002) this._fNuit = cible;
    const n = this._fNuit, c = this._fCrep || 0, tf = this._teinteF || 0;
    if (!n && !c && !tf) {
      if (this._ambSale) { // revenir une fois aux valeurs d'origine, puis ne plus rien toucher
        const A = this._amb0;
        this.hemi.intensity = A.hemiI; this.hemi.color.copy(A.hemiC);
        this.soleil.intensity = A.solI; this.soleil.color.copy(A.solC);
        this.scene.background.copy(A.bg); this.scene.fog.color.copy(A.bg);
        this._ambSale = false;
      }
      if (this._decorNuit && cible === 0) { this.scene.remove(this._decorNuit.groupe); this._decorNuit = null; }
      return;
    }
    this._ambSale = true;
    const A = this._amb0;
    const NUIT = Plateau3D._C_NUIT || (Plateau3D._C_NUIT = { ciel: new THREE.Color('#02040d'), hemi: new THREE.Color('#5d78c9'), lune: new THREE.Color('#9db8ff'), crep: new THREE.Color('#2a1238'), crepH: new THREE.Color('#ffb070') });
    this.hemi.intensity = A.hemiI * (1 - Math.max(n * 0.42, c * 0.55));
    this.hemi.color.copy(A.hemiC).lerp(NUIT.hemi, n * 0.65).lerp(NUIT.crepH, c * 0.35);
    if (tf) this.hemi.color.lerp(this._teinteC, tf);
    this.soleil.intensity = A.solI * (1 - Math.max(n * 0.55, c * 0.65));
    this.soleil.color.copy(A.solC).lerp(NUIT.lune, n * 0.8);
    this.scene.background.copy(A.bg).lerp(NUIT.ciel, n * 0.9).lerp(NUIT.crep, c * 0.6);
    this.scene.fog.color.copy(this.scene.background);
    const D = this._decorNuit;
    if (D) {
      D.etoiles.material.opacity = n * (0.75 + Math.sin(temps * 3) * 0.08);
      D.lune.material.opacity = n;
      D.lumiere.intensity = n * 9;
      for (const e of D.ecrans) {
        const u = e.userData;
        e.position.y = u.y0 + Math.sin(temps * 1.3 + u.ph) * 0.12;
        e.rotation.y = Math.atan2(this.camera.position.x - e.position.x, this.camera.position.z - e.position.z) + u.rot;
        e.material.opacity = n * (0.55 + Math.sin(temps * 7 + u.ph * 3) * 0.12 + (Math.random() < 0.015 ? -0.4 : 0));
      }
    }
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
    // on repart de l'éclairage normal (sans nuit ni crépuscule) avant l'ambiance de fin
    this._cibleNuit = 0; this._fNuit = 0; this._fCrep = 0; this._teinteF = 0;
    if (this._amb0) this._appliquerAmbiance(0, 0);
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

  /** Teinte brièvement l'éclairage d'ambiance (appliquée par _appliquerAmbiance). */
  _teinte(couleur, duree) {
    this._teinteC = new THREE.Color(couleur);
    this.animer(duree, (t) => { this._teinteF = Math.sin(t * Math.PI) * 0.75; }, true)
      .then(() => { this._teinteF = 0; });
  }
}

NV_etendre(Plateau3D, Cinematiques3D);
