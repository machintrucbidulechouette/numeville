/* =====================================================================
   Numéville 3D — plateau du mode Pro
   Plateau hexagonal construit en 3D : 25 cases sur trois niveaux, terrasses,
   escaliers aux angles, Place, cases malus, petits immeubles autour de la ville.
   Les visuels reprennent ceux du plateau du jeu de base (js/data/textures-plateau-pro.js) :
   cases « tourbillon », portraits, Place, départs, tracé blanc liseré de couleur,
   cartouche central, zones jetons et morceaux de ville peints.
   (méthodes ajoutées à la classe Plateau3D, voir js/3d/plateau3d.js)
   ===================================================================== */

class PlateauPro3D {
  /** Remplace le plateau imprimé par le plateau Pro (appelé une fois, au lancement d'une partie Pro). */
  activerPro() {
    if (this.pro) return;
    this.pro = true;
    for (const m of this._decorBase || []) this.scene.remove(m);
    this._decorBase = [];

    // vue d'ensemble plus large, brouillard et ombres adaptés au grand plateau
    this.VUE = { pos: new THREE.Vector3(0, 19.8, 16.4), cible: new THREE.Vector3(0, 0, 2.9) };
    this.camera.position.copy(this.VUE.pos);
    this.controles.target.copy(this.VUE.cible);
    this.controles.maxDistance = 32;
    this.scene.fog.near = 26; this.scene.fog.far = 62;
    Object.assign(this.soleil.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, far: 50 });
    this.soleil.shadow.camera.updateProjectionMatrix();
    this.soleil.position.set(-8, 18, 9);

    this._solPro();
    this._terrassesPro();
    this._casesPro();
    this._rubanPro();
    this._cartouchePro();
    this._zonesPro();
    this._immeublesPro();
    this._lumieresComplices();
    this._zonesJetons();
    this._pioches();
    this._complices3D();
    this.controles.update();
  }

  /* ---------- textures dessinées ---------- */
  _canvas(l, h = l) { const c = document.createElement('canvas'); c.width = l; c.height = h; return c; }
  _tex(cv) { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
  /** Image du plateau Pro (visuels repris du plateau du jeu de base), ou null si le fichier manque. */
  _visuel(cle, id, octo = false) {
    const T = window.NV_TEXTURES_PRO_PLATEAU;
    const src = T && (id ? T[cle] && T[cle][id] : T[cle]);
    if (!src) return null;
    this._cacheVisuels = this._cacheVisuels || {};
    const k = cle + ':' + (id || '') + (octo ? ':octo' : '');
    if (!this._cacheVisuels[k]) this._cacheVisuels[k] = octo ? this._octo(this.chargerTexture(src)) : this.chargerTexture(src);
    return this._cacheVisuels[k];
  }
  /**
   * Texture octogonale (bords plats en haut, comme sur le plateau) posée sur le couvercle d'un
   * cylindre à 8 côtés : on la tourne d'1/16 de tour pour que ses coins tombent sur ceux du cylindre.
   */
  _octo(tex) {
    if (!tex) return tex;
    tex.center.set(0.5, 0.5); tex.rotation = Math.PI / 8;
    return tex;
  }

  /** Sol de la ville : circuit imprimé sombre, rosace lumineuse au centre. */
  _texSol() {
    const N = 1024, cv = this._canvas(N), g = cv.getContext('2d');
    g.fillStyle = '#0d1430'; g.fillRect(0, 0, N, N);
    let graine = 7;
    const hasard = () => ((graine = (graine * 16807) % 2147483647) / 2147483647); // décor seulement
    g.lineCap = 'round';
    for (let i = 0; i < 140; i++) {
      let x = hasard() * N, y = hasard() * N;
      g.strokeStyle = `rgba(90,130,255,${0.08 + hasard() * 0.12})`; g.lineWidth = 2 + hasard() * 2;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 3; k++) {
        const d = 30 + hasard() * 90, dir = Math.floor(hasard() * 4);
        if (dir === 0) x += d; else if (dir === 1) x -= d; else if (dir === 2) y += d; else y -= d;
        g.lineTo(x, y);
      }
      g.stroke();
      g.fillStyle = 'rgba(140,180,255,.25)'; g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
    }
    // rosace centrale
    const c = N / 2;
    for (let r = 60; r <= 230; r += 34) {
      g.strokeStyle = `rgba(56,225,255,${0.25 - r / 1400})`; g.lineWidth = 3;
      g.beginPath();
      for (let i = 0; i <= 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6; const px = c + Math.cos(a) * r, py = c + Math.sin(a) * r; if (i) g.lineTo(px, py); else g.moveTo(px, py); }
      g.stroke();
    }
    return this._tex(cv);
  }

  _solPro() {
    const rayon = 9.6;
    const geo = new THREE.CylinderGeometry(rayon, rayon + 0.15, 0.2, 6);
    const tex = this._visuel('sol') || this._texSol();
    const dessus = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, metalness: 0.1 });
    const bord = new THREE.MeshStandardMaterial({ color: '#141a33', roughness: 0.6, metalness: 0.3 });
    const sol = new THREE.Mesh(geo, [bord, dessus, bord]);
    sol.receiveShadow = true;
    this.scene.add(sol);
    const cadre = new THREE.Mesh(new THREE.CylinderGeometry(rayon + 0.25, rayon + 0.3, 0.12, 6),
      new THREE.MeshStandardMaterial({ color: '#2a3a7a', emissive: '#1b2a6b', emissiveIntensity: 0.6, roughness: 0.4 }));
    cadre.position.y = -0.05;
    this.scene.add(cadre);
    this._decorPro = [sol, cadre];
  }

  /** Terrasses des quartiers surélevés, plateformes et escaliers aux angles. */
  _terrassesPro() {
    const C = NV.PRO.COTES;
    const matMur = new THREE.MeshStandardMaterial({ color: '#1a2144', roughness: 0.55, metalness: 0.35 });
    const ajouter = (m) => { m.castShadow = true; m.receiveShadow = true; this.scene.add(m); this._decorPro.push(m); return m; };
    C.forEach((cote) => {
      if (!cote.h) return;
      const longueur = cote.L * 0.84, largeur = 3.05, dn = 0.62;
      const c = NV.COMPLICES[cote.c];
      // dessus : un morceau de la ville peinte du plateau (sinon une teinte du quartier)
      const ville = this._visuel('terrasses', cote.c);
      const dessus = ville ? new THREE.MeshStandardMaterial({ map: ville, roughness: 0.8, metalness: 0.05 })
        : new THREE.MeshStandardMaterial({ color: new THREE.Color(c.couleur).multiplyScalar(0.22).add(new THREE.Color('#10163a')), roughness: 0.7, metalness: 0.2 });
      const m = ajouter(new THREE.Mesh(new THREE.BoxGeometry(longueur, cote.h, largeur), [matMur, matMur, dessus, matMur, matMur, matMur]));
      const mx = (cote.A.x + cote.B.x) / 2 + cote.n.x * dn, mz = (cote.A.z + cote.B.z) / 2 + cote.n.z * dn;
      m.position.set(mx, this.HAUT + cote.h / 2, mz);
      m.rotation.y = -Math.atan2(cote.t.z, cote.t.x);
      // liseré néon au bord intérieur de la terrasse
      const neon = new THREE.Mesh(new THREE.BoxGeometry(longueur, 0.04, 0.04), new THREE.MeshBasicMaterial({ color: c.couleur }));
      neon.position.set(mx - cote.n.x * (largeur / 2), this.HAUT + cote.h, mz - cote.n.z * (largeur / 2));
      neon.rotation.y = m.rotation.y;
      this.scene.add(neon); this._decorPro.push(neon);
    });
    // angles : escalier (niveaux différents) ou plateforme (même niveau surélevé)
    for (let k = 1; k < 6; k++) {
      const a = C[k - 1], b = C[k];
      const V = a.B;
      if (a.h === b.h) {
        if (!a.h) continue;
        const p = ajouter(new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, a.h, 6), matMur));
        p.position.set(V.x + (a.n.x + b.n.x) * 0.35, this.HAUT + a.h / 2, V.z + (a.n.z + b.n.z) * 0.35);
        const top = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.02, 6), new THREE.MeshStandardMaterial({ color: '#1d2550', roughness: 0.6 }));
        top.position.copy(p.position).setY(this.HAUT + a.h + 0.01);
        this.scene.add(top); this._decorPro.push(top);
        continue;
      }
      // marches le long du chemin : fin de la terrasse A → sommet → début de la terrasse B
      const L = a.L * 0.08;
      const PA = { x: V.x - a.t.x * L, z: V.z - a.t.z * L }, PB = { x: V.x + b.t.x * L, z: V.z + b.t.z * L };
      const N = 6;
      for (let i = 0; i < N; i++) {
        const u = (i + 0.5) / N;
        // point sur la ligne brisée PA → V → PB
        const P = u < 0.5 ? { x: PA.x + (V.x - PA.x) * u * 2, z: PA.z + (V.z - PA.z) * u * 2 } : { x: V.x + (PB.x - V.x) * (u - 0.5) * 2, z: V.z + (PB.z - V.z) * (u - 0.5) * 2 };
        const t = u < 0.5 ? a.t : b.t, n = u < 0.5 ? a.n : b.n;
        const h = a.h + (b.h - a.h) * ((i + 1) / (N + 1));
        const marche = ajouter(new THREE.Mesh(new THREE.BoxGeometry(0.42, h, 2.4), matMur));
        marche.position.set(P.x + n.x * 0.45, this.HAUT + h / 2, P.z + n.z * 0.45);
        marche.rotation.y = -Math.atan2(t.z, t.x);
        const nez = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.025, 2.42), new THREE.MeshBasicMaterial({ color: '#3a4f9a' }));
        nez.position.copy(marche.position).setY(this.HAUT + h);
        nez.rotation.y = marche.rotation.y;
        this.scene.add(nez); this._decorPro.push(nez);
      }
    }
  }

  /** Dessus d'une case : visuels du plateau (tourbillon, portrait, Place) ; malus dessinés au même style. */
  _texCase(b) {
    if (b.malus) return this._octo(this._texMalus(b.malus));
    const v = b.type === 'place' ? this._visuel('place', null, true) : this._visuel(b.type === 'face' ? 'faces' : 'cases', b.c, true);
    if (v) return v;
    return this._octo(this._texCaseDessinee(b));
  }

  /** Case malus : cadre des cases du plateau (liseré, bande noire, filet blanc) en rouge, rayures d'alerte. */
  _texMalus(type) {
    const N = 256, cv = this._canvas(N), g = cv.getContext('2d');
    const ap = N / 2 * Math.cos(Math.PI / 8);
    const oct = (a) => { const r = a * ap / Math.cos(Math.PI / 8); g.beginPath(); for (let i = 0; i < 8; i++) { const t = i * Math.PI / 4 + Math.PI / 8; const x = N / 2 + Math.cos(t) * r, y = N / 2 + Math.sin(t) * r; if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.closePath(); };
    oct(1); g.fillStyle = '#ff3a44'; g.fill();
    oct(0.925); g.fillStyle = '#161618'; g.fill();
    oct(0.80); g.fillStyle = '#ffffff'; g.fill();
    g.save(); oct(0.76); g.clip();
    g.fillStyle = '#1a0508'; g.fillRect(0, 0, N, N);
    g.strokeStyle = '#c81a28'; g.lineWidth = 16;
    for (let i = -N; i < N * 2; i += 40) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i - N, N); g.stroke(); }
    const r = g.createRadialGradient(N / 2, N / 2, 20, N / 2, N / 2, 80);
    r.addColorStop(0, 'rgba(10,2,5,.92)'); r.addColorStop(1, 'rgba(10,2,5,.55)');
    g.fillStyle = r; g.beginPath(); g.arc(N / 2, N / 2, 70, 0, Math.PI * 2); g.fill();
    g.restore();
    g.font = '84px system-ui, "Noto Color Emoji", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(NV.PRO.MALUS[type].icone, N / 2, N / 2 + 6);
    return this._tex(cv);
  }

  /** Secours si le fichier des visuels manque : cases dessinées. */
  _texCaseDessinee(b) {
    const N = 256, cv = this._canvas(N), g = cv.getContext('2d');
    const oct = (r) => { g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; const x = N / 2 + Math.cos(a) * r, y = N / 2 + Math.sin(a) * r; if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.closePath(); };
    if (b.type === 'place') {
      g.fillStyle = '#16205a'; oct(N / 2 - 4); g.fill(); g.lineWidth = 8; g.strokeStyle = '#38e1ff'; g.stroke();
      g.fillStyle = '#ffffff'; g.font = '800 46px "Baloo 2", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('place', N / 2, N / 2);
      return this._tex(cv);
    }
    const c = NV.COMPLICES[b.c];
    const fond = new THREE.Color(c.couleur).multiplyScalar(b.type === 'face' ? 0.55 : 0.32);
    g.fillStyle = '#' + fond.getHexString(); oct(N / 2 - 6); g.fill();
    g.lineWidth = 10; g.strokeStyle = c.couleurClaire; g.stroke();
    if (b.type === 'face') g.drawImage(this._embleme(b.c, c.couleur).image, N / 2 - 82, N / 2 - 82, 164, 164);
    return this._tex(cv);
  }

  _casesPro() {
    const matBord = new THREE.MeshStandardMaterial({ color: '#1c1d24', roughness: 0.5, metalness: 0.3 });
    // cylindres à 8 côtés tournés d'1/16 de tour : bords plats face à la caméra, image droite
    const ROT = Math.PI / 2 - Math.PI / 8;
    this.casesMesh = [];
    NV.BOUCLE.forEach((b, i) => {
      const r = b.type === 'place' ? 0.98 : b.type === 'face' ? 0.66 : 0.56;
      const dessus = new THREE.MeshStandardMaterial({ map: this._texCase(b), roughness: 0.55, metalness: 0.05 });
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.02, 0.06, 8), [matBord, dessus, matBord]);
      const p = this.posCase(i);
      m.position.set(p.x, p.y - 0.03, p.z);
      m.rotation.y = ROT;
      m.receiveShadow = true;
      m.userData.caseIndex = i;
      this.scene.add(m);
      this._decorPro.push(m);
      this.casesMesh[i] = m;
    });
    // cases départ : octogone noir « départ » du plateau
    const texDep = this._visuel('depart', null, true);
    NV.DEPARTS.forEach((d, i) => {
      const p = this.posDepart(i);
      const mat = texDep ? new THREE.MeshStandardMaterial({ map: texDep, roughness: 0.5 })
        : new THREE.MeshStandardMaterial({ color: '#1b2350', roughness: 0.5, emissive: '#22307a', emissiveIntensity: 0.4 });
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.54, 0.05, 8), [matBord, mat, matBord]);
      m.position.set(p.x, p.y - 0.025, p.z);
      m.rotation.y = ROT;
      this.scene.add(m); this._decorPro.push(m);
    });
  }

  /* ---------- tracé blanc liseré de couleur (comme sur le plateau), escaliers compris ---------- */
  _rubanPro() {
    const C = NV.PRO.COTES, H = this.HAUT;
    const mats = {};
    const mat = (couleur) => mats[couleur] || (mats[couleur] = new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.6, metalness: 0.05 }));
    const blanc = mat('#f4f6fb');
    const geoDisque = new THREE.CylinderGeometry(1, 1, 1, 20);
    const ajouter = (m) => { m.receiveShadow = true; this.scene.add(m); this._decorPro.push(m); return m; };
    const LARG = 0.42, LB = 0.26;              // largeur du liseré de couleur et de la bande blanche
    /** bande droite de P à Q (x, z) à la hauteur y (dessus du support), demi-liseré couleur */
    const bande = (P, Q, y, couleur, largeur = LARG, lb = LB, joints = true) => {
      const dx = Q.x - P.x, dz = Q.z - P.z, l = Math.hypot(dx, dz);
      if (l < 1e-3) return;
      const a = -Math.atan2(dz, dx);
      for (const [w, h, m] of [[largeur, 0.016, mat(couleur)], [lb, 0.02, blanc]]) {
        const b = ajouter(new THREE.Mesh(new THREE.BoxGeometry(l, h, w), m));
        b.position.set((P.x + Q.x) / 2, y + h / 2, (P.z + Q.z) / 2); b.rotation.y = a;
      }
      if (joints) for (const R of [P, Q]) for (const [w, h, m] of [[largeur, 0.016, mat(couleur)], [lb, 0.02, blanc]]) {
        const d = ajouter(new THREE.Mesh(geoDisque, m));
        d.scale.set(w / 2, h, w / 2); d.position.set(R.x, y + h / 2, R.z);
      }
    };
    const surCote = (cote, f) => ({ x: cote.A.x + cote.t.x * f * cote.L, z: cote.A.z + cote.t.z * f * cote.L });
    // côtés : tout le long de la terrasse (ou du sol)
    C.forEach((cote) => bande(surCote(cote, 0.08), surCote(cote, 0.92), H + cote.h, NV.COMPLICES[cote.c].couleur));
    // angles : plat (même hauteur) ou bandes peintes sur chaque marche
    for (let k = 0; k < 6; k++) {
      const a = C[(k + 5) % 6], b = C[k];
      const PA = surCote(a, 0.92), PB = surCote(b, 0.08);
      const ca = NV.COMPLICES[a.c].couleur, cb = NV.COMPLICES[b.c].couleur;
      if (a.h === b.h) {
        const V = k === 0 ? NV.BOUCLE[0].p : b.A;    // l'angle du bas passe par la Place
        bande(PA, V, H + a.h, ca); bande(V, PB, H + b.h, cb);
        continue;
      }
      // escalier : le dessus visible des marches (mêmes boîtes que _terrassesPro, qui se chevauchent)
      const V = b.A, N = 6, L = a.L * 0.08;
      const pt = (u) => u < 0.5 ? { x: PA.x + (V.x - PA.x) * u * 2, z: PA.z + (V.z - PA.z) * u * 2 } : { x: V.x + (PB.x - V.x) * (u - 0.5) * 2, z: V.z + (PB.z - V.z) * (u - 0.5) * 2 };
      const marches = [];
      for (let i = 0; i < N; i++) {
        const u = (i + 0.5) / N, P = pt(u), t = u < 0.5 ? a.t : b.t, n = u < 0.5 ? a.n : b.n;
        marches.push({ x: P.x + n.x * 0.45, z: P.z + n.z * 0.45, t, n, h: a.h + (b.h - a.h) * ((i + 1) / (N + 1)) });
      }
      const dessus = (q) => {
        let h = -1;
        for (const m of marches) {
          const dx = q.x - m.x, dz = q.z - m.z;
          if (Math.abs(dx * m.t.x + dz * m.t.z) <= 0.21 && Math.abs(dx * m.n.x + dz * m.n.z) <= 1.2) h = Math.max(h, m.h);
        }
        return h < 0 ? null : h;
      };
      const S = 36;
      let debutU = 0, hCour = dessus(pt(0.5 / S));
      for (let j = 1; j <= S; j++) {
        const u = (j + 0.5) / S, h = j < S ? dessus(pt(u)) : null;
        if (j === S || h !== hCour) {
          const u1 = j / S;
          if (hCour !== null) {
            const c = (debutU + u1) / 2 < 0.5 ? ca : cb;
            // au passage du sommet, la bande se coupe en deux pour suivre l'angle
            if (debutU < 0.5 && u1 > 0.5) { bande(pt(debutU), pt(0.5), H + hCour + 0.013, ca, LARG, LB, false); bande(pt(0.5), pt(u1), H + hCour + 0.013, cb, LARG, LB, false); }
            else bande(pt(debutU), pt(u1), H + hCour + 0.013, c, LARG, LB, false);
          }
          debutU = u1; hCour = h;
        }
      }
    }
    // chemins des cases départ (bande blanche, petit escalier si la case d'entrée est sur une terrasse)
    const matMur = new THREE.MeshStandardMaterial({ color: '#1a2144', roughness: 0.55, metalness: 0.35 });
    NV.DEPARTS.forEach((d, i) => {
      const D = this.posDepart(i), E = this.posCase(d.entree);
      const b = NV.BOUCLE[d.entree], cote = C[b.cote], n = cote.n, h = cote.h;
      const pt = (dn) => ({ x: E.x + n.x * dn, z: E.z + n.z * dn });
      const gris = '#9aa3c4';
      if (!h) { bande(pt(-1.75), pt(0), H, gris, 0.32, 0.2); return; }
      bande(pt(-1.75), pt(-1.32), H, gris, 0.32, 0.2);
      const M = 3, d0 = -1.32, d1 = -0.905, pas = (d1 - d0) / M;
      for (let k = 0; k < M; k++) {
        const hk = h * (k + 1) / (M + 1);
        const P = pt(d0 + pas * (k + 0.5));
        const m = new THREE.Mesh(new THREE.BoxGeometry(pas, hk, 0.62), matMur);
        m.position.set(P.x, H + hk / 2, P.z); m.rotation.y = -Math.atan2(n.z, n.x);
        m.castShadow = true; ajouter(m);
        bande(pt(d0 + pas * k + 0.01), pt(d0 + pas * (k + 1) - 0.01), H + hk + 0.001, gris, 0.32, 0.2, false);
      }
      bande(pt(-0.89), pt(0), H + h, gris, 0.32, 0.2);
    });
  }

  /* ---------- cartouche central « Numéville » avec les emplacements des pioches ---------- */
  _cartouchePro() {
    const tex = this._visuel('cartouche');
    if (!tex) return;
    const T = window.NV_TEXTURES_PRO_PLATEAU.cartesCartouche;
    // même échelle que le plateau imprimé : un emplacement de carte = une carte des pioches
    const cote = (NV.PIOCHES.fin.w * this.TAILLE) * (265 / 254) / T.largeur;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(cote, cote), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.rotation.x = -Math.PI / 2;
    // centré entre les deux pioches
    const pf = NV.PIOCHES.fin.p, pa = NV.PIOCHES.attaque.p;
    const cx = (pf.x + pa.x) / 2 - (((T.fin[0] + T.attaque[0]) / 2) - 0.5) * cote;
    const cz = (pf.z + pa.z) / 2 - (T.fin[1] - 0.5) * cote;
    m.position.set(cx, this.HAUT + 0.004, cz);
    m.receiveShadow = true;
    this.scene.add(m); this._decorPro.push(m);
  }

  /* ---------- zones jetons (cadres du plateau) sur la terrasse de chaque quartier ---------- */
  _zonesPro() {
    for (const id of NV.ORDRE_COMPLICES) {
      const z = NV.COMPLICES[id].zone3d, tex = this._visuel('zones', id);
      if (!z || !tex) continue;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.04), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      // l'étiquette se lit depuis la caméra (haut de l'image vers le fond du plateau)
      const haut = z.n.z > 0.05 ? { x: -z.n.x, z: -z.n.z } : { x: z.n.x, z: z.n.z };
      m.rotation.order = 'YXZ';
      m.rotation.y = Math.atan2(-haut.x, -haut.z);
      m.rotation.x = -Math.PI / 2;
      m.position.set(z.x, this.HAUT + z.y + 0.006, z.z);
      m.receiveShadow = true;
      this.scene.add(m); this._decorPro.push(m);
    }
  }

  /** Fenêtres allumées des immeubles. */
  _texFenetres() {
    const cv = this._canvas(64, 128), g = cv.getContext('2d');
    g.fillStyle = '#0a0e22'; g.fillRect(0, 0, 64, 128);
    for (let y = 8; y < 124; y += 14) for (let x = 6; x < 60; x += 14) {
      const v = Math.random();
      g.fillStyle = v < 0.45 ? 'rgba(255,255,255,.85)' : v < 0.6 ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.05)';
      g.fillRect(x, y, 8, 9);
    }
    const t = this._tex(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  _immeublesPro() {
    const tex = this._texFenetres();
    const C = NV.PRO.COTES;
    C.forEach((cote) => {
      const c = NV.COMPLICES[cote.c];
      const mat = new THREE.MeshStandardMaterial({ color: '#141a36', emissive: c.couleurClaire, emissiveMap: tex, emissiveIntensity: 0.55, roughness: 0.6 });
      for (let i = 0; i < 4; i++) {
        const f = 0.12 + i * 0.25 + (Math.random() - 0.5) * 0.06;
        const recul = 12.6 + Math.random() * 2.4;
        const x = cote.A.x + cote.t.x * f * cote.L, z = cote.A.z + cote.t.z * f * cote.L;
        const l = Math.hypot(x, z);
        // plus bas du côté des joueurs pour ne pas masquer le plateau
        const h = (z / l > 0.3 ? 0.6 : 1.2) + Math.random() * (z / l > 0.3 ? 1.0 : 2.4);
        const w = 0.9 + Math.random() * 0.7;
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat);
        m.position.set(x / l * recul, h / 2 - 0.1, z / l * recul);
        m.rotation.y = Math.random() * Math.PI;
        m.castShadow = true;
        this.scene.add(m); this._decorPro.push(m);
      }
    });
  }
}

NV_etendre(Plateau3D, PlateauPro3D);
