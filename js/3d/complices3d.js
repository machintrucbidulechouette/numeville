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
      const matBuste = new THREE.MeshBasicMaterial({ map: tex.actif, transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
      const buste = new THREE.Mesh(new THREE.PlaneGeometry(1.12, 0.84), matBuste);
      buste.renderOrder = 2;
      const matScan = new THREE.MeshBasicMaterial({ map: scan, color: c.couleurClaire, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const balayage = new THREE.Mesh(new THREE.PlaneGeometry(1.12, 0.84), matScan);
      balayage.position.z = 0.002; balayage.renderOrder = 3;
      pivot.add(buste, balayage);
      groupe.add(pivot);

      const embleme = new THREE.Sprite(new THREE.SpriteMaterial({ map: this._embleme(id, c.couleur), transparent: true }));
      embleme.scale.setScalar(0.34);
      embleme.position.y = 1.36;
      groupe.add(embleme);

      this.scene.add(groupe);
      this.figures[id] = { groupe, pivot, buste, matBuste, matScan, anneau, faisceau, embleme, tex, statut: 'actif', phase: i * 1.7 };
    });
  }

  /** Position (au niveau du buste) d'un Complice 3D : utile pour cadrer les cinématiques. */
  posFigure(id, hauteur = 0.72) {
    const f = this.figures && this.figures[id];
    return f ? f.groupe.position.clone().setY(this.HAUT + hauteur) : this.posCase(0);
  }

  /** Transformation du Complice : le buste « grésille » puis change d'apparence. */
  _majFigure(id, statut) {
    const f = this.figures && this.figures[id];
    if (!f || f.statut === statut) return;
    f.statut = statut;
    const c = NV.COMPLICES[id];
    // la transformation démarre quand la caméra arrive (cinématique d'environ 1,2 s)
    setTimeout(() => {
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

  _animerFigures(temps) {
    if (!this.figures) return;
    for (const f of Object.values(this.figures)) {
      const g = f.groupe.position;
      f.pivot.rotation.y = Math.atan2(this.camera.position.x - g.x, this.camera.position.z - g.z);
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
