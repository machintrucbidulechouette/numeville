/* =====================================================================
   Numéville 3D — plateau du mode Pro
   Plateau hexagonal construit en 3D (plus d'image imprimée) : 25 cases sur
   trois niveaux, terrasses, escaliers aux angles, Place, cases malus,
   petits immeubles autour de la ville.
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
    const tex = this._texSol();
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
      const dessus = new THREE.MeshStandardMaterial({ color: new THREE.Color(c.couleur).multiplyScalar(0.22).add(new THREE.Color('#10163a')), roughness: 0.7, metalness: 0.2 });
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

  /** Dessus d'une case : couleur du quartier, emblème (portrait), Place ou malus. */
  _texCase(b) {
    const N = 256, cv = this._canvas(N), g = cv.getContext('2d');
    const oct = (r) => { g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; const x = N / 2 + Math.cos(a) * r, y = N / 2 + Math.sin(a) * r; if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.closePath(); };
    if (b.type === 'place') {
      const d = g.createRadialGradient(N / 2, N / 2, 10, N / 2, N / 2, N / 2);
      d.addColorStop(0, '#2b3a8a'); d.addColorStop(1, '#0e1640');
      g.fillStyle = d; g.beginPath(); g.arc(N / 2, N / 2, N / 2 - 4, 0, Math.PI * 2); g.fill();
      g.lineWidth = 8; g.strokeStyle = '#38e1ff'; g.stroke();
      g.fillStyle = '#ffffff'; g.font = '800 46px "Baloo 2", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('LA', N / 2, N / 2 - 26); g.fillText('PLACE', N / 2, N / 2 + 22);
      return this._tex(cv);
    }
    if (b.malus) {
      g.save(); oct(N / 2 - 6); g.clip();
      g.fillStyle = '#16060a'; g.fillRect(0, 0, N, N);
      g.strokeStyle = '#d81e2c'; g.lineWidth = 20;
      for (let i = -N; i < N * 2; i += 46) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i - N, N); g.stroke(); }
      g.fillStyle = 'rgba(10,2,5,.82)'; g.beginPath(); g.arc(N / 2, N / 2, 76, 0, Math.PI * 2); g.fill();
      g.restore();
      oct(N / 2 - 6); g.lineWidth = 10; g.strokeStyle = '#ff3a44'; g.stroke();
      g.font = '96px system-ui, "Noto Color Emoji", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(NV.PRO.MALUS[b.malus].icone, N / 2, N / 2 + 6);
      return this._tex(cv);
    }
    const c = NV.COMPLICES[b.c];
    const fond = new THREE.Color(c.couleur).multiplyScalar(b.type === 'face' ? 0.55 : 0.32);
    g.fillStyle = '#' + fond.getHexString(); oct(N / 2 - 6); g.fill();
    g.lineWidth = 10; g.strokeStyle = c.couleurClaire; g.stroke();
    if (b.type === 'face') {
      const em = this._embleme(b.c, c.couleur).image;
      g.drawImage(em, N / 2 - 82, N / 2 - 82, 164, 164);
    } else {
      g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 4; oct(N / 2 - 34); g.stroke();
    }
    return this._tex(cv);
  }

  _casesPro() {
    const matBord = new THREE.MeshStandardMaterial({ color: '#2a3156', roughness: 0.5, metalness: 0.4 });
    NV.BOUCLE.forEach((b, i) => {
      const r = b.type === 'place' ? 0.95 : b.type === 'face' ? 0.66 : 0.56;
      const seg = b.type === 'place' ? 48 : 8;
      const dessus = new THREE.MeshStandardMaterial({ map: this._texCase(b), roughness: 0.55, metalness: 0.1, emissive: '#ffffff', emissiveMap: null, emissiveIntensity: 0 });
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.03, 0.06, seg), [matBord, dessus, matBord]);
      const p = this.posCase(i);
      m.position.set(p.x, p.y - 0.03, p.z);
      // dessus lisible depuis la caméra (le haut de la texture vers le fond du plateau)
      m.rotation.y = Math.PI / 2 + (seg === 8 ? Math.PI / 8 : 0);
      m.receiveShadow = true;
      this.scene.add(m);
      this._decorPro.push(m);
    });
    // fil lumineux qui relie les cases dans l'ordre de la boucle
    const pts = NV.BOUCLE.map((_, i) => this.posCase(i).add(new THREE.Vector3(0, 0.005, 0)));
    pts.push(pts[0].clone());
    const fil = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#3a5ad8', transparent: true, opacity: 0.55 }));
    this.scene.add(fil); this._decorPro.push(fil);
    // cases départ
    NV.DEPARTS.forEach((d, i) => {
      const p = this.posDepart(i);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.48, 0.05, 32), new THREE.MeshStandardMaterial({ color: '#1b2350', roughness: 0.5, emissive: '#22307a', emissiveIntensity: 0.4 }));
      m.position.set(p.x, p.y - 0.025, p.z);
      this.scene.add(m); this._decorPro.push(m);
      const fleche = this.posCase(d.entree);
      const lien = new THREE.Line(new THREE.BufferGeometry().setFromPoints([p.clone().setY(p.y + 0.01), fleche.clone().setY(fleche.y + 0.01)]),
        new THREE.LineDashedMaterial({ color: '#5f78d8', dashSize: 0.14, gapSize: 0.1, transparent: true, opacity: 0.7 }));
      lien.computeLineDistances();
      this.scene.add(lien); this._decorPro.push(lien);
    });
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
