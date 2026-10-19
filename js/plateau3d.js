/* =====================================================================
   Numéville 3D — scène Three.js
   Plateau texturé, pions des Éclaireurs, dés 3D, jetons et pioches.
   Dépend de window.THREE et window.NV_ADDONS (chargés dans index.html).
   ===================================================================== */

class Plateau3D {
  constructor(conteneur) {
    this.conteneur = conteneur;
    this.TAILLE = 10;          // côté du plateau en unités 3D
    this.HAUT = 0.1;           // hauteur de la face supérieure du plateau
    this.anims = [];
    this.pions = {};
    this.jetons = {};          // id complice -> { bleus: [mesh], rouges: [mesh], badge }
    this.pioches = {};
    this.marqueurs = [];
    this.horloge = new THREE.Clock();
    this._init();
  }

  /* ---------- outils ---------- */
  versMonde(u, v, y = this.HAUT) {
    return new THREE.Vector3((u - 0.5) * this.TAILLE, y, (v - 0.5) * this.TAILLE);
  }
  posCase(index) { const c = NV.BOUCLE[index]; return this.versMonde(c.u, c.v); }
  posDepart(i) { const d = NV.DEPARTS[i]; return this.versMonde(d.u, d.v); }

  /** Anime sur `duree` ms ; `cine` = animation de cinématique (peut être passée). */
  animer(duree, maj, cine = false) {
    return new Promise((resolve) => {
      this.anims.push({ t0: performance.now(), duree, maj, resolve, cine });
    });
  }
  attendre(ms) { return this.animer(ms, () => {}, true); }
  static ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  static easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  chargerTexture(src, srgb = true) {
    const tex = new THREE.TextureLoader().load(src);
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    return tex;
  }

  /* ---------- initialisation de la scène ---------- */
  _init() {
    const w = this.conteneur.clientWidth, h = this.conteneur.clientHeight;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.setSize(w, h);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    this.conteneur.appendChild(r.domElement);

    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color('#070a16');
    scene.fog = new THREE.Fog('#070a16', 22, 48);

    const cam = this.camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 200);
    this.VUE = { pos: new THREE.Vector3(0, 13.2, 10.2), cible: new THREE.Vector3(0, 0, 1.1) };
    cam.position.copy(this.VUE.pos);

    const ctl = this.controles = new NV_ADDONS.OrbitControls(cam, r.domElement);
    ctl.target.copy(this.VUE.cible);
    ctl.enableDamping = true;
    ctl.dampingFactor = 0.08;
    ctl.minDistance = 5;
    ctl.maxDistance = 26;
    ctl.maxPolarAngle = 1.32;
    ctl.update();

    // Lumières
    this.mouvementReduit = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.cinematiques = !this.mouvementReduit;
    this.hemi = new THREE.HemisphereLight('#c8d6ff', '#1a1430', 1.1);
    scene.add(this.hemi);
    const soleil = this.soleil = new THREE.DirectionalLight('#ffffff', 2.2);
    soleil.position.set(-6, 14, 7);
    soleil.castShadow = true;
    soleil.shadow.mapSize.set(2048, 2048);
    Object.assign(soleil.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
    soleil.shadow.bias = -0.0005;
    scene.add(soleil);
    for (const id of NV.ORDRE_COMPLICES) {
      const c = NV.COMPLICES[id];
      const l = new THREE.PointLight(c.couleur, 6, 7, 1.6);
      const p = this.versMonde(c.zone.u, c.zone.v, 1.6);
      l.position.copy(p);
      scene.add(l);
      c._lumiere = l;
    }

    this._table();
    this._plateau();
    this._marqueurs();
    this._des();
    this._zonesJetons();
    this._pioches();

    window.addEventListener('resize', () => this.redimensionner());
    r.setAnimationLoop(() => this._boucle());
  }

  _table() {
    // Table sombre avec un léger quadrillage « circuit »
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#0c1124'; g.fillRect(0, 0, 512, 512);
    g.strokeStyle = 'rgba(80,120,255,0.10)'; g.lineWidth = 2;
    for (let i = 0; i <= 512; i += 64) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke();
    }
    g.fillStyle = 'rgba(120,160,255,0.18)';
    for (let i = 0; i <= 512; i += 64) for (let j = 0; j <= 512; j += 64) g.fillRect(i - 3, j - 3, 6, 6);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(14, 14);
    tex.colorSpace = THREE.SRGBColorSpace;
    const table = new THREE.Mesh(
      new THREE.CircleGeometry(40, 64),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0.05 })
    );
    table.rotation.x = -Math.PI / 2;
    table.position.y = -0.1;
    table.receiveShadow = true;
    this.scene.add(table);
  }

  _plateau() {
    const T = this.TAILLE;
    const tex = this.chargerTexture(window.NV_BOARD_TEXTURE);
    const bord = new THREE.MeshStandardMaterial({ color: '#141a33', roughness: 0.6, metalness: 0.3 });
    const dessus = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, metalness: 0.0 });
    const geo = new THREE.BoxGeometry(T, 0.2, T);
    const plateau = new THREE.Mesh(geo, [bord, bord, dessus, bord, bord, bord]);
    plateau.receiveShadow = true;
    plateau.castShadow = true;
    this.scene.add(plateau);

    // Liseré lumineux autour du plateau
    const cadre = new THREE.Mesh(
      new THREE.BoxGeometry(T + 0.16, 0.12, T + 0.16),
      new THREE.MeshStandardMaterial({ color: '#2a3a7a', emissive: '#1b2a6b', emissiveIntensity: 0.6, roughness: 0.4 })
    );
    cadre.position.y = -0.05;
    this.scene.add(cadre);
  }

  _marqueurs() {
    // Anneaux au sol utilisés pour signaler la case du joueur actif et les destinations possibles
    const geo = new THREE.RingGeometry(0.33, 0.43, 48);
    const creer = () => {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      this.scene.add(m);
      return m;
    };
    this.anneauActif = creer();
    this.anneauxDest = [creer(), creer()];
  }

  /* ---------- Dés ---------- */
  _faceDe(valeur, fond, point) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = fond; g.fillRect(0, 0, 128, 128);
    g.fillStyle = point;
    const P = { 1: [[64, 64]], 2: [[34, 34], [94, 94]], 3: [[30, 30], [64, 64], [98, 98]],
      4: [[34, 34], [94, 34], [34, 94], [94, 94]], 5: [[30, 30], [98, 30], [64, 64], [30, 98], [98, 98]],
      6: [[34, 28], [94, 28], [34, 64], [94, 64], [34, 100], [94, 100]] };
    for (const [x, y] of P[valeur]) { g.beginPath(); g.arc(x, y, 11, 0, Math.PI * 2); g.fill(); }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  _des() {
    // ordre des matériaux d'une boîte : +x, -x, +y, -y, +z, -z
    this.VALEURS_FACES = [1, 6, 2, 5, 3, 4];
    const creer = (fond, point, x) => {
      const mats = this.VALEURS_FACES.map((v) => new THREE.MeshStandardMaterial({
        map: this._faceDe(v, fond, point), roughness: 0.35, metalness: 0.05,
      }));
      let geo;
      try { geo = new NV_ADDONS.RoundedBoxGeometry(0.62, 0.62, 0.62, 4, 0.09); }
      catch (e) { geo = new THREE.BoxGeometry(0.62, 0.62, 0.62); }
      const de = new THREE.Mesh(geo, mats);
      de.castShadow = true;
      // posés au centre du plateau, sous les pioches Dark Master : jamais cachés par l'interface
      de.position.set(x, this.HAUT + 0.31, 1.5);
      de.userData.repos = de.position.clone();
      this.scene.add(de);
      return de;
    };
    this.deBlanc = creer('#f4f4f2', '#14151c', -0.55);
    this.deNoir = creer('#15151b', '#f2f2f2', 0.55);
    this.deNoir.rotation.y = 0.5;
  }

  _orientationFace(valeur) {
    const e = new THREE.Euler();
    switch (valeur) {
      case 2: e.set(0, 0, 0); break;
      case 5: e.set(Math.PI, 0, 0); break;
      case 1: e.set(0, 0, Math.PI / 2); break;
      case 6: e.set(0, 0, -Math.PI / 2); break;
      case 3: e.set(-Math.PI / 2, 0, 0); break;
      case 4: e.set(Math.PI / 2, 0, 0); break;
    }
    return new THREE.Quaternion().setFromEuler(e);
  }

  /** Lance un dé 3D ; renvoie une promesse résolue avec la valeur (1 à 6). */
  lancerDe(couleur) {
    const de = couleur === 'noir' ? this.deNoir : this.deBlanc;
    const valeur = 1 + Math.floor(Math.random() * 6);
    const qFace = this._orientationFace(valeur);
    const qLacet = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 1.2);
    const qFinale = qLacet.multiply(qFace);
    const axe = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.5, Math.random() - 0.5).normalize();
    const tours = 4 + Math.random() * 3;
    const depart = de.userData.repos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0, 1.6));
    const arrivee = de.userData.repos.clone();
    const qSpin = new THREE.Quaternion();
    this._son('de', { couleur });
    return this.animer(1150, (t) => {
      const k = Plateau3D.easeOut(t);
      de.position.lerpVectors(depart, arrivee, k);
      // rebonds amortis
      de.position.y = arrivee.y + Math.abs(Math.sin(t * Math.PI * 2.5)) * 1.6 * Math.pow(1 - t, 1.6);
      qSpin.setFromAxisAngle(axe, tours * Math.PI * 2 * Math.pow(1 - k, 1.4));
      de.quaternion.copy(qFinale).multiply(qSpin);
    }).then(() => {
      de.quaternion.copy(qFinale);
      de.position.copy(arrivee);
      this._flash(arrivee, couleur === 'noir' ? '#ff4fd8' : '#7fd2ff');
      this._etiquette(String(valeur), arrivee.clone().setY(arrivee.y + 0.75), couleur === 'noir' ? '#ff4fd8' : '#38e1ff');
      return valeur;
    });
  }

  _flash(pos, couleur) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.2, 40),
      new THREE.MeshBasicMaterial({ color: couleur, transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(pos.x, this.HAUT + 0.01, pos.z);
    this.scene.add(m);
    this.animer(600, (t) => { m.scale.setScalar(1 + t * 6); m.material.opacity = 1 - t; })
      .then(() => { this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); });
  }

  /* ---------- Pions des Éclaireurs ---------- */
  _portrait(eclaireur, taille = 256) {
    const c = document.createElement('canvas');
    c.width = c.height = taille;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const img = new Image();
    img.onload = () => {
      const g = c.getContext('2d');
      const R = taille / 2;
      g.save();
      g.beginPath(); g.arc(R, R, R - 10, 0, Math.PI * 2); g.clip();
      // la carte Éclaireur mesure 337 × 520 : on cadre sur le visage
      const sx = 337 * 0.18, sy = 520 * 0.03, sw = 337 * 0.64;
      g.drawImage(img, sx, sy, sw, sw, 10, 10, taille - 20, taille - 20);
      g.restore();
      g.lineWidth = 12; g.strokeStyle = eclaireur.couleur;
      g.beginPath(); g.arc(R, R, R - 8, 0, Math.PI * 2); g.stroke();
      tex.needsUpdate = true;
    };
    img.src = window.NV_TEXTURES[eclaireur.id];
    return tex;
  }

  creerPion(joueur) {
    const e = NV.ECLAIREURS[joueur.eclaireur];
    const groupe = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: e.couleur, roughness: 0.35, metalness: 0.25, emissive: e.couleur, emissiveIntensity: 0.12 });
    // profil de pion tourné (Lathe)
    const profil = [[0, 0], [0.24, 0], [0.25, 0.05], [0.2, 0.09], [0.13, 0.16], [0.09, 0.36], [0.15, 0.42], [0.09, 0.46], [0, 0.46]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    const corps = new THREE.Mesh(new THREE.LatheGeometry(profil, 32), mat);
    corps.castShadow = true;
    const tete = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 16), mat);
    tete.position.y = 0.56;
    tete.castShadow = true;
    groupe.add(corps, tete);
    const portrait = new THREE.Sprite(new THREE.SpriteMaterial({ map: this._portrait(e), depthTest: true }));
    portrait.scale.set(0.62, 0.62, 1);
    portrait.position.y = 1.12;
    groupe.add(portrait);
    groupe.userData.portrait = portrait;
    this.scene.add(groupe);
    this.pions[joueur.id] = groupe;
    return groupe;
  }

  placerPion(joueur) {
    const p = joueur.case === null ? this.posDepart(joueur.depart) : this.posCase(joueur.case);
    this.pions[joueur.id].position.copy(p);
  }

  /** Fait sauter le pion de case en case (liste d'index de la boucle). */
  async deplacerPion(joueur, chemin) {
    const pion = this.pions[joueur.id];
    for (const idx of chemin) {
      const a = pion.position.clone();
      const b = this.posCase(idx);
      this._son('pas');
      await this.animer(260, (t) => {
        const k = Plateau3D.ease(t);
        pion.position.lerpVectors(a, b, k);
        pion.position.y = this.HAUT + Math.sin(Math.PI * t) * 0.55;
      });
    }
    pion.position.y = this.HAUT;
  }

  montrerJoueurActif(joueur) {
    const pion = this.pions[joueur.id];
    const e = NV.ECLAIREURS[joueur.eclaireur];
    this.anneauActif.material.color.set(e.couleur);
    this.anneauActif.visible = true;
    this.pionActif = pion;
    for (const [id, p] of Object.entries(this.pions)) p.userData.portrait.scale.setScalar(id === String(joueur.id) ? 0.78 : 0.56);
  }

  montrerDestinations(indices, couleurs) {
    this.anneauxDest.forEach((a, i) => {
      if (indices[i] === undefined) { a.visible = false; return; }
      a.position.copy(this.posCase(indices[i])).setY(this.HAUT + 0.02);
      a.material.color.set(couleurs[i] || '#ffffff');
      a.visible = true;
    });
  }
  cacherDestinations() { this.anneauxDest.forEach((a) => (a.visible = false)); }

  /* ---------- Jetons des Complices ---------- */
  _zonesJetons() {
    const geoJeton = this.geoJeton = new THREE.CylinderGeometry(0.17, 0.17, 0.06, 32);
    this.matBleu = new THREE.MeshStandardMaterial({ color: '#2f6dff', roughness: 0.3, metalness: 0.2, emissive: '#1d3fb0', emissiveIntensity: 0.35 });
    this.matRouge = new THREE.MeshStandardMaterial({ color: '#e3262f', roughness: 0.3, metalness: 0.2, emissive: '#8a0f15', emissiveIntensity: 0.35 });
    for (const id of NV.ORDRE_COMPLICES) {
      this.jetons[id] = { bleus: [], rouges: [], badge: null };
    }
    this.geoJeton = geoJeton;
  }

  _posJeton(id, couleur, n) {
    const c = NV.COMPLICES[id];
    const base = this.versMonde(c.zone.u, c.zone.v);
    // jetons alignés en deux rangées (bleus au-dessus, rouges en dessous) comme sur la fiche Complice
    const col = n % 5, rang = Math.floor(n / 5);
    const x = base.x - 0.8 + col * 0.4;
    const z = base.z + (couleur === 'bleu' ? -0.35 : 0.35) + rang * 0.12;
    return new THREE.Vector3(x, this.HAUT + 0.04 + rang * 0.07, z);
  }

  /** Synchronise les jetons 3D avec l'état des Complices (avec animation de chute). */
  majJetons(etatComplices) {
    for (const id of NV.ORDRE_COMPLICES) {
      const e = etatComplices[id];
      const z = this.jetons[id];
      for (const [cle, couleur, mat] of [['bleus', 'bleu', this.matBleu], ['rouges', 'rouge', this.matRouge]]) {
        const voulu = e.statut === 'actif' ? e[couleur === 'bleu' ? 'bleus' : 'rouges'] : 0;
        while (z[cle].length > voulu) {
          const m = z[cle].pop();
          const p0 = m.position.clone();
          this.animer(350, (t) => { m.position.y = p0.y + t * 1.2; m.scale.setScalar(1 - t); })
            .then(() => this.scene.remove(m));
          if (e.statut === 'actif') this._son('retrait');
        }
        while (z[cle].length < voulu) {
          const m = new THREE.Mesh(this.geoJeton, mat);
          m.castShadow = true;
          const cible = this._posJeton(id, couleur, z[cle].length);
          m.position.copy(cible).setY(cible.y + 2.2);
          this.scene.add(m);
          z[cle].push(m);
          this.animer(520, (t) => {
            m.position.y = cible.y + 2.2 * (1 - Plateau3D.easeOut(t)) + Math.abs(Math.sin(t * Math.PI * 2)) * 0.15 * (1 - t);
          }).then(() => { m.position.copy(cible); this._son(couleur === 'bleu' ? 'jetonBleu' : 'jetonRouge'); });
        }
      }
      // Badge « Sauvé » / « Perdu »
      if (e.statut !== 'actif' && !z.badge) {
        z.badge = this._badge(id, e.statut);
      }
      if (e.statut === 'actif' && z.badge) { this.scene.remove(z.badge); z.badge = null; }
      const lum = NV.COMPLICES[id]._lumiere;
      if (lum) lum.intensity = e.statut === 'perdu' ? 1.5 : e.statut === 'sauve' ? 12 : 6;
    }
  }

  _badge(id, statut) {
    const c = NV.COMPLICES[id];
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 192;
    const g = cv.getContext('2d');
    const coul = statut === 'sauve' ? c.couleur : '#2a0a12';
    g.fillStyle = coul;
    g.strokeStyle = statut === 'sauve' ? '#ffffff' : '#ff3048';
    g.lineWidth = 10;
    const r = 34;
    g.beginPath(); g.roundRect(12, 12, 488, 168, r); g.fill(); g.stroke();
    g.fillStyle = '#ffffff';
    g.font = '700 74px "Baloo 2", system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(statut === 'sauve' ? (c.id === 'stalky' || c.id === 'datata' ? 'SAUVÉE' : 'SAUVÉ') : 'PERDU', 256, 100);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true }));
    const p = this.versMonde(c.zone.u, c.zone.v, 0.9);
    s.position.copy(p);
    s.scale.set(0.01, 0.01, 1);
    this.scene.add(s);
    this.animer(700, (k) => { const e = Plateau3D.easeOut(k) * (1 + 0.15 * Math.sin(k * Math.PI)); s.scale.set(2.2 * e, 0.82 * e, 1); });
    return s;
  }

  /* ---------- Pioches Dark Master ---------- */
  _pioches() {
    const T = this.TAILLE;
    for (const [type, cle] of [['fin', 'dmFin'], ['attaque', 'dmAttaque']]) {
      const p = NV.PIOCHES[type];
      const dos = new THREE.MeshStandardMaterial({ map: this.chargerTexture(window.NV_TEXTURES[cle]), roughness: 0.5 });
      const tranche = new THREE.MeshStandardMaterial({ color: '#e9e9ef', roughness: 0.8 });
      this.pioches[type] = { cartes: [], dos, tranche, w: p.w * T, h: p.h * T, base: this.versMonde(p.u, p.v) };
    }
  }

  majPioches(nFin, nAttaque) {
    for (const [type, n] of [['fin', nFin], ['attaque', nAttaque]]) {
      const P = this.pioches[type];
      while (P.cartes.length > n) this.scene.remove(P.cartes.pop());
      while (P.cartes.length < n) {
        const geo = new THREE.BoxGeometry(P.w, 0.014, P.h);
        const m = new THREE.Mesh(geo, [P.tranche, P.tranche, P.dos, P.tranche, P.tranche, P.tranche]);
        m.position.copy(P.base).setY(this.HAUT + 0.007 + P.cartes.length * 0.016);
        m.rotation.y = (Math.random() - 0.5) * 0.04;
        m.castShadow = true;
        this.scene.add(m);
        P.cartes.push(m);
      }
    }
  }

  /** Animation : la carte du dessus s'envole vers la caméra. */
  async piocherCarte(type) {
    const P = this.pioches[type];
    const m = P.cartes.pop();
    if (!m) return;
    this._son('carte');
    const a = m.position.clone();
    const b = this.camera.position.clone().lerp(this.controles.target, 0.55);
    const r0 = m.rotation.clone();
    await this.animer(650, (t) => {
      const k = Plateau3D.ease(t);
      m.position.lerpVectors(a, b, k);
      m.position.y += Math.sin(Math.PI * t) * 1.2;
      m.rotation.x = r0.x + k * 0.9;
      m.rotation.z = r0.z + k * Math.PI * 2;
    });
    this.scene.remove(m);
  }


  /* ---------- Petites animations de retour visuel ---------- */

  /** Nombre (résultat de dé…) qui s'élève et s'efface au-dessus d'un point. */
  _etiquette(texte, pos, couleur) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = 'rgba(7,10,22,.85)';
    g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.fill();
    g.lineWidth = 8; g.strokeStyle = couleur; g.stroke();
    g.fillStyle = '#ffffff';
    g.font = '800 70px "Baloo 2", system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(texte, 64, 70);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
    s.renderOrder = 10;
    s.position.copy(pos);
    this.scene.add(s);
    const y0 = pos.y;
    this.animer(1500, (k) => {
      const e = Plateau3D.easeOut(Math.min(1, k * 3));
      s.scale.setScalar(0.62 * e);
      s.position.y = y0 + k * 0.45;
      s.material.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    }).then(() => { this.scene.remove(s); t.dispose(); s.material.dispose(); });
  }

  _texParticule() {
    if (this._texP) return this._texP;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    const d = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    d.addColorStop(0, 'rgba(255,255,255,1)');
    d.addColorStop(0.35, 'rgba(255,255,255,.7)');
    d.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = d; g.fillRect(0, 0, 64, 64);
    this._texP = new THREE.CanvasTexture(cv);
    return this._texP;
  }

  /**
   * Gerbe de particules.
   * type : 'eclat' (lumière qui monte, Complice sauvé), 'fumee' (Complice perdu),
   *        'confettis' (victoire), 'braises' (attaque du Dark Master)
   */
  particules(centre, couleurs, type = 'eclat', duree = 2200) {
    if (this.mouvementReduit) return Promise.resolve();
    const N = { eclat: 160, fumee: 90, confettis: 420, braises: 110 }[type];
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), vit = [];
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      c.set(couleurs[i % couleurs.length]);
      col.set([c.r, c.g, c.b], i * 3);
      let x = centre.x, y = centre.y, z = centre.z, v;
      if (type === 'confettis') {
        x += (Math.random() - 0.5) * 11; z += (Math.random() - 0.5) * 11; y += 4 + Math.random() * 5;
        v = new THREE.Vector3((Math.random() - 0.5) * 0.6, -1.2 - Math.random() * 1.2, (Math.random() - 0.5) * 0.6);
      } else if (type === 'fumee') {
        x += (Math.random() - 0.5) * 1.6; z += (Math.random() - 0.5) * 1.6;
        v = new THREE.Vector3((Math.random() - 0.5) * 0.25, 0.5 + Math.random() * 0.8, (Math.random() - 0.5) * 0.25);
      } else {
        const a = Math.random() * Math.PI * 2, r = type === 'braises' ? 0.6 + Math.random() * 1.6 : 0.4 + Math.random() * 1.4;
        v = new THREE.Vector3(Math.cos(a) * r, 1.4 + Math.random() * 2.6, Math.sin(a) * r);
      }
      pos.set([x, y, z], i * 3);
      vit.push(v);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: { eclat: 0.16, fumee: 0.55, confettis: 0.13, braises: 0.12 }[type],
      map: this._texParticule(), vertexColors: true, transparent: true, depthWrite: false,
      blending: type === 'fumee' ? THREE.NormalBlending : THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(geo, mat);
    this.scene.add(pts);
    let tPrec = 0;
    return this.animer(duree, (t) => {
      const dt = (t - tPrec) * duree / 1000; tPrec = t;
      const a = geo.attributes.position.array;
      for (let i = 0; i < N; i++) {
        const v = vit[i];
        if (type === 'eclat' || type === 'braises') v.y -= 2.2 * dt;
        if (type === 'confettis') { v.x = Math.sin(t * 9 + i) * 0.5; }
        a[i * 3] += v.x * dt; a[i * 3 + 1] += v.y * dt; a[i * 3 + 2] += v.z * dt;
        if (type === 'confettis' && a[i * 3 + 1] < this.HAUT + 0.05) a[i * 3 + 1] = this.HAUT + 0.05;
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = type === 'fumee' ? 0.55 * (1 - t) : (t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25);
      if (type === 'fumee') mat.size = 0.55 + t * 0.6;
    }).then(() => { this.scene.remove(pts); geo.dispose(); mat.dispose(); });
  }

  /* ---------- Cinématiques ---------- */
  // Courtes séquences de caméra (2 à 5 s) aux moments clés. Elles peuvent être passées
  // (clic ou Espace) et désactivées dans la barre du haut ; elles sont coupées si
  // l'utilisateur a demandé à réduire les animations.

  passerCinematique() {
    for (const a of this.anims) if (a.cine) a.t0 = -1e9;
  }

  memoriserVue() {
    // on garde la vue d'origine si une cinématique en déclenche une autre (ex. attaque → Complice perdu)
    if (!this._vue) this._vue = { pos: this.camera.position.clone(), cible: this.controles.target.clone() };
  }

  /** Déplace la caméra vers (pos, cible) en douceur. */
  voler(pos, cible, duree = 1200) {
    const a = this.camera.position.clone(), ta = this.controles.target.clone();
    return this.animer(duree, (t) => {
      const k = Plateau3D.ease(t);
      this.camera.position.lerpVectors(a, pos, k);
      this.controles.target.lerpVectors(ta, cible, k);
    }, true);
  }

  async revenirVue(duree = 1000) {
    const v = this._vue || { pos: this.VUE.pos, cible: this.VUE.cible };
    this._vue = null;
    await this.voler(v.pos, v.cible, duree);
    this.controles.enabled = true;
  }

  /** Plan rapproché sur un point du plateau (vu depuis le côté joueur). */
  async plan(cible, recul = 3.2, hauteur = 3.4, duree = 1200) {
    this.controles.enabled = false;
    const pos = cible.clone().add(new THREE.Vector3(cible.x * 0.12, hauteur, recul));
    await this.voler(pos, cible, duree);
  }

  /** Ouverture : survol de Numéville puis descente vers la vue de jeu. */
  async cineIntro() {
    this.controles.enabled = false;
    const fin = this.VUE.pos.clone(), cibleFin = this.VUE.cible.clone();
    const rFin = Math.hypot(fin.x, fin.z - cibleFin.z), aFin = Math.atan2(fin.x, fin.z - cibleFin.z);
    const a0 = aFin - 2.2;
    await this.animer(5200, (t) => {
      const k = Plateau3D.ease(t);
      const ang = a0 + (aFin - a0) * k;
      const r = 17 + (rFin - 17) * k;
      const h = 17 + (fin.y - 17) * k;
      const cz = cibleFin.z * k;
      this.camera.position.set(Math.sin(ang) * r, h, cz + Math.cos(ang) * r);
      this.controles.target.set(0, 0, cz);
    }, true);
    this.camera.position.copy(fin);
    this.controles.target.copy(cibleFin);
    this.controles.enabled = true;
  }

  /** Complice sauvé ou perdu : plan sur sa zone jetons, lumière ou fumée. */
  async cineComplice(id, statut) {
    const c = NV.COMPLICES[id];
    const zone = this.versMonde(c.zone.u, c.zone.v);
    this.memoriserVue();
    await this.plan(zone, 3.4, 3.6, 1300);
    const lum = c._lumiere;
    if (statut === 'sauve') {
      this.particules(zone.clone().setY(this.HAUT + 0.2), [c.couleur, '#ffffff', c.couleurClaire], 'eclat', 2400);
      const i0 = lum.intensity;
      this.animer(1600, (t) => { lum.intensity = i0 + Math.sin(t * Math.PI) * 30; }, true);
    } else {
      this.particules(zone.clone().setY(this.HAUT + 0.1), ['#1a0a10', '#3a0b18', '#55101f'], 'fumee', 2600);
      const i0 = lum.intensity;
      this.animer(1600, (t) => { lum.intensity = i0 * (Math.random() > 0.3 ? 1 - t * 0.8 : 0.1); lum.color.set(t > 0.5 ? '#ff2a3a' : c.couleur); }, true);
    }
    await this.attendre(1700);
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

  /** Face-à-face : rapproché sur le pion du joueur. */
  async cineFaceAFace(joueur, id) {
    const pion = this.pions[joueur.id];
    this.memoriserVue();
    const c = NV.COMPLICES[id];
    const lum = c._lumiere, i0 = lum.intensity;
    this.animer(1600, (t) => { lum.intensity = i0 + Math.sin(t * Math.PI) * 10; }, true);
    await this.plan(pion.position.clone().setY(this.HAUT + 0.5), 2.4, 2.2, 1100);
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
    await this.animer(5200, (t) => {
      const k = Plateau3D.ease(t);
      const ang = a0 + k * (victoire ? Math.PI * 2 : 0.6);
      const cible = new THREE.Vector3(Math.sin(ang) * r, h, Math.cos(ang) * r);
      this.camera.position.lerpVectors(p0, cible, Math.min(1, t * 2.5));
      if (t > 0.4) this.camera.position.copy(cible);
      this.controles.target.lerpVectors(t0, new THREE.Vector3(0, 0, 0), Math.min(1, t * 2));
    }, true);
    this.controles.enabled = true;
  }

  /** Teinte brièvement l'éclairage d'ambiance. */
  _teinte(couleur, duree) {
    const h = this.hemi, c0 = h.color.clone(), cible = new THREE.Color(couleur);
    this.animer(duree, (t) => { h.color.copy(c0).lerp(cible, Math.sin(t * Math.PI) * 0.75); }, true)
      .then(() => h.color.copy(c0));
  }

  /* ---------- Sons : délégués au module audio (js/audio.js) ---------- */
  _son(type, opt) { if (window.NV_AUDIO) window.NV_AUDIO.effet(type, opt); }
  sonResultat(bon) { this._son(bon ? 'bonne' : 'mauvaise'); }

  /* ---------- boucle de rendu ---------- */
  redimensionner() {
    const w = this.conteneur.clientWidth, h = this.conteneur.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  vueDefaut() {
    const a = this.camera.position.clone(), b = this.VUE.pos.clone();
    const ta = this.controles.target.clone(), tb = this.VUE.cible.clone();
    return this.animer(700, (t) => {
      const k = Plateau3D.ease(t);
      this.camera.position.lerpVectors(a, b, k);
      this.controles.target.lerpVectors(ta, tb, k);
    });
  }

  _boucle() {
    const now = performance.now();
    const temps = this.horloge.getElapsedTime();
    this.anims = this.anims.filter((a) => {
      const t = Math.min(1, (now - a.t0) / a.duree);
      a.maj(t);
      if (t >= 1) { a.resolve(); return false; }
      return true;
    });
    if (this.pionActif && this.anneauActif.visible) {
      this.anneauActif.position.set(this.pionActif.position.x, this.HAUT + 0.015, this.pionActif.position.z);
      const s = 1 + 0.12 * Math.sin(temps * 4);
      this.anneauActif.scale.set(s, s, s);
    }
    for (const a of this.anneauxDest) if (a.visible) a.material.opacity = 0.55 + 0.4 * Math.sin(temps * 6);
    for (const z of Object.values(this.jetons)) if (z.badge) z.badge.position.y = 0.95 + Math.sin(temps * 2) * 0.05;
    this.controles.update();
    this.renderer.render(this.scene, this.camera);
  }
}

window.Plateau3D = Plateau3D;
