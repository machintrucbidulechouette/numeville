/* =====================================================================
   Numéville 3D — les 4 Complices en 3D
   Socle lumineux, buste holographique, emblème ; transformation sauvé / perdu.
   (méthodes ajoutées à la classe Plateau3D, voir js/3d/plateau3d.js)
   ===================================================================== */

class Complices3D {
  /* ---------- Les 4 Complices en 3D ---------- */
  // Chaque Complice se dresse derrière son portrait sur la boucle : un socle lumineux,
  // un buste holographique (illustration du jeu) toujours tourné vers la caméra
  // et son emblème qui tourne au-dessus. Le buste change quand il est sauvé ou perdu.

  _embleme(id, couleur) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const g = cv.getContext('2d');
    g.fillStyle = couleur;
    g.beginPath(); g.arc(128, 128, 116, 0, Math.PI * 2); g.fill();
    g.lineWidth = 14; g.strokeStyle = '#ffffff'; g.stroke();
    g.fillStyle = '#ffffff'; g.strokeStyle = '#ffffff';
    g.save(); g.translate(128, 132);
    if (id === 'stalky') { // cœur
      g.beginPath(); g.moveTo(0, 52);
      g.bezierCurveTo(-78, 0, -58, -62, 0, -26);
      g.bezierCurveTo(58, -62, 78, 0, 0, 52); g.fill();
    } else if (id === 'hyperco') { // éclair
      g.beginPath(); g.moveTo(14, -70); g.lineTo(-38, 8); g.lineTo(-4, 8); g.lineTo(-16, 70); g.lineTo(38, -10); g.lineTo(4, -10); g.closePath(); g.fill();
    } else if (id === 'hacker') { // crâne
      g.beginPath(); g.arc(0, -10, 50, Math.PI * 0.85, Math.PI * 0.15); g.lineTo(26, 46); g.lineTo(-26, 46); g.closePath(); g.fill();
      g.fillStyle = couleur;
      g.beginPath(); g.arc(-20, -8, 13, 0, Math.PI * 2); g.arc(20, -8, 13, 0, Math.PI * 2); g.fill();
      g.fillRect(-4, 14, 8, 14);
    } else { // œil (Datata)
      g.lineWidth = 12;
      g.beginPath(); g.moveTo(-66, 0); g.quadraticCurveTo(0, -60, 66, 0); g.quadraticCurveTo(0, 60, -66, 0); g.stroke();
      g.beginPath(); g.arc(0, 0, 22, 0, Math.PI * 2); g.fill();
    }
    g.restore();
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  _texScanlines() {
    const cv = document.createElement('canvas');
    cv.width = 4; cv.height = 64;
    const g = cv.getContext('2d');
    for (let y = 0; y < 64; y += 4) { g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(0, y, 4, 1.5); }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 6);
    return t;
  }

  /** Version « perdue » du buste : niveaux de gris teintés de rouge, calculée une fois. */
  _texPerdu(src) {
    const cv = document.createElement('canvas');
    cv.width = 320; cv.height = 240;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const img = new Image();
    img.onload = () => {
      const g = cv.getContext('2d');
      g.drawImage(img, 0, 0, 320, 240);
      const d = g.getImageData(0, 0, 320, 240);
      for (let i = 0; i < d.data.length; i += 4) {
        const l = 0.3 * d.data[i] + 0.59 * d.data[i + 1] + 0.11 * d.data[i + 2];
        d.data[i] = Math.min(255, l * 0.9 + 40); d.data[i + 1] = l * 0.35; d.data[i + 2] = l * 0.4;
      }
      g.putImageData(d, 0, 0);
      tex.needsUpdate = true;
    };
    img.src = src;
    return tex;
  }

  _complices3D() {
    this.figures = {};
    const sources = window.NV_TEXTURES_COMPLICES || {};
    const scan = this._texScanlines();
    const geoSocle = new THREE.CylinderGeometry(0.3, 0.38, 0.12, 40);
    const matSocle = new THREE.MeshStandardMaterial({ color: '#151b36', roughness: 0.35, metalness: 0.7 });
    NV.ORDRE_COMPLICES.forEach((id, i) => {
      const c = NV.COMPLICES[id];
      const iCase = NV.BOUCLE.findIndex((b) => b.type === 'face' && b.c === id);
      const pCase = this.posCase(iCase);
      const dehors = new THREE.Vector3(pCase.x, 0, pCase.z).normalize();
      const base = pCase.clone().add(dehors.multiplyScalar(0.66));
      // le socle reste entièrement sur le plateau
      base.x = THREE.MathUtils.clamp(base.x, -4.55, 4.55);
      base.z = THREE.MathUtils.clamp(base.z, -4.55, 4.55);
      const groupe = new THREE.Group();
      groupe.position.copy(base);

      const socle = new THREE.Mesh(geoSocle, matSocle);
      socle.position.y = 0.06; socle.castShadow = true; socle.receiveShadow = true;
      const anneau = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.022, 10, 48),
        new THREE.MeshBasicMaterial({ color: c.couleur }));
      anneau.rotation.x = Math.PI / 2; anneau.position.y = 0.125;
      const faisceau = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 1.2, 32, 1, true),
        new THREE.MeshBasicMaterial({ color: c.couleur, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      faisceau.position.y = 0.72;
      groupe.add(socle, anneau, faisceau);

      // le buste tourne seulement autour de l'axe vertical pour toujours faire face à la caméra
      const pivot = new THREE.Group();
      pivot.position.y = 0.72;
      const tex = {
        actif: sources[id] ? this.chargerTexture(sources[id].actif) : null,
        sauve: sources[id] ? this.chargerTexture(sources[id].sauve) : null,
        perdu: sources[id] ? this._texPerdu(sources[id].actif) : null,
      };
      // Hologramme dessiné indépendamment de la profondeur : un pion posé devant ne le coupe jamais
      // (le portrait des pions, dessiné après, reste lui au-dessus du buste).
      const matBuste = new THREE.MeshBasicMaterial({ map: tex.actif, transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false, depthTest: false, toneMapped: false });
      const buste = new THREE.Mesh(new THREE.PlaneGeometry(1.12, 0.84), matBuste);
      buste.renderOrder = 2;
      const matScan = new THREE.MeshBasicMaterial({ map: scan, color: c.couleurClaire, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide });
      const balayage = new THREE.Mesh(new THREE.PlaneGeometry(1.12, 0.84), matScan);
      balayage.position.z = 0.002; balayage.renderOrder = 3;
      pivot.add(buste, balayage);
      groupe.add(pivot);

      const embleme = new THREE.Sprite(new THREE.SpriteMaterial({ map: this._embleme(id, c.couleur), transparent: true, depthTest: false }));
      embleme.renderOrder = 4;
      embleme.scale.setScalar(0.34);
      embleme.position.y = 1.36;
      groupe.add(embleme);

      this.scene.add(groupe);
      // fin rayon qui relie le socle à l'hologramme quand celui-ci s'écarte d'un pion
      const lien = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 8, 1, true),
        new THREE.MeshBasicMaterial({ color: c.couleurClaire, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
      lien.renderOrder = 1;
      groupe.add(lien);

      this.scene.add(groupe);
      this.figures[id] = { groupe, pivot, buste, matBuste, matScan, anneau, faisceau, embleme, lien, tex, statut: 'actif', phase: i * 1.7, decal: new THREE.Vector3() };
    });
  }

  /** Position (au niveau du buste) d'un Complice 3D : utile pour cadrer les cinématiques. */
  posFigure(id, hauteur = 0.72) {
    const f = this.figures && this.figures[id];
    return f ? f.groupe.position.clone().add(f.decal).setY(this.HAUT + hauteur) : this.posCase(0);
  }

  /** Transformation du Complice : le buste « grésille » puis change d'apparence. */
  _majFigure(id, statut) {
    const f = this.figures && this.figures[id];
    if (!f || f.statut === statut) return;
    f.statut = statut;
    const c = NV.COMPLICES[id];
    // la transformation démarre quand la caméra arrive (cinématique d'environ 1,2 s)
    setTimeout(() => {
      if (statut === 'sauve') return this._transformationSauve(f, c);
      this.animer(900, (t) => {
        f.matBuste.opacity = Math.random() < 0.5 ? 0.2 : 0.95;
        f.pivot.scale.set(1 + (Math.random() - 0.5) * 0.12 * (1 - t), 1, 1);
        if (t > 0.5 && f.matBuste.map !== f.tex[statut]) { f.matBuste.map = f.tex[statut]; f.matBuste.needsUpdate = true; }
      }).then(() => {
        f.pivot.scale.set(1, 1, 1);
        f.matBuste.opacity = statut === 'sauve' ? 1 : 0.85;
        f.anneau.material.color.set(statut === 'sauve' ? '#ffffff' : '#ff2a3a');
        f.faisceau.material.color.set(statut === 'sauve' ? c.couleurClaire : '#ff2a3a');
        f.faisceau.material.opacity = statut === 'sauve' ? 0.22 : 0.08;
        f.matScan.opacity = statut === 'sauve' ? 0.05 : 0.3;
        f.matScan.color.set(statut === 'sauve' ? '#ffffff' : '#ff3a44');
        f.embleme.material.color.set(statut === 'sauve' ? '#ffffff' : '#555555');
      });
    }, this.cinematiques ? 1150 : 0);
  }

  /**
   * Décalage latéral (en unités 3D) pour que l'hologramme ne soit pas masqué par un pion vu depuis
   * la caméra : on compare leurs rectangles à l'écran et on pousse l'hologramme du côté libre.
   * Calculé depuis la position de repos du Complice, pour ne pas osciller.
   */
  _decalageHologramme(f) {
    const cam = this.camera, g = f.groupe.position;
    const droite = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0).setY(0);
    if (droite.lengthSq() < 1e-6) return null;
    droite.normalize();
    const ecran = (v) => { const p = v.clone().project(cam); return { x: p.x, y: p.y, z: p.z }; };
    const centre = new THREE.Vector3(g.x, this.HAUT + 0.72, g.z);
    const cF = ecran(centre), dF = ecran(centre.clone().addScaledVector(droite, 0.56));
    const demiL = Math.abs(dF.x - cF.x);                       // demi-largeur du buste à l'écran
    if (demiL < 1e-4 || cF.z > 1) return null;
    const hautF = ecran(new THREE.Vector3(g.x, this.HAUT + 1.5, g.z)).y, basF = ecran(new THREE.Vector3(g.x, this.HAUT + 0.3, g.z)).y;
    let besoin = 0, sens = 0;
    for (const pion of Object.values(this.pions)) {
      const q = pion.position;
      if (Math.hypot(q.x - g.x, q.z - g.z) > 2.6) continue;
      const pB = ecran(new THREE.Vector3(q.x, this.HAUT, q.z)), pH = ecran(new THREE.Vector3(q.x, this.HAUT + 1.45, q.z));
      const pD = ecran(new THREE.Vector3(q.x, this.HAUT + 1.12, q.z).addScaledVector(droite, 0.36));
      const demiP = Math.abs(pD.x - pH.x);
      const chevaucheY = Math.min(hautF, pH.y) - Math.max(basF, pB.y) > 0;
      const ecart = cF.x - pH.x;
      const recouvre = demiL + demiP - Math.abs(ecart);
      if (!chevaucheY || recouvre <= 0) continue;
      const s = Math.abs(ecart) < 1e-3 ? (cF.x >= 0 ? -1 : 1) : Math.sign(ecart);
      const n = (recouvre + demiL * 0.15) / demiL * 0.56; // converti en unités 3D
      if (n > besoin) { besoin = n; sens = s; }
    }
    return droite.multiplyScalar(Math.min(besoin, 1.15) * sens);
  }

  /**
   * Complice sauvé : pas de grésillement, une transformation douce. Le buste s'illumine,
   * prend sa nouvelle apparence au plus fort de la lumière avec un petit rebond,
   * et le faisceau du socle reste un peu plus lumineux ensuite.
   */
  _transformationSauve(f, c) {
    const blanc = new THREE.Color(2.2, 2.2, 2.2), normal = new THREE.Color(1, 1, 1);
    const fo = f.faisceau.material.opacity;
    f.anneau.material.color.set('#ffffff');
    f.matScan.color.set('#ffffff');
    return this.animer(1300, (t) => {
      // montée vers le blanc (0 → 0,45), changement d'image, puis retour aux couleurs
      const k = t < 0.45 ? Plateau3D.ease(t / 0.45) : 1 - Plateau3D.ease((t - 0.45) / 0.55);
      f.matBuste.color.copy(normal).lerp(blanc, k);
      f.matBuste.opacity = 0.9 + 0.1 * k;
      if (t >= 0.45 && f.matBuste.map !== f.tex.sauve) { f.matBuste.map = f.tex.sauve; f.matBuste.needsUpdate = true; }
      const rebond = t < 0.45 ? 1 : 1 + Math.sin((t - 0.45) / 0.55 * Math.PI) * 0.06;
      f.pivot.scale.set(rebond, rebond, 1);
      f.faisceau.material.opacity = fo + Math.sin(t * Math.PI) * 0.3 + t * 0.08;
      f.faisceau.scale.set(1 + Math.sin(t * Math.PI) * 0.15, 1, 1 + Math.sin(t * Math.PI) * 0.15);
    }).then(() => {
      f.matBuste.color.copy(normal);
      f.matBuste.opacity = 1;
      f.pivot.scale.set(1, 1, 1);
      f.faisceau.scale.set(1, 1, 1);
      f.faisceau.material.opacity = 0.22;
      f.faisceau.material.color.set(c.couleurClaire);
      f.matScan.opacity = 0.05;
      f.embleme.material.color.set('#ffffff');
    });
  }

  _animerFigures(temps) {
    if (!this.figures) return;
    const dt = Math.min(0.1, temps - (this._tFig || temps));
    this._tFig = temps;
    this.camera.updateMatrixWorld();
    for (const f of Object.values(this.figures)) {
      const g = f.groupe.position;
      const cible = this._decalageHologramme(f) || new THREE.Vector3();
      f.decal.lerp(cible, 1 - Math.exp(-dt * 5));
      f.pivot.position.x = f.decal.x; f.pivot.position.z = f.decal.z;
      f.embleme.position.x = f.decal.x; f.embleme.position.z = f.decal.z;
      // rayon lumineux du socle vers l'hologramme déplacé
      const ecart = Math.hypot(f.decal.x, f.decal.z);
      f.lien.visible = ecart > 0.05;
      if (f.lien.visible) {
        const de = new THREE.Vector3(0, 0.13, 0), vers = new THREE.Vector3(f.decal.x, 0.45, f.decal.z);
        const v = vers.clone().sub(de);
        f.lien.position.copy(de).addScaledVector(v, 0.5);
        f.lien.scale.set(1, v.length(), 1);
        f.lien.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
        f.lien.material.opacity = Math.min(0.6, ecart);
      }
      f.pivot.rotation.y = Math.atan2(this.camera.position.x - (g.x + f.decal.x), this.camera.position.z - (g.z + f.decal.z));
      f.pivot.position.y = 0.72 + Math.sin(temps * 1.4 + f.phase) * 0.035;
      f.anneau.rotation.z = temps * 0.8 + f.phase;
      f.embleme.position.y = 1.36 + Math.sin(temps * 2 + f.phase) * 0.05;
      f.embleme.material.rotation = Math.sin(temps * 0.9 + f.phase) * 0.25;
      f.matScan.map.offset.y = -temps * 0.12;
      // léger scintillement d'hologramme (plus nerveux quand le Complice est perdu)
      if (f.statut === 'actif') f.matBuste.opacity = 0.86 + Math.sin(temps * 13 + f.phase) * 0.04 + (Math.random() < 0.01 ? -0.4 : 0);
      else if (f.statut === 'perdu') f.matBuste.opacity = Math.random() < 0.04 ? 0.25 : 0.82;
    }
  }
}

NV_etendre(Plateau3D, Complices3D);
