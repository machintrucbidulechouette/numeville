/* =====================================================================
   Numéville 3D — animations du mode Pro
   Vol en Jetpack, glissade du Toboggan à pop-ups, effets des cases malus,
   cinématiques de victoire totale et de défaite (hologramme du Dark Master).
   Caméra : trajectoires lissées (courbes de Catmull-Rom) pour la position
   et pour le point regardé.
   (méthodes ajoutées à la classe Plateau3D, voir js/3d/plateau3d.js)
   ===================================================================== */

class CinematiquesPro3D {
  /* ---------- outils ---------- */
  /** Le pion quitte sa case et réserve sa place sur la case d'arrivée ; renvoie sa position finale. */
  _preparerTrajet(pion, arrivee) {
    const depart = pion.userData.cle;
    pion.userData.cle = null;
    this._ranger(depart, 260);
    pion.userData.cle = arrivee;
    const occ = this._occupants(arrivee);
    const b = this._posEmplacement(arrivee, occ.indexOf(pion), occ.length);
    this._ranger(arrivee, 260, pion);
    return b;
  }

  /* ---------- Jetpack ---------- */
  _jetpack3D() {
    const g = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: '#c9d2e6', metalness: 0.8, roughness: 0.3 });
    for (const x of [-0.09, 0.09]) {
      const reservoir = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.26, 16), metal);
      reservoir.position.set(x, 0.32, -0.17);
      const flamme = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.32, 14, 1, true),
        new THREE.MeshBasicMaterial({ color: '#ffb43f', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
      flamme.rotation.x = Math.PI;
      flamme.position.set(x, 0.03, -0.17);
      const coeur = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.2, 10, 1, true),
        new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
      coeur.rotation.x = Math.PI;
      coeur.position.set(x, 0.09, -0.17);
      g.add(reservoir, flamme, coeur);
      (g.userData.flammes = g.userData.flammes || []).push(flamme, coeur);
    }
    const lumiere = new THREE.PointLight('#ff9a3a', 0, 3, 1.5);
    lumiere.position.set(0, 0, -0.17);
    g.add(lumiere);
    g.userData.lumiere = lumiere;
    return g;
  }

  /**
   * Vol en Jetpack au-dessus des cases : le pion s'accroupit, décolle dans un nuage de fumée,
   * suit une courbe au-dessus du chemin (et des escaliers), puis se pose avec un rebond.
   */
  async volJetpack(joueur, chemin) {
    const pion = this.pions[joueur.id];
    if (!chemin.length) return;
    const a = pion.position.clone();
    const b = this._preparerTrajet(pion, chemin[chemin.length - 1]);
    const jet = this._jetpack3D();
    pion.add(jet);
    const flammes = (k) => {
      for (const f of jet.userData.flammes) { f.scale.set(1, k * (0.8 + Math.random() * 0.4), 1); f.material.opacity = Math.min(1, k) * 0.9; }
      jet.userData.lumiere.intensity = k * 6;
    };
    flammes(0);
    // 1. accroupi, les réacteurs s'allument
    await this.animer(380, (t) => { pion.scale.set(1 + t * 0.12, 1 - t * 0.18, 1 + t * 0.12); flammes(t * 0.6); });
    this.particules(a.clone().add(new THREE.Vector3(0, 0.1, 0)), ['#cfd6e6', '#8a93a8', '#ffffff'], 'fumee', 1600);
    this._onde(a, '#ffb43f', 700, 0);
    // 2. vol le long d'une courbe au-dessus du chemin
    const hMax = Math.max(a.y, b.y, ...chemin.map((i) => this.posCase(i).y));
    const pts = [a.clone(), a.clone().add(new THREE.Vector3(0, 1.2, 0))];
    const n = chemin.length;
    for (let i = 1; i < n - 1; i += Math.max(1, Math.floor(n / 4))) pts.push(this.posCase(chemin[i]).setY(hMax + 2.0 + Math.sin(i / n * Math.PI) * 0.8));
    pts.push(b.clone().add(new THREE.Vector3(0, 1.3, 0)), b.clone());
    const courbe = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const duree = Math.min(2600, 900 + n * 170);
    const direction = new THREE.Vector3();
    let tPrec = 0, braises = 0;
    await this.animer(duree, (t) => {
      const k = Plateau3D.ease(t);
      pion.position.copy(courbe.getPointAt(k));
      pion.scale.set(1, 1 + Math.sin(t * Math.PI) * 0.06, 1);
      courbe.getTangentAt(Math.min(0.999, k), direction);
      pion.rotation.z = THREE.MathUtils.clamp(-direction.x * 0.5, -0.45, 0.45);
      pion.rotation.x = THREE.MathUtils.clamp(direction.z * 0.5, -0.45, 0.45);
      flammes(t < 0.85 ? 1 : 1 - (t - 0.85) / 0.15 * 0.7);
      // traînée d'étincelles
      braises += (t - tPrec) * duree; tPrec = t;
      if (braises > 140 && t < 0.92) { braises = 0; this.particules(pion.position.clone(), ['#ffb43f', '#ff6a2a', '#fff1b0'], 'braises', 650); }
    });
    // 3. atterrissage avec rebond
    pion.position.copy(b);
    pion.rotation.set(0, pion.rotation.y, 0);
    this._son('pas');
    this._onde(b, '#ffd23f', 800, 0);
    await this.animer(360, (t) => { const s = Math.sin(t * Math.PI); pion.scale.set(1 + s * 0.15, 1 - s * 0.2, 1 + s * 0.15); flammes((1 - t) * 0.3); });
    pion.scale.set(1, 1, 1);
    pion.remove(jet);
    pion.userData.sol = b.y;
  }

  /* ---------- Toboggan à pop-ups ---------- */
  /** Le pion glisse de case en case, sans sauter, en tournoyant légèrement, entouré de fenêtres pop-up. */
  async glisserPion(joueur, chemin) {
    const pion = this.pions[joueur.id];
    if (!chemin.length) return;
    const b = this._preparerTrajet(pion, chemin[chemin.length - 1]);
    const pts = [pion.position.clone(), ...chemin.slice(0, -1).map((i) => this.posCase(i)), b];
    const courbe = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const r0 = pion.rotation.y;
    await this.animer(380 * chemin.length, (t) => {
      const k = t * t * (1.6 - 0.6 * t); // accélère dans la pente
      pion.position.copy(courbe.getPointAt(Math.min(1, k)));
      pion.rotation.y = r0 + k * Math.PI * 2;
      pion.rotation.z = Math.sin(t * Math.PI * 6) * 0.15 * (1 - t);
    });
    pion.position.copy(b);
    pion.rotation.set(0, r0, 0);
    pion.userData.sol = b.y;
    this._son('pas');
    this._onde(b, '#ff3a44', 700, 0);
  }

  /** Petite fenêtre « pop-up » 3D qui jaillit puis s'efface. */
  _popup(pos, delai) {
    setTimeout(() => {
      const cv = document.createElement('canvas'); cv.width = 128; cv.height = 96;
      const g = cv.getContext('2d');
      g.fillStyle = '#f4f6ff'; g.fillRect(0, 0, 128, 96);
      g.fillStyle = ['#ff3a44', '#ff9a1a', '#e6007e'][Math.floor(Math.random() * 3)]; g.fillRect(0, 0, 128, 20);
      g.fillStyle = '#fff'; g.font = '700 16px sans-serif'; g.fillText('✕', 110, 16);
      g.fillStyle = '#20264a'; g.font = '800 19px sans-serif'; g.textAlign = 'center';
      g.fillText(['GAGNÉ !!!', 'CLIQUEZ', '-90 %', 'ALERTE'][Math.floor(Math.random() * 4)], 64, 52);
      g.fillStyle = '#3d7bff'; g.fillRect(34, 64, 60, 20);
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
      s.renderOrder = 9;
      const p0 = pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.6, 0.4, (Math.random() - 0.5) * 1.2));
      s.position.copy(p0);
      this.scene.add(s);
      this.animer(1300, (k) => {
        const e = Plateau3D.easeOut(Math.min(1, k * 3));
        s.scale.set(0.62 * e, 0.47 * e, 1);
        s.position.y = p0.y + k * 0.9;
        s.material.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      }).then(() => { this.scene.remove(s); t.dispose(); s.material.dispose(); });
    }, delai);
  }

  /** Effet visuel à l'arrivée sur une case malus. */
  effetMalus(type, joueur) {
    const pion = this.pions[joueur.id];
    if (!pion || this.mouvementReduit) return;
    const p = pion.position.clone();
    this._onde(p, '#ff3a44', 900, 0);
    if (type === 'toboggan') {
      for (let i = 0; i < 7; i++) this._popup(p, i * 140);
    } else {
      // batterie à plat : étincelles et lumière qui vacille
      this.particules(p.clone().add(new THREE.Vector3(0, 0.6, 0)), ['#ffe14a', '#ffffff', '#ff6a2a'], 'braises', 1200);
      const l = new THREE.PointLight('#ff3a44', 0, 4, 1.4);
      l.position.copy(p).add(new THREE.Vector3(0, 1, 0));
      this.scene.add(l);
      this.animer(1400, (t) => { l.intensity = (Math.random() < 0.5 ? 8 : 1) * (1 - t); }).then(() => this.scene.remove(l));
      const port = pion.userData.portrait;
      this.animer(1400, () => { port.material.opacity = Math.random() < 0.35 ? 0.25 : 1; }).then(() => { port.material.opacity = 1; });
      port.material.transparent = true;
    }
  }

  /* ---------- fin de partie (mode Pro) ---------- */
  /**
   * Victoire totale ou défaite. `legende(titre, texte, couleur)` met à jour la légende du bandeau cinéma.
   * Toutes les étapes sont des animations « cinématiques » : un clic ou Espace les passe.
   */
  async cineFinPro(totale, legende = () => {}) {
    this.controles.enabled = false;
    this._idVue++;
    this._cibleNuit = 0; this._fNuit = 0; this._teinteF = 0;
    if (totale) await this._cineVictoireTotale(legende);
    else await this._cineDefaite(legende);
    this.controles.enabled = true;
  }

  /** Suit en même temps une courbe pour la caméra et une courbe pour le point regardé. */
  _suivreCourbes(positions, cibles, duree, chaqueImage) {
    const cP = new THREE.CatmullRomCurve3(positions, false, 'centripetal');
    const cC = new THREE.CatmullRomCurve3(cibles, false, 'centripetal');
    return this._cameraPrise(this.animer(duree, (t) => {
      const k = Plateau3D.ease(t);
      this.camera.position.copy(cP.getPoint(k));
      this.controles.target.copy(cC.getPoint(k));
      if (chaqueImage) chaqueImage(k, t);
    }, true));
  }

  /**
   * Victoire totale : la ville est éteinte, la caméra descend en spirale depuis le ciel et passe
   * devant chaque Complice libéré, qui s'illumine à son passage ; puis elle remonte en grue
   * pendant un feu d'artifice aux couleurs des six Complices.
   */
  async _cineVictoireTotale(legende) {
    const ids = NV.PRO.COTES.map((c) => c.c);
    const lumieres = ids.map((id) => NV.COMPLICES[id]._lumiere);
    lumieres.forEach((l) => { l.userData.i0 = 12; l.intensity = 0.3; });
    this._fCrep = 0.75;
    // ciel → spirale autour des quartiers → grue finale
    const pos = [this.camera.position.clone(), new THREE.Vector3(0, 24, 3)];
    const cib = [this.controles.target.clone(), new THREE.Vector3(0, 0, 0)];
    ids.forEach((id, i) => {
      const f = this.posFigure(id, 0.7), c = NV.PRO.COTES[i];
      pos.push(new THREE.Vector3(f.x + c.n.x * 4.4 - c.t.x * 1.0, f.y + 2.6 + (5 - i) * 0.4, f.z + c.n.z * 4.4 - c.t.z * 1.0));
      cib.push(f.clone());
    });
    pos.push(new THREE.Vector3(0, 6, 15), new THREE.Vector3(0, 15, 17));
    cib.push(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, 3.5, 0));
    const N = pos.length - 1;
    const allume = new Set();
    const couleurs = ids.map((id) => NV.COMPLICES[id].couleurClaire);
    await this._suivreCourbes(pos, cib, 11500, (k) => {
      ids.forEach((id, i) => {
        if (allume.has(id) || k < (i + 1.6) / N) return;
        allume.add(id);
        const c = NV.COMPLICES[id], f = this.posFigure(id, 0.2);
        const l = lumieres[i];
        this.animer(900, (u) => { l.intensity = 0.3 + Plateau3D.easeOut(u) * 11.7 + Math.sin(u * Math.PI) * 10; }, true).then(() => { l.intensity = 12; });
        this._onde(f, c.couleurClaire, 1300, 0);
        this.particules(f, [c.couleurClaire, '#ffffff'], 'paillettes', 2200);
        this._son('carillon', { n: i });
        legende(`${c.sauveNom} est libre !`, `Le quartier de ${c.nom} se rallume.`, c.couleur);
      });
      this._fCrep = 0.75 * (1 - Math.min(1, Math.max(0, (k - 0.6) / 0.3)));
      if (k > 0.82 && !this._feuLance) {
        this._feuLance = true;
        legende('Numéville est libérée !', 'Les six Complices sont sauvés : bravo, Éclaireurs !', '#38e1ff');
        this._feuArtifice(couleurs);
      }
    });
    this._feuLance = false;
    this._fCrep = 0;
    lumieres.forEach((l) => { l.intensity = 12; });
    await this.attendre(1600);
  }

  _feuArtifice(couleurs) {
    for (let i = 0; i < 9; i++) {
      setTimeout(() => {
        const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 4;
        const c = couleurs[i % couleurs.length];
        this.particules(new THREE.Vector3(Math.cos(a) * r, 5 + Math.random() * 2.5, Math.sin(a) * r), [c, '#ffffff', c], 'eclat', 1900);
        this._son('petard');
      }, i * 330);
    }
    this.particules(new THREE.Vector3(0, this.HAUT, 0), couleurs.concat('#ffffff'), 'confettis', 5200);
  }

  /** Texture de lignes de balayage pour l'hologramme. */
  _texBalayage() {
    const cv = document.createElement('canvas'); cv.width = 4; cv.height = 128;
    const g = cv.getContext('2d');
    for (let y = 0; y < 128; y += 4) { g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(0, y, 4, 2); }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 3);
    return t;
  }

  /** Lueur ronde (yeux du Dark Master). */
  _texLueur() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    const d = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    d.addColorStop(0, 'rgba(255,255,255,1)'); d.addColorStop(0.18, 'rgba(255,60,60,1)'); d.addColorStop(0.5, 'rgba(255,0,20,.35)'); d.addColorStop(1, 'rgba(255,0,0,0)');
    g.fillStyle = d; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  }

  /** Hologramme géant du Dark Master au centre du plateau. */
  _hologrammeDM() {
    const D = window.NV_TEXTURES_PRO.darkMaster;
    const groupe = new THREE.Group();
    const h = 4.6, w = h * D.ratio;
    // projecteur au sol
    const socle = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.12, 48), new THREE.MeshStandardMaterial({ color: '#141a33', metalness: 0.7, roughness: 0.3, emissive: '#ff1a2a', emissiveIntensity: 0.4 }));
    socle.position.y = this.HAUT + 0.06;
    const anneau = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.03, 8, 64), new THREE.MeshBasicMaterial({ color: '#ff3a44' }));
    anneau.rotation.x = Math.PI / 2; anneau.position.y = this.HAUT + 0.13;
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.4, 1.05, h + 1, 48, 1, true),
      new THREE.MeshBasicMaterial({ color: '#7fd2ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    cone.position.y = this.HAUT + (h + 1) / 2;
    // le portrait, toujours face à la caméra
    const pivot = new THREE.Group();
    pivot.position.y = this.HAUT + 1.0 + h / 2;
    const tex = new THREE.TextureLoader().load(D.src); tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: '#8fdcff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide, toneMapped: false });
    const plan = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    plan.renderOrder = 20;
    const matScan = new THREE.MeshBasicMaterial({ map: this._texBalayage(), alphaMap: tex, color: '#9fe6ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide });
    const scan = new THREE.Mesh(new THREE.PlaneGeometry(w, h), matScan);
    scan.position.z = 0.01; scan.renderOrder = 21;
    pivot.add(plan, scan);
    // les yeux rouges
    const lueur = this._texLueur();
    const yeux = D.yeux.map(([u, v]) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: lueur, color: '#ff2030', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false }));
      s.position.set((u - 0.5) * w, (0.5 - v) * h, 0.05);
      s.scale.setScalar(0.5);
      s.renderOrder = 22;
      pivot.add(s);
      return s;
    });
    const lumYeux = new THREE.PointLight('#ff1020', 0, 14, 1.2);
    lumYeux.position.set(0, (0.5 - D.yeux[0][1]) * h, 0.6);
    pivot.add(lumYeux);
    groupe.add(socle, anneau, cone, pivot);
    groupe.position.set(0, 0, -0.4);
    this.scene.add(groupe);
    return { groupe, pivot, mat, matScan, cone, yeux, lumYeux, h, w };
  }

  /**
   * Défaite : les quartiers s'éteignent un à un, la caméra recule en contre-plongée vers le centre,
   * puis le Dark Master surgit en hologramme géant, ses yeux s'allument en rouge et il éclate de rire.
   */
  async _cineDefaite(legende) {
    const ids = NV.ORDRE_COMPLICES;
    // la ville s'assombrit et rougit
    const f0 = this.scene.fog.color.clone(), b0 = this.scene.background.clone(), h0 = this.hemi.intensity, s0 = this.soleil.intensity;
    this.animer(3200, (t) => {
      const r = new THREE.Color('#1c0206');
      this.scene.fog.color.copy(f0).lerp(r, t);
      this.scene.background.copy(b0).lerp(r, t * 0.8);
      this.hemi.intensity = h0 * (1 - t * 0.7);
      this.soleil.intensity = s0 * (1 - t * 0.75);
    }, true);
    // les lumières des quartiers s'éteignent l'une après l'autre en grésillant
    ids.forEach((id, i) => {
      const l = NV.COMPLICES[id]._lumiere, i0 = l.intensity;
      setTimeout(() => {
        this._son('coupure');
        this.animer(500, (t) => { l.intensity = t > 0.9 ? 0.15 : i0 * (Math.random() < 0.5 ? 0.1 : 1 - t); }, true).then(() => { l.intensity = 0.15; });
      }, 300 + i * 420);
    });
    // caméra : recul en arc puis contre-plongée vers le centre
    const centre = new THREE.Vector3(0, 0, -0.4);
    await this._suivreCourbes(
      [this.camera.position.clone(), new THREE.Vector3(7, 7, 12), new THREE.Vector3(2.5, 2.2, 12), new THREE.Vector3(0, 1.1, 10.2)],
      [this.controles.target.clone(), new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, 3.4, -0.4)],
      3400);
    // l'hologramme surgit
    legende('Le Dark Master…', 'Une silhouette se dresse au cœur de Numéville.', '#ff3a44');
    const H = this._hologrammeDM();
    const camPos = () => this.camera.position;
    const orienter = () => { H.pivot.rotation.y = Math.atan2(camPos().x - H.groupe.position.x, camPos().z - H.groupe.position.z); };
    this._son('hologramme');
    await this.animer(1300, (t) => {
      orienter();
      const k = Plateau3D.easeOut(t);
      H.pivot.scale.set(1 + (Math.random() - 0.5) * 0.08 * (1 - t), k, 1);
      H.mat.opacity = (Math.random() < 0.2 * (1 - t) ? 0.15 : 0.95) * Math.min(1, t * 2);
      H.matScan.opacity = 0.35 * t;
      H.cone.material.opacity = 0.05 * t;
      H.pivot.position.x = Math.random() < 0.08 ? (Math.random() - 0.5) * 0.3 : 0;
    }, true);
    H.pivot.position.x = 0;
    // les yeux s'allument, il rit ; la caméra s'approche lentement de son visage, secouée par le rire
    legende('… éclate de rire.', 'Numéville reste sous son emprise.', '#ff3a44');
    this._son('rire');
    const visage = new THREE.Vector3(0, H.pivot.position.y + H.yeux[0].position.y, H.groupe.position.z);
    const p0 = this.camera.position.clone(), c0 = this.controles.target.clone();
    const p1 = new THREE.Vector3(0.4, visage.y - 0.6, 5.2);
    await this._cameraPrise(this.animer(4600, (t) => {
      orienter();
      const k = Plateau3D.ease(t);
      const yeux = Math.min(1, t * 2.5);
      for (const y of H.yeux) { y.material.opacity = yeux; y.scale.setScalar(0.45 + yeux * 0.35 + Math.sin(t * 40) * 0.04); }
      H.lumYeux.intensity = yeux * 30;
      // secousses au rythme du rire
      const rire = Math.max(0, Math.sin(t * Math.PI * 9)) * (t > 0.1 && t < 0.85 ? 1 : 0);
      H.pivot.position.y = this.HAUT + 1.0 + H.h / 2 + rire * 0.05;
      H.mat.opacity = Math.random() < 0.05 ? 0.4 : 0.95;
      H.matScan.map.offset.y = -t * 6;
      this.camera.position.lerpVectors(p0, p1, k).add(new THREE.Vector3((Math.random() - 0.5) * rire * 0.05, (Math.random() - 0.5) * rire * 0.05, 0));
      this.controles.target.lerpVectors(c0, visage, k);
    }, true));
    // l'hologramme se brouille et disparaît
    await this.animer(800, (t) => {
      H.pivot.scale.set(1 + t * 0.6, 1 - Plateau3D.ease(t), 1);
      H.mat.opacity = 0.95 * (1 - t) * (Math.random() < 0.4 ? 0.3 : 1);
      H.matScan.opacity = 0.35 * (1 - t);
      H.cone.material.opacity = 0.05 * (1 - t);
      for (const y of H.yeux) y.material.opacity = 1 - t;
      H.lumYeux.intensity = 30 * (1 - t);
    }, true);
    this.scene.remove(H.groupe);
    await this.attendre(500);
  }
}

NV_etendre(Plateau3D, CinematiquesPro3D);

/* petite surprise sans effet sur la partie */
(function () {
  let n = 0, t0 = 0;
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#hud .logo')) return;
    const t = performance.now();
    n = t - t0 < 600 ? n + 1 : 1;
    t0 = t;
    const p = window.__plateau;
    if (n < 5 || !p || p.enCinematique || p._enFete) return;
    n = 0;
    p._enFete = true;
    if (window.NV_AUDIO) NV_AUDIO.effet('fete');
    const lums = NV.ORDRE_COMPLICES.map((id) => NV.COMPLICES[id]._lumiere).filter(Boolean);
    const avant = lums.map((l) => l.color.clone());
    const pions = Object.values(p.pions);
    const dy = pions.map(() => 0), dr = pions.map(() => 0); // décalages appliqués (retirés à la fin)
    const c = new THREE.Color();
    p.particules(new THREE.Vector3(0, p.HAUT, 0), ['#ff4fd8', '#38e1ff', '#ffd23f', '#6fd864', '#ff8a4f', '#a493ff'], 'confettis', 4200);
    p.animer(4200, (t) => {
      lums.forEach((l, i) => l.color.copy(c.setHSL((t * 3 + i / lums.length) % 1, 1, 0.55)));
      pions.forEach((q, i) => {
        const y = Math.abs(Math.sin(t * Math.PI * 8 + i * 0.8)) * 0.35 * (1 - t);
        const r = Math.sin(t * Math.PI * 4 + i) * 0.7 * (1 - t);
        q.position.y += y - dy[i]; q.rotation.y += r - dr[i];
        dy[i] = y; dr[i] = r;
      });
    }).then(() => {
      lums.forEach((l, i) => l.color.copy(avant[i]));
      pions.forEach((q, i) => { q.position.y -= dy[i]; q.rotation.y -= dr[i]; });
      p._enFete = false;
    });
  });
})();
